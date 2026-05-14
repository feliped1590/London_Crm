import { FieldRenderer } from './FieldRenderer';
import { evaluateCondition } from './engine/conditions';
import type { FichaData, Section } from './engine/types';

interface Props {
  section: Section;
  data: FichaData;
  onChange: (sectionId: string, fieldId: string, value: any) => void;
}

const COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

export function SectionRenderer({ section, data, onChange }: Props) {
  if (!evaluateCondition(section.visibleWhen, data)) return null;

  const cols = section.layout?.columns ?? 2;
  const sectionData = (data[section.id] ?? {}) as Record<string, any>;

  return (
    <section className="space-y-3">
      {section.title && <h4 className="text-sm font-medium">{section.title}</h4>}
      <div className={`grid gap-4 ${COL_CLASS[cols] ?? COL_CLASS[2]}`}>
        {section.fields.map((field) => {
          if (!evaluateCondition(field.visibleWhen, data)) return null;
          const requiredNow =
            field.required ||
            (field.requiredWhen ? evaluateCondition(field.requiredWhen, data) : false);
          return (
            <FieldRenderer
              key={field.id}
              field={field}
              value={sectionData[field.id]}
              required={requiredNow}
              onChange={(v) => onChange(section.id, field.id, v)}
            />
          );
        })}
      </div>
    </section>
  );
}
