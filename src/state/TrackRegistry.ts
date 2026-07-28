export interface TrackIdentity {
  stableId: string;
  runtimeId?: number;
  uniqueId?: string;
  name?: string;
  lastSeenAt: string;
}

export class TrackRegistry {
  private readonly byStableId = new Map<string, TrackIdentity>();
  private readonly byRuntimeId = new Map<number, string>();

  upsert(identity: Omit<TrackIdentity, "stableId" | "lastSeenAt"> & { stableId?: string }): TrackIdentity {
    const stableId = identity.stableId ?? this.stableIdFor(identity.runtimeId, identity.uniqueId, identity.name);
    const next: TrackIdentity = {
      stableId,
      runtimeId: identity.runtimeId,
      uniqueId: identity.uniqueId,
      name: identity.name,
      lastSeenAt: new Date().toISOString()
    };
    this.byStableId.set(stableId, next);
    if (typeof identity.runtimeId === "number") this.byRuntimeId.set(identity.runtimeId, stableId);
    return next;
  }

  get(stableId: string): TrackIdentity | undefined {
    return this.byStableId.get(stableId);
  }

  list(): TrackIdentity[] {
    return [...this.byStableId.values()];
  }

  private stableIdFor(runtimeId?: number, uniqueId?: string, name?: string): string {
    if (uniqueId) return `track:${uniqueId}`;
    if (typeof runtimeId === "number") return `track:runtime:${runtimeId}`;
    return `track:selected:${name ?? "unknown"}`;
  }
}
