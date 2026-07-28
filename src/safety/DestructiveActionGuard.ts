import type { ToolDefinition } from "../tools/toolTypes.js";
import { CubaseMcpError, ErrorCode } from "./ErrorCodes.js";

export class DestructiveActionGuard {
  assertAllowed(definition: ToolDefinition, input: Record<string, unknown>, dryRun: boolean, confirmed: boolean, preview?: unknown): void {
    if (dryRun) return;
    const destructive = definition.safety.destructive === true;
    const overwrite = definition.safety.mayOverwriteFiles === true && input.overwrite === true;
    if ((destructive || overwrite) && !confirmed) {
      throw new CubaseMcpError(
        ErrorCode.ConfirmationRequired,
        `${definition.name} requires confirm:true before execution.`,
        { destructive, overwrite, preview },
        true
      );
    }
  }
}
