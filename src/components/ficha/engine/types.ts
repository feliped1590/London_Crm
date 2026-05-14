// Schema declarativo da Ficha Técnica Dinâmica.
// Catálogo fechado de tipos de campo. Novos tipos exigem 1 entrada no
// FieldRenderer + 1 componente em ./fields, sem mudar o resto.

export type FichaPrimitive = string | number | boolean | null | undefined;
export type FichaValue =
  | FichaPrimitive
  | FichaPrimitive[]
  | { [k: string]: FichaValue }
  | Array<{ [k: string]: FichaValue }>;

export type FichaData = Record<string, Record<string, FichaValue>>;

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'lookup'
  | 'lookup_multi'
  | 'repeater'
  | 'date'
  | 'computed';

export type LookupSource =
  | 'product_ficha_machines'
  | 'product_ficha_cylinders'
  | 'product_ficha_accessories';

export type ConditionOp = 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'lt' | 'truthy' | 'falsy';

export type Condition =
  | { field: string; op: ConditionOp; value?: unknown }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface BaseField {
  id: string;                       // snake_case, estável
  type: FieldType;
  label?: string;
  description?: string;
  required?: boolean;
  requiredWhen?: Condition;
  visibleWhen?: Condition;
  // Reservado para fase futura (sem efeito hoje):
  erp_mapping?: { erp_field: string; transform?: string };
  operational_only?: boolean;       // true = nunca enviar ao ERP
}

export interface TextField extends BaseField { type: 'text'; pattern?: string; maxLength?: number; }
export interface TextareaField extends BaseField { type: 'textarea'; rows?: number; maxLength?: number; }
export interface NumberField extends BaseField { type: 'number'; min?: number; max?: number; step?: number; unit?: string; }
export interface IntegerField extends BaseField { type: 'integer'; min?: number; max?: number; step?: number; unit?: string; }
export interface BooleanField extends BaseField { type: 'boolean'; }
export interface SelectField extends BaseField { type: 'select'; options: Array<string | number>; }
export interface MultiSelectField extends BaseField { type: 'multiselect'; options: Array<string | number>; minItems?: number; maxItems?: number; }
export interface LookupField extends BaseField { type: 'lookup'; source: LookupSource; }
export interface LookupMultiField extends BaseField { type: 'lookup_multi'; source: LookupSource; minItems?: number; maxItems?: number; }
export interface RepeaterField extends BaseField {
  type: 'repeater';
  itemFields: Array<Exclude<Field, RepeaterField>>; // 1 nível apenas (Fase 0)
  minItems?: number;
  maxItems?: number;
}
export interface DateField extends BaseField { type: 'date'; }
export interface ComputedField extends BaseField { type: 'computed'; template: string; }

export type Field =
  | TextField | TextareaField | NumberField | IntegerField | BooleanField
  | SelectField | MultiSelectField | LookupField | LookupMultiField
  | RepeaterField | DateField | ComputedField;

export interface SectionLayout { columns?: 1 | 2 | 3 | 4; }

export interface Section {
  id: string;                       // snake_case, estável; vira chave no JSON
  title?: string;
  description?: string;
  layout?: SectionLayout;
  visibleWhen?: Condition;
  fields: Field[];
}

export interface FichaSchema {
  key: string;                      // ex.: stand_up_impresso
  version?: number;
  title: string;
  description?: string;
  sections: Section[];
}
