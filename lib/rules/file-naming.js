import fs from "fs";
import path from "path";
import { extractProfileReferences } from "../profiles.js";

export function validateFileNaming(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  const dir = path.dirname(filePath);
  const manDir = path.join(dir, "man");
  const testDir = path.join(dir, "test");

  // Build expected filenames from command definitions
  const expectedNames = buildExpectedNames(parsed);

  // Validate man/ files
  if (fs.existsSync(manDir)) {
    const manFiles = listFiles(manDir, ".md");
    for (const file of manFiles) {
      const basename = path.basename(file, ".md");
      issues.push(...validateFilename(basename, file, "man", expectedNames, filePath));
    }
  }

  // Validate test/ files
  if (fs.existsSync(testDir)) {
    const testFiles = listFiles(testDir, ".test.md");
    for (const file of testFiles) {
      const basename = path.basename(file, ".test.md");
      issues.push(...validateFilename(basename, file, "test", expectedNames, filePath));
    }
  }

  return issues;
}

/**
 * Build a set of expected file base names from profiles and commands.
 *
 * Rules:
 * - The top-level command name is the root (e.g., "lint")
 * - Subcommands use __ to separate levels (e.g., "lint__run")
 * - Special chars in profile names (like :) are replaced with _ (e.g., "aux4:pkger" -> "aux4_pkger")
 */
function buildExpectedNames(parsed) {
  const names = new Set();
  const commandPaths = [];

  // Collect all command paths by traversing the profile tree
  for (const profile of parsed.profiles) {
    // A colon-named profile (e.g. 'ai:skill') may have an entry/index man page
    // named after the profile itself with ':' replaced by '_' (e.g. 'ai_skill').
    if (profile.name && profile.name.includes(":")) {
      names.add(profile.name.replace(/:/g, "_"));
    }

    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.name) continue;

      // Find the path to this command from the root
      const paths = resolveCommandPaths(parsed, profile.name, command.name);
      for (const p of paths) {
        const filename = pathToFilename(p);
        names.add(filename);
        commandPaths.push({ path: p, filename });
      }
    }
  }

  return names;
}

/**
 * Resolve the full command path(s) for a command.
 * Returns arrays of command name segments from root to leaf.
 */
function resolveCommandPaths(parsed, profileName, commandName) {
  const paths = [];

  if (profileName === "main") {
    // Direct command on main profile
    paths.push([commandName]);
  } else {
    // Find which command routes to this profile via profile:profileName
    const parentPaths = findParentPaths(parsed, profileName);
    for (const parentPath of parentPaths) {
      paths.push([...parentPath, commandName]);
    }

    // If no parent found (extension package), use the profile name as prefix
    if (parentPaths.length === 0) {
      const profileParts = profileName.split(":").map(p => p);
      paths.push([...profileParts, commandName]);
    }
  }

  return paths;
}

function findParentPaths(parsed, targetProfile, visited = new Set()) {
  if (visited.has(targetProfile)) return [];
  visited.add(targetProfile);

  const results = [];

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      for (const instruction of command.execute) {
        const refs = extractProfileReferences(instruction);
        if (refs.includes(targetProfile)) {
          if (profile.name === "main") {
            results.push([command.name]);
          } else {
            const parentPaths = findParentPaths(parsed, profile.name, visited);
            for (const pp of parentPaths) {
              results.push([...pp, command.name]);
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Convert a command path to the expected filename.
 * - Special chars (like :) become _ (single underscore)
 * - Path separators become __ (double underscore)
 */
function pathToFilename(segments) {
  return segments
    .map(s => s.replace(/[^a-zA-Z0-9-]/g, "_"))
    .join("__");
}

function validateFilename(basename, fullPath, dirType, expectedNames, aux4FilePath) {
  const issues = [];

  // Check for single underscore where double underscore should be
  // A single _ between two word segments is suspicious if __ is the convention
  const singleUnderscorePattern = /(?<![_])_(?![_])/g;
  const doubleUnderscoreCount = (basename.match(/__/g) || []).length;
  const singleUnderscoreMatches = [];
  let match;

  // Reset and find single underscores
  const cleaned = basename.replace(/__/g, "\x00\x00");
  while ((match = singleUnderscorePattern.exec(cleaned)) !== null) {
    singleUnderscoreMatches.push(match.index);
  }

  // If there are single underscores but no double underscores, and the name
  // has multiple segments, it's likely using _ instead of __
  if (singleUnderscoreMatches.length > 0 && doubleUnderscoreCount === 0) {
    // Check if this looks like a hierarchy separator mistake
    // e.g., "config_get" should be "config__get"
    const parts = basename.split("_");
    if (parts.length >= 2) {
      const suggested = parts.join("__");
      // Only warn when this name isn't itself a legitimate expected name (e.g. a
      // colon-profile entry page like 'ai_skill') AND the double-underscore form
      // IS an expected command hierarchy (e.g. 'config_get' -> 'config__get').
      if (!expectedNames.has(basename) && expectedNames.has(suggested)) {
        issues.push({
          rule: "file-naming",
          severity: "error",
          message: `${dirType}/ file '${path.basename(fullPath)}' uses single underscore — use double underscore '__' to separate command hierarchy (e.g., '${suggested}')`,
          file: aux4FilePath
        });
      }
    }
  }

  return issues;
}

function listFiles(dir, suffix) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(suffix)) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch (e) {
    // Skip if we can't read
  }
  return files;
}
