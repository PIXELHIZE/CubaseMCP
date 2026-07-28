import { z } from "zod/v4";
import { BaseInputShape, DirectAccessParameterTargetSchema, EmptyInputShape, TrackIdField, EnabledField } from "./commonSchemas.js";

export const ListPluginsInputShape = { ...BaseInputShape, query: z.string().optional(), includeLoaded: z.boolean().default(true).optional() };
export const LoadInstrumentInputShape = { ...BaseInputShape, ...TrackIdField, instrumentName: z.string().min(1), preset: z.string().optional(), pluginSlotObjectId: z.number().int().nonnegative().optional(), pluginUid: z.string().min(1).optional() };
export const AddInsertPluginInputShape = { ...BaseInputShape, ...TrackIdField, pluginName: z.string().min(1), slot: z.number().int().min(0).max(31).optional(), preset: z.string().optional(), pluginSlotObjectId: z.number().int().nonnegative().optional(), pluginUid: z.string().min(1).optional() };
export const PluginTargetInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().min(1).optional(), pluginSlotObjectId: z.number().int().nonnegative().optional(), directAccess: DirectAccessParameterTargetSchema.optional() };
export const PluginBooleanInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().min(1).optional(), ...EnabledField, directAccess: DirectAccessParameterTargetSchema.optional() };
export const GetPluginParametersInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().optional(), objectId: z.number().int().nonnegative().optional(), focused: z.boolean().default(true).optional() };
export const PluginParameterInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().optional(), parameterId: z.string().min(1), objectId: z.number().int().nonnegative().optional(), parameterTag: z.number().int().nonnegative().optional(), valueMode: z.enum(["process", "plain"]).default("process").optional(), value: z.union([z.number(), z.string(), z.boolean()]) };
export const LoadPluginPresetInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().min(1), presetName: z.string().min(1) };
export const LoadEffectInputShape = { ...BaseInputShape, ...TrackIdField, pluginName: z.string().min(1), slot: z.number().int().min(0).max(31).optional(), preset: z.string().optional(), pluginSlotObjectId: z.number().int().nonnegative().optional(), pluginUid: z.string().min(1).optional() };
export const GetPluginParameterInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().optional(), parameterId: z.string().min(1).optional(), objectId: z.number().int().nonnegative().optional(), parameterTag: z.number().int().nonnegative().optional() };
export const PluginSidechainInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().min(1).optional(), enabled: z.boolean().default(true).optional(), directAccess: DirectAccessParameterTargetSchema.optional() };
export const InstrumentOutputInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().optional(), outputIndex: z.number().int().min(0), enabled: z.boolean().default(true).optional() };
export const MultiOutputRoutingInputShape = { ...BaseInputShape, ...TrackIdField, pluginId: z.string().optional(), outputs: z.array(z.object({ outputIndex: z.number().int().min(0), targetTrackId: z.string().optional(), enabled: z.boolean().default(true).optional() })).min(1) };
export { EmptyInputShape };
