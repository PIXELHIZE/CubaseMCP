import type { z } from "zod/v4";
import { Permission, type ToolSafety } from "../safety/PermissionModel.js";

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  operation: string;
  inputSchema: z.ZodRawShape;
  safety: ToolSafety;
}

export function readTool(
  name: string,
  title: string,
  description: string,
  operation: string,
  inputSchema: z.ZodRawShape,
  permission = Permission.Read
): ToolDefinition {
  return {
    name,
    title,
    description,
    operation,
    inputSchema,
    safety: {
      permission,
      changesState: false,
      supportsDryRun: true
    }
  };
}

export function writeTool(
  name: string,
  title: string,
  description: string,
  operation: string,
  inputSchema: z.ZodRawShape,
  permission: Permission,
  extras: Partial<ToolSafety> = {}
): ToolDefinition {
  return {
    name,
    title,
    description,
    operation,
    inputSchema,
    safety: {
      permission,
      changesState: true,
      supportsDryRun: true,
      createsUndoSnapshot: true,
      requiresProject: true,
      ...extras
    }
  };
}
