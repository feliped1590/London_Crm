// Gera dinamicamente um schema Zod a partir de um FichaSchema.
// Usado para validação no submit. Condicionais (requiredWhen/visibleWhen)
// são tratadas via superRefine em uma camada externa para ter acesso ao
// dado completo — aqui geramos a forma estrutural.

import { z, ZodTypeAny } from 'zod';
import type { Field, FichaSchema, Section } from './types';

function fieldToZod(f: Field): ZodTypeAny {
  let base: ZodTypeAny;
  switch (f.type) {
    case 'text':
    case 'textarea':
      base = z.string();
      if ('maxLength' in f && f.maxLength) base = (base as z.ZodString).max(f.maxLength);
      break;
    case 'number': {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      base = n;
      break;
    }
    case 'integer': {
      let n = z.number().int();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      base = n;
      break;
    }
    case 'boolean': base = z.boolean(); break;
    case 'date': base = z.string(); break;
    case 'select':
    case 'lookup': base = z.union([z.string(), z.number()]); break;
    case 'multiselect':
    case 'lookup_multi': base = z.array(z.union([z.string(), z.number()])); break;
    case 'computed': base = z.any(); break;
    case 'repeater': {
      const item = z.object(
        Object.fromEntries(
          f.itemFields.map((sf) => [sf.id, sf.required ? fieldToZod(sf) : fieldToZod(sf).optional()]),
        ),
      );
      let arr: z.ZodTypeAny = z.array(item);
      if (f.minItems !== undefined) arr = (arr as z.ZodArray<typeof item>).min(f.minItems);
      if (f.maxItems !== undefined) arr = (arr as z.ZodArray<typeof item>).max(f.maxItems);
      base = arr;
      break;
    }
  }
  return f.required ? base : base.optional().nullable();
}

function sectionToZod(s: Section): ZodTypeAny {
  return z
    .object(Object.fromEntries(s.fields.map((f) => [f.id, fieldToZod(f)])))
    .partial()
    .optional();
}

export function zodFromSchema(schema: FichaSchema): ZodTypeAny {
  return z.object(Object.fromEntries(schema.sections.map((s) => [s.id, sectionToZod(s)])));
}
