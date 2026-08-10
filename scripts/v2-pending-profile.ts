import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { makePendingSafe14Manifest } from "../src/v2/CapabilityRegistry.js";

const outputPath = resolve(process.argv[2] ?? "reports/v2/safe14.pending.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(makePendingSafe14Manifest(), null, 2)}\n`, "utf8");
console.log(outputPath);

