import { findCommandLine } from "../json-positions.js";
import { VALUES_FN, PARAMS_FN, OBJECT_FN, MULTI_SUFFIX } from "../patterns.js";
import { getDeclaredVariables, getDeclaredRoots, commandUsesConfig } from "../variables.js";

/**
 * Per-function semantics, mirroring aux4 core (engine/param/inject.go):
 *
 *   value(path) / values(a, b)  -> resolveValueVariables / resolveValuesVariables
 *       No alias. `*` collects every parameter.
 *
 *   param(field)                -> parseParam(..., allowAlias = true)
 *       `field` may be `variable:alias`; the alias is only the emitted flag
 *       name, never a variable. The split is skipped when the field ends with
 *       `**` (multi-value expansion). `*` is NOT supported.
 *
 *   params(a, b)                -> parseParam(..., allowAlias = false)
 *       Aliases are NOT supported here — the whole field is the variable path.
 *
 *   object(a, b:key)            -> parseObject
 *       Every field is split on the FIRST `:`; the left side is the variable
 *       path and the right side is the output JSON key (an alias). `*` collects
 *       every parameter (`*` spreads, `*:key` nests). `**` is not supported.
 */
const FUNCTION_SEMANTICS = {
  value: { allowStar: true, allowAlias: false },
  values: { allowStar: true, allowAlias: false },
  param: { allowStar: false, allowAlias: true },
  params: { allowStar: false, allowAlias: false },
  object: { allowStar: true, allowAlias: true }
};

export function validateParameterFunctions(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;
      if (commandUsesConfig(command)) continue;

      // Includes help.variables AND every variable created by a `set:` earlier
      // in the same execute array — creating a variable with `set:` and then
      // using it in object()/param()/values() is valid aux4.
      const declaredVars = getDeclaredVariables(command);
      const declaredRoots = getDeclaredRoots(command);
      const line = findCommandLine(ctx.source, profile.name, command.name);
      const reported = new Set();

      for (const instruction of command.execute) {
        if (instruction.startsWith("#")) continue;

        // value() / values()
        validateFnArgs(instruction, VALUES_FN, declaredVars, declaredRoots, profile.name, command.name, filePath, line, reported, issues);

        // param() / params()
        validateFnArgs(instruction, PARAMS_FN, declaredVars, declaredRoots, profile.name, command.name, filePath, line, reported, issues);

        // object()
        validateFnArgs(instruction, OBJECT_FN, declaredVars, declaredRoots, profile.name, command.name, filePath, line, reported, issues);
      }
    }
  }

  return issues;
}

function validateFnArgs(instruction, pattern, declaredVars, declaredRoots, profileName, commandName, filePath, line, reported, issues) {
  pattern.lastIndex = 0;
  let match;

  while ((match = pattern.exec(instruction)) !== null) {
    const fnName = match[1];
    const argsStr = match[2].trim();
    const semantics = FUNCTION_SEMANTICS[fnName];
    if (!semantics) continue;

    if (argsStr.length === 0) {
      const key = `${commandName}:${fnName}:empty`;
      if (!reported.has(key)) {
        reported.add(key);
        issues.push({
          rule: "param-function",
          severity: "warning",
          message: `Command '${commandName}' in profile '${profileName}' has empty '${fnName}()' — expected variable names`,
          file: filePath,
          line
        });
      }
      continue;
    }

    const args = argsStr.split(",").map(a => a.trim());

    for (const rawArg of args) {
      if (!rawArg) continue;

      // Strip $ prefix — value($name) is the same as value(name)
      let arg = rawArg.replace(/^\$\{?/, "").replace(/\}$/, "");

      // Split `variable:alias` before anything else — the alias is an output
      // key/flag name, never a variable, so it is never validated.
      // param() skips the split when the field ends with `**` (core parity).
      if (semantics.allowAlias && arg.includes(":") && !arg.endsWith("**")) {
        arg = arg.split(":", 1)[0].trim();
      }

      // Handle * wildcard
      if (arg === "*") {
        if (!semantics.allowStar) {
          const key = `${commandName}:${fnName}:star`;
          if (!reported.has(key)) {
            reported.add(key);
            issues.push({
              rule: "param-function",
              severity: "warning",
              message: `Command '${commandName}' in profile '${profileName}' uses '*' in ${fnName}() — '*' is only supported in value(), values() and object()`,
              file: filePath,
              line
            });
          }
        }
        continue;
      }

      // Check for trailing * or ** (multi-value expansion)
      const hasMultipleSuffix = MULTI_SUFFIX.test(arg);
      arg = arg.replace(MULTI_SUFFIX, "");

      // Skip literals and complex expressions
      if (arg.includes('"') || arg.includes("'") || arg.includes("{")) continue;

      // Strip dot notation / array indexing for root variable check
      const rootVar = arg.split(/[.[]/)[0];
      if (!rootVar) continue;

      if (!declaredRoots.has(rootVar)) {
        const key = `${commandName}:${fnName}:${rootVar}`;
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            rule: "param-function",
            severity: "warning",
            message: `Command '${commandName}' in profile '${profileName}' uses '${rootVar}' in ${fnName}() but it is not declared in help.variables`,
            file: filePath,
            line
          });
        }
      } else if (hasMultipleSuffix) {
        const varDef = declaredVars.get(rootVar);
        if (varDef && varDef.multiple !== true) {
          const key = `${commandName}:${fnName}:${rootVar}:multiple`;
          if (!reported.has(key)) {
            reported.add(key);
            issues.push({
              rule: "param-multiple",
              severity: "warning",
              message: `Command '${commandName}' in profile '${profileName}' uses '${rootVar}*' in ${fnName}() but '${rootVar}' does not have 'multiple: true'`,
              file: filePath,
              line
            });
          }
        }
      }
    }
  }
}
