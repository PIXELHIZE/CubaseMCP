import type { CubaseAdapter } from "../adapters/CubaseAdapter.js";
import type { ToolDefinition } from "../tools/toolTypes.js";

export class UndoManager {
  constructor(private readonly adapter: CubaseAdapter) {}

  async snapshot(definition: ToolDefinition, requestId: string, dryRun: boolean): Promise<string | undefined> {
    if (dryRun || !definition.safety.changesState || !definition.safety.createsUndoSnapshot) return undefined;
    return this.adapter.createUndoSnapshot(`${definition.name}:${requestId}`);
  }
}
