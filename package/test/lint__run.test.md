# lint run

## valid .aux4 file

```file:sample/.aux4
{
  "scope": "test",
  "name": "sample",
  "version": "1.0.0",
  "description": "A sample package",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "hello",
          "execute": [
            "echo Hello"
          ],
          "help": {
            "text": "Say hello"
          }
        }
      ]
    }
  ]
}
```

### should report no issues

```execute
aux4 lint run --dir sample
```

```expect:partial
No issues found.
```

## invalid JSON

```file:bad-json/.aux4
{ invalid json }
```

### should report JSON error

```execute
aux4 lint run --dir bad-json 2>&1 || true
```

```expect:partial
*?
   ERROR  [json-valid] Invalid JSON: *?
**1 error
```

## missing main profile

```file:no-main/.aux4
{
  "profiles": [
    {
      "name": "other",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test command"
          }
        }
      ]
    }
  ]
}
```

### should report missing main profile

```execute
aux4 lint run --dir no-main 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [main-profile] Missing required 'main' profile
*?
1 error
```

## missing profiles array

```file:no-profiles/.aux4
{
  "scope": "test",
  "name": "no-profiles",
  "version": "1.0.0",
  "description": "Missing profiles"
}
```

### should report missing profiles

```execute
aux4 lint run --dir no-profiles 2>&1 || true
```

```expect:partial
*?
  *ERROR  [profiles-required] Missing or invalid 'profiles' array
*?
1 error
```

## command missing execute

```file:no-execute/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "broken"
        }
      ]
    }
  ]
}
```

### should report missing execute array

```execute
aux4 lint run --dir no-execute 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [command-execute] Command 'broken' in profile 'main' missing or invalid 'execute' array
  *: WARN   [missing-help] Command 'broken' in profile 'main' missing 'help' field
*?
1 error, 1 warning
```

## profile reference to non-existent profile

```file:bad-ref/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "profile:deploy"
          ],
          "help": {
            "text": "Deploy"
          }
        }
      ]
    }
  ]
}
```

### should report non-existent profile reference

```execute
aux4 lint run --dir bad-ref 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [profile-reference] Command 'deploy' in profile 'main' references non-existent profile 'deploy'
*?
1 error
```

## naming conventions

```file:bad-names/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "sendEmail",
          "execute": [
            "echo send"
          ],
          "help": {
            "text": "Send email",
            "variables": [
              {
                "name": "to-address",
                "text": "Recipient"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### should warn about camelCase command name

```execute
aux4 lint run --dir bad-names
```

```expect:partial
*?
  *: WARN   [naming-command] Command 'sendEmail' in profile 'main' uses camelCase — use dashes instead (e.g., 'send-email')
  *: WARN   [naming-variable] Variable 'to-address' in command 'sendEmail' is not camelCase — use 'toAddress' instead
*?
2 warnings
```

### should warn about snake_case

```file:snake-names/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "send_email",
          "execute": [
            "echo send"
          ],
          "help": {
            "text": "Send email",
            "variables": [
              {
                "name": "to_address",
                "text": "Recipient"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir snake-names
```

```expect:partial
*?
  *: WARN   [naming-command] Command 'send_email' in profile 'main' uses underscores — use dashes instead (e.g., 'send-email')
  *: WARN   [naming-variable] Variable 'to_address' in command 'send_email' is not camelCase — use 'toAddress' instead
*?
2 warnings
```

## unused profile

```file:unused/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "hello",
          "execute": [
            "echo hello"
          ],
          "help": {
            "text": "Say hello"
          }
        }
      ]
    },
    {
      "name": "orphan",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

### should warn about unused profile

```execute
aux4 lint run --dir unused
```

```expect:partial
*?
  *: WARN   [unused-profile] Profile 'orphan' is defined but never referenced
*?
1 warning
```

## missing help

```file:no-help/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "build",
          "execute": [
            "npm run build"
          ]
        }
      ]
    }
  ]
}
```

### should warn about missing help

```execute
aux4 lint run --dir no-help
```

```expect:partial
*?
  *: WARN   [missing-help] Command 'build' in profile 'main' missing 'help' field
*?
1 warning
```

## json output format

```file:json-out/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "hello",
          "execute": [
            "echo hello"
          ],
          "help": {
            "text": "Say hello"
          }
        }
      ]
    }
  ]
}
```

### should output valid JSON with summary

```execute
aux4 lint run --dir json-out --format json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(JSON.stringify(d.summary))"
```

```expect:json
{
  "files": 1,
  "errors": 0,
  "warnings": 0
}
```

## executor prefix validation

### invalid set format

```file:bad-set/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "set:noequals"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-set 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [executor-set] Command 'test' in profile 'main' has invalid 'set:' format — expected 'set:varName=value' or 'set:varName=!command'
*?
1 error
```

### unknown executor prefix

```file:bad-prefix/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "foo:bar"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-prefix
```

```expect:partial
*?
  *: WARN   [unknown-executor] Command 'test' in profile 'main' uses unknown executor prefix 'foo:' — known prefixes: profile, set, log, nout, json, each, confirm, stdin, alias, debug
*?
1 warning
```

### profile: without name

```file:empty-profile/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "profile:"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir empty-profile 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [executor-profile] Command 'test' in profile 'main' has 'profile:' without a profile name
*?
1 error
```

### valid conditionals should not error

```file:valid-cond/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "if(env==prod) && log:deploying || log:skipping"
          ],
          "help": {
            "text": "Deploy",
            "variables": [
              {
                "name": "env",
                "text": "Environment"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir valid-cond
```

```expect:partial
No issues found.
```

### invalid each format

```file:bad-each/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "each:notavar"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-each 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [executor-each] Command 'test' in profile 'main' has invalid 'each:' format — expected 'each:${variable} command'
*?
1 error
```

### misplaced executor prefix

```file:misplaced/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo hello && log:done"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir misplaced
```

```expect:partial
*?
  *: WARN   [misplaced-executor] Command 'test' in profile 'main' has 'log:' mid-instruction — executor prefixes must be at the beginning
*?
1 warning
```

## metadata validation

### profiles-only file should pass

```file:profiles-only/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "build",
          "execute": [
            "npm run build"
          ],
          "help": {
            "text": "Build"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir profiles-only
```

```expect:partial
No issues found.
```

### missing scope and name when version is present

```file:partial-meta/.aux4
{
  "version": "1.0.0",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir partial-meta 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [metadata-scope] Package metadata missing required 'scope' field
  *: ERROR  [metadata-name] Package metadata missing required 'name' field
*?
2 errors
```

### invalid scope format

```file:bad-scope/.aux4
{
  "scope": "My-Scope",
  "name": "test",
  "version": "1.0.0",
  "description": "Test package",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-scope 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [metadata-scope] Invalid 'scope' value 'My-Scope' — must be lowercase alphanumeric with optional dashes
*?
1 error
```

### invalid version format

```file:bad-version/.aux4
{
  "scope": "aux4",
  "name": "test",
  "version": "not-a-version",
  "description": "Test package",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-version 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [metadata-version] Invalid 'version' value 'not-a-version' — must follow semantic versioning (e.g., '1.0.0')
*?
1 error
```

### local version

```file:local-ver/.aux4
{
  "scope": "aux4",
  "name": "test",
  "version": "1.0.0-local",
  "description": "Test package",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

#### without strict is a warning

```execute
aux4 lint run --dir local-ver
```

```expect:partial
*?
  *: WARN   [version-local] Version '1.0.0-local' contains '-local' suffix — must not be committed or published
*?
1 warning
```

#### with strict is an error

```execute
aux4 lint run --dir local-ver --strict true 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [version-local] Version '1.0.0-local' contains '-local' suffix — must not be committed or published
*?
1 error
```

### invalid dependencies format

```file:bad-deps/.aux4
{
  "scope": "aux4",
  "name": "test",
  "version": "1.0.0",
  "description": "Test package",
  "dependencies": ["not-valid-format"],
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-deps
```

```expect:partial
*?
  *: WARN   [metadata-dependencies] Dependency 'not-valid-format' should follow 'scope/name' format (e.g., 'aux4/config')
*?
1 warning
```

### invalid system format

```file:bad-system/.aux4
{
  "scope": "aux4",
  "name": "test",
  "version": "1.0.0",
  "description": "Test package",
  "system": "not-an-array",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-system 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [metadata-system] 'system' must be an array of arrays
*?
1 error
```

## no .aux4 files found

### should report error when directory has no .aux4 files

```execute
aux4 lint run --dir /tmp 2>&1 || true
```

```expect:partial
*?
   ERROR  [no-files] No .aux4 files found in '/tmp'
*?
1 error
```

## line numbers in output

```file:line-nums/.aux4
{
  "scope": "aux4",
  "name": "line-nums",
  "version": "1.0.0",
  "description": "Test line numbers",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "profile:deploy"
          ],
          "help": {
            "text": "Deploy"
          }
        }
      ]
    }
  ]
}
```

### should include line number in json output

```execute
aux4 lint run --dir line-nums --format json 2>&1 | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const i=d.results[0].issues[0];console.log(JSON.stringify({rule:i.rule,severity:i.severity,line:i.line}))"
```

```expect:json
{
  "rule": "profile-reference",
  "severity": "error",
  "line": 11
}
```

## file naming validation

### single underscore instead of double in man page

```file:bad-man-name/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "config",
          "execute": [
            "profile:config"
          ],
          "help": {
            "text": "Config commands"
          }
        }
      ]
    },
    {
      "name": "config",
      "commands": [
        {
          "name": "get",
          "execute": [
            "echo get"
          ],
          "help": {
            "text": "Get config"
          }
        }
      ]
    }
  ]
}
```

```file:bad-man-name/man/config_get.md
#### Description

Get a config value.
```

```execute
aux4 lint run --dir bad-man-name 2>&1 || true
```

```expect:partial
*?
  *ERROR  [file-naming] man/ file 'config_get.md' uses single underscore — use double underscore '__' to separate command hierarchy (e.g., 'config__get')
**
```

### single underscore instead of double in test file

```file:bad-test-name/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "lint",
          "execute": [
            "profile:lint"
          ],
          "help": {
            "text": "Lint commands"
          }
        }
      ]
    },
    {
      "name": "lint",
      "commands": [
        {
          "name": "run",
          "execute": [
            "echo run"
          ],
          "help": {
            "text": "Run linter"
          }
        }
      ]
    }
  ]
}
```

```file:bad-test-name/test/lint_run.test.md
# lint run
## should work
```

```execute
aux4 lint run --dir bad-test-name 2>&1 || true
```

```expect:partial
*?
  *ERROR  [file-naming] test/ file 'lint_run.test.md' uses single underscore — use double underscore '__' to separate command hierarchy (e.g., 'lint__run')
**
```

### correct double underscore should pass

```file:good-names/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "lint",
          "execute": [
            "profile:lint"
          ],
          "help": {
            "text": "Lint commands"
          }
        }
      ]
    },
    {
      "name": "lint",
      "commands": [
        {
          "name": "run",
          "execute": [
            "echo run"
          ],
          "help": {
            "text": "Run linter"
          }
        }
      ]
    }
  ]
}
```

```file:good-names/man/lint__run.md
#### Description

Run the linter.
```

```file:good-names/test/lint__run.test.md
# lint run
## should work
```

```execute
aux4 lint run --dir good-names
```

```expect:partial
No issues found.
```

## parameter function validation

### undeclared variable in values()

```file:bad-param-fn/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "node deploy.js values(env, region)"
          ],
          "help": {
            "text": "Deploy",
            "variables": [
              {
                "name": "env",
                "text": "Environment"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-param-fn
```

```expect:partial
*?
  *: WARN   [param-function] Command 'deploy' in profile 'main' uses 'region' in values() but it is not declared in help.variables
**
```

### valid values() should pass

```file:good-param-fn/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "node deploy.js values(env, region)"
          ],
          "help": {
            "text": "Deploy",
            "variables": [
              {
                "name": "env",
                "text": "Environment"
              },
              {
                "name": "region",
                "text": "Region"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir good-param-fn
```

```expect:partial
No issues found.
```

### wildcard * in value and values should pass

```file:value-star/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "proxy",
          "execute": [
            "node proxy.js value(*)"
          ],
          "help": {
            "text": "Proxy command"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir value-star
```

```expect:partial
No issues found.
```

### wildcard * in param should warn

```file:param-star/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "node test.js param(*)"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir param-star
```

```expect:partial
*?
  *: WARN   [param-function] Command 'test' in profile 'main' uses '*' in param() — '*' is only supported in value() and values()
**
```

### param with alias and double star should pass

```file:param-alias/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "tag",
          "execute": [
            "docker tag param(image:i) param(tags**)"
          ],
          "help": {
            "text": "Tag image",
            "variables": [
              {
                "name": "image",
                "text": "Image name"
              },
              {
                "name": "tags",
                "text": "Tags",
                "multiple": true
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir param-alias
```

```expect:partial
No issues found.
```

### var* without multiple true should warn

```file:bad-multi/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "send",
          "execute": [
            "node send.js values(to*, subject)"
          ],
          "help": {
            "text": "Send message",
            "variables": [
              {
                "name": "to",
                "text": "Recipient"
              },
              {
                "name": "subject",
                "text": "Subject"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-multi
```

```expect:partial
*?
  *: WARN   [param-multiple] Command 'send' in profile 'main' uses 'to*' in values() but 'to' does not have 'multiple: true'
**
```

### var* with multiple true should pass

```file:good-multi/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "send",
          "execute": [
            "node send.js values(to*, subject)"
          ],
          "help": {
            "text": "Send message",
            "variables": [
              {
                "name": "to",
                "text": "Recipients",
                "multiple": true
              },
              {
                "name": "subject",
                "text": "Subject"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir good-multi
```

```expect:partial
No issues found.
```

## variable property validation

### invalid boolean type for arg

```file:bad-var-type/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo ${name}"
          ],
          "help": {
            "text": "Test",
            "variables": [
              {
                "name": "name",
                "text": "Name",
                "arg": "yes",
                "default": 123
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-var-type 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [variable-type] Variable 'name' in command 'test' has 'arg' that is not a boolean
  *: ERROR  [variable-type] Variable 'name' in command 'test' has 'default' that is not a string
**
```

### encrypt without dependency

```file:encrypt-nodep/.aux4
{
  "scope": "aux4",
  "name": "encrypt-nodep",
  "version": "1.0.0",
  "description": "Test encrypt",
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "echo ${password}"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "password",
                "text": "Password",
                "encrypt": true
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir encrypt-nodep
```

```expect:partial
*?
  *: WARN   [encrypt-dependency] Variable 'password' in command 'login' uses 'encrypt: true' but 'aux4/encrypter' is not in dependencies
**
```

### encrypt with dependency should pass

```file:encrypt-dep/.aux4
{
  "scope": "aux4",
  "name": "encrypt-dep",
  "version": "1.0.0",
  "description": "Test encrypt",
  "dependencies": ["aux4/encrypter"],
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "echo ${password}"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "password",
                "text": "Password",
                "encrypt": true
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir encrypt-dep
```

```expect:partial
No issues found.
```

### multiple arg true

```file:multi-arg/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "copy",
          "execute": [
            "cp ${source} ${dest}"
          ],
          "help": {
            "text": "Copy files",
            "variables": [
              {
                "name": "source",
                "text": "Source file",
                "arg": true
              },
              {
                "name": "dest",
                "text": "Destination",
                "arg": true
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir multi-arg
```

```expect:partial
*?
  *: WARN   [multiple-args] Command 'copy' in profile 'main' has 2 positional arguments (arg: true) — only the last positional argument is used
**
```

### private as non-boolean

```file:bad-private/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "internal",
          "private": "true",
          "execute": [
            "echo internal"
          ],
          "help": {
            "text": "Internal command"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-private 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [command-private] Command 'internal' in profile 'main' has 'private' field that is not a boolean
**
```

## config integration

### commands with config variable should not warn about undeclared vars

```file:config-cmd/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "log:Deploying to ${host}:${port}"
          ],
          "help": {
            "text": "Deploy",
            "variables": [
              {
                "name": "config",
                "text": "Config section"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir config-cmd
```

```expect:partial
No issues found.
```

## resolve mode

### invalid flag on aux4 command

```file:bad-resolve/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "run-tests",
          "execute": [
            "aux4 test run --dir ${dir} --verbose true"
          ],
          "help": {
            "text": "Run tests",
            "variables": [
              {
                "name": "dir",
                "text": "Test directory"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-resolve --resolve true
```

```expect:partial
*?
  *: WARN   [resolve-flag] Command 'run-tests' in profile 'main' passes '--verbose' to 'aux4 test run' but 'verbose' is not a recognized parameter
**
```

#### without resolve flag should not check aux4 calls

```execute
aux4 lint run --dir bad-resolve
```

```expect:partial
No issues found.
```

### valid aux4 call should pass with resolve

```file:good-resolve/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "run-tests",
          "execute": [
            "aux4 test run --dir ${dir}"
          ],
          "help": {
            "text": "Run tests",
            "variables": [
              {
                "name": "dir",
                "text": "Test directory"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir good-resolve --resolve true
```

```expect:partial
No issues found.
```

## duplicate detection

### duplicate profile names

```file:dup-profile/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "hello",
          "execute": [
            "echo hello"
          ],
          "help": {
            "text": "Hello"
          }
        }
      ]
    },
    {
      "name": "main",
      "commands": [
        {
          "name": "world",
          "execute": [
            "echo world"
          ],
          "help": {
            "text": "World"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir dup-profile 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [duplicate-profile] Profile 'main' is defined more than once
**
```

### duplicate command names in same profile

```file:dup-command/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "build",
          "execute": [
            "echo build1"
          ],
          "help": {
            "text": "Build v1"
          }
        },
        {
          "name": "build",
          "execute": [
            "echo build2"
          ],
          "help": {
            "text": "Build v2"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir dup-command 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [duplicate-command] Command 'build' is defined more than once in profile 'main'
**
```

### duplicate variable names in same command

```file:dup-var/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo ${name}"
          ],
          "help": {
            "text": "Test",
            "variables": [
              {
                "name": "name",
                "text": "First name"
              },
              {
                "name": "name",
                "text": "Last name"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir dup-var 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [duplicate-variable] Variable 'name' is defined more than once in command 'test' of profile 'main'
**
```

## circular profile references

### should detect circular reference

```file:circular/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "a",
          "execute": [
            "profile:group-a"
          ],
          "help": {
            "text": "Group A"
          }
        }
      ]
    },
    {
      "name": "group-a",
      "commands": [
        {
          "name": "b",
          "execute": [
            "profile:group-b"
          ],
          "help": {
            "text": "Group B"
          }
        }
      ]
    },
    {
      "name": "group-b",
      "commands": [
        {
          "name": "a",
          "execute": [
            "profile:group-a"
          ],
          "help": {
            "text": "Back to A"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir circular 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [circular-profile] Circular profile reference detected involving 'group-a'
**
```

## if() condition variable validation

### undeclared variable in if() condition

```file:bad-if/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "if(env==prod) && echo deploying"
          ],
          "help": {
            "text": "Deploy"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-if
```

```expect:partial
*?
  *: WARN   [condition-variable] Command 'deploy' in profile 'main' uses 'env' in if() condition but it is not declared
**
```

### declared variable in if() should pass

```file:good-if/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "deploy",
          "execute": [
            "if(env==prod) && echo deploying"
          ],
          "help": {
            "text": "Deploy",
            "variables": [
              {
                "name": "env",
                "text": "Environment"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir good-if
```

```expect:partial
No issues found.
```

## system entry format validation

### missing prefix in system entry

```file:no-sys-prefix/.aux4
{
  "scope": "aux4",
  "name": "no-sys-prefix",
  "version": "1.0.0",
  "description": "Test system prefix",
  "system": [
    [
      "test:node --version",
      "node"
    ]
  ],
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir no-sys-prefix 2>&1 || true
```

```expect:partial
*?
  *: ERROR  [metadata-system] system[0] entry 'node' must follow 'prefix:package' format (e.g., 'brew:node', 'test:node --version')
**
```

### custom system prefix should pass

```file:custom-sys/.aux4
{
  "scope": "aux4",
  "name": "custom-sys",
  "version": "1.0.0",
  "description": "Test custom system prefix",
  "system": [
    [
      "test:node --version",
      "snap:node",
      "choco:nodejs"
    ]
  ],
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "test",
          "execute": [
            "echo test"
          ],
          "help": {
            "text": "Test"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir custom-sys
```

```expect:partial
No issues found.
```

## encrypted variable validation

### encryptedPassword without matching variable

```file:enc-no-var/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "curl -u ${user}:${encryptedPassword} https://api.example.com"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "user",
                "text": "Username"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir enc-no-var
```

```expect:partial
*?
  *: WARN   [encrypted-variable] Command 'login' in profile 'main' references 'encryptedPassword' but variable 'password' is not declared
**
```

### encryptedPassword without encrypt true

```file:enc-no-flag/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "curl -u ${user}:${encryptedPassword} https://api.example.com"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "user",
                "text": "Username"
              },
              {
                "name": "password",
                "text": "Password"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir enc-no-flag
```

```expect:partial
*?
  *: WARN   [encrypted-variable] Command 'login' in profile 'main' references 'encryptedPassword' but variable 'password' does not have 'encrypt: true'
**
```

### encryptedPassword with encrypt true should pass

```file:enc-ok/.aux4
{
  "scope": "aux4",
  "name": "enc-ok",
  "version": "1.0.0",
  "description": "Test encrypted vars",
  "dependencies": ["aux4/encrypter"],
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "curl -u ${user}:${encryptedPassword} https://api.example.com"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "user",
                "text": "Username"
              },
              {
                "name": "password",
                "text": "Password",
                "encrypt": true
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir enc-ok
```

```expect:partial
No issues found.
```

### --encryptedPassword flag should also be validated

```file:enc-flag/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "login",
          "execute": [
            "aux4 auth login --encryptedToken ${token}"
          ],
          "help": {
            "text": "Login",
            "variables": [
              {
                "name": "token",
                "text": "Auth token"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir enc-flag
```

```expect:partial
*?
  *: WARN   [encrypted-variable] Command 'login' in profile 'main' references 'encryptedToken' but variable 'token' does not have 'encrypt: true'
**
```

## profile naming convention

### wrong profile name for nested command

```file:bad-prof-name/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "email",
          "execute": [
            "profile:mail-commands"
          ],
          "help": {
            "text": "Email commands"
          }
        }
      ]
    },
    {
      "name": "mail-commands",
      "commands": [
        {
          "name": "send",
          "execute": [
            "echo send"
          ],
          "help": {
            "text": "Send email"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-prof-name
```

```expect:partial
*?
  *: WARN   [profile-naming] Command 'email' in profile 'main' routes to 'profile:mail-commands' but convention expects 'profile:email'
**
```

### correct 4-level nested profile naming should pass

```file:good-prof-name/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "ai",
          "execute": [
            "profile:ai"
          ],
          "help": {
            "text": "AI commands"
          }
        }
      ]
    },
    {
      "name": "ai",
      "commands": [
        {
          "name": "agent",
          "execute": [
            "profile:ai:agent"
          ],
          "help": {
            "text": "Agent commands"
          }
        }
      ]
    },
    {
      "name": "ai:agent",
      "commands": [
        {
          "name": "config",
          "execute": [
            "profile:ai:agent:config"
          ],
          "help": {
            "text": "Agent config"
          }
        },
        {
          "name": "ask",
          "execute": [
            "echo asking"
          ],
          "help": {
            "text": "Ask the agent"
          }
        }
      ]
    },
    {
      "name": "ai:agent:config",
      "commands": [
        {
          "name": "get",
          "execute": [
            "echo get config"
          ],
          "help": {
            "text": "Get config value"
          }
        },
        {
          "name": "set",
          "execute": [
            "echo set config"
          ],
          "help": {
            "text": "Set config value"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir good-prof-name
```

```expect:partial
No issues found.
```

### wrong naming at 3rd level should warn

```file:bad-nested/.aux4
{
  "profiles": [
    {
      "name": "main",
      "commands": [
        {
          "name": "ai",
          "execute": [
            "profile:ai"
          ],
          "help": {
            "text": "AI commands"
          }
        }
      ]
    },
    {
      "name": "ai",
      "commands": [
        {
          "name": "agent",
          "execute": [
            "profile:agent"
          ],
          "help": {
            "text": "Agent commands"
          }
        }
      ]
    },
    {
      "name": "agent",
      "commands": [
        {
          "name": "config",
          "execute": [
            "profile:config"
          ],
          "help": {
            "text": "Agent config"
          }
        }
      ]
    },
    {
      "name": "config",
      "commands": [
        {
          "name": "get",
          "execute": [
            "echo get"
          ],
          "help": {
            "text": "Get value"
          }
        }
      ]
    }
  ]
}
```

```execute
aux4 lint run --dir bad-nested
```

```expect:partial
*?
  *: WARN   [profile-naming] Command 'agent' in profile 'ai' routes to 'profile:agent' but convention expects 'profile:ai:agent'
  *: WARN   [profile-naming] Command 'config' in profile 'agent' routes to 'profile:config' but convention expects 'profile:agent:config'
**
```
