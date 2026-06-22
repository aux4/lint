import { findCommandLine } from "../json-positions.js";
import { validateStep } from "../executor-steps.js";

export function validateExecutorPrefixes(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      const line = findCommandLine(ctx.source, profile.name, command.name);
      const subject = `Command '${command.name}' in profile '${profile.name}'`;

      for (const instruction of command.execute) {
        issues.push(...validateStep(instruction, { subject, filePath, line }));
      }
    }
  }

  return issues;
}
