import { z } from 'zod';

function jsonSchemaNodeToZod(schema: Record<string, unknown>): z.ZodType {
  let field: z.ZodType;

  if (schema.type === 'string') {
    field = z.string();
  } else if (schema.type === 'number' || schema.type === 'integer') {
    field = z.number();
  } else if (schema.type === 'boolean') {
    field = z.boolean();
  } else if (schema.type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    field = z.array(items ? jsonSchemaNodeToZod(items) : z.unknown());
  } else if (schema.type === 'object') {
    field = z.object(jsonSchemaToZod(schema));
  } else {
    field = z.unknown();
  }

  if (schema.description) {
    field = field.describe(schema.description as string);
  }
  return field;
}

export function jsonSchemaToZod(schema: Record<string, unknown>): Record<string, z.ZodType> {
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required || []) as string[]);

  return Object.fromEntries(
    Object.entries(properties).map(([key, property]) => {
      const field = jsonSchemaNodeToZod(property);
      return [key, required.has(key) ? field : field.optional()];
    }),
  );
}
