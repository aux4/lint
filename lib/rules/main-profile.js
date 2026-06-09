import { findKeyLine } from "../json-positions.js";

export function validateMainProfile(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const hasMain = parsed.profiles.some(p => p.name === "main");
  if (!hasMain) {
    const isExtension = parsed.profiles.some(p => p.name && p.name.includes(":"));
    if (!isExtension) {
      issues.push({
        rule: "main-profile",
        severity: "error",
        message: "Missing required 'main' profile",
        file: filePath,
        line: findKeyLine(ctx.source, "profiles")
      });
    }
  }

  return issues;
}
