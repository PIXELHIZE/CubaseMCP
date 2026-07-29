import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import {
  CubaseConnectionDoctor,
  type CubaseHandshakeEvidence
} from "../src/diagnostics/CubaseConnectionDoctor.js";
import { evaluateSafe14Preflight } from "../src/v2/Safe14Preflight.js";

function defaultOutputPath(): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return resolve("reports", "v2", `safe14-preflight-${timestamp}.json`);
}

const outputPath = resolve(process.argv[2] ?? defaultOutputPath());
const config = loadCubaseConfig(process.env).midi;
const connection = new CubaseConnectionDoctor(config);
const started = Date.now();
let handshake: CubaseHandshakeEvidence;
try {
  handshake = await connection.connect();
} catch (error) {
  const completed = Date.now();
  const message = error instanceof Error ? error.message : String(error);
  handshake = {
    connected: false,
    startedAt: new Date(started).toISOString(),
    completedAt: new Date(completed).toISOString(),
    durationMs: completed - started,
    ports: {
      expected: { input: config.inputName, output: config.outputName },
      available: { inputs: [], outputs: [] },
      inputFound: false,
      outputFound: false,
      likelyDirectionMismatch: false,
      valid: false,
      diagnoses: [message]
    },
    routerDiagnostics: connection.getRouter().getDiagnostics(),
    error: { code: "PREFLIGHT_RUNTIME_FAILED", message }
  };
} finally {
  await connection.disconnect();
}

const report = evaluateSafe14Preflight(handshake, {
  edition: process.env.CUBASE_HOST_EDITION
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`safe14 real-host preflight: ${report.passed ? "PASS" : "FAIL"}`);
console.log(`report: ${outputPath}`);
for (const blocker of report.blockers) {
  console.error(`${blocker.code}: ${blocker.message}`);
}
if (!report.passed) process.exitCode = 1;
