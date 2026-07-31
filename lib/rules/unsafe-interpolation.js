import { findCommandLine } from "../json-positions.js";
import { getDeclaredRoots, rootSegment, commandUsesConfig } from "../variables.js";

/**
 * Flags raw single-quote interpolation of a variable inside an execute step.
 *
 * Everything in an execute step is textually substituted into ONE string that
 * aux4 core runs via `sh -c` (engine/param/inject.go). The parameter functions
 * value()/param()/values()/params() single-quote-escape their output
 * (escapeValue, inject.go:838 — every `'` becomes `'\''`), so an untrusted /
 * model-derived value is inert. But a bare `'${var}'` / `'$var'` is substituted
 * WITHOUT escaping (inject.go:707): a value containing a single quote breaks out
 * of the quotes and injects arbitrary shell (or prompt) content.
 *
 * Two patterns are detected — a SINGLE variable wrapped in literal single quotes,
 * where the quoted content is EXACTLY one variable reference and nothing else:
 *
 *   1. flag-adjacent   `--flag '${var}'`  -> suggest param(var[:flag])
 *   2. standalone      `'${var}'`         -> suggest value(var)
 *
 * Consecutive occurrences within a single execute instruction (strictly adjacent,
 * only whitespace between them) collapse into the aggregate function form, which
 * emits the exact same shell shape (verified against engine/param/inject.go):
 *
 *   - `'${a}' '${b}' '${c}'`                 -> values(a,b,c)   (emits 'a' 'b' 'c')
 *   - `--a '${a}' --b '${b}' --c '${c}'`     -> params(a,b,c)   (emits --a 'a' ...)
 *
 * params() has allowAlias=false, so it only produces `--<standardizedName>`: a run
 * of flag pairs aggregates ONLY when every flag equals its variable's standardized
 * name. A pair whose flag differs (e.g. `--x '${a}'`) stays an individual
 * param(a:x) and breaks the run; the runs on either side aggregate independently.
 */

// A prefix (optional) then a quoted single-var. The prefix is either a `--flag`
// or a shell env-assignment `NAME=` (as in `set:x=!TITLE='${title}' jq …`, where
// a `'` in the value breaks out of the quotes just the same). The quotes must
// wrap exactly one reference; composite strings are handled by COMPOSITE below.
// Token boundary on both sides — start / whitespace / `!` / `;` / `(` before,
// whitespace / end after — so `!NAME=` at the head of a `set:x=!…` step matches.
const UNSAFE_INTERPOLATION =
  /(?<=^|\s|!|;|\()(?:(--[A-Za-z0-9][\w.-]*)\s+|([A-Za-z_]\w*)=)?'(?:\$\{([^}]+)\}|\$([A-Za-z_]\w*))'(?=\s|$)/g;

// A single-quoted segment (optionally flag/env-prefixed) whose content is NOT a
// lone variable but DOES contain at least one `${var}` / `$var`. This catches the
// composite case the single-var matcher deliberately skips — most importantly an
// inlined URL like `--url '${apiUrl}/files/${id}'`, where a `'` in `id` breaks out.
// The fix is never a single function swap: build the string with `set:` (no shell
// runs at a set: step) then pass it through `value()`.
const COMPOSITE =
  /(?<=^|\s|!|;|\()(?:(--[A-Za-z0-9][\w.-]*)\s+|([A-Za-z_]\w*)=)?'([^']*)'(?=\s|$)/g;
const VAR_REF = /\$\{([^}]+)\}|\$([A-Za-z_]\w*)/g;
const LONE_VAR = /^(?:\$\{[^}]+\}|\$[A-Za-z_]\w*)$/;

// Simple aux4 path only: root plus optional `.field` / `[index]`. Anything with
// a shell expansion operator (`:`, `#`, `/`, `-`, ...) is rejected, so defaults
// like ${var:-x}, ${var:=x}, ${#var}, ${var//a/b} are skipped.
const SIMPLE_PATH = /^[A-Za-z_][\w.[\]]*$/;

// Trusted builtins that are never injection sinks — skip them. `index` is
// numeric; the each: loop builtins are skipped to keep noise low. `response` is
// the one untrusted builtin (previous command output) and IS flagged.
const TRUSTED_BUILTINS = new Set([
  "packageDir",
  "aux4HomeDir",
  "configDir",
  "item",
  "index",
  "value",
  "key"
]);

/**
 * Mirror aux4 core's standardizeParameterName (engine/param/arg.go): dot-notation
 * names collapse to camelCase (`person.firstName` -> `personFirstName`); array
 * indices are dropped.
 */
function standardizeParameterName(name) {
  const segments = name.replace(/\[\d+\]/g, "").split(".");
  return segments[0] + segments.slice(1).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

export function validateUnsafeInterpolation(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const strict = ctx && ctx.strict;
  const severity = strict ? "error" : "warning";

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;
      if (commandUsesConfig(command)) continue;

      const declaredRoots = getDeclaredRoots(command);
      const line = findCommandLine(ctx.source, profile.name, command.name);
      const reported = new Set();

      for (const instruction of command.execute) {
        if (instruction.startsWith("#")) continue;

        // 1) Collect every guard-passing unsafe occurrence, in order, with its
        //    position in the instruction so adjacency can be measured later.
        const occurrences = [];
        UNSAFE_INTERPOLATION.lastIndex = 0;
        let match;

        while ((match = UNSAFE_INTERPOLATION.exec(instruction)) !== null) {
          const flag = match[1];
          const envName = match[2];
          const varName = match[3] !== undefined ? match[3] : match[4];

          // Only a simple aux4 path — reject shell expansions entirely.
          if (!SIMPLE_PATH.test(varName)) continue;

          const root = rootSegment(varName);
          if (TRUSTED_BUILTINS.has(root)) continue;

          // Only flag untrusted sinks: a declared variable root or `response`.
          if (root !== "response" && !declaredRoots.has(root)) continue;

          let category;
          let flagName = null;
          if (flag) {
            flagName = flag.slice(2);
            // params() emits `--<standardizedName>` only (allowAlias=false), so a
            // flag pair can join a params() run ONLY when the flag equals the
            // variable's standardized name. A mismatch stays an individual
            // param(var:flag) and breaks any surrounding run.
            category = standardizeParameterName(varName) === flagName
              ? "param-match"
              : "param-mismatch";
          } else if (envName) {
            // Shell env-assignment prefix `NAME='${var}'` (e.g. before a jq call).
            category = "env";
          } else {
            category = "standalone";
          }

          occurrences.push({
            flag,
            flagName,
            envName,
            varName,
            category,
            start: match.index,
            end: match.index + match[0].length
          });
        }

        // 2) Group STRICTLY ADJACENT occurrences (only whitespace between them)
        //    of the same aggregatable category. A `param-mismatch`, or any
        //    non-whitespace text between two candidates, breaks the run.
        const groups = [];
        let prevEnd = -1;
        for (const occ of occurrences) {
          const aggregatable = occ.category === "standalone" || occ.category === "param-match";
          const adjacent = prevEnd >= 0 && /^\s*$/.test(instruction.slice(prevEnd, occ.start));
          const last = groups[groups.length - 1];

          if (last && adjacent && aggregatable && last.aggregatable && last.category === occ.category) {
            last.items.push(occ);
          } else {
            groups.push({ category: occ.category, aggregatable, items: [occ] });
          }
          prevEnd = occ.end;
        }

        // 3) Emit one issue per group — an aggregate (values()/params()) for a
        //    run of >=2, otherwise the singular value()/param() suggestion.
        for (const group of groups) {
          const items = group.items;

          if (group.category === "standalone") {
            if (items.length >= 2) {
              const vars = items.map(o => o.varName);
              const raw = items.map(o => `'\${${o.varName}}'`).join(" ");
              const key = `unsafe-value-interpolation:${command.name}:${vars.join(",")}`;
              if (reported.has(key)) continue;
              reported.add(key);

              issues.push({
                rule: "unsafe-value-interpolation",
                severity,
                message: `Command '${command.name}' in profile '${profile.name}' passes ${raw} with raw interpolation; use values(${vars.join(",")}) to shell-escape the values (avoids injection)`,
                file: filePath,
                line
              });
            } else {
              const o = items[0];
              const key = `unsafe-value-interpolation:${command.name}:${o.varName}`;
              if (reported.has(key)) continue;
              reported.add(key);

              issues.push({
                rule: "unsafe-value-interpolation",
                severity,
                message: `Command '${command.name}' in profile '${profile.name}' passes '\${${o.varName}}' with raw interpolation; use value(${o.varName}) to shell-escape the value (avoids injection)`,
                file: filePath,
                line
              });
            }
          } else if (group.category === "param-match" && items.length >= 2) {
            const vars = items.map(o => o.varName);
            const raw = items.map(o => `${o.flag} '\${${o.varName}}'`).join(" ");
            const key = `unsafe-param-interpolation:${command.name}:${items.map(o => o.varName + ":" + o.flagName).join(",")}`;
            if (reported.has(key)) continue;
            reported.add(key);

            issues.push({
              rule: "unsafe-param-interpolation",
              severity,
              message: `Command '${command.name}' in profile '${profile.name}' passes ${raw} with raw interpolation; use params(${vars.join(",")}) to shell-escape the values (avoids injection)`,
              file: filePath,
              line
            });
          } else if (group.category === "env") {
            // Shell env-assignment `NAME='${var}'` — a `'` in the value breaks out.
            const o = items[0];
            const key = `unsafe-env-interpolation:${command.name}:${o.envName}:${o.varName}`;
            if (reported.has(key)) continue;
            reported.add(key);

            issues.push({
              rule: "unsafe-env-interpolation",
              severity,
              message: `Command '${command.name}' in profile '${profile.name}' sets ${o.envName}='\${${o.varName}}' with raw interpolation; use ${o.envName}=value(${o.varName}) to shell-escape the value (avoids injection)`,
              file: filePath,
              line
            });
          } else {
            // Single flag pair — matched (param(var)) or mismatched (param(var:flag)).
            const o = items[0];
            const key = `unsafe-param-interpolation:${command.name}:${o.varName}:${o.flagName}`;
            if (reported.has(key)) continue;
            reported.add(key);

            const fix = o.category === "param-match"
              ? `param(${o.varName})`
              : `param(${o.varName}:${o.flagName})`;

            issues.push({
              rule: "unsafe-param-interpolation",
              severity,
              message: `Command '${command.name}' in profile '${profile.name}' passes ${o.flag} '\${${o.varName}}' with raw interpolation; use ${fix} to shell-escape the value (avoids injection)`,
              file: filePath,
              line
            });
          }
        }

        // 4) Composite pass — a single-quoted segment that is NOT a lone variable
        //    but interpolates one, e.g. `--url '${apiUrl}/files/${id}'`. No single
        //    function swap fixes these; suggest set: then value().
        COMPOSITE.lastIndex = 0;
        let cmatch;
        while ((cmatch = COMPOSITE.exec(instruction)) !== null) {
          const flag = cmatch[1];
          const envName = cmatch[2];
          const content = cmatch[3];

          // Lone-variable segments are owned by the single-var matcher above.
          if (LONE_VAR.test(content.trim())) continue;

          const vars = [];
          VAR_REF.lastIndex = 0;
          let vm;
          while ((vm = VAR_REF.exec(content)) !== null) {
            const v = vm[1] !== undefined ? vm[1] : vm[2];
            if (!SIMPLE_PATH.test(v)) continue;
            const r = rootSegment(v);
            if (TRUSTED_BUILTINS.has(r)) continue;
            if (r !== "response" && !declaredRoots.has(r)) continue;
            if (!vars.includes(v)) vars.push(v);
          }
          if (vars.length === 0) continue;

          const key = `unsafe-composite-interpolation:${command.name}:${content}`;
          if (reported.has(key)) continue;
          reported.add(key);

          const shown = content.length > 48 ? content.slice(0, 48) + "…" : content;
          const where = flag ? `${flag} '${shown}'` : envName ? `${envName}='${shown}'` : `'${shown}'`;
          issues.push({
            rule: "unsafe-composite-interpolation",
            severity,
            message: `Command '${command.name}' in profile '${profile.name}' interpolates ${vars.map(v => "${" + v + "}").join(", ")} inside a composite quoted value (${where}); build it with set: then pass through value() (e.g. set:url=… then --url value(url)) to shell-escape (avoids injection)`,
            file: filePath,
            line
          });
        }
      }
    }
  }

  return issues;
}
