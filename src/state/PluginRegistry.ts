import { randomUUID } from "node:crypto";

export interface PluginIdentityInput {
  objectId?: number;
  uniqueId?: string;
  trackId?: string;
  slot?: number;
  name?: string;
}

export class PluginRegistry {
  private readonly identities = new Map<string, string>();

  resolve(input: PluginIdentityInput): string {
    const keys = [
      input.uniqueId ? `unique:${input.uniqueId}` : undefined,
      input.objectId !== undefined ? `object:${input.objectId}` : undefined,
      input.trackId !== undefined && input.slot !== undefined ? `slot:${input.trackId}:${input.slot}` : undefined,
      input.name ? `name:${input.trackId ?? ""}:${input.name}:${input.slot ?? ""}` : undefined
    ].filter((value): value is string => value !== undefined);
    for (const key of keys) {
      const existing = this.identities.get(key);
      if (existing) {
        for (const alias of keys) this.identities.set(alias, existing);
        return existing;
      }
    }
    const id = `plugin_${randomUUID()}`;
    for (const key of keys) this.identities.set(key, id);
    return id;
  }
}
