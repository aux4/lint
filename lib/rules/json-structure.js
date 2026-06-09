export function validateJsonStructure(content, filePath) {
  const issues = [];

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    issues.push({
      rule: "json-valid",
      severity: "error",
      message: `Invalid JSON: ${e.message}`,
      file: filePath
    });
    return { parsed: null, issues };
  }

  if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
    issues.push({
      rule: "profiles-required",
      severity: "error",
      message: "Missing or invalid 'profiles' array",
      file: filePath
    });
  }

  return { parsed, issues };
}
