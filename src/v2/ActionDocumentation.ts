import { z } from "zod/v4";
import { v2ActionSchemas, type V2ToolName } from "./actionSchemas.js";
import { v2Actions } from "./actionManifest.js";

type JsonSchema = {
  type?: string | string[];
  const?: unknown;
  default?: unknown;
  enum?: unknown[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minimum?: number;
  exclusiveMinimum?: number;
  minItems?: number;
  pattern?: string;
};

export interface ActionDocumentation {
  key: string;
  tool: V2ToolName;
  action: string;
  summary: string;
  inputSchema: Record<string, unknown>;
  example: Record<string, unknown>;
}

function exampleString(propertyName: string, schema: JsonSchema): string {
  if (propertyName === "timeSignature" || schema.pattern?.includes("\\/")) return "4/4";
  if (propertyName === "value" && schema.pattern?.includes(":")) return "00:00:00:00";
  if (/path|directory|file/i.test(propertyName)) return "C:\\CubaseMCP\\example";
  if (/name/i.test(propertyName)) return "Example";
  if (/id$/i.test(propertyName)) return "example-id";
  if (propertyName === "length") return "1.0.0.0";
  if (propertyName === "prompt") return "Create a four-bar house demo";
  if (propertyName === "action") return "status";
  if (propertyName === "createdAt") return "2026-01-01T00:00:00.000Z";
  return "value";
}

function generateExample(schema: JsonSchema, propertyName = "value"): unknown {
  if ("const" in schema) return schema.const;
  if ("default" in schema) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  const alternative = schema.oneOf?.[0] ?? schema.anyOf?.[0];
  if (alternative) return generateExample(alternative, propertyName);
  const type = Array.isArray(schema.type) ? schema.type.find((candidate) => candidate !== "null") : schema.type;
  if (type === "object" || schema.properties) {
    const result: Record<string, unknown> = {};
    for (const name of schema.required ?? []) {
      const child = schema.properties?.[name];
      if (child) result[name] = generateExample(child, name);
    }
    return result;
  }
  if (type === "array") {
    return schema.minItems && schema.minItems > 0 && schema.items
      ? [generateExample(schema.items, propertyName)]
      : [];
  }
  if (type === "integer" || type === "number") {
    if (schema.minimum !== undefined) return schema.minimum;
    if (schema.exclusiveMinimum !== undefined) {
      return type === "integer" ? Math.floor(schema.exclusiveMinimum) + 1 : schema.exclusiveMinimum + 1;
    }
    return 0;
  }
  if (type === "boolean") return false;
  return exampleString(propertyName, schema);
}

function summarize(tool: string, action: string): string {
  const domain = tool.replace(/^cubase\./, "").replaceAll("_", " ");
  return `${action.replaceAll("_", " ")} in the Cubase ${domain} domain.`;
}

function buildDocumentation(): ActionDocumentation[] {
  const byKey = new Map(v2Actions.map((item) => [item.key, item]));
  const documents: ActionDocumentation[] = [];
  for (const [tool, zodSchema] of Object.entries(v2ActionSchemas) as Array<[V2ToolName, z.ZodTypeAny]>) {
    const schema = z.toJSONSchema(zodSchema) as JsonSchema;
    for (const variant of schema.oneOf ?? []) {
      const action = variant.properties?.action?.const;
      if (typeof action !== "string") throw new Error(`Missing action discriminator in ${tool}.`);
      const example = generateExample(variant) as Record<string, unknown>;
      if (tool === "cubase.song" && action === "create") example.planId = "example-plan-id";
      if (tool === "cubase.midi_edit" && action === "update_notes") {
        const edits = example.edits as Array<Record<string, unknown>>;
        edits[0].pitch = 60;
      }
      const parsed = zodSchema.safeParse(example);
      if (!parsed.success) {
        throw new Error(`Generated example for ${tool}.${action} is invalid: ${z.prettifyError(parsed.error)}`);
      }
      const key = `${tool}.${action}`;
      if (!byKey.has(key)) throw new Error(`Documented action ${key} is absent from the action manifest.`);
      documents.push({
        key,
        tool,
        action,
        summary: summarize(tool, action),
        inputSchema: variant as Record<string, unknown>,
        example: parsed.data as Record<string, unknown>
      });
    }
  }
  return documents;
}

export const v2ActionDocumentation = Object.freeze(buildDocumentation());
