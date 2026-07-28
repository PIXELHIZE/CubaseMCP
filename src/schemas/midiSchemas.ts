import { z } from "zod/v4";
import { BaseInputShape, TrackIdField } from "./commonSchemas.js";

export const CreateMidiPartInputShape = { ...BaseInputShape, ...TrackIdField, start: z.string().min(1), length: z.string().min(1), name: z.string().optional() };
export const MidiPartIdInputShape = { ...BaseInputShape, partId: z.string().min(1) };
const MidiNoteInputSchema = z.object({ pitch: z.number().int().min(0).max(127), start: z.string().min(1), length: z.string().min(1), velocity: z.number().int().min(1).max(127).default(100).optional(), channel: z.number().int().min(1).max(16).default(1).optional() });
export const AddMidiNoteInputShape = { ...BaseInputShape, partId: z.string().min(1), notes: z.array(MidiNoteInputSchema).min(1) };
export const EditMidiNotesInputShape = { ...BaseInputShape, partId: z.string().min(1), noteIds: z.array(z.string()).optional(), pitchDelta: z.number().int().optional(), startDelta: z.string().optional(), setLength: z.string().optional(), velocityDelta: z.number().int().optional(), setVelocity: z.number().int().min(1).max(127).optional() };
export const DeleteMidiNotesInputShape = { ...BaseInputShape, partId: z.string().min(1), noteIds: z.array(z.string()).min(1) };
export const QuantizeMidiInputShape = { ...BaseInputShape, partId: z.string().optional(), trackId: z.string().optional(), grid: z.string().default("1/16").optional(), strength: z.number().min(0).max(1).default(1).optional() };
export const HumanizeMidiInputShape = { ...BaseInputShape, partId: z.string().optional(), timingTicks: z.number().int().default(8).optional(), velocity: z.number().int().default(5).optional() };
export const TransposeMidiInputShape = { ...BaseInputShape, partId: z.string().optional(), semitones: z.number().int() };
export const ApplyDrumMapInputShape = { ...BaseInputShape, ...TrackIdField, drumMapName: z.string().min(1) };
export const ChordProgressionInputShape = { ...BaseInputShape, ...TrackIdField, chords: z.array(z.object({ position: z.string().min(1), chord: z.string().min(1), length: z.string().optional() })).min(1) };
export const CopyMidiPartInputShape = { ...BaseInputShape, partId: z.string().min(1), position: z.string().min(1), targetTrackId: z.string().optional() };
export const MoveMidiPartInputShape = { ...BaseInputShape, partId: z.string().min(1), position: z.string().min(1), targetTrackId: z.string().optional() };
export const MidiNoteIdInputShape = { ...BaseInputShape, partId: z.string().min(1), noteId: z.string().min(1) };
export const EditMidiNoteInputShape = { ...MidiNoteIdInputShape, pitch: z.number().int().min(0).max(127).optional(), start: z.string().optional(), length: z.string().optional(), velocity: z.number().int().min(1).max(127).optional(), channel: z.number().int().min(1).max(16).optional() };
export const MidiVelocityInputShape = { ...BaseInputShape, partId: z.string().min(1), noteIds: z.array(z.string()).optional(), velocity: z.number().int().min(1).max(127) };
export const MidiControllerInputShape = { ...BaseInputShape, partId: z.string().min(1), lane: z.string().min(1), events: z.array(z.object({ position: z.string().min(1), value: z.number(), channel: z.number().int().min(1).max(16).optional() })).min(1) };
export const MidiTransformInputShape = { ...BaseInputShape, partId: z.string().optional(), trackId: z.string().optional(), parameters: z.record(z.string(), z.unknown()).default({}).optional() };
export const CreateChordInputShape = { ...BaseInputShape, ...TrackIdField, position: z.string().min(1), chord: z.string().min(1), length: z.string().optional() };
export const ImportMidiFileInputShape = { ...BaseInputShape, filePath: z.string().min(1), trackId: z.string().optional(), position: z.string().default("1.1.1.0").optional(), createTrack: z.boolean().default(false).optional() };
export const GeneratedMidiPartInputShape = {
  ...BaseInputShape,
  ...TrackIdField,
  position: z.string().default("1.1.1.0").optional(),
  tempo: z.number().min(1).max(400).default(120).optional(),
  ppq: z.number().int().min(24).max(9600).default(480).optional(),
  outputPath: z.string().optional(),
  name: z.string().optional(),
  notes: z.array(MidiNoteInputSchema).min(1)
};
