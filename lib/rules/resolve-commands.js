import { execFileSync } from "child_process";
import { findCommandLine } from "../json-positions.js";

// Cache resolved command signatures to avoid repeated shell calls
const cache = new Map();

/**
 * Validate aux4 command calls in execute arrays by resolving target
 * command signatures via `aux4 <cmd> --help --json`.
 */
export function validateResolvedCommands(parsed, filePath, ctx) {
  const issues = [];

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    return issues;
  }

  for (const profile of parsed.profiles) {
    if (!profile.commands || !Array.isArray(profile.commands)) continue;

    for (const command of profile.commands) {
      if (!command.execute || !Array.isArray(command.execute)) continue;

      const line = findCommandLine(ctx.source, profile.name, command.name);

      for (const instruction of command.execute) {
        const aux4Call = parseAux4Call(instruction);
        if (!aux4Call) continue;

        const target = resolveCommand(aux4Call.command);
        if (!target) continue;

        validateCall(aux4Call, target, profile.name, command.name, filePath, line, issues);
      }
    }
  }

  return issues;
}

/**
 * Parse an execute instruction to extract aux4 command calls.
 * Returns { command: ["config", "get"], flags: ["--file", ...], positionals: [...] }
 */
function parseAux4Call(instruction) {
  // Strip executor prefixes
  let inst = instruction;

  // Skip comments
  if (inst.startsWith("#")) return null;

  // Handle conditional — check both branches
  if (inst.match(/^if\(/)) return null;

  // Strip known prefixes that still execute the command
  for (const prefix of ["nout:", "log:", "alias:", "debug:"]) {
    if (inst.startsWith(prefix)) {
      inst = inst.slice(prefix.length);
      break;
    }
  }

  // Must start with "aux4 " to be an aux4 command call
  if (!inst.startsWith("aux4 ")) return null;

  const parts = inst.slice(5).trim();

  // Extract the command path (words before any --flag, ${var}, value(), or quoted arg)
  const commandParts = [];
  const rest = [];
  let inCommand = true;

  const tokens = tokenize(parts);

  for (const token of tokens) {
    if (inCommand && !token.startsWith("--") && !token.startsWith("${") &&
        !token.match(/^(values?|params?|object)\(/) && !token.startsWith("'") &&
        !token.startsWith('"') && !token.match(/^\d/)) {
      commandParts.push(token);
    } else {
      inCommand = false;
      rest.push(token);
    }
  }

  if (commandParts.length === 0) return null;

  // Parse rest into flags and positionals
  const flags = new Set();
  const positionals = [];

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const flagName = token.replace(/^--/, "").split("=")[0];
      flags.add(flagName);
      // Skip next token if it's the flag value (not another flag)
      if (!token.includes("=") && i + 1 < rest.length && !rest[i + 1].startsWith("--")) {
        i++;
      }
    } else {
      positionals.push(token);
    }
  }

  return { command: commandParts, flags, positionals, raw: instruction };
}

function tokenize(str) {
  const tokens = [];
  let current = "";
  let inQuote = null;
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inQuote) {
      current += ch;
      if (ch === inQuote) {
        inQuote = null;
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (ch === "(" || ch === "{") depth++;
    if (ch === ")" || ch === "}") depth--;

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === " " && depth === 0) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * Resolve a command signature via aux4 --help --json.
 */
function resolveCommand(commandParts) {
  const key = commandParts.join(" ");

  if (cache.has(key)) {
    return cache.get(key);
  }

  try {
    const output = execFileSync("aux4", [...commandParts, "--help", "--json"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "ignore"]
    }).trim();

    if (!output) {
      cache.set(key, null);
      return null;
    }

    // Parse JSON lines — last line is the leaf command if multiple lines
    const lines = output.split("\n").filter(l => l.trim());
    const commands = [];

    for (const line of lines) {
      try {
        commands.push(JSON.parse(line));
      } catch (e) {
        // Skip unparseable lines
      }
    }

    if (commands.length === 0) {
      cache.set(key, null);
      return null;
    }

    // If one line, it's the target command
    // If multiple lines, the first is the group, rest are subcommands
    // We want the command that matches the last part of our command path
    const lastPart = commandParts[commandParts.length - 1];
    const match = commands.find(c => c.name === lastPart) || commands[0];

    const result = {
      name: match.name,
      params: match.params || [],
      subcommands: commands.length > 1 ? commands.slice(1).map(c => c.name) : []
    };

    cache.set(key, result);
    return result;
  } catch (e) {
    cache.set(key, null);
    return null;
  }
}

function validateCall(call, target, profileName, commandName, filePath, line, issues) {
  const targetParamNames = new Set(target.params.map(p => p.name));
  const targetArgParams = target.params.filter(p => p.arg);
  const cmdStr = call.command.join(" ");

  // Validate --flag usage
  for (const flag of call.flags) {
    // Strip ${} interpolation from flag names
    const cleanFlag = flag.replace(/\$\{[^}]+\}/g, "");
    if (!cleanFlag) continue;

    if (!targetParamNames.has(cleanFlag)) {
      issues.push({
        rule: "resolve-flag",
        severity: "warning",
        message: `Command '${commandName}' in profile '${profileName}' passes '--${cleanFlag}' to 'aux4 ${cmdStr}' but '${cleanFlag}' is not a recognized parameter`,
        file: filePath,
        line
      });
    }
  }

  // Check if subcommand is missing
  if (target.subcommands.length > 0 && call.flags.size === 0 && call.positionals.length === 0) {
    issues.push({
      rule: "resolve-subcommand",
      severity: "warning",
      message: `Command '${commandName}' in profile '${profileName}' calls 'aux4 ${cmdStr}' which is a command group — did you mean to call a subcommand? (${target.subcommands.join(", ")})`,
      file: filePath,
      line
    });
  }
}
