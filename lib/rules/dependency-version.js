import { findKeyLine } from "../json-positions.js";
import { isVersionRange, parseVersionRange } from "../semver-range.js";

/**
 * Validates the version token of every dependency reference in a package
 * .aux4, so a malformed semver range is caught at LINT time instead of at a
 * user's install.
 *
 * The grammar mirrors pkger/semver_range.go — see lib/semver-range.js.
 *
 * Backward-compat rule (identical to pkger's): a token is a RANGE only when it
 * fails a strict semver parse AND carries range syntax. Bare '1.2.3',
 * '1.0.0-local', 'latest' and a bare partial '2.0' are all valid EXACT
 * references and are left alone — otherwise this rule would fire on nearly
 * every published package.
 */
export function validateDependencyVersions(parsed, filePath, ctx) {
  const issues = [];
  const src = ctx && ctx.source;

  if (!Array.isArray(parsed.dependencies)) {
    return issues;
  }

  const line = src ? findKeyLine(src, "dependencies") : null;

  for (const dependency of parsed.dependencies) {
    if (typeof dependency !== "string") continue;

    const version = dependencyVersion(dependency);
    if (version === null) continue;

    if (version.trim() === "") {
      issues.push({
        rule: "dependency-version",
        severity: "error",
        message: `Dependency '${dependency}' has an empty version — drop the '@' or give a version, range or 'latest'`,
        file: filePath,
        line
      });
      continue;
    }

    if (!isVersionRange(version)) continue;

    try {
      parseVersionRange(version);
    } catch (e) {
      issues.push({
        rule: "dependency-version",
        severity: "error",
        message: `Dependency '${dependency}' has an invalid version range '${version}' — ${e.message}`,
        file: filePath,
        line
      });
    }
  }

  return issues;
}

/**
 * Extracts the version token from a package reference the way pkger does
 * (manager.go parsePackage): an optional '<repository>:' prefix before the
 * first '/' is stripped, then the reference is split on '@' and the version is
 * the segment between the first and second '@'. Returns null when no version
 * is given.
 */
function dependencyVersion(dependency) {
  let definition = dependency;

  const colon = definition.indexOf(":");
  const slash = definition.indexOf("/");
  if (colon > 0 && (slash < 0 || colon < slash)) {
    definition = definition.substring(colon + 1);
  }

  const parts = definition.split("@");
  if (parts.length === 1) return null;

  return parts[1];
}
