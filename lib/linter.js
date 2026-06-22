import fs from "fs";
import path from "path";
import { validateJsonStructure } from "./rules/json-structure.js";
import { validateMainProfile } from "./rules/main-profile.js";
import { validateCommandStructure } from "./rules/command-structure.js";
import { validateReferenceIntegrity } from "./rules/reference-integrity.js";
import { validateNamingConventions } from "./rules/naming-conventions.js";
import { validateUnusedProfiles } from "./rules/unused-profiles.js";
import { validateDescriptions } from "./rules/descriptions.js";
import { validateExecutorPrefixes } from "./rules/executor-prefix.js";
import { validateMetadata } from "./rules/metadata.js";
import { validateFileNaming } from "./rules/file-naming.js";
import { validateParameterFunctions } from "./rules/parameter-functions.js";
import { validateVariableProperties } from "./rules/variable-properties.js";
import { validateResolvedCommands } from "./rules/resolve-commands.js";
import { validateDuplicates } from "./rules/duplicates.js";
import { validateCircularProfiles } from "./rules/circular-profiles.js";
import { validateEncryptedVariables } from "./rules/encrypted-variables.js";
import { validateProfileNaming } from "./rules/profile-naming.js";
import { validateHooks } from "./rules/hooks.js";

export async function lint(dir, options = {}) {
  const resolvedDir = path.resolve(dir);
  const aux4Files = findAux4Files(resolvedDir);

  if (aux4Files.length === 0) {
    return [{
      file: resolvedDir,
      issues: [{
        rule: "no-files",
        severity: "error",
        message: `No .aux4 files found in '${resolvedDir}'`,
        file: resolvedDir
      }]
    }];
  }

  const results = [];

  for (const filePath of aux4Files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const issues = [];

    const { parsed, issues: jsonIssues } = validateJsonStructure(content, filePath);
    issues.push(...jsonIssues);

    if (parsed) {
      const ctx = { source: content, filePath };
      issues.push(...validateMainProfile(parsed, filePath, ctx));
      issues.push(...validateCommandStructure(parsed, filePath, ctx));
      issues.push(...validateReferenceIntegrity(parsed, filePath, ctx));
      issues.push(...validateNamingConventions(parsed, filePath, ctx));
      issues.push(...validateUnusedProfiles(parsed, filePath, ctx));
      issues.push(...validateDescriptions(parsed, filePath, ctx));
      issues.push(...validateExecutorPrefixes(parsed, filePath, ctx));
      issues.push(...validateMetadata(parsed, filePath, options, ctx));
      issues.push(...validateFileNaming(parsed, filePath, ctx));
      issues.push(...validateParameterFunctions(parsed, filePath, ctx));
      issues.push(...validateVariableProperties(parsed, filePath, ctx));
      issues.push(...validateDuplicates(parsed, filePath, ctx));
      issues.push(...validateCircularProfiles(parsed, filePath, ctx));
      issues.push(...validateEncryptedVariables(parsed, filePath, ctx));
      issues.push(...validateProfileNaming(parsed, filePath, ctx));
      issues.push(...validateHooks(parsed, filePath, ctx));
      if (options.resolve) {
        issues.push(...validateResolvedCommands(parsed, filePath, ctx));
      }
    }

    results.push({ file: filePath, issues });
  }

  return results;
}

function findAux4Files(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...findAux4Files(fullPath));
      } else if (entry.name === ".aux4") {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }

  return files;
}
