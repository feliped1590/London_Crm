import { Badge } from '@/components/ui/badge';
import { SectionRenderer } from './SectionRenderer';
import type { FichaData, FichaSchema } from './engine/types';

interface Props {
  schema: FichaSchema;
  value: FichaData;
  onChange: (next: FichaData) => void;
}

/**
 * Renderer dinâmico da Ficha Técnica.
 * Esta é a v2 (schema-driven). Atualmente NÃO está plugada na tela de produto;
 * será ativada via feature flag `tenant_settings.ficha_renderer_version = 'v2'`
 * em fase posterior.
 */
export function FichaRenderer({ schema, value, onChange }: Props) {
  const handle = (sectionId: string, fieldId: string, v: any) => {
    const sec = (value[sectionId] ?? {}) as Record<string, any>;
    onChange({ ...value, [sectionId]: { ...sec, [fieldId]: v } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Ficha Técnica</h3>
        <Badge variant="outline" className="text-xs">{schema.title}</Badge>
      </div>
      {schema.sections.map((s) => (
        <SectionRenderer key={s.id} section={s} data={value} onChange={handle} />
      ))}
    </div>
  );
}

export default FichaRenderer;
