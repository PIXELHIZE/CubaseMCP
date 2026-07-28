import { z } from "zod/v4";
import { BaseInputShape, EmptyInputShape } from "./commonSchemas.js";

export { EmptyInputShape };

export const ProjectPathInputShape = { ...BaseInputShape, path: z.string().min(1) };
export const CreateProjectInputShape = {
  ...BaseInputShape,
  path: z.string().optional(),
  directory: z.string().optional(),
  template: z.string().optional(),
  name: z.string().min(1),
  sampleRate: z.number().int().positive().optional(),
  bitDepth: z.number().int().positive().optional(),
  frameRate: z.string().optional()
};
export const SaveProjectInputShape = { ...BaseInputShape, overwrite: z.boolean().default(false).optional() };
export const SaveProjectAsInputShape = { ...BaseInputShape, path: z.string().min(1), overwrite: z.boolean().default(false).optional() };
export const CloseProjectInputShape = { ...BaseInputShape, discardUnsavedChanges: z.boolean().default(false).optional() };
export const CreateBackupInputShape = { ...BaseInputShape, destination: z.string().optional(), includeMedia: z.boolean().default(true).optional() };
export const SetSampleRateInputShape = { ...BaseInputShape, sampleRate: z.number().int().positive() };
export const SetBitDepthInputShape = { ...BaseInputShape, bitDepth: z.number().int().positive() };
export const SetFrameRateInputShape = { ...BaseInputShape, frameRate: z.string().min(1) };
export const ApplyProjectTemplateInputShape = { ...BaseInputShape, template: z.string().min(1), merge: z.boolean().default(false).optional() };
