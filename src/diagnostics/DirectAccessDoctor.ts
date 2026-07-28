import { randomUUID } from "node:crypto";
import type { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import {
  isDirectAccessResponse,
  makeDirectAccessEnvelope,
  type DirectAccessRequest,
  type DirectAccessResponse,
  type DirectAccessRoot
} from "../bridge/midi/DirectAccessProtocol.js";

export interface DirectAccessObjectEvidence {
  root: DirectAccessRoot;
  path: string;
  objectId: number;
  title?: string;
  typeName?: string;
  uniqueId?: string;
  childCount: number;
  parameterCount: number;
}

export interface DirectAccessParameterEvidence {
  root: DirectAccessRoot;
  objectPath: string;
  objectId: number;
  objectTitle?: string;
  objectTypeName?: string;
  parameterTag: number;
  title?: string;
  processValue?: number;
  defaultProcessValue?: number;
  plainValue?: number;
  displayValue?: string;
  units?: string;
  processValueType?: string;
  automatable?: boolean;
  editLocked?: boolean;
  writable: boolean;
  writeTestPossible: boolean;
}

export interface DirectAccessWriteTest {
  objectId: number;
  parameterTag: number;
  title?: string;
  before: unknown;
  executionValue?: number;
  after?: unknown;
  restoreValue?: number;
  restoredValue?: unknown;
  writeAccepted: boolean;
  valueChanged: boolean;
  restored: boolean;
  mode: "same-value" | "mutate-and-restore";
  error?: string;
}

export interface DirectAccessAuditResult {
  apiVersion?: unknown;
  capabilities?: unknown;
  roots: DirectAccessRoot[];
  trees: Record<string, unknown>;
  objects: DirectAccessObjectEvidence[];
  parameters: DirectAccessParameterEvidence[];
  categories: Record<string, number[]>;
  writeTests: DirectAccessWriteTest[];
  subscriptions: {
    objectChanges?: unknown;
    parameterChanges: Array<{ objectId: number; response?: unknown; error?: string }>;
  };
  errors: Array<{ root?: string; request?: string; message: string }>;
}

interface TreeNode {
  objectId?: number;
  title?: string;
  typeName?: string;
  uniqueId?: string;
  childCount?: number;
  parameterCount?: number;
  children?: TreeNode[];
  parameters?: Array<Record<string, unknown>>;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class DirectAccessDoctor {
  readonly roots: DirectAccessRoot[] = ["transport", "trackSelection", "mixConsole", "focusedQuickControls"];

  constructor(private readonly router: RequestResponseRouter) {}

  async request(request: DirectAccessRequest): Promise<DirectAccessResponse> {
    const requestId = randomUUID();
    const response = await this.router.request("direct_access", makeDirectAccessEnvelope(requestId, request));
    if (!isDirectAccessResponse(response.payload)) throw new Error("DirectAccess bridge returned an invalid structured response.");
    if (response.payload.requestId !== response.id && response.payload.requestId !== requestId) {
      throw new Error("DirectAccess response requestId does not correlate with the MIDI request.");
    }
    if (!response.payload.ok) throw new Error(`${response.payload.error?.code ?? "DIRECT_ACCESS_ERROR"}: ${response.payload.error?.message ?? "Unknown error"}`);
    return response.payload;
  }

  async audit(options: { testWrites?: boolean; mutateWrites?: boolean; maximumWriteTests?: number } = {}): Promise<DirectAccessAuditResult> {
    const result: DirectAccessAuditResult = {
      roots: [...this.roots],
      trees: {},
      objects: [],
      parameters: [],
      categories: {
        selectedTrackChannel: [],
        insertSlots: [],
        sendSlots: [],
        eq: [],
        quickControls: [],
        transport: []
      },
      writeTests: [],
      subscriptions: { parameterChanges: [] },
      errors: []
    };

    try {
      result.apiVersion = (await this.request({ type: "DA_GET_API_VERSION" })).data;
    } catch (error) {
      result.errors.push({ request: "DA_GET_API_VERSION", message: this.message(error) });
    }
    try {
      result.capabilities = (await this.request({ type: "DA_GET_CAPABILITIES" })).data;
    } catch (error) {
      result.errors.push({ request: "DA_GET_CAPABILITIES", message: this.message(error) });
    }

    for (const root of this.roots) {
      try {
        const data = (await this.request({ type: "DA_DISCOVER_OBJECT_TREE", root })).data;
        result.trees[root] = data;
        const tree = record(data).tree as TreeNode | undefined;
        if (tree) this.flattenTree(root, tree, root, result);
      } catch (error) {
        result.errors.push({ root, request: "DA_DISCOVER_OBJECT_TREE", message: this.message(error) });
      }
    }

    try {
      result.subscriptions.objectChanges = (await this.request({ type: "DA_SUBSCRIBE_OBJECT_CHANGES" })).data;
    } catch (error) {
      result.errors.push({ request: "DA_SUBSCRIBE_OBJECT_CHANGES", message: this.message(error) });
    }
    const parameterObjectIds = [...new Set(result.parameters.map((parameter) => parameter.objectId))].slice(0, 8);
    for (const objectId of parameterObjectIds) {
      try {
        result.subscriptions.parameterChanges.push({ objectId, response: (await this.request({ type: "DA_SUBSCRIBE_PARAMETER_CHANGES", objectId })).data });
      } catch (error) {
        result.subscriptions.parameterChanges.push({ objectId, error: this.message(error) });
      }
    }

    if (options.testWrites !== false) {
      const maximum = options.maximumWriteTests ?? Number(process.env.CUBASE_DISCOVERY_MAX_WRITE_TESTS ?? 8);
      const candidates = this.writeCandidates(result.parameters).slice(0, Math.max(0, maximum));
      for (const parameter of candidates) {
        result.writeTests.push(await this.testWrite(parameter, options.mutateWrites === true));
      }
    }
    return result;
  }

  private flattenTree(root: DirectAccessRoot, node: TreeNode, path: string, result: DirectAccessAuditResult): void {
    if (typeof node.objectId !== "number") return;
    const objectPath = `${path}/${node.title || node.typeName || node.objectId}`;
    const object: DirectAccessObjectEvidence = {
      root,
      path: objectPath,
      objectId: node.objectId,
      title: node.title,
      typeName: node.typeName,
      uniqueId: node.uniqueId,
      childCount: node.childCount ?? node.children?.length ?? 0,
      parameterCount: node.parameterCount ?? node.parameters?.length ?? 0
    };
    result.objects.push(object);
    this.categorize(object, result.categories);

    for (const rawParameter of node.parameters ?? []) {
      const tag = number(rawParameter.parameterTag);
      if (tag === undefined) continue;
      const writable = rawParameter.writable === true;
      result.parameters.push({
        root,
        objectPath,
        objectId: node.objectId,
        objectTitle: node.title,
        objectTypeName: node.typeName,
        parameterTag: tag,
        title: text(rawParameter.title),
        processValue: number(rawParameter.processValue),
        defaultProcessValue: number(rawParameter.defaultProcessValue),
        plainValue: number(rawParameter.plainValue),
        displayValue: text(rawParameter.displayValue),
        units: text(rawParameter.displayUnits),
        processValueType: text(rawParameter.processValueType),
        automatable: bool(rawParameter.automatable),
        editLocked: bool(rawParameter.editLocked),
        writable,
        writeTestPossible: writable && number(rawParameter.processValue) !== undefined
      });
    }
    for (const child of node.children ?? []) this.flattenTree(root, child, objectPath, result);
  }

  private categorize(object: DirectAccessObjectEvidence, categories: Record<string, number[]>): void {
    const label = `${object.path} ${object.title ?? ""} ${object.typeName ?? ""}`.toLowerCase();
    if (object.root === "trackSelection" && /mixer|channel|selected/.test(label)) categories.selectedTrackChannel.push(object.objectId);
    if (/insert|plugin.?slot|effect.?viewer|instrument.?plugin/.test(label)) categories.insertSlots.push(object.objectId);
    if (/send.?slot|sends?\//.test(label)) categories.sendSlots.push(object.objectId);
    if (/channel.?eq|eq.?band|equalizer/.test(label)) categories.eq.push(object.objectId);
    if (/quick.?control/.test(label)) categories.quickControls.push(object.objectId);
    if (object.root === "transport") categories.transport.push(object.objectId);
  }

  private writeCandidates(parameters: DirectAccessParameterEvidence[]): DirectAccessParameterEvidence[] {
    const unsafe = /record|play|start|stop|rewind|forward|delete|remove|reset|open|close|export/i;
    return parameters
      .filter((parameter) => parameter.writeTestPossible && !unsafe.test(`${parameter.objectPath} ${parameter.title ?? ""}`))
      .sort((left, right) => this.writePriority(left) - this.writePriority(right));
  }

  private writePriority(parameter: DirectAccessParameterEvidence): number {
    const label = `${parameter.objectPath} ${parameter.title ?? ""}`.toLowerCase();
    if (/quick.?control/.test(label)) return 0;
    if (/volume|pan/.test(label)) return 1;
    if (/mute|solo/.test(label)) return 2;
    if (/eq|send/.test(label)) return 3;
    return 10;
  }

  private async testWrite(parameter: DirectAccessParameterEvidence, mutate: boolean): Promise<DirectAccessWriteTest> {
    const mode = mutate ? "mutate-and-restore" : "same-value";
    const evidence: DirectAccessWriteTest = {
      objectId: parameter.objectId,
      parameterTag: parameter.parameterTag,
      title: parameter.title,
      before: undefined,
      writeAccepted: false,
      valueChanged: false,
      restored: false,
      mode
    };
    try {
      const before = record((await this.request({ type: "DA_GET_PARAMETER", objectId: parameter.objectId, parameterTag: parameter.parameterTag })).data);
      evidence.before = before;
      const original = number(before.processValue) ?? parameter.processValue;
      if (original === undefined) throw new Error("Parameter has no numeric process value.");
      const executionValue = mutate ? this.changedValue(original, parameter.processValueType) : original;
      evidence.executionValue = executionValue;
      await this.request({ type: "DA_SET_PARAMETER_PROCESS_VALUE", objectId: parameter.objectId, parameterTag: parameter.parameterTag, value: executionValue });
      evidence.writeAccepted = true;
      await wait(100);
      const after = record((await this.request({ type: "DA_GET_PARAMETER", objectId: parameter.objectId, parameterTag: parameter.parameterTag })).data);
      evidence.after = after;
      evidence.valueChanged = number(after.processValue) !== original;
      evidence.restoreValue = original;
      await this.request({ type: "DA_SET_PARAMETER_PROCESS_VALUE", objectId: parameter.objectId, parameterTag: parameter.parameterTag, value: original });
      await wait(100);
      const restored = record((await this.request({ type: "DA_GET_PARAMETER", objectId: parameter.objectId, parameterTag: parameter.parameterTag })).data);
      evidence.restoredValue = restored;
      evidence.restored = this.nearlyEqual(number(restored.processValue), original);
    } catch (error) {
      evidence.error = this.message(error);
    }
    return evidence;
  }

  private changedValue(original: number, valueType?: string): number {
    if (/bool|toggle|switch/i.test(valueType ?? "") || original === 0 || original === 1) return original >= 0.5 ? 0 : 1;
    return original > 0.99 ? Math.max(0, original - 0.01) : Math.min(1, original + 0.01);
  }

  private nearlyEqual(value: number | undefined, expected: number): boolean {
    return value !== undefined && Math.abs(value - expected) < 0.0001;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
