import fs from "fs";
import path from "path";

const METRIC_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const RECORD_CALL_RE = /\baux4\s+metric\s+record\s+([^\s;&|]+)/g;

function executeStrings(parsed) {
  const instructions = [];
  for (const profile of parsed.profiles || []) {
    for (const command of profile.commands || []) {
      for (const instruction of command.execute || []) {
        if (typeof instruction === "string") instructions.push(instruction);
      }
    }
  }
  return instructions;
}

function recordedMetricKeys(parsed) {
  const keys = new Set();
  for (const instruction of executeStrings(parsed)) {
    for (const match of instruction.matchAll(RECORD_CALL_RE)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function issue(file, message) {
  return {
    rule: "package-metric",
    severity: "error",
    message,
    file
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validatePackageMetrics(parsed, filePath) {
  const issues = [];
  const plansPath = path.join(path.dirname(filePath), "plans.json");
  const recorded = recordedMetricKeys(parsed);

  if (!fs.existsSync(plansPath)) {
    for (const key of recorded) {
      issues.push(issue(filePath, `Metric '${key}' is recorded but this package has no plans.json`));
    }
    return issues;
  }

  let plans;
  try {
    plans = JSON.parse(fs.readFileSync(plansPath, "utf8"));
  } catch (error) {
    return [issue(filePath, `plans.json is not valid JSON: ${error.message}`)];
  }

  if (!plans.metrics || typeof plans.metrics !== "object" || Array.isArray(plans.metrics)) {
    return [issue(filePath, "plans.json 'metrics' must be an object")];
  }

  const declared = new Set(Object.keys(plans.metrics));
  for (const key of declared) {
    const metric = plans.metrics[key];
    if (!METRIC_KEY_RE.test(key)) {
      issues.push(issue(filePath, `Declared metric key '${key}' is invalid`));
    }
    if (!isPlainObject(metric)) {
      issues.push(issue(filePath, `Metric '${key}' must be an object`));
      continue;
    }
    const unknownMetricKeys = Object.keys(metric).filter(field => !["label", "type", "unit"].includes(field));
    if (unknownMetricKeys.length > 0) {
      issues.push(issue(filePath, `Metric '${key}' has unknown key(s): ${unknownMetricKeys.join(", ")}`));
    }
    if (metric.unit !== undefined) {
      if (!isPlainObject(metric.unit)) {
        issues.push(issue(filePath, `Metric '${key}' unit must be an object`));
      } else {
        const unknownUnitKeys = Object.keys(metric.unit)
          .filter(field => !["base", "display", "baseUnitsPerDisplayUnit", "decimals"].includes(field));
        if (unknownUnitKeys.length > 0) {
          issues.push(issue(filePath, `Metric '${key}' unit has unknown key(s): ${unknownUnitKeys.join(", ")}`));
        }
        if (typeof metric.unit.base !== "string" || !metric.unit.base.trim() || metric.unit.base.length > 20) {
          issues.push(issue(filePath, `Metric '${key}' unit.base must be a non-empty string of at most 20 characters`));
        }
        if (typeof metric.unit.display !== "string" || !metric.unit.display.trim() || metric.unit.display.length > 20) {
          issues.push(issue(filePath, `Metric '${key}' unit.display must be a non-empty string of at most 20 characters`));
        }
        if (!Number.isSafeInteger(metric.unit.baseUnitsPerDisplayUnit) || metric.unit.baseUnitsPerDisplayUnit < 1) {
          issues.push(issue(filePath, `Metric '${key}' unit.baseUnitsPerDisplayUnit must be a positive safe integer`));
        }
        if (metric.unit.decimals !== undefined &&
            (!Number.isInteger(metric.unit.decimals) || metric.unit.decimals < 0 || metric.unit.decimals > 6)) {
          issues.push(issue(filePath, `Metric '${key}' unit.decimals must be an integer from 0 to 6`));
        }
      }
    }
    const type = metric?.type || "counter";
    if (!["counter", "gauge"].includes(type)) {
      issues.push(issue(filePath, `Metric '${key}' has invalid type '${type}'; expected 'counter' or 'gauge'`));
    } else if (type === "counter" && !recorded.has(key)) {
      issues.push(issue(filePath, `Metric '${key}' is declared in plans.json but never recorded with 'aux4 metric record ${key}'`));
    } else if (type === "gauge" && recorded.has(key)) {
      issues.push(issue(filePath, `Gauge metric '${key}' must be measured by its trusted service, not 'aux4 metric record'`));
    }
  }

  for (const key of recorded) {
    if (!METRIC_KEY_RE.test(key)) {
      issues.push(issue(filePath, `Recorded metric key '${key}' must be a literal lowercase key`));
    } else if (!declared.has(key)) {
      issues.push(issue(filePath, `Metric '${key}' is recorded but not declared in plans.json`));
    }
  }

  return issues;
}
