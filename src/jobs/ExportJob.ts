import type { Job } from "../schemas/state.js";
import { JobManager } from "./JobManager.js";

export class ExportJob {
  constructor(private readonly jobs: JobManager) {}

  enqueue(settings: Record<string, unknown>, worker: () => Promise<unknown>): Job {
    return this.jobs.enqueue({ type: "export", metadata: { settings } }, worker);
  }
}
