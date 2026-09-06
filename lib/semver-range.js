/**
 * npm-style semver RANGE grammar — JS MIRROR of pkger/semver_range.go.
 *
 * !!! DUPLICATED ON PURPOSE — THE TWO MUST MOVE TOGETHER !!!
 *
 * pkger (Go) is what actually resolves a dependency reference at install time;
 * this file exists so `aux4 lint` can reject a malformed range at LINT time,
 * before publish, instead of leaving the user to discover it on install.
 * aux4/lint is a JavaScript package and pkger is a Go binary, so there is no
 * shared library to import — the grammar is re-implemented here, function for
 * function, from pkger/semver_range.go (IsVersionRange / TranslateVersionRange
 * / ParseVersionRange). If the grammar changes on either side, change BOTH.
 *
 * The Go original also carries a pointer back to this file.
 *
 * Supported grammar (npm familiar set):
 *
 *   ^1.2.3  ~1.2.3  >=1.2.3  >1.2.3  <=2.0.0  <2.0.0  =1.2.3  !=1.2.3
 *   1.x  1.2.x  1  1.2  *  1.2.3 - 2.0.0
 *   space = AND, || = OR
 *
 * A BARE version (1.2.3) is NOT a range: it keeps meaning EXACT, and "latest"
 * keeps meaning latest. That is the backward-compatibility contract.
 */

const UINT64_MAX = 18446744073709551615n;

/**
 * Mirrors strconv.ParseUint(segment, 10, 64): digits only, no sign, no
 * overflow. Go DOES accept leading zeroes here (unlike semver.Parse), so this
 * accepts them too.
 * Returns a BigInt, or null when Go would have returned an error.
 */
function parseUint64(segment) {
  if (!/^[0-9]+$/.test(segment)) return null;
  const value = BigInt(segment);
  if (value > UINT64_MAX) return null;
  return value;
}

const NUMERIC = /^[0-9]+$/;
const ALPHANUM = /^[0-9A-Za-z-]+$/;

function hasLeadingZeroes(value) {
  return value.length > 1 && value[0] === "0";
}

/**
 * Mirrors github.com/blang/semver/v4 semver.Parse — a COMPLETE, strict semver
 * version. Returns true when Go's semver.Parse would return no error.
 *
 * This is the pivot of the backward-compat rule: a token that parses here is
 * an EXACT reference and is never treated as a range.
 */
export function isExactSemver(value) {
  if (typeof value !== "string" || value.length === 0) return false;

  const parts = splitN(value, ".", 3);
  if (parts.length !== 3) return false;

  if (!NUMERIC.test(parts[0]) || hasLeadingZeroes(parts[0])) return false;
  if (parseUint64(parts[0]) === null) return false;
  if (!NUMERIC.test(parts[1]) || hasLeadingZeroes(parts[1])) return false;
  if (parseUint64(parts[1]) === null) return false;

  let patchStr = parts[2];
  let build = null;
  let prerelease = null;

  const buildIndex = patchStr.indexOf("+");
  if (buildIndex !== -1) {
    build = patchStr.substring(buildIndex + 1).split(".");
    patchStr = patchStr.substring(0, buildIndex);
  }

  const preIndex = patchStr.indexOf("-");
  if (preIndex !== -1) {
    prerelease = patchStr.substring(preIndex + 1).split(".");
    patchStr = patchStr.substring(0, preIndex);
  }

  if (!NUMERIC.test(patchStr) || hasLeadingZeroes(patchStr)) return false;
  if (parseUint64(patchStr) === null) return false;

  if (prerelease !== null) {
    for (const identifier of prerelease) {
      if (identifier.length === 0) return false;
      if (NUMERIC.test(identifier)) {
        if (hasLeadingZeroes(identifier)) return false;
      } else if (!ALPHANUM.test(identifier)) {
        return false;
      }
    }
  }

  if (build !== null) {
    for (const identifier of build) {
      if (identifier.length === 0 || !ALPHANUM.test(identifier)) return false;
    }
  }

  return true;
}

/** Mirrors strings.SplitN. */
function splitN(value, separator, count) {
  const parts = value.split(separator);
  if (parts.length <= count) return parts;
  return parts.slice(0, count - 1).concat(parts.slice(count - 1).join(separator));
}

/** Mirrors strings.Fields. */
function fields(value) {
  const trimmed = value.trim();
  if (trimmed === "") return [];
  return trimmed.split(/\s+/);
}

/**
 * Mirrors IsVersionRange: reports whether a version token from a package
 * reference is a semver RANGE rather than a concrete version.
 *
 * Deliberately conservative: a token that parses as a complete semver version
 * (including prereleases such as "1.0.0-local") is EXACT, "latest" is latest,
 * and anything else is only treated as a range when it actually carries range
 * syntax — a leading comparator, "||", a hyphen-range separator or an x/X/*
 * wildcard segment.
 */
export function isVersionRange(version) {
  const constraint = typeof version === "string" ? version.trim() : "";

  if (constraint === "" || constraint === "latest") return false;

  if (isExactSemver(constraint)) return false;

  // A leading comparator: ^ ~ > < = or ! ("!=1.2.3" excludes a version). No
  // token that starts with one of these can be a concrete version, so this is
  // safe to treat as range syntax. Mirrors pkger/semver_range.go.
  if ("^~><=!".includes(constraint[0])) return true;

  if (constraint.includes("||")) return true;

  for (const token of fields(constraint)) {
    if (token === "-") return true;
    for (const segment of token.split(".")) {
      if (segment === "x" || segment === "X" || segment === "*") return true;
    }
  }

  return false;
}

/**
 * Mirrors ParseVersionRange: translates an npm-style range and validates that
 * the translated expression is something semver.ParseRange accepts.
 * Throws an Error carrying pkger's message when it is not.
 */
export function parseVersionRange(constraint) {
  const expression = translateVersionRange(constraint);

  const unparsable = findUnparsableTerm(expression);
  if (unparsable !== null) {
    throw new Error(`invalid version range "${constraint}": could not parse version ${JSON.stringify(unparsable)}`);
  }

  return expression;
}

/**
 * Mirrors what semver.ParseRange accepts for an ALREADY TRANSLATED expression:
 * OR groups of whitespace-separated comparators, each an explicit operator
 * followed by a complete semver version. Translation never emits wildcards or
 * partial versions, so a plain strict parse is the whole check.
 *
 * Returns the offending version string, or null when the expression is fine.
 */
function findUnparsableTerm(expression) {
  for (const group of expression.split("||")) {
    const terms = fields(group);
    if (terms.length === 0) return "";

    for (const term of terms) {
      const match = /^(>=|<=|!=|==|>|<|=|!)?(.*)$/.exec(term);
      if (!match || !isExactSemver(match[2])) return match ? match[2] : term;
    }
  }

  return null;
}

/**
 * Mirrors TranslateVersionRange: rewrites an npm-style range into an
 * expression whose every term carries an explicit comparator and a complete
 * major.minor.patch version. Throws on a malformed range.
 */
export function translateVersionRange(constraint) {
  const trimmed = typeof constraint === "string" ? constraint.trim() : "";
  if (trimmed === "") {
    throw new Error(`invalid version range "${constraint}": empty range`);
  }

  const groups = [];

  for (const group of trimmed.split("||")) {
    let translated;
    try {
      translated = translateComparatorSet(group);
    } catch (e) {
      throw new Error(`invalid version range "${constraint}": ${e.message}`);
    }
    groups.push(translated);
  }

  return groups.join(" || ");
}

/** Mirrors translateComparatorSet. */
function translateComparatorSet(group) {
  const tokens = tokenizeComparatorSet(group);
  if (tokens.length === 0) {
    throw new Error("empty comparator set");
  }

  // Hyphen range: "1.2.3 - 2.0.0". npm requires the hyphen to be its own
  // whitespace-delimited token, which is what keeps it unambiguous against a
  // prerelease such as "1.0.0-local".
  for (const token of tokens) {
    if (token !== "-") continue;
    if (tokens.length !== 3 || tokens[1] !== "-") {
      throw new Error(`invalid hyphen range "${group.trim()}"`);
    }
    return translateHyphenRange(tokens[0], tokens[2]);
  }

  const comparators = [];
  for (const token of tokens) {
    comparators.push(translateComparator(token));
  }

  return comparators.join(" ");
}

/** Mirrors tokenizeComparatorSet. */
function tokenizeComparatorSet(group) {
  const tokens = [];
  let pendingOperator = "";

  for (const field of fields(group)) {
    if (pendingOperator !== "") {
      tokens.push(pendingOperator + field);
      pendingOperator = "";
      continue;
    }

    if (isOperatorOnly(field)) {
      pendingOperator = field;
      continue;
    }

    tokens.push(field);
  }

  if (pendingOperator !== "") {
    tokens.push(pendingOperator);
  }

  return tokens;
}

function isOperatorOnly(field) {
  return [">", ">=", "<", "<=", "=", "==", "!", "!=", "^", "~"].includes(field);
}

/** Mirrors translateHyphenRange. */
function translateHyphenRange(from, to) {
  const lower = parsePartialVersion(from);
  const upper = parsePartialVersion(to);

  if (lower.any) {
    throw new Error("a hyphen range cannot start with a wildcard");
  }

  if (upper.any) {
    return ">=" + lowerBound(lower);
  }

  // An incomplete upper bound is inclusive of the whole missing segment:
  // "1.2.3 - 2.3" means "<2.4.0", "1.2.3 - 2" means "<3.0.0".
  if (!complete(upper)) {
    return ">=" + lowerBound(lower) + " <" + upperBound(upper);
  }

  return ">=" + lowerBound(lower) + " <=" + versionString(upper);
}

/** Mirrors translateComparator. */
function translateComparator(token) {
  let operator = "";
  let rest = token;

  while (rest.length > 0 && "^~><=!".includes(rest[0])) {
    operator += rest[0];
    rest = rest.substring(1);
  }

  rest = rest.trim();

  if (operator !== "" && rest === "") {
    throw new Error(`comparator "${token}" has no version`);
  }

  const partial = parsePartialVersion(rest);

  switch (operator) {
    case "^":
      if (partial.any) return ">=0.0.0";
      return ">=" + lowerBound(partial) + " <" + caretUpperBound(partial);

    case "~":
      if (partial.any) return ">=0.0.0";
      return ">=" + lowerBound(partial) + " <" + tildeUpperBound(partial);

    case "":
    case "=":
    case "==":
      if (partial.any) return ">=0.0.0";
      if (complete(partial)) return "=" + versionString(partial);
      return ">=" + lowerBound(partial) + " <" + upperBound(partial);

    case ">":
      // ">*" matches nothing sensible; treat it as "any" like npm does.
      if (partial.any) return ">=0.0.0";
      if (complete(partial)) return ">" + versionString(partial);
      // ">1.2" excludes every 1.2.x, so it starts at 1.3.0.
      return ">=" + upperBound(partial);

    case ">=":
      if (partial.any) return ">=0.0.0";
      return ">=" + lowerBound(partial);

    case "<":
      if (partial.any) return ">=0.0.0";
      return "<" + lowerBound(partial);

    case "<=":
      if (partial.any) return ">=0.0.0";
      if (complete(partial)) return "<=" + versionString(partial);
      // "<=1.2" includes every 1.2.x, so it ends just before 1.3.0.
      return "<" + upperBound(partial);

    case "!":
    case "!=":
      if (!complete(partial)) {
        throw new Error(`"${token}" requires a complete version`);
      }
      return "!=" + versionString(partial);
  }

  throw new Error(`unknown comparator "${token}"`);
}

/**
 * partialVersion — a version that may leave the minor and/or patch segment
 * unspecified ("1", "1.2") or wildcarded ("1.x", "*").
 * { major, minor, patch: BigInt, minorSet, patchSet, prerelease, build, any }
 */

function complete(v) {
  return !v.any && v.minorSet && v.patchSet;
}

function versionString(v) {
  let version = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease !== "") version += "-" + v.prerelease;
  if (v.build !== "") version += "+" + v.build;
  return version;
}

/** Fills the missing segments with zeros: "1.2" -> "1.2.0". */
function lowerBound(v) {
  return versionString(v);
}

/**
 * The first version ABOVE everything the partial covers:
 * "1" -> "2.0.0", "1.2" -> "1.3.0", "1.2.3" -> "1.2.3".
 */
function upperBound(v) {
  if (!v.minorSet) return `${v.major + 1n}.0.0`;
  if (!v.patchSet) return `${v.major}.${v.minor + 1n}.0`;
  return versionString(v);
}

/**
 * npm caret semantics — "compatible with", where the left-most NON-ZERO
 * segment is the one that must not change:
 *
 *   ^1.2.3 -> <2.0.0    ^0.2.3 -> <0.3.0    ^0.0.3 -> <0.0.4
 *   ^1.2   -> <2.0.0    ^0.2   -> <0.3.0    ^0.0   -> <0.1.0
 *   ^1     -> <2.0.0    ^0     -> <1.0.0
 */
function caretUpperBound(v) {
  if (v.major > 0n || !v.minorSet) return `${v.major + 1n}.0.0`;
  if (v.minor > 0n || !v.patchSet) return `0.${v.minor + 1n}.0`;
  return `0.0.${v.patch + 1n}`;
}

/**
 * npm tilde semantics — patch-level changes when a minor is given, minor-level
 * changes otherwise:
 *
 *   ~1.2.3 -> <1.3.0    ~1.2 -> <1.3.0    ~1 -> <2.0.0
 */
function tildeUpperBound(v) {
  if (!v.minorSet) return `${v.major + 1n}.0.0`;
  return `${v.major}.${v.minor + 1n}.0`;
}

/** Mirrors parsePartialVersion. Throws on an unparseable partial version. */
function parsePartialVersion(value) {
  let version = typeof value === "string" ? value.trim() : "";
  if (version.startsWith("v")) version = version.substring(1);

  if (version === "" || version === "*" || version === "x" || version === "X") {
    return anyVersion();
  }

  let build = "";
  const buildIndex = version.indexOf("+");
  if (buildIndex >= 0) {
    build = version.substring(buildIndex + 1);
    version = version.substring(0, buildIndex);
    if (build === "") {
      throw new Error(`invalid build metadata in "${value}"`);
    }
  }

  let prerelease = "";
  const preIndex = version.indexOf("-");
  if (preIndex >= 0) {
    prerelease = version.substring(preIndex + 1);
    version = version.substring(0, preIndex);
    if (prerelease === "") {
      throw new Error(`invalid prerelease in "${value}"`);
    }
  }

  const segments = version.split(".");
  if (segments.length > 3) {
    throw new Error(`invalid version "${value}"`);
  }

  const parsed = {
    major: 0n,
    minor: 0n,
    patch: 0n,
    minorSet: false,
    patchSet: false,
    prerelease,
    build,
    any: false
  };

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];

    if (segment === "x" || segment === "X" || segment === "*") {
      // Everything after a wildcard is a wildcard too, so stop here.
      if (index === 0) return anyVersion();
      break;
    }

    const number = parseUint64(segment);
    if (number === null) {
      throw new Error(`invalid version "${value}"`);
    }

    if (index === 0) {
      parsed.major = number;
    } else if (index === 1) {
      parsed.minor = number;
      parsed.minorSet = true;
    } else if (index === 2) {
      parsed.patch = number;
      parsed.patchSet = true;
    }
  }

  if (parsed.prerelease !== "" && !complete(parsed)) {
    throw new Error(`a prerelease requires a complete version: "${value}"`);
  }

  return parsed;
}

function anyVersion() {
  return {
    major: 0n,
    minor: 0n,
    patch: 0n,
    minorSet: false,
    patchSet: false,
    prerelease: "",
    build: "",
    any: true
  };
}
