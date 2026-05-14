import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { useFichaLookups } from '@/hooks/useFichaLookups';
import type { Field, LookupSource } from './engine/types';

interface FieldRendererProps {
  field: Field;
  value: any;
  onChange: (next: any) => void;
  required?: boolean;
}

function num(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function useLookupItems(source: LookupSource) {
  const { machines, cylinders, accessories } = useFichaLookups();
  if (source === 'product_ficha_machines') return machines.items;
  if (source === 'product_ficha_cylinders') return cylinders.items;
  if (source === 'product_ficha_accessories') return accessories.items;
  return [];
}

export function FieldRenderer({ field, value, onChange, required }: FieldRendererProps) {
  const isRequired = required ?? field.required;
  const labelEl = field.label && (
    <Label className="text-xs">
      {field.label}
      {isRequired && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  switch (field.type) {
    case 'text':
      return (
        <div>
          {labelEl}
          <Input value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-1">
          {labelEl}
          <Textarea rows={field.rows ?? 3} value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)} />
        </div>
      );
    case 'number':
    case 'integer':
      return (
        <div>
          {labelEl}
          <Input
            type="number"
            step={field.step ?? (field.type === 'integer' ? 1 : 0.01)}
            min={field.min}
            max={field.max}
            value={value ?? ''}
            onChange={(e) => onChange(num(e.target.value))}
          />
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center justify-between gap-3 pt-5">
          {labelEl}
          <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
        </div>
      );
    case 'select': {
      return (
        <div>
          {labelEl}
          <Select
            value={value !== undefined && value !== null ? String(value) : undefined}
            onValueChange={(v) => {
              const opt = field.options.find((o) => String(o) === v);
              onChange(opt ?? v);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    case 'lookup': {
      const items = useLookupItems(field.source);
      return (
        <div>
          {labelEl}
          <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {items.map((it: any) => (
                <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    case 'multiselect':
    case 'lookup_multi':
      // Fase 0: placeholder visual. Implementação completa virá no cutover.
      return (
        <div>
          {labelEl}
          <div className="text-xs text-muted-foreground rounded-md border border-dashed p-2">
            Multi-select disponível na próxima fase.
          </div>
        </div>
      );
    case 'date':
      return (
        <div>
          {labelEl}
          <Input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
        </div>
      );
    case 'computed':
      return (
        <div>
          {labelEl}
          <Input value={String(value ?? '')} readOnly disabled />
        </div>
      );
    case 'repeater': {
      const items: any[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2 col-span-full">
          <div className="flex items-center justify-between">
            {labelEl ?? <span className="text-xs font-medium">{field.id}</span>}
            <Button type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => onChange([...items, {}])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
          )}
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                {field.itemFields.map((sf) => (
                  <div key={sf.id} className="flex-1">
                    <FieldRenderer
                      field={sf as Field}
                      value={it?.[sf.id]}
                      onChange={(v) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], [sf.id]: v };
                        onChange(next);
                      }}
                    />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="icon" onClick={() => {
                  onChange(items.filter((_, i) => i !== idx));
                }}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
