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
| `variable-reference` | warn | `${var}` in execute arrays should reference declared variables (skipped for config-bound commands) |
| `condition-variable` | warn | Variables in `if()` conditions must be declared |

### Executors

| Rule | Severity | Description |
|------|----------|-------------|
| `executor-profile` | error | `profile:` must be followed by a profile name |
| `executor-set` | error | `set:` must follow `set:varName=value` or `set:varName=!command` format |
| `executor-each` | error | `each:` must follow `each:${variable} command` format |
| `unknown-executor` | warn | Instruction starts with an unrecognized executor prefix |
| `misplaced-executor` | warn | Known executor prefix appears mid-instruction instead of at the beginning |

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
| `naming-variable` | warn | Variable names should use camelCase, not dashes |
| `file-naming` | error | Man/test files must use `__` for command hierarchy and `_` for special characters |

### Metadata

| Rule | Severity | Description |
|------|----------|-------------|
| `metadata-scope` | error | Required when any package field is present; must be lowercase alphanumeric |
| `metadata-name` | error | Required when any package field is present; must be lowercase with optional dashes |
| `metadata-version` | error | Required when any package field is present; must follow semver |
| `version-local` | warn/error | `-local` version suffix (error with `--strict`) |
| `metadata-description` | error | Must be a string if present |
| `metadata-license` | error | Must be a string if present |
| `metadata-git` | warn | Should be an HTTPS or git+ssh URL |
| `metadata-tags` | error | Must be an array of strings |
| `metadata-dependencies` | warn | Should follow `scope/name` format |
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
