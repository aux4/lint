# Release notes

## Features

- New `dependency-version` rule (severity `error`). Every `dependencies` entry
  in a package `.aux4` now has its version token validated at lint time, using
  the same grammar the package manager applies when it resolves the dependency
  — so a reference that could never install is caught before publish instead of
  at a user's install.

  A complete version (`1.2.3`), a prerelease (`1.0.0-local`), `latest` and an
  omitted version are accepted as-is. npm-style range syntax (`^`, `~`, `>=`,
  `>`, `<=`, `<`, `=`, `!=`, x-ranges, `*`, hyphen ranges, `||`, space-separated
  AND) is parsed and reported when malformed. Anything that is neither — an
  empty version, `banana`, `v1.2.3`, `1.2.3.4` — is reported.

  ```text
  9: ERROR  [dependency-version] Dependency 'aux4/config@~>1.2.3' has an invalid version range '~>1.2.3' — invalid version range "~>1.2.3": unknown comparator "~>1.2.3"
  ```

## Fixes

- A bare partial version such as `aux4/config@2.0` or `@2` is now reported. The
  package manager parses it as an *exact* reference rather than a range, which
  is deliberate and unchanged — but an exact reference only matches a version
  published under that literal name, and nothing is published as `2.0`, so the
  dependency fails to install. Write `~2.0` or `2.0.x` for the range that was
  meant.

- `metadata-dependencies` no longer warns on a legitimate range. Its format
  pattern previously required the version to look like `x.y.z`, so it flagged
  `aux4/api@^2.0.0` and even `aux4/api@latest`. The pattern now accepts any
  version token and version validity is checked by `dependency-version`.
