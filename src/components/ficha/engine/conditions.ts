// Avaliador puro de condicionais declarativas. Sem `eval`.
// Acesso a campos por path "section.field" ou "section.field.subfield".

import type { Condition, FichaData } from './types';

function getByPath(data: FichaData, path: string): unknown {
  const parts = path.split('.');
  let cur: any = data;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function evaluateCondition(cond: Condition | undefined, data: FichaData): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, data));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, data));
  if ('not' in cond) return !evaluateCondition(cond.not, data);

  const v = getByPath(data, cond.field);
  switch (cond.op) {
    case 'eq': return v === cond.value;
    case 'neq': return v !== cond.value;
    case 'in': return Array.isArray(cond.value) && (cond.value as unknown[]).includes(v);
    case 'nin': return Array.isArray(cond.value) && !(cond.value as unknown[]).includes(v);
    case 'gt': return typeof v === 'number' && typeof cond.value === 'number' && v > cond.value;
    case 'lt': return typeof v === 'number' && typeof cond.value === 'number' && v < cond.value;
    case 'truthy': return Boolean(v);
    case 'falsy': return !v;
    default: return true;
  }
}
