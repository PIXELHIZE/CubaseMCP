import { z } from "zod/v4";

export const BaseInputShape = {
  dryRun: z.boolean().default(false).optional(),
  confirm: z.boolean().optional(),
  timeoutMs: z.number().int().min(100).max(600_000).optional(),
  correlationId: z.string().min(1).max(256).optional(),
  requestId: z.string().min(1).max(256).optional()
};

export const EmptyInputShape = { ...BaseInputShape };

export const TrackIdField = {
  trackId: z.string().min(1).default("selected").optional()
};

export const EnabledField = {
  enabled: z.boolean()
};

export const PositionField = {
  position: z.string().min(1)
};

export const RangeShape = z.object({
  start: z.string().min(1),
  end: z.string().min(1)
});

export const DirectAccessParameterTargetSchema = z.object({
  objectId: z.number().int().nonnegative(),
  parameterTag: z.number().int().nonnegative(),
  valueMode: z.enum(["process", "plain"]).optional(),
  value: z.number().optional()
});

export const DirectAccessParameterWriteSchema = DirectAccessParameterTargetSchema.extend({
  value: z.number()
});

export const FileFormatSchema = z.enum(["wav", "aiff", "flac", "mp3"]);
