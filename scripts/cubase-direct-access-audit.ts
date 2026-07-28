import { runRealCubaseReport } from "./cubase-report.js";

const args = new Set(process.argv.slice(2));
const result = await runRealCubaseReport({
  mode: "direct-access",
  executePluginAssignment: args.has("--execute-plugin-assignment")
});
console.log(`Real Cubase DirectAccess audit report: ${result.reportDirectory}`);
if (!result.success) process.exitCode = 1;
