import { CONDITIONAL } from "./patterns.js";

/**
 * Shared validation for execute-style instruction arrays.
 * Used by both command `execute` blocks and hook `before`/`after`/`error` steps.
 */

export const KNOWN_PREFIXES = [
  "profile", "set", "log", "nout", "json", "each",
  "confirm", "stdin", "alias", "debug", "when", "range",
  "file", "aux4"
];

const KNOWN_PREFIX_SET = new Set(KNOWN_PREFIXES);

/**
 * Validate a single instruction.
 *
 * opts:
 *   subject          - human-readable prefix for messages (e.g. "Command 'x' in profile 'y'")
 *   filePath         - file being linted
 *   line             - line number for the issue
 *   blockedPrefixes  - optional Set of prefixes that are not allowed in this context
 *                      (e.g. hooks block "profile" and "stdin")
 */
export function validateStep(instruction, opts) {
  const issues = [];

  if (typeof instruction !== "string") return issues;
  if (instruction.startsWith("#")) return issues;

  const conditional = parseConditional(instruction);

  if (conditional) {
    validatePart(conditional.then, opts, issues);
    if (conditional.else) {
      validatePart(conditional.else, opts, issues);
    }
  } else {
    validatePart(instruction, opts, issues);
  }

  checkMisplacedPrefixes(instruction, opts, issues);

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

function validatePart(part, opts, issues) {
  const prefix = extractPrefix(part);
  if (!prefix) return;

  if (opts.blockedPrefixes && opts.blockedPrefixes.has(prefix.name)) {
    issues.push({
      rule: "hook-executor",
      severity: "error",
      message: `${opts.subject} uses '${prefix.name}:' executor which is not allowed in hooks`,
      file: opts.filePath,
      line: opts.line
    });
    return;
  }

  if (!KNOWN_PREFIX_SET.has(prefix.name)) {
    if (looksLikePrefix(prefix.name, part)) {
      issues.push({
        rule: "unknown-executor",
        severity: "warning",
        message: `${opts.subject} uses unknown executor prefix '${prefix.name}:' — known prefixes: ${KNOWN_PREFIXES.join(", ")}`,
        file: opts.filePath,
        line: opts.line
      });
    }
    return;
  }

  if (prefix.name === "set") {
    validateSetInstruction(prefix.rest, opts, issues);
  }

  if (prefix.name === "each") {
    validateEachInstruction(prefix.rest, opts, issues);
  }

  if (prefix.name === "range") {
    validateRangeInstruction(prefix.rest, opts, issues);
  }

  if (prefix.name === "when") {
    validateWhenInstruction(prefix.rest, opts, issues);
  }

  if (prefix.name === "profile") {
    if (!prefix.rest || prefix.rest.trim().length === 0) {
      issues.push({
        rule: "executor-profile",
        severity: "error",
        message: `${opts.subject} has 'profile:' without a profile name`,
        file: opts.filePath,
        line: opts.line
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

function validateSetInstruction(rest, opts, issues) {
  const match = rest.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)=(.*)/s);
  if (!match) {
    issues.push({
      rule: "executor-set",
      severity: "error",
      message: `${opts.subject} has invalid 'set:' format — expected 'set:varName=value' or 'set:varName=!command'`,
      file: opts.filePath,
      line: opts.line
    });
  }
}

function validateEachInstruction(rest, opts, issues) {
  // each: runs an arbitrary command once per item in ${response}, exposing
  // ${item} and ${index}. The only hard requirement is a non-empty command.
  if (rest.trim().length === 0) {
    issues.push({
      rule: "executor-each",
      severity: "error",
      message: `${opts.subject} has invalid 'each:' format — expected 'each:<command>' (a command run for each item in \${response})`,
      file: opts.filePath,
      line: opts.line
    });
  }
}

function validateRangeInstruction(rest, opts, issues) {
  // range: produces a numeric list into ${response}. Format: 'range:N' or
  // 'range:start-end'. Variables resolve at runtime, so only validate literals.
  const value = rest.trim();
  if (value.length === 0 || value.includes("${")) return;

  if (!/^\d+$/.test(value) && !/^\d+\s*-\s*\d+$/.test(value)) {
    issues.push({
      rule: "executor-range",
      severity: "warning",
      message: `${opts.subject} has invalid 'range:' format — expected 'range:N' or 'range:start-end' (e.g., 'range:5', 'range:1-10')`,
      file: opts.filePath,
      line: opts.line
    });
  }
}

function validateWhenInstruction(rest, opts, issues) {
  // Format: when:<condition>:<command> — the first colon separates the
  // condition from the command to run when the condition is true.
  const colonIdx = rest.indexOf(":");
  const condition = colonIdx === -1 ? rest : rest.slice(0, colonIdx);
  const command = colonIdx === -1 ? "" : rest.slice(colonIdx + 1);

  if (colonIdx === -1 || condition.trim().length === 0 || command.trim().length === 0) {
    issues.push({
      rule: "executor-when",
      severity: "warning",
      message: `${opts.subject} has invalid 'when:' format — expected 'when:condition:command' (e.g., 'when:\${env}==prod:log:deploying')`,
      file: opts.filePath,
      line: opts.line
    });
  }
}

function checkMisplacedPrefixes(instruction, opts, issues) {
  if (instruction.startsWith("#")) return;
  if (instruction.match(/^if\(/)) return;

  const prefix = extractPrefix(instruction);
  if (prefix && KNOWN_PREFIX_SET.has(prefix.name)) return;
  if (prefix && opts.blockedPrefixes && opts.blockedPrefixes.has(prefix.name)) return;

  for (const p of KNOWN_PREFIXES) {
    const pattern = new RegExp(`(?:^|\\s)${p}:`, "g");
    let match;
    while ((match = pattern.exec(instruction)) !== null) {
      if (match.index > 0) {
        issues.push({
          rule: "misplaced-executor",
          severity: "warning",
          message: `${opts.subject} has '${p}:' mid-instruction — executor prefixes must be at the beginning`,
          file: opts.filePath,
          line: opts.line
        });
        break;
      }
    }
  }
}
