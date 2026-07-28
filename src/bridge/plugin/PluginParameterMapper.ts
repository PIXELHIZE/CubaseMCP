export interface PluginParameterAddress {
  objectId?: number;
  parameterTag?: number;
  pluginId?: string;
  parameterId: string;
  quickControl?: { focused: boolean; index: number };
}

export class PluginParameterMapper {
  parse(input: { pluginId?: unknown; parameterId?: unknown; objectId?: unknown; parameterTag?: unknown }): PluginParameterAddress {
    const parameterId = String(input.parameterId ?? input.parameterTag ?? "");
    const quickControlMatch = parameterId.match(/^(focusedQuickControl|selectedQuickControl|quickControl):(\d)$/);
    return {
      pluginId: input.pluginId === undefined ? undefined : String(input.pluginId),
      parameterId,
      objectId: input.objectId === undefined ? undefined : Number(input.objectId),
      parameterTag: input.parameterTag === undefined ? (/^\d+$/.test(parameterId) ? Number(parameterId) : undefined) : Number(input.parameterTag),
      quickControl: quickControlMatch
        ? { focused: quickControlMatch[1] !== "selectedQuickControl", index: Number(quickControlMatch[2]) }
        : undefined
    };
  }
}
