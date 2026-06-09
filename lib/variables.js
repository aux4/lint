import { SET_VAR } from "./patterns.js";

/**
 * Get declared variables from a command as a Map of name -> definition.
 * Includes help.variables and set: instructions in execute.
 */
export function getDeclaredVariables(command) {
  const vars = new Map();

  if (command.help && command.help.variables && Array.isArray(command.help.variables)) {
    for (const v of command.help.variables) {
      if (v.name) {
        vars.set(v.name, v);
      }
    }
  }

  if (command.execute && Array.isArray(command.execute)) {
    for (const instruction of command.execute) {
      const match = instruction.match(SET_VAR);
      if (match) {
        vars.set(match[1], { name: match[1] });
      }
    }
  }

  return vars;
}

/**
 * Check if a command uses --config binding, which auto-populates variables
 * from config.yaml at runtime.
 */
export function commandUsesConfig(command) {
  if (command.help && command.help.variables && Array.isArray(command.help.variables)) {
    for (const v of command.help.variables) {
      if (v.name === "config" || v.name === "configFile") return true;
    }
  }
  return false;
}
