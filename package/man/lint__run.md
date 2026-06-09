#### Description

The `run` command scans a directory for `.aux4` files and validates them against a comprehensive set of rules. It recursively searches the directory, skipping `node_modules` and `.git` directories.

The linter checks for:

- **JSON structure** — valid JSON, required `profiles` array
- **Main profile** — the `main` profile must exist as the entry point (skipped for extension packages)
- **Command structure** — commands must have `name` and `execute` fields; `private` must be boolean
- **Duplicates** — duplicate profile names, command names within a profile, and variable names within a command
- **Circular references** — profile references that form infinite loops
- **Profile references** — `profile:x` executors must point to existing profiles; cross-package references are allowed as warnings
- **Variable references** — `${var}` in execute arrays should match declared variables; built-in variables (`${response}`, `${packageDir}`, `${aux4HomeDir}`) are excluded; config-bound commands are skipped
- **Condition variables** — variables used in `if()` conditions must be declared
- **Executor prefixes** — `set:`, `each:`, `profile:` must follow the correct format; unknown and misplaced prefixes are flagged
- **Parameter functions** — variables in `value()`, `values()`, `param()`, `params()`, `object()` must be declared; `*` is only valid in `value()` and `values()`; `var*`/`var**` requires `multiple: true`; `param(name:alias)` and `param(name**)` are supported
- **Encrypted variables** — `${encryptedX}` and `--encryptedX` must match a variable `x` with `encrypt: true`; `encrypt: true` requires `aux4/encrypter` in dependencies
- **Variable properties** — `arg`, `multiple`, `hide`, `encrypt` must be boolean; `options` must be string array; `env` and `default` must be strings; only one `arg: true` per command
- **Naming conventions** — command/profile names should use dashes, variable names should use camelCase
- **File naming** — man/test files must use `__` for command hierarchy and `_` for special characters (e.g., `config__get.md`, not `config_get.md`)
- **Metadata** — `scope`, `name`, `version` are required when any package field is present; `system` entries must follow `prefix:package` format; `-local` version suffix is flagged
- **Best practices** — unused profiles, missing help text, missing descriptions

Issues are classified as errors (structural problems, exit code `1`) or warnings (conventions and best practices, exit code `0`).

Use `--strict` to treat `-local` version suffixes as errors for CI/production pipelines.

Use `--resolve` to validate `aux4` command calls in execute arrays against installed command signatures via `aux4 <cmd> --help --json`.

#### Usage

```bash
aux4 lint run [--dir <path>] [--format <text|json>] [--strict <true|false>] [--resolve <true|false>]
```

--dir      Directory to scan for .aux4 files (default: `.`)
--format   Output format: `text` for human-readable or `json` for machine-parseable (default: `text`)
--strict   Strict mode for CI/production — treats `-local` versions as errors (default: `false`)
--resolve  Resolve `aux4` command calls to validate flags and parameters (default: `false`)

#### Example

```bash
aux4 lint run --dir ./package
```

```text
/path/to/package/.aux4
  2: ERROR  [metadata-scope] Invalid 'scope' value '<scope>' — must be lowercase alphanumeric with optional dashes
  14: WARN   [unused-profile] Profile 'old-commands' is defined but never referenced
  18: WARN   [naming-command] Command 'sendEmail' in profile 'main' uses camelCase — use dashes instead (e.g., 'send-email')

1 error, 2 warnings
```

```bash
aux4 lint run --format json
```

```json
{
  "results": [
    {
      "file": ".aux4",
      "issues": []
    }
  ],
  "summary": {
    "files": 1,
    "errors": 0,
    "warnings": 0
  }
}
```

```bash
aux4 lint run --strict true --resolve true
```

```text
No issues found.
```
