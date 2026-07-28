import { z } from "zod/v4";
import { BaseInputShape, EmptyInputShape } from "./commonSchemas.js";

export { EmptyInputShape };
export const TempoMapInputShape = { ...BaseInputShape, events: z.array(z.object({ position: z.string().min(1), bpm: z.number().min(1).max(400), curve: z.enum(["jump", "ramp"]).default("jump").optional() })).min(1), replaceExisting: z.boolean().default(false).optional() };
export const TempoEventIdInputShape = { ...BaseInputShape, eventId: z.string().min(1) };
export const KeySignatureInputShape = { ...BaseInputShape, key: z.string().min(1), scale: z.string().optional(), position: z.string().optional() };
export const ChordTrackUpdateInputShape = { ...BaseInputShape, chords: z.array(z.object({ position: z.string().min(1), chord: z.string().min(1), length: z.string().optional() })).min(1) };
export const ScaleInputShape = { ...BaseInputShape, root: z.string().min(1), scale: z.string().min(1), position: z.string().optional() };
export const ArrangerControlInputShape = { ...BaseInputShape, action: z.enum(["enable", "disable", "play", "stop", "flatten"]), chainId: z.string().optional() };
