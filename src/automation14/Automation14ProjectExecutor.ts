import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { OperationContext, OperationResult } from "../adapters/CubaseAdapter.js";
import { PowerShellCubaseUiDriver } from "./PowerShellCubaseUiDriver.js";
import type { Automation14UiDriver } from "./types.js";

export class Automation14ProjectExecutor {
  constructor(private readonly ui: Automation14UiDriver = new PowerShellCubaseUiDriver()) {}

  async create(input: Record<string, unknown>, context: OperationContext): Promise<OperationResult> {
    const name = String(input.name);
    const directory = resolve(typeof input.directory === "string"
      ? input.directory
      : resolve(process.env.USERPROFILE ?? process.cwd(), "Documents", "Cubase Projects"));
    if (typeof input.template === "string" && input.template.length > 0) {
      throw new Error("automation14 project.create currently supports the Empty template only.");
    }
    const projectPath = resolve(directory, name, `${name}.cpr`);
    if (context.dryRun) return { changed: false, preview: { name, directory, projectPath, template: "Empty" } };
    await mkdir(directory, { recursive: true });
    const preflight = await this.ui.preflight();
    const blockingFailures = preflight.failures.filter((failure) => failure !== "Cubase must be maximized on the primary display.");
    if (blockingFailures.length > 0) throw new Error(`automation14 project preflight failed: ${blockingFailures.join("; ")}`);
    const created = await this.ui.createEmptyProject(name, directory);
    return {
      changed: created.created,
      adapter: "automation14",
      data: created,
      evidence: { requestId: context.requestId, reportFile: created.screenshotPath }
    };
  }
}
