import { PROFILE_REF, PROFILE_REF_ELSE } from "./patterns.js";

/**
 * Extract all profile:X references from an instruction.
 * Handles conditionals: if(x==y) && profile:a || profile:b
 */
export function extractProfileReferences(instruction) {
  const refs = [];

  const match = instruction.match(PROFILE_REF);
  if (match) {
    refs.push(match[1]);
  }

  const elseMatch = instruction.match(PROFILE_REF_ELSE);
  if (elseMatch) {
    refs.push(elseMatch[1]);
  }

  return refs;
}

/**
 * Collect all profile names referenced across all commands.
 */
export function collectReferencedProfiles(parsed) {
  const referenced = new Set();

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      for (const instruction of command.execute) {
        for (const ref of extractProfileReferences(instruction)) {
          referenced.add(ref);
        }
      }
    }
  }

  return referenced;
}
