import { audioTools } from "./audioTools.js";
import { exportTools } from "./exportTools.js";
import { markerTools } from "./markerTools.js";
import { midiTools } from "./midiTools.js";
import { mixerTools } from "./mixerTools.js";
import { pluginTools } from "./pluginTools.js";
import { projectTools } from "./projectTools.js";
import { safetyTools } from "./safetyTools.js";
import { trackTools } from "./trackTools.js";
import { transportTools } from "./transportTools.js";
import { directAccessTools } from "./directAccessTools.js";
import { automationTools } from "./automationTools.js";
import { tempoTools } from "./tempoTools.js";
import { mediaTools } from "./mediaTools.js";
import type { ToolDefinition } from "./toolTypes.js";

export const toolDefinitions: ToolDefinition[] = [
  ...projectTools,
  ...trackTools,
  ...transportTools,
  ...mixerTools,
  ...pluginTools,
  ...midiTools,
  ...audioTools,
  ...markerTools,
  ...automationTools,
  ...tempoTools,
  ...mediaTools,
  ...exportTools,
  ...safetyTools,
  ...directAccessTools
];

export function getToolDefinition(name: string): ToolDefinition {
  const definition = toolDefinitions.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`Unknown tool definition: ${name}`);
  return definition;
}

export type { ToolDefinition } from "./toolTypes.js";
