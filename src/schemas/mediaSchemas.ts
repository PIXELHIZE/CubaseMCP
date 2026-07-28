import { z } from "zod/v4";
import { BaseInputShape, EmptyInputShape } from "./commonSchemas.js";

export { EmptyInputShape };
export const ImportMediaFileInputShape = { ...BaseInputShape, filePath: z.string().min(1), trackId: z.string().optional(), position: z.string().default("1.1.1.0").optional(), copyToProject: z.boolean().default(true).optional() };
export const CleanupMediaInputShape = { ...BaseInputShape, deleteFromDisk: z.boolean().default(false).optional(), mediaIds: z.array(z.string()).optional() };
export const RelinkMediaInputShape = { ...BaseInputShape, missingFileId: z.string().min(1), newPath: z.string().min(1) };
export const MediaBaySearchInputShape = { ...BaseInputShape, query: z.string().min(1), mediaType: z.enum(["audio", "midi", "preset", "video", "all"]).default("all").optional(), limit: z.number().int().min(1).max(1000).default(100).optional() };
export const ExportSelectedEventInputShape = { ...BaseInputShape, eventIds: z.array(z.string()).min(1), destinationDirectory: z.string().min(1), overwrite: z.boolean().default(false).optional() };
