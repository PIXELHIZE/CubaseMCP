import { z } from "zod/v4";
import { BaseInputShape, DirectAccessParameterTargetSchema, TrackIdField } from "./commonSchemas.js";

export const AutomationTargetSchema = z.object({
  type: z.enum(["volume", "pan", "pluginParameter", "send", "tempo"]),
  pluginId: z.string().optional(),
  parameterId: z.string().optional(),
  sendIndex: z.number().int().min(0).max(31).optional()
});

export const CreateAutomationLaneInputShape = { ...BaseInputShape, ...TrackIdField, target: AutomationTargetSchema };
export const AutomationPointInputShape = { ...BaseInputShape, laneId: z.string().min(1), position: z.string().min(1), value: z.number(), curve: z.enum(["step", "linear", "bezier"]).default("linear").optional() };
export const AutomationPointIdInputShape = { ...BaseInputShape, laneId: z.string().min(1), pointId: z.string().min(1) };
export const EditAutomationPointInputShape = { ...AutomationPointIdInputShape, position: z.string().optional(), value: z.number().optional(), curve: z.enum(["step", "linear", "bezier"]).optional() };
export const AutomationCurveInputShape = { ...BaseInputShape, laneId: z.string().min(1), pointIds: z.array(z.string()).optional(), curve: z.enum(["step", "linear", "bezier"]), tension: z.number().min(-1).max(1).optional() };
export const AutomationModeInputShape = { ...BaseInputShape, ...TrackIdField, enabled: z.boolean(), directAccess: DirectAccessParameterTargetSchema.optional() };
export const WriteAutomationInputShape = { ...BaseInputShape, ...TrackIdField, target: AutomationTargetSchema.optional(), points: z.array(z.object({ position: z.string().min(1), value: z.number(), curve: z.enum(["step", "linear", "bezier"]).optional() })).min(1) };
export const SmoothAutomationInputShape = { ...BaseInputShape, laneId: z.string().min(1), amount: z.number().min(0).max(1), range: z.object({ start: z.string(), end: z.string() }).optional() };
export const TrimAutomationInputShape = { ...BaseInputShape, laneId: z.string().min(1), delta: z.number(), range: z.object({ start: z.string(), end: z.string() }).optional() };
