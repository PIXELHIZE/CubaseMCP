import type { DirectAccessDoctor, DirectAccessAuditResult, DirectAccessObjectEvidence } from "./DirectAccessDoctor.js";

interface PluginEntry {
  pluginUid?: string;
  name?: string;
  title?: string;
  vendor?: string;
}

export interface PluginManagerAuditResult {
  available: boolean;
  capabilityReported: boolean;
  slotsExamined: number;
  collections: unknown[];
  pluginEntries: PluginEntry[];
  assignmentSupported: boolean;
  dryRunSupported: boolean;
  assignmentExecuted: boolean;
  assignmentRestored: boolean;
  assignmentResult?: unknown;
  restoreResult?: unknown;
  errors: Array<{ objectId?: number; message: string }>;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function collectEntries(value: unknown, output: PluginEntry[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectEntries(item, output);
    return;
  }
  const object = record(value);
  if (typeof object.pluginUid === "string") {
    output.push({
      pluginUid: object.pluginUid,
      name: typeof object.name === "string" ? object.name : undefined,
      title: typeof object.title === "string" ? object.title : undefined,
      vendor: typeof object.vendor === "string" ? object.vendor : undefined
    });
  }
  for (const nested of Object.values(object)) if (typeof nested === "object" && nested !== null) collectEntries(nested, output);
}

export class PluginManagerDoctor {
  constructor(private readonly directAccess: DirectAccessDoctor) {}

  async audit(directAudit: DirectAccessAuditResult, options: { executePluginAssignment?: boolean } = {}): Promise<PluginManagerAuditResult> {
    const capabilities = record(directAudit.capabilities);
    const extended = record(capabilities.extendedV13);
    const capabilityReported = extended.pluginManager === true;
    const result: PluginManagerAuditResult = {
      available: false,
      capabilityReported,
      slotsExamined: 0,
      collections: [],
      pluginEntries: [],
      assignmentSupported: false,
      dryRunSupported: true,
      assignmentExecuted: false,
      assignmentRestored: false,
      errors: []
    };
    const slots = this.slotObjects(directAudit.objects).slice(0, Number(process.env.CUBASE_DISCOVERY_MAX_PLUGIN_SLOTS ?? 16));
    for (const slot of slots) {
      result.slotsExamined += 1;
      try {
        const response = await this.directAccess.request({ type: "DA_GET_PLUGIN_COLLECTIONS", pluginSlotObjectId: slot.objectId });
        const data = record(response.data);
        result.available = true;
        result.assignmentSupported ||= data.assignmentSupported === true;
        result.collections.push({ object: slot, ...data });
        collectEntries(data.collections, result.pluginEntries);
      } catch (error) {
        result.errors.push({ objectId: slot.objectId, message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (options.executePluginAssignment && result.assignmentSupported) {
      const slot = slots[0];
      const normalizedTitle = (slot?.title ?? "").trim().toLowerCase();
      const original = result.pluginEntries.find((candidate) => candidate.pluginUid && [candidate.name, candidate.title].some((label) => label?.trim().toLowerCase() === normalizedTitle));
      const replacement = result.pluginEntries.find((candidate) => candidate.pluginUid && candidate.pluginUid !== original?.pluginUid);
      if (slot && original?.pluginUid && replacement?.pluginUid) {
        try {
          result.assignmentResult = (
            await this.directAccess.request({ type: "DA_SET_SLOT_PLUGIN", pluginSlotObjectId: slot.objectId, pluginUid: replacement.pluginUid })
          ).data;
          result.assignmentExecuted = record(result.assignmentResult).accepted === true;
          if (!result.assignmentExecuted) throw new Error("Cubase plugin manager rejected the replacement assignment.");
          result.restoreResult = (
            await this.directAccess.request({ type: "DA_SET_SLOT_PLUGIN", pluginSlotObjectId: slot.objectId, pluginUid: original.pluginUid })
          ).data;
          result.assignmentRestored = record(result.restoreResult).accepted === true;
          if (!result.assignmentRestored) throw new Error("Cubase accepted plugin assignment but rejected restoration of the original plugin.");
        } catch (error) {
          result.errors.push({ objectId: slot.objectId, message: error instanceof Error ? error.message : String(error) });
        }
      } else {
        result.errors.push({ objectId: slot?.objectId, message: "Assignment was refused because the current slot plugin UID or a distinct replacement UID could not be identified safely." });
      }
    }
    return result;
  }

  private slotObjects(objects: DirectAccessObjectEvidence[]): DirectAccessObjectEvidence[] {
    const seen = new Set<number>();
    return objects.filter((object) => {
      const label = `${object.path} ${object.title ?? ""} ${object.typeName ?? ""}`;
      const matches = /insert|plugin.?slot|effect.?viewer|instrument.?plugin/i.test(label);
      if (!matches || seen.has(object.objectId)) return false;
      seen.add(object.objectId);
      return true;
    });
  }
}
