import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const realCapabilityStatuses = [
  "real",
  "partial_direct_access",
  "partial_command_binding",
  "partial_current_setting_only",
  "partial_selection_dependent",
  "partial_bridge_required",
  "unknown_not_tested",
  "blocked_by_no_headless_api",
  "blocked_by_missing_cubase_side_bridge",
  "blocked_by_cubase_api",
  "mock_only"
] as const;

export type RealCapabilityStatus = (typeof realCapabilityStatuses)[number];

export interface ToolCapabilityEvidence {
  tool: string;
  status: RealCapabilityStatus;
  adapter: string;
  testedWithRealCubase: boolean;
  evidenceFile: string;
  limitation: string;
}

export interface DiagnosticErrorRecord {
  stage: string;
  code: string;
  message: string;
  timestamp: string;
  details?: unknown;
}

export interface RealCubaseReport {
  mode: "discover" | "smoke" | "commands" | "direct-access";
  timestamp: string;
  connected: boolean;
  handshake: unknown;
  directAccessTree: unknown;
  directAccessParameters: unknown;
  commandBindings: unknown;
  pluginManager: unknown;
  toolCapabilities: ToolCapabilityEvidence[];
  errors: DiagnosticErrorRecord[];
  crashDumps: unknown;
  nextActions: string[];
  smokeTests?: unknown;
}

function timestampFolder(timestamp: string): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", "<br>");
}

export class ReportWriter {
  constructor(private readonly baseDirectory = resolve("reports", "real-cubase")) {}

  async write(report: RealCubaseReport): Promise<string> {
    this.assertEvidenceInvariants(report.toolCapabilities);
    const directory = resolve(this.baseDirectory, timestampFolder(report.timestamp));
    await mkdir(directory, { recursive: true });

    await Promise.all([
      this.writeJson(directory, "raw-handshake.json", report.handshake),
      this.writeJson(directory, "direct-access-tree.json", report.directAccessTree),
      this.writeJson(directory, "direct-access-parameters.json", report.directAccessParameters),
      this.writeJson(directory, "command-bindings.json", report.commandBindings),
      this.writeJson(directory, "plugin-manager.json", report.pluginManager),
      this.writeJson(directory, "tool-capability-matrix.json", report.toolCapabilities),
      this.writeJson(directory, "errors.json", report.errors),
      this.writeJson(directory, "crash-dumps.json", report.crashDumps),
      writeFile(resolve(directory, "summary.md"), this.summary(report), "utf8"),
      writeFile(resolve(directory, "next-actions.md"), this.nextActions(report), "utf8"),
      ...(report.smokeTests === undefined ? [] : [this.writeJson(directory, "smoke-tests.json", report.smokeTests)])
    ]);
    return directory;
  }

  private assertEvidenceInvariants(capabilities: ToolCapabilityEvidence[]): void {
    const invalid = capabilities.filter((item) => item.status === "real" && !item.testedWithRealCubase);
    if (invalid.length > 0) {
      throw new Error(`Report invariant failed: untested tools cannot be real: ${invalid.map((item) => item.tool).join(", ")}`);
    }
  }

  private async writeJson(directory: string, name: string, value: unknown): Promise<void> {
    await writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  private summary(report: RealCubaseReport): string {
    const rows = report.toolCapabilities
      .map(
        (item) =>
          `| ${escapeCell(item.tool)} | ${item.status} | ${escapeCell(item.adapter)} | ${item.testedWithRealCubase} | ${escapeCell(item.evidenceFile)} | ${escapeCell(item.limitation)} |`
      )
      .join("\n");
    return [
      "# Real Cubase Capability Report",
      "",
      `- Timestamp: ${report.timestamp}`,
      `- Mode: ${report.mode}`,
      `- Cubase connected: ${report.connected}`,
      `- Screen automation used: false`,
      "",
      "| Tool | Status | Adapter | Tested With Real Cubase | Evidence File | Limitation |",
      "| ---- | ------ | ------- | ----------------------- | ------------- | ---------- |",
      rows,
      ""
    ].join("\n");
  }

  private nextActions(report: RealCubaseReport): string {
    const actions = report.nextActions.length > 0 ? report.nextActions : ["No automatic next action was generated."];
    return ["# Next Actions", "", ...actions.map((action, index) => `${index + 1}. ${action}`), ""].join("\n");
  }
}
