import { findCommandLine } from "../json-positions.js";
import { VALUES_FN, PARAMS_FN, OBJECT_FN, MULTI_SUFFIX } from "../patterns.js";
import { getDeclaredVariables, commandUsesConfig } from "../variables.js";

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

      const declaredVars = getDeclaredVariables(command);
      const line = findCommandLine(ctx.source, profile.name, command.name);
      const reported = new Set();

      for (const instruction of command.execute) {
        if (instruction.startsWith("#")) continue;

        // value() / values() — supports *
        validateFnArgs(instruction, VALUES_FN, declaredVars, true, profile.name, command.name, filePath, line, reported, issues);

        // param() / params() — supports :alias and ** suffixes, no *
        validateFnArgs(instruction, PARAMS_FN, declaredVars, false, profile.name, command.name, filePath, line, reported, issues);

        // object() — no *
        validateFnArgs(instruction, OBJECT_FN, declaredVars, false, profile.name, command.name, filePath, line, reported, issues);
      }
    }
  }

  return issues;
}

function validateFnArgs(instruction, pattern, declaredVars, allowStar, profileName, commandName, filePath, line, reported, issues) {
  pattern.lastIndex = 0;
  let match;

  while ((match = pattern.exec(instruction)) !== null) {
    const fnName = match[1];
    const argsStr = match[2].trim();

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

      // Handle * wildcard — only valid in value()/values()
      if (arg === "*") {
        if (!allowStar) {
          const key = `${commandName}:${fnName}:star`;
          if (!reported.has(key)) {
            reported.add(key);
            issues.push({
              rule: "param-function",
              severity: "warning",
              message: `Command '${commandName}' in profile '${profileName}' uses '*' in ${fnName}() — '*' is only supported in value() and values()`,
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

      // Handle param(name:alias) — strip alias for variable check
      if (fnName === "param" || fnName === "params") {
        arg = arg.split(":")[0];
      }

      // Skip literals and complex expressions
      if (arg.includes('"') || arg.includes("'") || arg.includes("{")) continue;

      // Strip dot notation for root variable check
      const rootVar = arg.split(".")[0];

      if (!declaredVars.has(rootVar)) {
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
