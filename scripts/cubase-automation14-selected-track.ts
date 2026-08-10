import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { PowerShellCubaseUiDriver } from "../src/automation14/PowerShellCubaseUiDriver.js";
import { MidiPerformanceEncoder } from "../src/automation14/MidiPerformanceEncoder.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { JpopMidiArrangementGenerator } from "../src/song/JpopMidiArrangementGenerator.js";
import type { SongRole } from "../src/song/models.js";
import { SongProjectPlanner } from "../src/song/SongProjectPlanner.js";

const args = process.argv.slice(2);
const role = (args[args.indexOf("--role") + 1] ?? "chords") as SongRole;
const bars = Number(args[args.indexOf("--bars") + 1] ?? 8);
const tempo = Number(args[args.indexOf("--tempo") + 1] ?? 138);
const captureTempo = Math.min(300, tempo * 2);
const plan = new SongProjectPlanner().plan({ prompt: `${bars}-bar J-pop selected-track test`, genre: "jpop", bars, tempo, key: "D major" });
const notes = new JpopMidiArrangementGenerator().generate(role, plan);
if (notes.length === 0) throw new Error(`No notes generated for role ${role}.`);
const encoder = new MidiPerformanceEncoder();
const events = encoder.encode(notes, captureTempo);
const driver = new PowerShellCubaseUiDriver();
const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));

await adapter.connect();
try {
  const preflight = await driver.preflight();
  if (!preflight.ok) throw new Error(`automation14 preflight failed: ${preflight.failures.join("; ")}`);
  await driver.stopTransport();
  await driver.setTempo(captureTempo);
  await driver.locateStart();
  await driver.startRecording();
  try {
    await adapter.execute("automation14PlayMidi", { events }, {
      requestId: `automation14-selected-${Date.now()}`,
      toolName: "automation14.selected_track",
      dryRun: false,
      timeoutMs: 3_600_000
    });
  } finally {
    await driver.stopTransport();
  }
  await driver.setTempo(tempo);
  await driver.saveProject();
  console.log(JSON.stringify({ ok: true, role, bars, tempo, captureTempo, noteCount: notes.length, eventCount: events.length, durationMs: encoder.durationMs(events) }, null, 2));
} finally {
  await adapter.disconnect();
}
