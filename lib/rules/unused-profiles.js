import { findProfileLine } from "../json-positions.js";
import { collectReferencedProfiles } from "../profiles.js";

export function validateUnusedProfiles(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const profileNames = new Set(parsed.profiles.map(p => p.name));
  const referencedProfiles = collectReferencedProfiles(parsed);

  // "main" is always referenced (entry point)
  referencedProfiles.add("main");

  // In extension packages (no main profile), the first profile is the
  // entry point provided by the parent package
  const hasMain = parsed.profiles.some(p => p.name === "main");
  if (!hasMain && parsed.profiles.length > 0) {
    referencedProfiles.add(parsed.profiles[0].name);
  }

  for (const name of profileNames) {
    if (!referencedProfiles.has(name)) {
      issues.push({
        rule: "unused-profile",
        severity: "warning",
        message: `Profile '${name}' is defined but never referenced`,
        file: filePath,
        line: findProfileLine(ctx.source, name)
      });
    }
  }

  return issues;
}
