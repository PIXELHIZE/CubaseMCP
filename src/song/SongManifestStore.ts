import type { SongManifest, SongPlan } from "./models.js";

export class SongManifestStore {
  private readonly plans = new Map<string, SongPlan>();
  private readonly manifests = new Map<string, SongManifest>();

  savePlan(plan: SongPlan): SongPlan {
    this.plans.set(plan.id, structuredClone(plan));
    return structuredClone(plan);
  }

  getPlan(planId: string): SongPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Song plan not found: ${planId}`);
    return structuredClone(plan);
  }

  saveManifest(manifest: SongManifest): SongManifest {
    this.manifests.set(manifest.songId, structuredClone(manifest));
    return structuredClone(manifest);
  }

  getManifest(songId: string): SongManifest {
    const manifest = this.manifests.get(songId);
    if (!manifest) throw new Error(`Song manifest not found: ${songId}`);
    return structuredClone(manifest);
  }

  latestManifest(): SongManifest | undefined {
    return [...this.manifests.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((manifest) => structuredClone(manifest))[0];
  }
}

