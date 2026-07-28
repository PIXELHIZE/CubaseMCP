import { runRealCubaseReport } from "./cubase-report.js";

const result = await runRealCubaseReport({ mode: "smoke" });
console.log(`Real Cubase smoke report: ${result.reportDirectory}`);
if (!result.success) process.exitCode = 1;
