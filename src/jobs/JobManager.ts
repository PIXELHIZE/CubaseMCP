import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Job } from "../schemas/state.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";

export type JobStatus = Job["status"];
export type JobType = Job["type"];

export interface CreateJobInput {
  type: JobType;
  metadata?: Record<string, unknown>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class JobManager extends EventEmitter {
  private readonly jobs = new Map<string, Job>();

  create(input: CreateJobInput): Job {
    const timestamp = new Date().toISOString();
    const job: Job = {
      id: `job_${randomUUID()}`,
      type: input.type,
      status: "queued",
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      result: input.metadata
    };
    this.jobs.set(job.id, job);
    this.emit("change", clone(job));
    return clone(job);
  }

  start(jobId: string): Job {
    const job = this.require(jobId);
    if (job.status !== "queued") throw new CubaseMcpError(ErrorCode.AdapterFailed, `Cannot start job ${jobId} from ${job.status}.`, { status: job.status });
    return this.update(jobId, { status: "running", progress: 0 });
  }

  progress(jobId: string, progress: number, result?: unknown): Job {
    const job = this.require(jobId);
    if (job.status !== "running") throw new CubaseMcpError(ErrorCode.AdapterFailed, `Cannot update progress for ${jobId} from ${job.status}.`, { status: job.status });
    return this.update(jobId, { status: "running", progress: Math.max(0, Math.min(1, progress)), result });
  }

  complete(jobId: string, result?: unknown): Job {
    const job = this.require(jobId);
    if (job.status === "cancelled") return clone(job);
    if (job.status !== "running") throw new CubaseMcpError(ErrorCode.AdapterFailed, `Cannot complete job ${jobId} from ${job.status}.`, { status: job.status });
    return this.update(jobId, { status: "completed", progress: 1, result });
  }

  fail(jobId: string, error: unknown): Job {
    const job = this.require(jobId);
    if (job.status === "cancelled") return clone(job);
    if (job.status === "completed" || job.status === "failed") return clone(job);
    return this.update(jobId, {
      status: "failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : error
    });
  }

  cancel(jobId: string): Job {
    const job = this.require(jobId);
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      throw new CubaseMcpError(ErrorCode.AdapterFailed, `Cannot cancel terminal job ${jobId}.`, { status: job.status });
    }
    return this.update(jobId, { status: "cancelled" });
  }

  get(jobId: string): Job {
    return clone(this.require(jobId));
  }

  list(filter?: { type?: JobType; status?: JobStatus }): Job[] {
    return [...this.jobs.values()]
      .filter((job) => (!filter?.type || job.type === filter.type) && (!filter?.status || job.status === filter.status))
      .map(clone);
  }

  enqueue<T>(input: CreateJobInput, worker: (job: Job) => Promise<T>): Job {
    const job = this.create(input);
    queueMicrotask(() => {
      try {
        this.start(job.id);
      } catch (error) {
        if (this.get(job.id).status === "cancelled") return;
        this.fail(job.id, error);
        return;
      }
      void worker(this.get(job.id)).then(
        (result) => this.complete(job.id, result),
        (error) => this.fail(job.id, error)
      );
    });
    return job;
  }

  register(job: Pick<Job, "id" | "type" | "status" | "progress">, result?: unknown): Job {
    const timestamp = new Date().toISOString();
    const existing = this.jobs.get(job.id);
    const full: Job = existing ?? {
      ...job,
      createdAt: timestamp,
      updatedAt: timestamp,
      result
    };
    Object.assign(full, job, { updatedAt: timestamp, result: result ?? full.result });
    this.jobs.set(full.id, full);
    this.emit("change", clone(full));
    return clone(full);
  }

  private update(jobId: string, patch: Partial<Job>): Job {
    const job = this.require(jobId);
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    this.emit("change", clone(job));
    return clone(job);
  }

  private require(jobId: string): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new CubaseMcpError(ErrorCode.JobNotFound, `Job not found: ${jobId}`, { jobId });
    return job;
  }
}
