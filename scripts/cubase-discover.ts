import { runRealCubaseReport } from "./cubase-report.js";

const args = new Set(process.argv.slice(2));
const result = await runRealCubaseReport({
  mode: "discover",
  executeDestructive: args.has("--execute-destructive"),
  executePluginAssignment: args.has("--execute-plugin-assignment")
});
console.log(`Real Cubase discovery report: ${result.reportDirectory}`);
if (!result.success) process.exitCode = 1;
