import { runRealCubaseReport } from "./cubase-report.js";

const args = new Set(process.argv.slice(2));
const result = await runRealCubaseReport({ mode: "commands", executeDestructive: args.has("--execute-destructive") });
console.log(`Real Cubase command audit report: ${result.reportDirectory}`);
if (!result.success) process.exitCode = 1;
