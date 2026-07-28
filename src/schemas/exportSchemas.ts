import { z } from "zod/v4";
import { BaseInputShape, FileFormatSchema, RangeShape } from "./commonSchemas.js";

export const ExportMixdownInputShape = { ...BaseInputShape, path: z.string().min(1), format: FileFormatSchema.default("wav").optional(), range: RangeShape.optional(), overwrite: z.boolean().default(false).optional(), realTime: z.boolean().default(false).optional() };
export const ExportStemsInputShape = { ...BaseInputShape, destinationDirectory: z.string().min(1), trackIds: z.array(z.string()).optional(), selectedOnly: z.boolean().default(false).optional(), format: FileFormatSchema.default("wav").optional(), sampleRate: z.number().int().positive().optional(), bitDepth: z.number().int().positive().optional(), filenamePattern: z.string().optional(), range: RangeShape.optional(), realTime: z.boolean().default(false).optional(), overwrite: z.boolean().default(false).optional() };
export const ExportSelectedInputShape = { ...BaseInputShape, destinationDirectory: z.string().min(1), format: FileFormatSchema.default("wav").optional(), overwrite: z.boolean().default(false).optional() };
export const BatchExportInputShape = { ...BaseInputShape, destinationDirectory: z.string().min(1), jobs: z.array(z.record(z.string(), z.unknown())).min(1), overwrite: z.boolean().default(false).optional() };
export const ExportSettingsInputShape = { ...BaseInputShape, format: FileFormatSchema.optional(), sampleRate: z.number().int().positive().optional(), bitDepth: z.number().int().positive().optional(), loudnessTargetLufs: z.number().optional(), filenamePattern: z.string().optional() };
export const ExportFilenamePatternInputShape = { ...BaseInputShape, pattern: z.string().min(1) };
export const ExportLoudnessInputShape = { ...BaseInputShape, targetLufs: z.number().min(-70).max(0), truePeakDb: z.number().max(0).optional() };
export const ExportFormatInputShape = { ...BaseInputShape, format: FileFormatSchema };
export const ExportSampleRateInputShape = { ...BaseInputShape, sampleRate: z.number().int().positive() };
export const ExportBitDepthInputShape = { ...BaseInputShape, bitDepth: z.number().int().positive() };
export const ExportRangeInputShape = { ...BaseInputShape, range: RangeShape };
export const ExportRealtimeInputShape = { ...BaseInputShape, realTime: z.boolean() };
export const ExportJobsInputShape = { ...BaseInputShape, status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional() };
export const CancelExportJobInputShape = { ...BaseInputShape, jobId: z.string().min(1) };
export const CurrentExportInputShape = { ...BaseInputShape, expectedFiles: z.array(z.string()).optional(), overwrite: z.boolean().default(false).optional() };
