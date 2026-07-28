import { describe, expect, it } from "vitest";
import { JobManager } from "../../src/jobs/JobManager.js";

describe("JobManager", () => {
  it("tracks queued, running, completed and cancelled jobs", async () => {
    const jobs = new JobManager();
    const queued = jobs.enqueue({ type: "export" }, async () => ({ file: "mix.wav" }));
    expect(queued.status).toBe("queued");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(jobs.get(queued.id).status).toBe("completed");

    const cancellable = jobs.create({ type: "scan" });
    expect(jobs.cancel(cancellable.id).status).toBe("cancelled");
    expect(jobs.list()).toHaveLength(2);
  });

  it("does not resurrect a job cancelled before its worker starts", async () => {
    const jobs = new JobManager();
    let workerRan = false;
    const queued = jobs.enqueue({ type: "render" }, async () => {
      workerRan = true;
    });
    jobs.cancel(queued.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(jobs.get(queued.id).status).toBe("cancelled");
    expect(workerRan).toBe(false);
  });
});
