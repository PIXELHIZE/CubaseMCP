import { randomUUID } from "node:crypto";

export interface MarkerIdentityInput {
  hostId?: string | number;
  name?: string;
  position?: string;
  type?: string;
}

export class MarkerRegistry {
  private readonly identities = new Map<string, string>();

  resolve(input: MarkerIdentityInput): string {
    const keys = [
      input.hostId !== undefined ? `host:${input.hostId}` : undefined,
      input.position ? `position:${input.type ?? "marker"}:${input.position}:${input.name ?? ""}` : undefined
    ].filter((value): value is string => value !== undefined);
    for (const key of keys) {
      const existing = this.identities.get(key);
      if (existing) return existing;
    }
    const id = `marker_${randomUUID()}`;
    for (const key of keys) this.identities.set(key, id);
    return id;
  }
}
