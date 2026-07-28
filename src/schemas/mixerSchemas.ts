import { z } from "zod/v4";
import { BaseInputShape, DirectAccessParameterTargetSchema, DirectAccessParameterWriteSchema, EmptyInputShape, TrackIdField, EnabledField } from "./commonSchemas.js";

export const TrackVolumeInputShape = { ...BaseInputShape, ...TrackIdField, volumeDb: z.number().min(-144).max(24), directAccess: DirectAccessParameterTargetSchema.optional() };
export const TrackPanInputShape = { ...BaseInputShape, ...TrackIdField, pan: z.number().min(-1).max(1), directAccess: DirectAccessParameterTargetSchema.optional() };
export const InputGainInputShape = { ...BaseInputShape, ...TrackIdField, gainDb: z.number().min(-60).max(24), directAccess: DirectAccessParameterTargetSchema.optional() };
export const PhaseInvertInputShape = { ...BaseInputShape, ...TrackIdField, ...EnabledField, directAccess: DirectAccessParameterTargetSchema.optional() };
export const SendLevelInputShape = { ...BaseInputShape, ...TrackIdField, sendIndex: z.number().int().min(0).max(31), levelDb: z.number().min(-144).max(24), directAccess: DirectAccessParameterTargetSchema.optional() };
export const SendEnableInputShape = { ...BaseInputShape, ...TrackIdField, sendIndex: z.number().int().min(0).max(31), ...EnabledField, directAccess: DirectAccessParameterTargetSchema.optional() };
export const RoutingInputShape = { ...BaseInputShape, ...TrackIdField, inputBus: z.string().optional(), outputBus: z.string().optional(), targetTrackId: z.string().optional() };
export const SidechainRoutingInputShape = { ...BaseInputShape, sourceTrackId: z.string().min(1), targetTrackId: z.string().min(1), pluginId: z.string().optional() };
export const EqBandInputShape = {
  ...BaseInputShape,
  ...TrackIdField,
  band: z.number().int().min(1).max(8),
  enabled: z.boolean().default(true).optional(),
  frequencyHz: z.number().positive(),
  gainDb: z.number().min(-24).max(24),
  q: z.number().positive().default(1).optional(),
  type: z.string().optional(),
  directAccessWrites: z.array(DirectAccessParameterWriteSchema).min(1).optional()
};
export const ChannelStripInputShape = { ...BaseInputShape, ...TrackIdField, module: z.string().min(1), parameters: z.record(z.string(), z.unknown()).default({}).optional() };
export const MeterLevelsInputShape = { ...BaseInputShape, trackIds: z.array(z.string()).optional() };
export const AddSendInputShape = { ...BaseInputShape, ...TrackIdField, destination: z.string().min(1), sendIndex: z.number().int().min(0).max(31).optional(), levelDb: z.number().min(-144).max(24).default(-6).optional(), preFader: z.boolean().default(false).optional() };
export const RemoveSendInputShape = { ...BaseInputShape, ...TrackIdField, sendIndex: z.number().int().min(0).max(31) };
export const GroupRoutingInputShape = { ...BaseInputShape, trackIds: z.array(z.string()).min(1), groupTrackId: z.string().min(1) };
export const VcaInputShape = { ...BaseInputShape, vcaTrackId: z.string().min(1), trackIds: z.array(z.string()).min(1) };
export const AutomationModeInputShape = { ...BaseInputShape, ...TrackIdField, enabled: z.boolean(), directAccess: DirectAccessParameterTargetSchema.optional() };
export { EmptyInputShape };
