/**
 * Scans JSON source text to find line/column positions of keys and values.
 * Works alongside JSON.parse() — we parse for structure, scan for positions.
 */

export function findPositions(source) {
  const positions = {};
  const lines = source.split("\n");

  // Build line offset index for fast line:col lookup
  const lineOffsets = [0];
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
  }

  function offsetToLineCol(offset) {
    let line = 1;
    for (let i = 1; i < lineOffsets.length; i++) {
      if (offset < lineOffsets[i]) {
        line = i;
        break;
      }
    }
    return { line, col: offset - lineOffsets[line - 1] + 1 };
  }

  // Find profiles array position
  const profilesMatch = source.match(/"profiles"\s*:\s*\[/);
  if (profilesMatch) {
    positions.profiles = offsetToLineCol(profilesMatch.index);
  }

  // Find each profile by scanning for "name": "profileName" inside profiles
  const profileNamePattern = /"name"\s*:\s*"([^"]+)"/g;
  let match;
  const profilePositions = [];

  while ((match = profileNamePattern.exec(source)) !== null) {
    profilePositions.push({
      name: match[1],
      offset: match.index,
      pos: offsetToLineCol(match.index)
    });
  }

  positions.profileNames = profilePositions;

  return { positions, offsetToLineCol, source };
}

/**
 * Find the line number of a specific key path in JSON source.
 * path examples: "scope", "version", "profiles[0].commands[1].name"
 */
export function findKeyLine(source, key) {
  const pattern = new RegExp(`"${escapeRegex(key)}"\\s*:`);
  const match = source.match(pattern);
  if (!match) return null;

  const lines = source.substring(0, match.index).split("\n");
  return lines.length;
}

/**
 * Find the line of a profile by name.
 */
export function findProfileLine(source, profileName) {
  // Look for "name": "profileName" that appears inside a profile object
  const pattern = new RegExp(`"name"\\s*:\\s*"${escapeRegex(profileName)}"`);
  const match = source.match(pattern);
  if (!match) return null;

  const lines = source.substring(0, match.index).split("\n");
  return lines.length;
}

/**
 * Find the line of a command by name within a specific profile.
 * Searches for the command name that appears after the profile name.
 */
export function findCommandLine(source, profileName, commandName) {
  // Find the profile first
  const profilePattern = new RegExp(`"name"\\s*:\\s*"${escapeRegex(profileName)}"`);
  const profileMatch = profilePattern.exec(source);
  if (!profileMatch) return null;

  // Search for the command name after the profile
  const afterProfile = source.substring(profileMatch.index);
  const commandPattern = new RegExp(`"name"\\s*:\\s*"${escapeRegex(commandName)}"`);
  const commandMatch = commandPattern.exec(afterProfile);
  if (!commandMatch) return null;

  const totalOffset = profileMatch.index + commandMatch.index;
  const lines = source.substring(0, totalOffset).split("\n");
  return lines.length;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
