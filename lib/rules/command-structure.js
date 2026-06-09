import { findProfileLine, findCommandLine } from "../json-positions.js";

export function validateCommandStructure(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.name) {
      issues.push({
        rule: "profile-name",
        severity: "error",
        message: "Profile missing 'name' field",
        file: filePath
      });
      continue;
    }

    if (!profile.commands || !Array.isArray(profile.commands)) {
      issues.push({
        rule: "profile-commands",
        severity: "error",
        message: `Profile '${profile.name}' missing or invalid 'commands' array`,
        file: filePath,
        line: findProfileLine(ctx.source, profile.name)
      });
      continue;
    }

    for (const command of profile.commands) {
      if (!command.name) {
        issues.push({
          rule: "command-name",
          severity: "error",
          message: `Command in profile '${profile.name}' missing 'name' field`,
          file: filePath,
          line: findProfileLine(ctx.source, profile.name)
        });
      }

      if (!command.execute || !Array.isArray(command.execute)) {
        issues.push({
          rule: "command-execute",
          severity: "error",
          message: `Command '${command.name || "<unnamed>"}' in profile '${profile.name}' missing or invalid 'execute' array`,
          file: filePath,
          line: findCommandLine(ctx.source, profile.name, command.name || "")
        });
      }
    }
  }

  return issues;
}
