import { findCommandLine } from "../json-positions.js";
import { ENCRYPTED_VAR, ENCRYPTED_FLAG } from "../patterns.js";
import { getDeclaredVariables } from "../variables.js";

export function validateEncryptedVariables(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      const varMap = getDeclaredVariables(command);
      const line = findCommandLine(ctx.source, profile.name, command.name);
      const reported = new Set();

      for (const instruction of command.execute) {
        if (instruction.startsWith("#")) continue;

        checkEncryptedRefs(instruction, ENCRYPTED_VAR, varMap, profile.name, command.name, filePath, line, reported, issues);
        checkEncryptedRefs(instruction, ENCRYPTED_FLAG, varMap, profile.name, command.name, filePath, line, reported, issues);
      }
    }
  }

  return issues;
}

function checkEncryptedRefs(instruction, pattern, varMap, profileName, commandName, filePath, line, reported, issues) {
  pattern.lastIndex = 0;
  let match;

  while ((match = pattern.exec(instruction)) !== null) {
    const suffix = match[1];
    const varName = suffix.charAt(0).toLowerCase() + suffix.slice(1);

    if (reported.has(varName)) continue;
    reported.add(varName);

    const varDef = varMap.get(varName);

    if (!varDef) {
      issues.push({
        rule: "encrypted-variable",
        severity: "warning",
        message: `Command '${commandName}' in profile '${profileName}' references 'encrypted${suffix}' but variable '${varName}' is not declared`,
        file: filePath,
        line
      });
    } else if (varDef.encrypt !== true) {
      issues.push({
        rule: "encrypted-variable",
        severity: "warning",
        message: `Command '${commandName}' in profile '${profileName}' references 'encrypted${suffix}' but variable '${varName}' does not have 'encrypt: true'`,
        file: filePath,
        line
      });
    }
  }
}
