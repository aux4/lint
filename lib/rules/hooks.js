import { findHookLine } from "../json-positions.js";
import { validateStep } from "../executor-steps.js";

// Executors that aux4 core forbids inside hook steps (see executor.go blockedHookExecutors).
const BLOCKED_HOOK_PREFIXES = new Set(["profile", "stdin"]);

const PHASES = ["before", "after", "error"];

export function validateHooks(parsed, filePath, ctx) {
  const issues = [];

  if (parsed.hooks === undefined) return issues;

  if (!Array.isArray(parsed.hooks)) {
    issues.push({
      rule: "hooks-structure",
      severity: "error",
      message: "'hooks' must be an array",
      file: filePath,
      line: findHookLine(ctx.source, "")
    });
    return issues;
  }

  parsed.hooks.forEach((hook, index) => {
    if (hook === null || typeof hook !== "object" || Array.isArray(hook)) {
      issues.push({
        rule: "hook-structure",
        severity: "error",
        message: `Hook #${index + 1} must be an object`,
        file: filePath
      });
      return;
    }

    const label = typeof hook.command === "string" && hook.command.length > 0
      ? hook.command
      : `#${index + 1}`;
    const line = typeof hook.command === "string"
      ? findHookLine(ctx.source, hook.command)
      : null;

    validateCommandPattern(hook, label, index, filePath, line, issues);
    validateOrder(hook, label, filePath, line, issues);
    validateParams(hook, label, filePath, line, issues);
    validateSteps(hook, label, filePath, line, issues);
  });

  return issues;
}

function validateCommandPattern(hook, label, index, filePath, line, issues) {
  if (hook.command === undefined) {
    issues.push({
      rule: "hook-command",
      severity: "error",
      message: `Hook #${index + 1} is missing required 'command' field`,
      file: filePath,
      line
    });
    return;
  }

  if (typeof hook.command !== "string" || hook.command.trim().length === 0) {
    issues.push({
      rule: "hook-command",
      severity: "error",
      message: `Hook #${index + 1} has 'command' that must be a non-empty string`,
      file: filePath,
      line
    });
    return;
  }

  const parts = hook.command.split("/");
  if (parts.length !== 2 || parts.some(p => p.length === 0)) {
    issues.push({
      rule: "hook-command",
      severity: "warning",
      message: `Hook '${label}' command pattern should be 'profile/command' (e.g., 'main/deploy', '*/deploy', '*/*')`,
      file: filePath,
      line
    });
  }
}

function validateOrder(hook, label, filePath, line, issues) {
  if (hook.order === undefined) return;

  if (typeof hook.order !== "number" || !Number.isInteger(hook.order)) {
    issues.push({
      rule: "hook-order",
      severity: "error",
      message: `Hook '${label}' has 'order' that is not an integer`,
      file: filePath,
      line
    });
  }
}

function validateParams(hook, label, filePath, line, issues) {
  if (hook.params === undefined) return;

  if (hook.params === null || typeof hook.params !== "object" || Array.isArray(hook.params)) {
    issues.push({
      rule: "hook-params",
      severity: "error",
      message: `Hook '${label}' has 'params' that must be an object of string values`,
      file: filePath,
      line
    });
    return;
  }

  for (const [key, value] of Object.entries(hook.params)) {
    if (typeof value !== "string") {
      issues.push({
        rule: "hook-params",
        severity: "error",
        message: `Hook '${label}' has 'params.${key}' that must be a string`,
        file: filePath,
        line
      });
    }
  }
}

function validateSteps(hook, label, filePath, line, issues) {
  const present = PHASES.filter(phase => hook[phase] !== undefined);

  if (present.length === 0) {
    issues.push({
      rule: "hook-empty",
      severity: "warning",
      message: `Hook '${label}' has no 'before', 'after', or 'error' steps`,
      file: filePath,
      line
    });
    return;
  }

  for (const phase of present) {
    const steps = hook[phase];

    if (!Array.isArray(steps)) {
      issues.push({
        rule: "hook-steps",
        severity: "error",
        message: `Hook '${label}' has '${phase}' that must be an array of strings`,
        file: filePath,
        line
      });
      continue;
    }

    const subject = `Hook '${label}' (${phase})`;

    for (const step of steps) {
      if (typeof step !== "string") {
        issues.push({
          rule: "hook-steps",
          severity: "error",
          message: `Hook '${label}' has a non-string step in '${phase}'`,
          file: filePath,
          line
        });
        continue;
      }

      issues.push(...validateStep(step, {
        subject,
        filePath,
        line,
        blockedPrefixes: BLOCKED_HOOK_PREFIXES
      }));
    }
  }
}
