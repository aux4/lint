# Release notes

## Fixes

- `lint run` no longer crashes when a command in a `.aux4` file has no `name`
  field. A nameless command reached `findCommandLine`, which built a regular
  expression from the missing name and threw `Cannot read properties of
  undefined (reading 'replace')`. That exception aborted the entire run for the
  directory, so every other file went unlinted and the user saw a stack trace
  instead of results.

  The run now completes and reports the nameless command as a `command-name`
  error (a command with no name is unreachable), alongside every other finding
  in the directory.

  ```text
  4: ERROR  [command-name] Command in profile 'main' missing 'name' field
  ```

  `findCommandLine`, `findProfileLine` and the underlying `escapeRegex` helper
  are now defensive against non-string node values, so no malformed `.aux4` can
  take down the whole run — a linter that crashes on bad input hides every other
  finding in the directory, which is worse than missing one line number.
