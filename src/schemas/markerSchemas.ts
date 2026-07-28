import { z } from "zod/v4";
import { BaseInputShape, EmptyInputShape } from "./commonSchemas.js";

export { EmptyInputShape };

export const SetTempoInputShape = { ...BaseInputShape, bpm: z.number().min(1).max(400), position: z.string().optional() };
export const AddTempoEventInputShape = { ...BaseInputShape, bpm: z.number().min(1).max(400), position: z.string().min(1) };
export const TimeSignatureInputShape = { ...BaseInputShape, signature: z.string().regex(/^\d+\/\d+$/), position: z.string().optional() };
export const AddMarkerInputShape = { ...BaseInputShape, name: z.string().min(1), position: z.string().min(1) };
export const AddCycleMarkerInputShape = { ...BaseInputShape, name: z.string().min(1), start: z.string().min(1), end: z.string().min(1) };
export const MarkerIdInputShape = { ...BaseInputShape, markerId: z.string().min(1) };
export const UpdateMarkerInputShape = { ...BaseInputShape, markerId: z.string().min(1), name: z.string().optional(), position: z.string().optional(), end: z.string().optional() };
export const ArrangerEventInputShape = { ...BaseInputShape, name: z.string().min(1), start: z.string().min(1), end: z.string().min(1) };
export const ArrangerChainInputShape = { ...BaseInputShape, eventIds: z.array(z.string()).min(1) };
export const DuplicateSectionInputShape = { ...BaseInputShape, sectionId: z.string().min(1), destination: z.string().min(1), copies: z.number().int().min(1).max(128).default(1).optional() };
export const ReorderSectionInputShape = { ...BaseInputShape, sectionId: z.string().min(1), targetIndex: z.number().int().min(0) };
export const SongStructureAnalysisInputShape = { ...BaseInputShape, range: z.object({ start: z.string(), end: z.string() }).optional(), includeAudioAnalysis: z.boolean().default(false).optional() };
