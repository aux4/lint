import { findKeyLine } from "../json-positions.js";
import { SEMVER, LOCAL_VERSION, SCOPE_FORMAT, NAME_FORMAT, DEPENDENCY_FORMAT } from "../patterns.js";

const VALID_METADATA_FIELDS = new Set([
  "scope", "name", "version", "description", "license", "git",
  "tags", "system", "dependencies", "profiles"
]);

export function validateMetadata(parsed, filePath, options = {}, ctx) {
  const issues = [];
  const src = ctx && ctx.source;

  const hasPackageMetadata = parsed.scope || parsed.name || parsed.version;
  if (!hasPackageMetadata) {
    return issues;
  }

  if (!parsed.scope) {
    issues.push({
      rule: "metadata-scope",
      severity: "error",
      message: "Package metadata missing required 'scope' field",
      file: filePath,
      line: 1
    });
  } else if (typeof parsed.scope !== "string" || !SCOPE_FORMAT.test(parsed.scope)) {
    issues.push({
      rule: "metadata-scope",
      severity: "error",
      message: `Invalid 'scope' value '${parsed.scope}' — must be lowercase alphanumeric with optional dashes`,
      file: filePath,
      line: src ? findKeyLine(src, "scope") : null
    });
  }

  if (!parsed.name) {
    issues.push({
      rule: "metadata-name",
      severity: "error",
      message: "Package metadata missing required 'name' field",
      file: filePath,
      line: 1
    });
  } else if (typeof parsed.name !== "string" || !NAME_FORMAT.test(parsed.name)) {
    issues.push({
      rule: "metadata-name",
      severity: "error",
      message: `Invalid 'name' value '${parsed.name}' — must be lowercase alphanumeric with optional dashes`,
      file: filePath,
      line: src ? findKeyLine(src, "name") : null
    });
  }

  if (!parsed.version) {
    issues.push({
      rule: "metadata-version",
      severity: "error",
      message: "Package metadata missing required 'version' field",
      file: filePath,
      line: 1
    });
  } else if (typeof parsed.version !== "string" || !SEMVER.test(parsed.version)) {
    issues.push({
      rule: "metadata-version",
      severity: "error",
      message: `Invalid 'version' value '${parsed.version}' — must follow semantic versioning (e.g., '1.0.0')`,
      file: filePath,
      line: src ? findKeyLine(src, "version") : null
    });
  }

  if (typeof parsed.version === "string" && LOCAL_VERSION.test(parsed.version)) {
    issues.push({
      rule: "version-local",
      severity: options.strict ? "error" : "warning",
      message: `Version '${parsed.version}' contains '-local' suffix — must not be committed or published`,
      file: filePath,
      line: src ? findKeyLine(src, "version") : null
    });
  }

  if (parsed.description !== undefined && typeof parsed.description !== "string") {
    issues.push({
      rule: "metadata-description",
      severity: "error",
      message: "'description' must be a string",
      file: filePath,
      line: src ? findKeyLine(src, "description") : null
    });
  }

  if (parsed.license !== undefined && typeof parsed.license !== "string") {
    issues.push({
      rule: "metadata-license",
      severity: "error",
      message: "'license' must be a string",
      file: filePath,
      line: src ? findKeyLine(src, "license") : null
    });
  }

  if (parsed.git !== undefined) {
    if (typeof parsed.git !== "string") {
      issues.push({
        rule: "metadata-git",
        severity: "error",
        message: "'git' must be a string",
        file: filePath,
        line: src ? findKeyLine(src, "git") : null
      });
    } else if (!parsed.git.startsWith("https://") && !parsed.git.startsWith("git+ssh://")) {
      issues.push({
        rule: "metadata-git",
        severity: "warning",
        message: `'git' value '${parsed.git}' should be an HTTPS or git+ssh URL`,
        file: filePath,
        line: src ? findKeyLine(src, "git") : null
      });
    }
  }

  if (parsed.tags !== undefined) {
    const line = src ? findKeyLine(src, "tags") : null;
    if (!Array.isArray(parsed.tags)) {
      issues.push({
        rule: "metadata-tags",
        severity: "error",
        message: "'tags' must be an array of strings",
        file: filePath,
        line
      });
    } else {
      for (const tag of parsed.tags) {
        if (typeof tag !== "string") {
          issues.push({
            rule: "metadata-tags",
            severity: "error",
            message: "Invalid tag value — each tag must be a string",
            file: filePath,
            line
          });
          break;
        }
      }
    }
  }

  if (parsed.dependencies !== undefined) {
    const line = src ? findKeyLine(src, "dependencies") : null;
    if (!Array.isArray(parsed.dependencies)) {
      issues.push({
        rule: "metadata-dependencies",
        severity: "error",
        message: "'dependencies' must be an array of strings",
        file: filePath,
        line
      });
    } else {
      for (const dep of parsed.dependencies) {
        if (typeof dep !== "string") {
          issues.push({
            rule: "metadata-dependencies",
            severity: "error",
            message: "Invalid dependency value — each dependency must be a string",
            file: filePath,
            line
          });
          break;
        } else if (!DEPENDENCY_FORMAT.test(dep)) {
          issues.push({
            rule: "metadata-dependencies",
            severity: "warning",
            message: `Dependency '${dep}' should follow 'scope/name' format (e.g., 'aux4/config')`,
            file: filePath,
            line
          });
        }
      }
    }
  }

  if (parsed.system !== undefined) {
    const line = src ? findKeyLine(src, "system") : null;
    if (!Array.isArray(parsed.system)) {
      issues.push({
        rule: "metadata-system",
        severity: "error",
        message: "'system' must be an array of arrays",
        file: filePath,
        line
      });
    } else {
      for (let i = 0; i < parsed.system.length; i++) {
        const group = parsed.system[i];
        if (!Array.isArray(group)) {
          issues.push({
            rule: "metadata-system",
            severity: "error",
            message: `system[${i}] must be an array of strings`,
            file: filePath,
            line
          });
          continue;
        }

        if (group.length === 0) {
          issues.push({
            rule: "metadata-system",
            severity: "error",
            message: `system[${i}] must not be empty`,
            file: filePath,
            line
          });
          continue;
        }

        if (typeof group[0] === "string" && !group[0].startsWith("test:")) {
          issues.push({
            rule: "metadata-system",
            severity: "warning",
            message: `system[${i}] first element should be a 'test:' command to check if the dependency is installed`,
            file: filePath,
            line
          });
        }

        for (const entry of group) {
          if (typeof entry !== "string") {
            issues.push({
              rule: "metadata-system",
              severity: "error",
              message: `system[${i}] entries must be strings`,
              file: filePath,
              line
            });
            break;
          }

          const colonIdx = entry.indexOf(":");
          if (colonIdx < 0) {
            issues.push({
              rule: "metadata-system",
              severity: "error",
              message: `system[${i}] entry '${entry}' must follow 'prefix:package' format (e.g., 'brew:node', 'test:node --version')`,
              file: filePath,
              line
            });
          } else {
            const prefix = entry.substring(0, colonIdx);
            const value = entry.substring(colonIdx + 1);
            if (!prefix || !value.trim()) {
              issues.push({
                rule: "metadata-system",
                severity: "error",
                message: `system[${i}] entry '${entry}' has empty prefix or package name`,
                file: filePath,
                line
              });
            }
          }
        }
      }
    }
  }

  for (const key of Object.keys(parsed)) {
    if (!VALID_METADATA_FIELDS.has(key)) {
      issues.push({
        rule: "metadata-unknown",
        severity: "warning",
        message: `Unknown top-level field '${key}'`,
        file: filePath,
        line: src ? findKeyLine(src, key) : null
      });
    }
  }

  return issues;
}
