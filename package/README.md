# aux4/lint

Linter for `.aux4` configuration files. Validates JSON structure, naming conventions, reference integrity, parameter functions, encrypted variables, and best practices.

## Installation

```bash
aux4 aux4 pkger install aux4/lint
```

## Quick Start

```bash
aux4 lint run
```

Lint a specific directory:

```bash
aux4 lint run --dir ./my-package
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dir` | Directory to scan for `.aux4` files | `.` |
| `--format` | Output format: `text` or `json` | `text` |
| `--strict` | Treat `-local` versions as errors (for CI/production) | `false` |
| `--resolve` | Resolve `aux4` command calls to validate flags and parameters | `false` |

## Output

### Text (default)

Output includes ANSI colors, line numbers, and a summary:

```text
/path/to/package/.aux4
  2: ERROR  [metadata-scope] Invalid 'scope' value '<scope>' — must be lowercase alphanumeric with optional dashes
  3: ERROR  [metadata-name] Invalid 'name' value '<name>' — must be lowercase alphanumeric with optional dashes
  14: WARN   [missing-help] Command 'build' in profile 'main' missing 'help' field

2 errors, 1 warning
```

### JSON

```bash
aux4 lint run --format json
```

```json
{
  "results": [
    {
      "file": "/path/to/package/.aux4",
      "issues": [
        {
          "rule": "main-profile",
          "severity": "error",
          "message": "Missing required 'main' profile",
          "file": "/path/to/package/.aux4",
          "line": 7
        }
      ]
    }
  ],
  "summary": {
    "files": 1,
    "errors": 1,
    "warnings": 0
  }
}
```

## Strict Mode

Use `--strict true` in CI/production to treat `-local` version suffixes as errors instead of warnings:

```bash
aux4 lint run --strict true
```

## Resolve Mode

Use `--resolve true` to validate `aux4` command calls in execute arrays against the installed command signatures via `aux4 <cmd> --help --json`:

```bash
aux4 lint run --resolve true
```

This checks that `--flag` names passed to `aux4` commands match declared parameters. Requires aux4 and target packages to be installed.

## Validation Rules

### Structure

| Rule | Severity | Description |
|------|----------|-------------|
| `json-valid` | error | File contains valid JSON |
| `profiles-required` | error | `profiles` array must exist |
| `main-profile` | error | `main` profile must be defined (skipped for extension packages with colon-notation profiles) |
| `profile-name` | error | Every profile must have a `name` field |
| `profile-commands` | error | Every profile must have a `commands` array |
| `command-name` | error | Every command must have a `name` field |
| `command-execute` | error | Every command must have an `execute` array |
| `command-private` | error | `private` field must be a boolean |
| `duplicate-profile` | error | Profile names must be unique |
| `duplicate-command` | error | Command names must be unique within a profile |
| `duplicate-variable` | error | Variable names must be unique within a command |
| `circular-profile` | error | Profile references must not form cycles |

### References

| Rule | Severity | Description |
|------|----------|-------------|
| `profile-reference` | error/warn | `profile:x` executors must reference existing profiles (warns for cross-package references) |
| `variable-reference` | warn | `${var}` in execute arrays should reference declared variables (skipped for config-bound commands). Supports dot notation and array indexing (`${obj.items[0].name}`); shell expansions like `${HOME:-/tmp}` are ignored |
| `condition-variable` | warn | Variables in `if()` conditions must be declared |

### Executors

| Rule | Severity | Description |
|------|----------|-------------|
| `executor-profile` | error | `profile:` must be followed by a profile name |
| `executor-set` | error | `set:` must follow `set:varName=value` or `set:varName=!command` format (multiple `;`-separated assignments allowed) |
| `executor-each` | error | `each:` must have a command to run for each item in `${response}` (e.g. `each:echo ${item}`) |
| `executor-range` | warn | `range:` must follow `range:N` or `range:start-end` format |
| `executor-when` | warn | `when:` must follow `when:condition:command` format (a missing command silently does nothing) |
| `unknown-executor` | warn | Instruction starts with an unrecognized executor prefix |
| `misplaced-executor` | warn | Known executor prefix appears mid-instruction instead of at the beginning |

Recognized executor prefixes: `profile`, `set`, `log`, `nout`, `json`, `each`, `confirm`, `stdin`, `alias`, `debug`, `when`, `range`, `file`, `aux4`.

Executor rules apply both to command `execute` arrays and to hook `before`/`after`/`error` steps.

### Hooks

The top-level `hooks` array is validated for structure, and each hook's `before`/`after`/`error` steps are run through the same executor checks as command `execute` arrays.

| Rule | Severity | Description |
|------|----------|-------------|
| `hooks-structure` | error | `hooks` must be an array |
| `hook-structure` | error | Each hook must be an object |
| `hook-command` | error/warn | Hook requires a non-empty `command` (error); pattern should be `profile/command` with `*` wildcards (warn) |
| `hook-order` | error | `order` must be an integer |
| `hook-params` | error | `params` must be an object of string values |
| `hook-steps` | error | `before`, `after`, `error` must be arrays of strings |
| `hook-empty` | warn | Hook should define at least one of `before`, `after`, or `error` |
| `hook-executor` | error | `profile:` and `stdin:` executors are not allowed in hook steps |

### Parameter Functions

| Rule | Severity | Description |
|------|----------|-------------|
| `param-function` | warn | Variables in `value()`, `values()`, `param()`, `params()`, `object()` must be declared |
| `param-multiple` | warn | `var*` or `var**` suffix requires `multiple: true` on the variable |

Supports `value(*)` (all params as JSON), `param(name:alias)` (flag aliasing), `param(name**)` (multi-value expansion), and `$` prefix stripping.

### Encrypted Variables

| Rule | Severity | Description |
|------|----------|-------------|
| `encrypted-variable` | warn | `${encryptedX}` or `--encryptedX` must have a matching variable `x` with `encrypt: true` |
| `encrypt-dependency` | warn | Variables with `encrypt: true` require `aux4/encrypter` in dependencies |

### Variable Properties

| Rule | Severity | Description |
|------|----------|-------------|
| `variable-type` | error | `arg`, `multiple`, `hide`, `encrypt` must be boolean; `options` must be string array; `env` and `default` must be strings |
| `multiple-args` | warn | Only one variable per command should have `arg: true` |

### Naming Conventions

| Rule | Severity | Description |
|------|----------|-------------|
| `naming-profile` | warn | Profile names should use dashes, not camelCase |
| `naming-command` | warn | Command names should use dashes, not camelCase |
| `naming-variable` | warn | Variable names should use camelCase, not dashes (dot notation allowed for nested objects, e.g. `setting.timezone`) |
| `file-naming` | error | Man/test files must use `__` for command hierarchy and `_` for special characters |

### Dependency Versions

A dependency may pin a version or declare an npm-style semver range:

```json
{
  "dependencies": [
    "aux4/config",
    "aux4/config@latest",
    "aux4/config@1.2.3",
    "aux4/config@1.0.0-local",
    "aux4/config@^1.2.3",
    "aux4/config@~1.2",
    "aux4/config@1.x",
    "aux4/config@*",
    "aux4/config@>=1.0.0 <2.0.0",
    "aux4/config@1.2.3 - 2.0.0",
    "aux4/config@^1.0.0 || ^2.0.0"
  ]
}
```

The `dependency-version` rule parses the version token with the same grammar the package manager uses when it resolves the dependency, so a malformed range is reported at lint time instead of at a user's install:

```text
  9: ERROR  [dependency-version] Dependency 'aux4/config@~>1.2.3' has an invalid version range '~>1.2.3' — invalid version range "~>1.2.3": unknown comparator "~>1.2.3"
```

A token that is not range syntax is treated as an exact reference — a complete version (`1.2.3`), a prerelease (`1.0.0-local`), `latest`, and an omitted version are all accepted as-is, never reported as malformed ranges.

Anything else is reported, because it can never resolve to a published version:

```text
  9: ERROR  [dependency-version] Dependency 'aux4/config@2.0' has an invalid version '2.0' — use a complete version (1.2.3), a range (^1.2.0, 1.2.x) or 'latest'
```

**Note:** a bare partial such as `2.0` or `2` is not a range. The package manager parses it as an *exact* reference — that is deliberate backward compatibility and is not changing — but an exact reference only matches a version published under that literal name, and no package publishes a version called `2.0`, so the dependency fails to install. Write `~2.0` or `2.0.x` for the range that was meant.

Supported range syntax: `^`, `~`, `>=`, `>`, `<=`, `<`, `=`, `!=`, x-ranges (`1.x`, `1.2.X`), `*`, hyphen ranges (`1.2.3 - 2.0.0`), `||` for OR and whitespace for AND.

### Metadata

| Rule | Severity | Description |
|------|----------|-------------|
| `metadata-scope` | error | Required when any package field is present; must be lowercase alphanumeric with optional dashes (may start with a digit) |
| `metadata-name` | error | Required when any package field is present; must be lowercase alphanumeric with optional dashes (may start with a digit, e.g. `2table`) |
| `metadata-version` | error | Required when any package field is present; must follow semver |
| `version-local` | warn/error | `-local` version suffix (error with `--strict`) |
| `metadata-description` | error | Must be a string if present |
| `metadata-license` | error | Must be a string if present |
| `metadata-git` | warn | Should be an HTTPS or git+ssh URL |
| `metadata-tags` | error | Must be an array of strings |
| `metadata-dependencies` | warn | Should follow `scope/name` or `scope/name@version` format |
| `dependency-version` | error | The version token of a dependency must be a complete version, `latest`, or a parseable semver range |
| `metadata-system` | error | Must be array of arrays; entries must follow `prefix:package` format; first entry should be `test:` |
| `metadata-unknown` | warn | Unknown top-level fields |

### Resolve Mode (--resolve)

| Rule | Severity | Description |
|------|----------|-------------|
| `resolve-flag` | warn | `--flag` passed to an `aux4` command must match a declared parameter |
| `resolve-subcommand` | warn | Calling a command group without specifying a subcommand |

### Best Practices

| Rule | Severity | Description |
|------|----------|-------------|
| `unused-profile` | warn | Profiles should be referenced by at least one `profile:x` executor |
| `missing-help` | warn | Commands should have a `help` field |
| `missing-help-text` | warn | Help objects should have a `text` field |
| `missing-variable-text` | warn | Variables should have a `text` field |
| `missing-description` | warn | Package metadata should have a `description` field |

## Config Integration

Commands that declare a `config` or `configFile` variable use `--config` binding, which auto-populates variables from config.yaml at runtime. The linter skips `variable-reference` and `param-function` checks for these commands since the variable values come from the config file.

## Extension Packages

Packages that extend a parent package's profile tree (e.g., `db:mysql`, `aux4:releaser`) are detected by colon-notation in profile names. For these packages:

- The `main-profile` check is skipped
- The first profile is treated as the entry point for `unused-profile` detection
- Profile references that look like cross-package references are downgraded to warnings

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No errors found (warnings may be present) |
| `1` | One or more errors found |

## Commands

| Command | Description |
|---------|-------------|
| `aux4 lint run` | Run the linter on `.aux4` files |
