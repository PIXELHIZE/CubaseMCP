export type DirectAccessRoot = "trackSelection" | "mixConsole" | "focusedQuickControls" | "transport";

export type DirectAccessRequest =
  | { type: "DA_GET_API_VERSION" }
  | { type: "DA_GET_CAPABILITIES" }
  | { type: "DA_DISCOVER_OBJECT_TREE"; root: DirectAccessRoot }
  | { type: "DA_GET_OBJECT_METADATA"; objectId: number }
  | { type: "DA_GET_CHILD_OBJECTS"; objectId: number }
  | { type: "DA_GET_PARAMETERS"; objectId: number }
  | { type: "DA_GET_PARAMETER"; objectId: number; parameterTag: number }
  | { type: "DA_SET_PARAMETER_PROCESS_VALUE"; objectId: number; parameterTag: number; value: number }
  | { type: "DA_SET_PARAMETER_PLAIN_VALUE"; objectId: number; parameterTag: number; plainValue: number }
  | { type: "DA_GET_PLUGIN_COLLECTIONS"; pluginSlotObjectId: number }
  | { type: "DA_SET_SLOT_PLUGIN"; pluginSlotObjectId: number; pluginUid: string }
  | { type: "DA_RESET_SLOT_PLUGIN"; pluginSlotObjectId: number }
  | { type: "DA_SUBSCRIBE_OBJECT_CHANGES" }
  | { type: "DA_SUBSCRIBE_PARAMETER_CHANGES"; objectId: number };

export type DirectAccessResponse = {
  ok: boolean;
  requestId: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    cubaseApiVersion?: string;
    objectId?: number;
    parameterTag?: number;
    raw?: unknown;
  };
};

export interface DirectAccessEnvelope {
  requestId: string;
  request: DirectAccessRequest;
}

export function makeDirectAccessEnvelope(requestId: string, request: DirectAccessRequest): DirectAccessEnvelope {
  return { requestId, request };
}

export function isDirectAccessResponse(value: unknown): value is DirectAccessResponse {
  return typeof value === "object" && value !== null && "ok" in value && "requestId" in value;
}
