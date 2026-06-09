const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";

export function formatText(results) {
  const lines = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    if (result.issues.length === 0) continue;

    lines.push(`${BOLD}${result.file}${RESET}`);

    for (const issue of result.issues) {
      const lineNum = issue.line ? `${DIM}${issue.line}${RESET}:` : "";
      if (issue.severity === "error") {
        lines.push(`  ${lineNum} ${RED}ERROR${RESET}  ${DIM}[${issue.rule}]${RESET} ${issue.message}`);
        totalErrors++;
      } else {
        lines.push(`  ${lineNum} ${YELLOW}WARN${RESET}   ${DIM}[${issue.rule}]${RESET} ${issue.message}`);
        totalWarnings++;
      }
    }

    lines.push("");
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    lines.push(`${GREEN}No issues found.${RESET}`);
  } else {
    const parts = [];
    if (totalErrors > 0) parts.push(`${RED}${totalErrors} error${totalErrors === 1 ? "" : "s"}${RESET}`);
    if (totalWarnings > 0) parts.push(`${YELLOW}${totalWarnings} warning${totalWarnings === 1 ? "" : "s"}${RESET}`);
    lines.push(parts.join(", "));
  }

  return lines.join("\n");
}
