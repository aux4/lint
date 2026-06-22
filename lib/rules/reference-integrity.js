import { findCommandLine } from "../json-positions.js";
import { BUILTIN_VARIABLES, ENCRYPTED_PREFIX, VAR_REF, SET_VAR } from "../patterns.js";
import { getDeclaredRoots, rootSegment, referenceRoot, commandUsesConfig } from "../variables.js";
import { extractProfileReferences } from "../profiles.js";

export function validateReferenceIntegrity(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const profileNames = new Set(parsed.profiles.map(p => p.name));

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      const declaredRoots = getDeclaredRoots(command);
      const usesConfig = commandUsesConfig(command);
      const line = findCommandLine(ctx.source, profile.name, command.name);

      for (const instruction of command.execute) {
        const setMatch = instruction.match(SET_VAR);
        if (setMatch) {
          declaredRoots.add(setMatch[1]);
          declaredRoots.add(rootSegment(setMatch[1]));
        }

        validateProfileReferences(instruction, profileNames, profile.name, command.name, filePath, line, issues);
        if (!usesConfig) {
          validateVariableReferences(instruction, declaredRoots, profile.name, command.name, filePath, line, issues);
          validateConditionVariables(instruction, declaredRoots, profile.name, command.name, filePath, line, issues);
        }
      }
    }
  }

  return issues;
}

function validateProfileReferences(instruction, profileNames, profileName, commandName, filePath, line, issues) {
  const refs = extractProfileReferences(instruction);

  for (const referencedProfile of refs) {
    if (!profileNames.has(referencedProfile)) {
      const isLikelyCrossPackage = referencedProfile.includes(":") &&
        profileNames.has(referencedProfile.split(":").slice(0, -1).join(":"));

      issues.push({
        rule: "profile-reference",
        severity: isLikelyCrossPackage ? "warning" : "error",
        message: `Command '${commandName}' in profile '${profileName}' references non-existent profile '${referencedProfile}'` +
          (isLikelyCrossPackage ? " (may be provided by another package)" : ""),
        file: filePath,
        line
      });
    }
  }
}

function validateConditionVariables(instruction, declaredRoots, profileName, commandName, filePath, line, issues) {
  const match = instruction.match(/^if\((!?)([a-zA-Z_][a-zA-Z0-9_.]*)/);
  if (!match) return;

  const varName = match[2];
  const rootVar = rootSegment(varName);

  if (BUILTIN_VARIABLES.has(rootVar)) return;
  if (declaredRoots.has(rootVar)) return;

  issues.push({
    rule: "condition-variable",
    severity: "warning",
    message: `Command '${commandName}' in profile '${profileName}' uses '${rootVar}' in if() condition but it is not declared`,
    file: filePath,
    line
  });
}

function validateVariableReferences(instruction, declaredRoots, profileName, commandName, filePath, line, issues) {
  if (instruction.startsWith("set:")) return;
  if (instruction.startsWith("#")) return;

  VAR_REF.lastIndex = 0;
  let match;

  while ((match = VAR_REF.exec(instruction)) !== null) {
    const varRef = match[1];
    const rootVar = referenceRoot(varRef);

    // Not a plain aux4 path (e.g. shell expansion like ${var:-default}) — skip.
    if (rootVar === null) continue;
    if (BUILTIN_VARIABLES.has(rootVar)) continue;
    if (declaredRoots.has(rootVar)) continue;
    if (ENCRYPTED_PREFIX.test(rootVar)) continue;

    issues.push({
      rule: "variable-reference",
      severity: "warning",
      message: `Command '${commandName}' in profile '${profileName}' references undeclared variable '${rootVar}'`,
      file: filePath,
      line
    });
  }
}
