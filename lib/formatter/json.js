export function formatJson(results) {
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === "error") {
        totalErrors++;
      } else {
        totalWarnings++;
      }
    }
  }

  return JSON.stringify({
    results,
    summary: {
      files: results.length,
      errors: totalErrors,
      warnings: totalWarnings
    }
  }, null, 2);
}
