import { z } from "zod/v4";
import { BaseInputShape, EmptyInputShape, EnabledField, PositionField } from "./commonSchemas.js";

export { EmptyInputShape };

export const SetPositionInputShape = { ...BaseInputShape, ...PositionField };
export const SetLocatorsInputShape = { ...BaseInputShape, left: z.string().min(1), right: z.string().min(1) };
export const SetCycleInputShape = { ...BaseInputShape, ...EnabledField };
export const SetMetronomeInputShape = { ...BaseInputShape, ...EnabledField };
export const SetPunchInOutInputShape = { ...BaseInputShape, punchIn: z.string().min(1).optional(), punchOut: z.string().min(1).optional(), enabled: z.boolean().default(true).optional() };
export const NudgePositionInputShape = { ...BaseInputShape, amount: z.number(), unit: z.enum(["bars", "beats", "ticks", "seconds", "frames"]).default("beats").optional() };
export const CountInInputShape = { ...BaseInputShape, enabled: z.boolean(), bars: z.number().int().min(0).max(16).optional() };
export const RollInputShape = { ...BaseInputShape, bars: z.number().min(0).max(128) };
