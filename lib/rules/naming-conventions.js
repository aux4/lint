import { findProfileLine, findCommandLine } from "../json-positions.js";
import { CAMEL_CASE, CAMEL_CASE_VALID, UNDERSCORE, WHITESPACE } from "../patterns.js";

export function validateNamingConventions(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (profile.name && profile.name !== "main") {
      const nameParts = profile.name.split(":");
      for (const part of nameParts) {
        const line = findProfileLine(ctx.source, profile.name);
        if (WHITESPACE.test(part)) {
          issues.push({
            rule: "naming-profile",
            severity: "error",
            message: `Profile '${profile.name}' contains whitespace — use dashes instead`,
            file: filePath,
            line
          });
        } else if (CAMEL_CASE.test(part)) {
          issues.push({
            rule: "naming-profile",
            severity: "warning",
            message: `Profile '${profile.name}' uses camelCase — use dashes instead (e.g., '${toDashCase(part)}')`,
            file: filePath,
            line
          });
        } else if (UNDERSCORE.test(part)) {
          issues.push({
            rule: "naming-profile",
            severity: "warning",
            message: `Profile '${profile.name}' uses underscores — use dashes instead (e.g., '${part.replace(/_/g, "-")}')`,
            file: filePath,
            line
          });
        }
      }
    }

    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (command.name) {
        const line = findCommandLine(ctx.source, profile.name, command.name);
        if (WHITESPACE.test(command.name)) {
          issues.push({
            rule: "naming-command",
            severity: "error",
            message: `Command '${command.name}' in profile '${profile.name}' contains whitespace — use dashes instead`,
            file: filePath,
            line
          });
        } else if (CAMEL_CASE.test(command.name)) {
          issues.push({
            rule: "naming-command",
            severity: "warning",
            message: `Command '${command.name}' in profile '${profile.name}' uses camelCase — use dashes instead (e.g., '${toDashCase(command.name)}')`,
            file: filePath,
            line
          });
        } else if (UNDERSCORE.test(command.name)) {
          issues.push({
            rule: "naming-command",
            severity: "warning",
            message: `Command '${command.name}' in profile '${profile.name}' uses underscores — use dashes instead (e.g., '${command.name.replace(/_/g, "-")}')`,
            file: filePath,
            line
          });
        }
      }

      if (command.help && command.help.variables && Array.isArray(command.help.variables)) {
        for (const v of command.help.variables) {
          if (!v.name) continue;
          const line = findCommandLine(ctx.source, profile.name, command.name);

          if (WHITESPACE.test(v.name)) {
            issues.push({
              rule: "naming-variable",
              severity: "error",
              message: `Variable '${v.name}' in command '${command.name}' contains whitespace — use camelCase instead`,
              file: filePath,
              line
            });
          } else if (!isValidVariableName(v.name)) {
            // Variable names may use dot notation to build nested objects
            // (e.g. 'setting.timezone' -> { setting: { timezone } }); each
            // dot-separated segment must be camelCase.
            const suggested = v.name.split(".").map(toCamelCaseFromAny).join(".");
            issues.push({
              rule: "naming-variable",
              severity: "warning",
              message: `Variable '${v.name}' in command '${command.name}' is not camelCase — use '${suggested}' instead`,
              file: filePath,
              line
            });
          }
        }
      }
    }
  }

  return issues;
}

function isValidVariableName(name) {
  return name.split(".").every(part => CAMEL_CASE_VALID.test(part));
}

function toDashCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function toCamelCaseFromAny(str) {
  if (/^[A-Z][a-zA-Z0-9]*$/.test(str) && !/_/.test(str) && !/-/.test(str)) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
  return str
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}
