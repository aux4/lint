import { findCommandLine } from "../json-positions.js";
import { CONDITIONAL } from "../patterns.js";

const KNOWN_PREFIXES = [
  "profile", "set", "log", "nout", "json", "each",
  "confirm", "stdin", "alias", "debug"
];

const KNOWN_PREFIX_SET = new Set(KNOWN_PREFIXES);

export function validateExecutorPrefixes(parsed, filePath, ctx) {
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
        issues.push(...validateInstruction(instruction, profile.name, command.name, filePath, line));
      }
    }
  }

  return issues;
}

function validateInstruction(instruction, profileName, commandName, filePath, line) {
  const issues = [];

  if (instruction.startsWith("#")) return issues;

  const conditional = parseConditional(instruction);

  if (conditional) {
    validatePart(conditional.then, profileName, commandName, filePath, line, issues);
    if (conditional.else) {
      validatePart(conditional.else, profileName, commandName, filePath, line, issues);
    }
  } else {
    validatePart(instruction, profileName, commandName, filePath, line, issues);
  }

  checkMisplacedPrefixes(instruction, profileName, commandName, filePath, line, issues);

  return issues;
}

function parseConditional(instruction) {
  const match = instruction.match(CONDITIONAL);
  if (!match) return null;

  const rest = instruction.slice(match[0].length);
  const elseIndex = findElseBranch(rest);

  if (elseIndex >= 0) {
    return {
      then: rest.slice(0, elseIndex).trim(),
      else: rest.slice(elseIndex + 2).trim()
    };
  }

  return { then: rest.trim(), else: null };
}

function findElseBranch(str) {
  let depth = 0;
  let inQuote = null;

  for (let i = 0; i < str.length - 1; i++) {
    const ch = str[i];

    if (inQuote) {
      if (ch === inQuote && str[i - 1] !== "\\") inQuote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;

    if (depth === 0 && ch === "|" && str[i + 1] === "|") {
      return i;
    }
  }

  return -1;
}

function validatePart(part, profileName, commandName, filePath, line, issues) {
  const prefix = extractPrefix(part);
  if (!prefix) return;

  if (!KNOWN_PREFIX_SET.has(prefix.name)) {
    if (looksLikePrefix(prefix.name, part)) {
      issues.push({
        rule: "unknown-executor",
        severity: "warning",
        message: `Command '${commandName}' in profile '${profileName}' uses unknown executor prefix '${prefix.name}:' — known prefixes: ${KNOWN_PREFIXES.join(", ")}`,
        file: filePath,
        line
      });
    }
    return;
  }

  if (prefix.name === "set") {
    validateSetInstruction(prefix.rest, profileName, commandName, filePath, line, issues);
  }

  if (prefix.name === "each") {
    validateEachInstruction(prefix.rest, profileName, commandName, filePath, line, issues);
  }

  if (prefix.name === "profile") {
    if (!prefix.rest || prefix.rest.trim().length === 0) {
      issues.push({
        rule: "executor-profile",
        severity: "error",
        message: `Command '${commandName}' in profile '${profileName}' has 'profile:' without a profile name`,
        file: filePath,
        line
      });
    }
  }
}

function extractPrefix(part) {
  const match = part.match(/^([a-zA-Z]+):(.*)/s);
  if (!match) return null;
  return { name: match[1], rest: match[2] };
}

function looksLikePrefix(name, fullPart) {
  if (["http", "https", "ftp", "ssh", "git", "file"].includes(name)) return false;
  if (name.length === 1) return false;
  if (name.length > 10) return false;
  return true;
}

function validateSetInstruction(rest, profileName, commandName, filePath, line, issues) {
  const match = rest.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)=(.*)/s);
  if (!match) {
    issues.push({
      rule: "executor-set",
      severity: "error",
      message: `Command '${commandName}' in profile '${profileName}' has invalid 'set:' format — expected 'set:varName=value' or 'set:varName=!command'`,
      file: filePath,
      line
    });
  }
}

function validateEachInstruction(rest, profileName, commandName, filePath, line, issues) {
  const match = rest.match(/^\$\{[^}]+\}\s+.+/s);
  if (!match) {
    issues.push({
      rule: "executor-each",
      severity: "error",
      message: `Command '${commandName}' in profile '${profileName}' has invalid 'each:' format — expected 'each:\${variable} command'`,
      file: filePath,
      line
    });
  }
}

function checkMisplacedPrefixes(instruction, profileName, commandName, filePath, line, issues) {
  if (instruction.startsWith("#")) return;
  if (instruction.match(/^if\(/)) return;

  const prefix = extractPrefix(instruction);
  if (prefix && KNOWN_PREFIX_SET.has(prefix.name)) return;

  for (const p of KNOWN_PREFIXES) {
    const pattern = new RegExp(`(?:^|\\s)${p}:`, "g");
    let match;
    while ((match = pattern.exec(instruction)) !== null) {
      if (match.index > 0) {
        issues.push({
          rule: "misplaced-executor",
          severity: "warning",
          message: `Command '${commandName}' in profile '${profileName}' has '${p}:' mid-instruction — executor prefixes must be at the beginning`,
          file: filePath,
          line
        });
        break;
      }
    }
  }
}
