import { findCommandLine } from "../json-positions.js";
import { extractProfileReferences } from "../profiles.js";

/**
 * Validates that profile:X references follow the naming convention:
 * - Command in "main" profile → profile:commandName
 * - Command in profile "foo" → profile:foo:commandName
 * - Command in profile "foo:bar" → profile:foo:bar:commandName
 */
export function validateProfileNaming(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.name) continue;
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.name) continue;
      if (!command.execute || !Array.isArray(command.execute)) continue;

      for (const instruction of command.execute) {
        const refs = extractProfileReferences(instruction);
        if (refs.length === 0) continue;

        const expectedProfile = profile.name === "main"
          ? command.name
          : `${profile.name}:${command.name}`;

        for (const targetProfile of refs) {
          if (targetProfile !== expectedProfile) {
            issues.push({
              rule: "profile-naming",
              severity: "warning",
              message: `Command '${command.name}' in profile '${profile.name}' routes to 'profile:${targetProfile}' but convention expects 'profile:${expectedProfile}'`,
              file: filePath,
              line: findCommandLine(ctx.source, profile.name, command.name)
            });
          }
        }
      }
    }
  }

  return issues;
}
