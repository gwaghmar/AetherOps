import { z } from "zod";

export type FieldType = "text" | "textarea" | "select" | "number" | "date" | "boolean";

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** For select fields: list of option values shown to the user. */
  options?: string[];
  /** For number fields: minimum allowed value. */
  min?: number;
  /** For number fields: maximum allowed value. */
  max?: number;
};

export type FieldSchemaJson = {
  fields: FieldDefinition[];
};

export function parseFieldSchema(raw: unknown): FieldSchemaJson {
  const field = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(["text", "textarea", "select", "number", "date", "boolean"]),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  });
  return z.object({ fields: z.array(field).min(1) }).parse(raw);
}

export function buildPayloadSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    const required = f.required !== false;
    let s: z.ZodTypeAny;

    switch (f.type) {
      case "number": {
        let n = z.coerce.number();
        if (f.min !== undefined) n = n.min(f.min, `${f.label} must be ≥ ${f.min}`);
        if (f.max !== undefined) n = n.max(f.max, `${f.label} must be ≤ ${f.max}`);
        s = required ? n : n.optional();
        break;
      }
      case "boolean": {
        const b = z.coerce.boolean();
        s = required ? b : b.optional();
        break;
      }
      case "date": {
        // Accept ISO date string; coerce via string validation
        const d = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${f.label} must be a valid date (YYYY-MM-DD)`);
        s = required ? d.min(1, `${f.label} is required`) : d.optional();
        break;
      }
      case "select": {
        const opts = f.options ?? [];
        const d = opts.length > 0
          ? z.enum(opts as [string, ...string[]])
          : z.string().trim();
        s = required ? d : (d as z.ZodTypeAny).optional();
        break;
      }
      default: {
        const str = z.string().trim();
        s = required ? str.min(1, `${f.label} is required`) : (str as z.ZodTypeAny).optional();
      }
    }

    shape[f.key] = s;
  }
  return z.object(shape);
}
