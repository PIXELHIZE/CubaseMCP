import type { ToolDefinition } from "../tools/toolTypes.js";
import type { Capability } from "../state/CapabilityMatrix.js";

export interface DryRunPlan {
  tool: string;
  operation: string;
  adapter: string;
  status: Capability["status"];
  changesState: boolean;
  destructive: boolean;
  confirmationRequired: boolean;
  affectedObjects: Array<{ field: string; value: unknown }>;
  fallbackAdapters: string[];
  limitations: string[];
  usesScreenAutomation: false;
}

export class DryRunPlanner {
  plan(definition: ToolDefinition, input: Record<string, unknown>, capability: Capability): DryRunPlan {
    const affectedObjects: Array<{ field: string; value: unknown }> = [];
    for (const field of ["trackId", "trackIds", "eventId", "eventIds", "partId", "noteId", "noteIds", "pluginId", "markerId", "jobId", "path", "filePath"]) {
      if (input[field] !== undefined) affectedObjects.push({ field, value: input[field] });
    }
    return {
      tool: definition.name,
      operation: definition.operation,
      adapter: capability.primaryAdapter,
      status: capability.status,
      changesState: definition.safety.changesState,
      destructive: definition.safety.destructive === true,
      confirmationRequired: definition.safety.destructive === true || (definition.safety.mayOverwriteFiles === true && input.overwrite === true),
      affectedObjects,
      fallbackAdapters: [...capability.fallbackAdapters],
      limitations: [...capability.limitations],
      usesScreenAutomation: false
    };
  }
}
