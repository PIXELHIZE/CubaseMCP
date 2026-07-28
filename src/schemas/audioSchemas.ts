import { z } from "zod/v4";
import { BaseInputShape, TrackIdField } from "./commonSchemas.js";

export const ImportAudioInputShape = { ...BaseInputShape, filePath: z.string().min(1), trackId: z.string().optional(), createTrack: z.boolean().default(false).optional(), position: z.string().default("1.1.1.0").optional() };
export const AudioEventIdInputShape = { ...BaseInputShape, eventId: z.string().min(1) };
export const EditAudioEventInputShape = { ...BaseInputShape, eventId: z.string().min(1), action: z.string().min(1), parameters: z.record(z.string(), z.unknown()).default({}).optional() };
export const SplitAudioEventInputShape = { ...BaseInputShape, eventId: z.string().min(1), position: z.string().min(1) };
export const MoveAudioEventInputShape = { ...BaseInputShape, eventId: z.string().min(1), position: z.string().min(1), targetTrackId: z.string().optional() };
export const FadeInputShape = { ...BaseInputShape, eventId: z.string().min(1), fadeIn: z.string().optional(), fadeOut: z.string().optional(), curve: z.string().optional() };
export const CrossfadeInputShape = { ...BaseInputShape, eventIds: z.array(z.string()).length(2).optional(), length: z.string().min(1).optional() };
export const RenderInPlaceInputShape = { ...BaseInputShape, trackIds: z.array(z.string()).optional(), eventIds: z.array(z.string()).optional(), settings: z.record(z.string(), z.unknown()).default({}).optional() };
export const BounceSelectionInputShape = { ...BaseInputShape, ...TrackIdField, eventIds: z.array(z.string()).optional() };
export const CreateAudioEventInputShape = { ...BaseInputShape, ...TrackIdField, filePath: z.string().min(1), position: z.string().min(1), offset: z.string().optional(), length: z.string().optional() };
export const CopyAudioEventInputShape = { ...BaseInputShape, eventId: z.string().min(1), position: z.string().min(1), targetTrackId: z.string().optional() };
export const AudioFadeInputShape = { ...BaseInputShape, eventId: z.string().min(1).optional(), length: z.string().min(1).optional(), curve: z.enum(["linear", "equalPower", "sCurve"]).default("linear").optional() };
export const AudioGainInputShape = { ...BaseInputShape, eventId: z.string().min(1), gainDb: z.number().min(-60).max(24) };
export const AudioProcessInputShape = { ...BaseInputShape, eventId: z.string().optional(), eventIds: z.array(z.string()).optional(), parameters: z.record(z.string(), z.unknown()).default({}).optional() };
