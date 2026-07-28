import type { Job } from "../schemas/state.js";
import { JobManager } from "./JobManager.js";

export class ScanJob {
  constructor(private readonly jobs: JobManager) {}

  enqueue(settings: Record<string, unknown>, worker: () => Promise<unknown>): Job {
    return this.jobs.enqueue({ type: "scan", metadata: { settings } }, worker);
  }
}
