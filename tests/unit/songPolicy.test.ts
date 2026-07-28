import { describe, expect, it } from "vitest";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { SongProjectPlanner } from "../../src/song/SongProjectPlanner.js";
import { SongProjectService } from "../../src/song/SongProjectService.js";
import { SongProjectValidator } from "../../src/song/SongProjectValidator.js";
import { TrackTypeResolver } from "../../src/song/TrackTypeResolver.js";
import type { SongManifest } from "../../src/song/models.js";

describe("Song Creation Policy", () => {
  it("resolves musical software roles to Instrument Tracks", () => {
    const resolver = new TrackTypeResolver();
    for (const role of ["drums", "bass", "chords", "lead", "pad", "arp"] as const) {
      expect(resolver.resolve(role)).toEqual({ sourceKind: "software_instrument", trackType: "instrument" });
    }
    expect(resolver.resolve("external_hardware_synth")).toEqual({ sourceKind: "external_midi", trackType: "midi" });
    expect(resolver.resolve("vocal")).toEqual({ sourceKind: "audio_recording", trackType: "audio" });
    expect(() => resolver.resolve("bass", "software_instrument", "midi")).toThrow(/must use an Instrument Track/);
  });

  it("plans a house song without software roles on MIDI Tracks", () => {
    const plan = new SongProjectPlanner().plan({ prompt: "4마디 house 노래 만들어줘" });
    expect(plan.bars).toBe(4);
    expect(plan.tracks.filter((track) => track.sourceKind === "software_instrument")
      .every((track) => track.trackType === "instrument")).toBe(true);
    expect(plan.tracks.find((track) => track.role === "drum_bus")?.trackType).toBe("group");
    expect(plan.tracks.find((track) => track.role === "reverb")?.trackType).toBe("fx");
  });

  it("creates playable Instrument Tracks, imported MIDI parts, routing, and audible mock evidence", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    await adapter.execute("createProject", { name: "Song Policy" }, {
      requestId: "project",
      toolName: "test",
      dryRun: false
    });
    const service = new SongProjectService(adapter);
    const plan = service.plan({ prompt: "4 bar house demo" });
    const created = await service.create({ planId: plan.id });

    expect(created.status).toBe("succeeded");
    expect(created.validation.valid).toBe(true);
    expect(created.validation.summary.instrumentTracks).toBeGreaterThan(0);
    expect(created.validation.summary.midiParts).toBeGreaterThan(0);
    expect(created.validation.summary.notes).toBeGreaterThan(0);
    expect(created.validation.summary.audible).toBe(true);
    const state = await adapter.getState();
    expect(state.project.tempo).toBe(124);
    expect(state.project.timeSignature).toBe("4/4");
    expect(state.tracks.filter((track) => ["Drums", "Bass", "Chords", "Lead"].includes(track.name))
      .every((track) => track.type === "instrument" && track.parts.length > 0)).toBe(true);
  });

  it("rejects a software instrument manifest that points to a MIDI Track", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    await adapter.execute("createProject", { name: "Invalid" }, { requestId: "p", toolName: "test", dryRun: false });
    const created = await adapter.execute<{ tracks: Array<{ id: string }> }>("createTrack", {
      type: "midi",
      name: "Bass"
    }, { requestId: "t", toolName: "test", dryRun: false });
    const trackId = created.data?.tracks[0]?.id;
    expect(trackId).toBeTruthy();
    const manifest: SongManifest = {
      songId: "song",
      planId: "plan",
      hostSessionId: "session",
      projectFingerprint: "fixture",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trackBindings: [{
        intentId: "bass",
        role: "bass",
        name: "Bass",
        target: { kind: "uniqueId", uniqueId: String(trackId) },
        expectedType: "instrument",
        actualType: "midi",
        instrumentExpected: "HALion Sonic",
        instrumentLoaded: false,
        partIds: [],
        noteCount: 0,
        audioEventIds: [],
        routeValid: true,
        ownedByPlanner: true
      }],
      audibleEvidence: { verified: true, method: "mock" },
      evidence: []
    };
    const validation = new SongProjectValidator().validate(manifest, await adapter.getState());
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "TRACK_TYPE_MISMATCH" && /forbidden/.test(issue.message))).toBe(true);
  });
});
