import { findCommandLine } from "../json-positions.js";

export function validateDescriptions(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  if (parsed.scope && parsed.name) {
    if (!parsed.description) {
      issues.push({
        rule: "missing-description",
        severity: "warning",
        message: "Package metadata missing 'description' field",
        file: filePath,
        line: 1
      });
    }
  }

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (command.private) continue;

      const line = findCommandLine(ctx.source, profile.name, command.name || "");

      if (!command.help) {
        issues.push({
          rule: "missing-help",
          severity: "warning",
          message: `Command '${command.name || "<unnamed>"}' in profile '${profile.name}' missing 'help' field`,
          file: filePath,
          line
        });
      } else if (!command.help.text) {
        issues.push({
          rule: "missing-help-text",
          severity: "warning",
          message: `Command '${command.name || "<unnamed>"}' in profile '${profile.name}' missing 'help.text' field`,
          file: filePath,
          line
        });
      }

      if (command.help && command.help.variables && Array.isArray(command.help.variables)) {
        for (const v of command.help.variables) {
          if (!v.text) {
            issues.push({
              rule: "missing-variable-text",
              severity: "warning",
              message: `Variable '${v.name || "<unnamed>"}' in command '${command.name}' missing 'text' field`,
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
