import { findCommandLine } from "../json-positions.js";

const BOOLEAN_FIELDS = ["arg", "multiple", "hide", "encrypt"];

export function validateVariableProperties(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const hasDependencies = parsed.dependencies && Array.isArray(parsed.dependencies);
  const hasEncryptDep = hasDependencies && parsed.dependencies.some(
    d => typeof d === "string" && (d === "aux4/encrypter" || d.startsWith("aux4/encrypter@"))
  );

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      const line = findCommandLine(ctx.source, profile.name, command.name || "");

      // Validate private field type
      if (command.private !== undefined && typeof command.private !== "boolean") {
        issues.push({
          rule: "command-private",
          severity: "error",
          message: `Command '${command.name}' in profile '${profile.name}' has 'private' field that is not a boolean`,
          file: filePath,
          line
        });
      }

      if (!command.help || !command.help.variables || !Array.isArray(command.help.variables)) continue;

      let argCount = 0;

      for (const v of command.help.variables) {
        const varName = v.name || "<unnamed>";

        // Validate boolean fields
        for (const field of BOOLEAN_FIELDS) {
          if (v[field] !== undefined && typeof v[field] !== "boolean") {
            issues.push({
              rule: "variable-type",
              severity: "error",
              message: `Variable '${varName}' in command '${command.name}' has '${field}' that is not a boolean`,
              file: filePath,
              line
            });
          }
        }

        // Validate options is array of strings
        if (v.options !== undefined) {
          if (!Array.isArray(v.options)) {
            issues.push({
              rule: "variable-type",
              severity: "error",
              message: `Variable '${varName}' in command '${command.name}' has 'options' that is not an array`,
              file: filePath,
              line
            });
          } else {
            for (const opt of v.options) {
              if (typeof opt !== "string") {
                issues.push({
                  rule: "variable-type",
                  severity: "error",
                  message: `Variable '${varName}' in command '${command.name}' has non-string value in 'options'`,
                  file: filePath,
                  line
                });
                break;
              }
            }
          }
        }

        // Validate env is a string
        if (v.env !== undefined && typeof v.env !== "string") {
          issues.push({
            rule: "variable-type",
            severity: "error",
            message: `Variable '${varName}' in command '${command.name}' has 'env' that is not a string`,
            file: filePath,
            line
          });
        }

        // Validate default is a string
        if (v.default !== undefined && typeof v.default !== "string") {
          issues.push({
            rule: "variable-type",
            severity: "error",
            message: `Variable '${varName}' in command '${command.name}' has 'default' that is not a string`,
            file: filePath,
            line
          });
        }

        // Count arg: true
        if (v.arg === true) {
          argCount++;
        }

        // Check encrypt: true requires aux4/encrypter dependency
        if (v.encrypt === true && !hasEncryptDep) {
          issues.push({
            rule: "encrypt-dependency",
            severity: "warning",
            message: `Variable '${varName}' in command '${command.name}' uses 'encrypt: true' but 'aux4/encrypter' is not in dependencies`,
            file: filePath,
            line
          });
        }
      }

      // Check multiple arg: true
      if (argCount > 1) {
        issues.push({
          rule: "multiple-args",
          severity: "warning",
          message: `Command '${command.name}' in profile '${profile.name}' has ${argCount} positional arguments (arg: true) — only the last positional argument is used`,
          file: filePath,
          line
        });
      }
    }
  }

  return issues;
}
