// Profile references
export const PROFILE_REF = /^(?:if\([^)]*\)\s*(?:&&|\|\|)\s*)?profile:(\S+)/;
export const PROFILE_REF_ELSE = /\|\|\s*profile:(\S+)/;

// Variable references
export const SET_VAR = /^set:([a-zA-Z_][a-zA-Z0-9_.]*)=/;
export const VAR_REF = /\$\{([^}]+)\}/g;

// Encrypted variables
export const ENCRYPTED_VAR = /\$\{encrypted([A-Z][a-zA-Z0-9]*)\}/g;
export const ENCRYPTED_FLAG = /--encrypted([A-Z][a-zA-Z0-9]*)/g;
export const ENCRYPTED_PREFIX = /^encrypted[A-Z]/;

// Parameter functions
export const VALUES_FN = /\b(values?)\(([^)]*)\)/g;
export const PARAMS_FN = /\b(params?)\(([^)]*)\)/g;
export const OBJECT_FN = /\b(object)\(([^)]*)\)/g;
export const MULTI_SUFFIX = /\*{1,2}$/;

// Naming
export const CAMEL_CASE = /[a-z][A-Z]/;
export const CAMEL_CASE_VALID = /^[a-z][a-zA-Z0-9]*$/;
export const UNDERSCORE = /_/;
export const WHITESPACE = /\s/;

// Metadata
export const SEMVER = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
export const LOCAL_VERSION = /-local/;
export const SCOPE_FORMAT = /^[a-z0-9][a-z0-9-]*$/;
export const NAME_FORMAT = /^[a-z0-9][a-z0-9-]*$/;
export const DEPENDENCY_FORMAT = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(@\d+\.\d+\.\d+)?$/;

// Conditionals
export const CONDITIONAL = /^if\([^)]*\)\s*&&\s*/;

// Built-in variables that don't need to be declared.
// These are auto-injected by aux4 core at runtime:
//   response     - output of the previous instruction
//   item, index  - current element/index inside an each: loop
//   packageDir   - directory of the .aux4 file (command.Ref.Dir)
//   aux4HomeDir  - ~/.aux4.config
//   configDir    - resolved config directory
// (value/key are kept for backward compatibility with older patterns.)
export const BUILTIN_VARIABLES = new Set([
  "response",
  "packageDir",
  "aux4HomeDir",
  "configDir",
  "item",
  "index",
  "value",
  "key"
]);
