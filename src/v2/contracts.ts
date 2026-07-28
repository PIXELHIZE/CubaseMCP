import { z } from "zod/v4";

export const CapabilityStatusSchema = z.enum([
  "real",
  "blocked_by_cubase_api",
  "blocked_by_no_headless_api",
  "unsupported_release_profile"
]);

export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const HostSupportStatusSchema = z.enum([
  "supported_release_profile",
  "unverified_host_profile",
  "unsupported_host_version"
]);

export type HostSupportStatus = z.infer<typeof HostSupportStatusSchema>;

export const BlockerReasonSchema = z.enum([
  "dialog_required",
  "command_has_no_parameters",
  "object_not_enumerable",
  "path_not_headless_configurable",
  "requires_existing_selection",
  "requires_existing_export_settings",
  "requires_track_template",
  "host_crash_reproduced",
  "api_method_missing",
  "instrument_not_available",
  "audibility_not_observable",
  "host_edition_missing_feature"
]);

export type BlockerReason = z.infer<typeof BlockerReasonSchema>;

export const TargetRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("selected") }),
  z.object({
    kind: z.literal("objectId"),
    sessionId: z.string().min(1),
    objectId: z.number().int().nonnegative()
  }),
  z.object({
    kind: z.literal("uniqueId"),
    uniqueId: z.string().min(1)
  })
]);

export type TargetRef = z.infer<typeof TargetRefSchema>;

export const PositionSchema = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("musical"),
    bar: z.number().int().min(1),
    beat: z.number().int().min(1).default(1),
    sixteenth: z.number().int().min(1).max(16).default(1),
    tick: z.number().int().min(0).default(0)
  }),
  z.object({
    format: z.literal("seconds"),
    seconds: z.number().min(0)
  }),
  z.object({
    format: z.literal("timecode"),
    value: z.string().regex(/^\d{2,}:\d{2}:\d{2}:\d{2}$/)
  })
]);

export type Position = z.infer<typeof PositionSchema>;

export const V2BaseInputShape = {
  requestId: z.string().min(1).max(256).optional(),
  correlationId: z.string().min(1).max(256).optional(),
  timeoutMs: z.number().int().min(100).max(600_000).default(30_000).optional(),
  dryRun: z.boolean().default(false).optional(),
  confirm: z.boolean().default(false).optional()
};

export const HostDescriptorSchema = z.object({
  product: z.string(),
  edition: z.string().optional(),
  version: z.string(),
  midiRemoteApiVersion: z.string().optional(),
  mcpProtocolVersion: z.number().int().optional(),
  mcpTransportVersion: z.number().int().optional(),
  scriptBuild: z.string().optional(),
  sessionId: z.string(),
  supportStatus: HostSupportStatusSchema,
  profile: z.string()
});

export type HostDescriptor = z.infer<typeof HostDescriptorSchema>;

export const ActionCapabilitySchema = z.object({
  key: z.string(),
  profile: z.string(),
  status: CapabilityStatusSchema,
  blockerReason: BlockerReasonSchema.optional(),
  constraints: z.record(z.string(), z.unknown()).default({}),
  evidenceId: z.string().optional(),
  verifiedAt: z.string().datetime().optional()
}).superRefine((capability, context) => {
  if (capability.status === "real" && capability.blockerReason !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["blockerReason"],
      message: "A real capability cannot declare a blockerReason."
    });
  }
  if (capability.status !== "real" && capability.blockerReason === undefined) {
    context.addIssue({
      code: "custom",
      path: ["blockerReason"],
      message: "A non-real capability must declare a blockerReason."
    });
  }
});

export type ActionCapability = z.infer<typeof ActionCapabilitySchema>;

export interface V2Evidence {
  requestId: string;
  actionKey: string;
  hostSessionId: string;
  stateBefore?: unknown;
  stateAfter?: unknown;
  stateDiff?: unknown;
  restored?: boolean;
  outputFiles?: Array<{ path: string; bytes?: number; sha256?: string }>;
  evidenceId?: string;
}

export interface V2Error {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export interface V2Result<T = unknown> {
  [key: string]: unknown;
  ok: boolean;
  tool: string;
  action: string;
  actionKey: string;
  requestId: string;
  correlationId: string;
  host: HostDescriptor;
  capability: ActionCapability;
  changed: boolean;
  dryRun: boolean;
  confirmed: boolean;
  data?: T;
  preview?: unknown;
  evidence?: V2Evidence;
  warnings: string[];
  error?: V2Error;
}

export function positionToCubaseString(position: Position): string {
  switch (position.format) {
    case "musical":
      return `${position.bar}.${position.beat}.${position.sixteenth}.${position.tick}`;
    case "seconds":
      return String(position.seconds);
    case "timecode":
      return position.value;
  }
}
