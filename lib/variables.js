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
      for (const name of extractSetVariables(instruction)) {
        vars.set(name, { name });
      }
    }
  }

  return vars;
}

/**
 * Extract every variable name assigned by a `set:` instruction.
 *
 * aux4 `set:` supports multiple assignments separated by `;`
 * (e.g. `set:user=!whoami;host=!hostname` sets both `user` and `host`),
 * so all of them must be treated as declared.
 */
export function extractSetVariables(instruction) {
  if (!instruction.startsWith("set:")) return [];

  const names = [];
  for (const pair of instruction.slice(4).split(";")) {
    const match = pair.match(/^\s*([a-zA-Z_][a-zA-Z0-9_.]*)=/);
    if (match) names.push(match[1]);
  }
  return names;
}

/**
 * Get the set of declared variable "roots" for a command.
 *
 * aux4 variables support dot notation in their names (e.g. a variable named
 * `setting.timezone` is set via `--setting.timezone` and builds the object
 * `{ setting: { timezone: ... } }`). A reference like `${setting.timezone}` or
 * `${setting}` should both resolve. To support that, the returned set contains
 * both the full declared name AND its leading root segment.
 */
export function getDeclaredRoots(command) {
  const roots = new Set();
  for (const name of getDeclaredVariables(command).keys()) {
    roots.add(name);
    roots.add(rootSegment(name));
  }
  return roots;
}

/**
 * The leading identifier of a dotted/indexed name (e.g. `setting.timezone` -> `setting`).
 */
export function rootSegment(name) {
  return name.split(/[.[]/)[0];
}

/**
 * Extract the root variable of an aux4 `${...}` reference, supporting dot
 * notation (`obj.field`) and array indexing (`obj.arr[0]`, `arr[2]`).
 *
 * Returns null when the reference is NOT a plain aux4 path — e.g. shell
 * parameter expansions like `${var:-default}` or `${var//a/b}` — so callers
 * can skip them instead of reporting a phantom undeclared variable.
 */
export function referenceRoot(ref) {
  const match = ref.match(/^([a-zA-Z_][a-zA-Z0-9_]*)((?:\.[a-zA-Z_][a-zA-Z0-9_]*)|(?:\[\d+\]))*$/);
  return match ? match[1] : null;
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
