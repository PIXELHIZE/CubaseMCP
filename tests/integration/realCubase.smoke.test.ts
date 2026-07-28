import { describe, expect, it } from "vitest";
import { CompositeCubaseAdapter } from "../../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../../src/config/cubaseConfig.js";

const runReal = process.env.SKIP_REAL_CUBASE_TESTS === "false" || process.env.CUBASE_REQUIRE_REAL === "true" || process.env.npm_lifecycle_event === "test:real";
const describeReal = runReal ? describe : describe.skip;

describeReal("real Cubase MIDI Remote bridge smoke", () => {
  it("connects to Cubase MIDI Remote bridge and reads status", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
    await adapter.connect();
    const state = await adapter.getState();
    expect(state.cubase.connected).toBe(true);
    await adapter.disconnect();
  }, 10000);

  it("sends transport play and stop", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
    await adapter.connect();
    const play = await adapter.execute("transportPlay", {}, { requestId: "real-play", toolName: "cubase.transport_play", dryRun: false });
    const stop = await adapter.execute("transportStop", {}, { requestId: "real-stop", toolName: "cubase.transport_stop", dryRun: false });
    expect(play.changed).toBe(true);
    expect(stop.changed).toBe(true);
    await adapter.disconnect();
  }, 10000);

  it("reads selected-track state and exposes non-mutating mixer previews", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
    await adapter.connect();
    const state = await adapter.getState();
    expect(state.selectedObjects.some((item) => item.type === "track")).toBe(true);
    const volume = await adapter.execute("setTrackVolume", { trackId: "selected", volumeDb: -6 }, { requestId: "real-volume-preview", toolName: "cubase.set_track_volume", dryRun: true });
    const pan = await adapter.execute("setTrackPan", { trackId: "selected", pan: 0 }, { requestId: "real-pan-preview", toolName: "cubase.set_track_pan", dryRun: true });
    expect(volume.changed).toBe(false);
    expect(pan.changed).toBe(false);
    await adapter.disconnect();
  }, 10000);
});
