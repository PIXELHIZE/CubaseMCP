import { z } from "zod/v4";

export const HostHandshakeSchema = z.object({
  version: z.literal(2),
  transportVersion: z.literal(1),
  releaseProfile: z.string().min(1),
  scriptBuild: z.string().min(1)
});

export type HostHandshake = z.infer<typeof HostHandshakeSchema>;

export function parseHostHandshake(payload: unknown): HostHandshake | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as { mcpProtocol?: unknown }).mcpProtocol;
  const parsed = HostHandshakeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
