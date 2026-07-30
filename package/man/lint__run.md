#### Description

The `run` command scans a directory for `.aux4` files and validates them against a comprehensive set of rules. It recursively searches the directory, skipping `node_modules` and `.git` directories.

The linter checks for:

- **JSON structure** — valid JSON, required `profiles` array
- **Main profile** — the `main` profile must exist as the entry point (skipped for extension packages)
- **Command structure** — commands must have `name` and `execute` fields; `private` must be boolean
- **Duplicates** — duplicate profile names, command names within a profile, and variable names within a command
- **Circular references** — profile references that form infinite loops
- **Profile references** — `profile:x` executors must point to existing profiles; cross-package references are allowed as warnings
- **Variable references** — `${var}` in execute arrays should match declared variables; built-in variables (`${response}`, `${item}`, `${index}`, `${packageDir}`, `${aux4HomeDir}`, `${configDir}`) are excluded; config-bound commands are skipped. Dot notation and array indexing are supported (`${obj.items[0].name}`), and shell parameter expansions like `${HOME:-/tmp}` are ignored
- **Condition variables** — variables used in `if()` conditions must be declared
- **Executor prefixes** — `set:`, `each:`, `range:`, `profile:`, `when:` must follow the correct format; unknown and misplaced prefixes are flagged (applied to both command `execute` arrays and hook steps). `set:` allows multiple `;`-separated assignments; `each:` runs a command per item in `${response}`. Recognized prefixes: `profile`, `set`, `log`, `nout`, `json`, `each`, `confirm`, `stdin`, `alias`, `debug`, `when`, `range`, `file`, `aux4`
- **Hooks** — the top-level `hooks` array is validated: each hook needs a `command` pattern (`profile/command` with `*` wildcards), `order` must be an integer, `params` an object of strings, and `before`/`after`/`error` arrays of steps; `profile:` and `stdin:` executors are not allowed in hook steps
- **Parameter functions** — variables in `value()`, `values()`, `param()`, `params()`, `object()` must be declared, either in `help.variables` or by a `set:` earlier in the same `execute` array; `*` is only valid in `value()`, `values()` and `object()`; `var*`/`var**` requires `multiple: true`; aliases are validated on the variable side only — `param(name:alias)` renames the flag and `object(name:key)` renames the output JSON key, while `params()` does **not** support aliases (the whole field is the variable path)
- **Encrypted variables** — `${encryptedX}` and `--encryptedX` must match a variable `x` with `encrypt: true`; `encrypt: true` requires `aux4/encrypter` in dependencies
- **Variable properties** — `arg`, `multiple`, `hide`, `encrypt` must be boolean; `options` must be string array; `env` and `default` must be strings; only one `arg: true` per command
- **Naming conventions** — command/profile names should use dashes, variable names should use camelCase (dot notation allowed for nested objects, e.g. `setting.timezone`)
- **File naming** — man/test files must use `__` for command hierarchy and `_` for special characters (e.g., `config__get.md`, not `config_get.md`); colon-profile entry pages like `ai_skill.md` are accepted
- **Metadata** — `scope`, `name`, `version` are required when any package field is present; `scope`/`name` are lowercase alphanumeric with dashes (may start with a digit); `system` entries must follow `prefix:package` format; `-local` version suffix is flagged
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
