import { lint } from "../lib/linter.js";
import { formatText } from "../lib/formatter/text.js";
import { formatJson } from "../lib/formatter/json.js";

const args = process.argv.slice(2);
const command = args[0];
const dir = args[1] || ".";
const format = args[2] || "text";
const strict = args[3] === "true";
const resolve = args[4] === "true";

async function main() {
  if (command === "run") {
    const results = await lint(dir, { strict, resolve });

    if (format === "json") {
      console.log(formatJson(results));
    } else {
      console.log(formatText(results));
    }

    const hasErrors = results.some(r => r.issues.some(i => i.severity === "error"));
    process.exit(hasErrors ? 1 : 0);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
