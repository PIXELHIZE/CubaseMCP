import { randomUUID } from "node:crypto";

export interface EventIdentityInput {
  runtimeId?: number;
  uniqueId?: string;
  filePath?: string;
  trackId?: string;
  start?: string;
}

export class EventRegistry {
  private readonly identities = new Map<string, string>();

  resolve(input: EventIdentityInput): string {
    const keys = this.keys(input);
    for (const key of keys) {
      const existing = this.identities.get(key);
      if (existing) {
        for (const alias of keys) this.identities.set(alias, existing);
        return existing;
      }
    }
    const stableId = `event_${randomUUID()}`;
    for (const key of keys) this.identities.set(key, stableId);
    return stableId;
  }

  private keys(input: EventIdentityInput): string[] {
    const keys: string[] = [];
    if (input.uniqueId) keys.push(`unique:${input.uniqueId}`);
    if (input.runtimeId !== undefined) keys.push(`runtime:${input.runtimeId}`);
    if (input.filePath) keys.push(`file:${input.filePath}:${input.trackId ?? ""}:${input.start ?? ""}`);
    if (keys.length === 0) keys.push(`anonymous:${randomUUID()}`);
    return keys;
  }
}
