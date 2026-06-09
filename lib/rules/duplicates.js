import { findProfileLine, findCommandLine } from "../json-positions.js";

export function validateDuplicates(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  // Check duplicate profile names
  const profileNames = new Map();
  for (const profile of parsed.profiles) {
    if (!profile.name) continue;

    if (profileNames.has(profile.name)) {
      issues.push({
        rule: "duplicate-profile",
        severity: "error",
        message: `Profile '${profile.name}' is defined more than once`,
        file: filePath,
        line: findProfileLine(ctx.source, profile.name)
      });
    } else {
      profileNames.set(profile.name, true);
    }
  }

  // Check duplicate command names within each profile and duplicate variable names
  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    const commandNames = new Map();
    for (const command of profile.commands) {
      if (!command.name) continue;

      if (commandNames.has(command.name)) {
        issues.push({
          rule: "duplicate-command",
          severity: "error",
          message: `Command '${command.name}' is defined more than once in profile '${profile.name}'`,
          file: filePath,
          line: findCommandLine(ctx.source, profile.name, command.name)
        });
      } else {
        commandNames.set(command.name, true);
      }

      // Check duplicate variable names
      if (command.help && command.help.variables && Array.isArray(command.help.variables)) {
        const varNames = new Map();
        for (const v of command.help.variables) {
          if (!v.name) continue;

          if (varNames.has(v.name)) {
            issues.push({
              rule: "duplicate-variable",
              severity: "error",
              message: `Variable '${v.name}' is defined more than once in command '${command.name}' of profile '${profile.name}'`,
              file: filePath,
              line: findCommandLine(ctx.source, profile.name, command.name)
            });
          } else {
            varNames.set(v.name, true);
          }
        }
      }
    }
  }

  return issues;
}
