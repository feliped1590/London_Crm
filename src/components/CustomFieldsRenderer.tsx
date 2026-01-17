import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type CustomField = Tables<'custom_fields'>;

interface CustomFieldsRendererProps {
  entity: 'contact' | 'company' | 'deal';
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function CustomFieldsRenderer({ entity, values, onChange }: CustomFieldsRendererProps) {
  const { data: fields, isLoading } = useQuery({
    queryKey: ['custom-fields', entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('entity', entity)
        .order('sort_order');
      if (error) throw error;
      return data as CustomField[];
    },
  });

  const handleChange = (fieldName: string, value: unknown) => {
    onChange({ ...values, [fieldName]: value });
  };

  const renderField = (field: CustomField) => {
    const value = values[field.name];
    const fieldId = `custom-field-${field.name}`;

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            id={fieldId}
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.field_type === 'email' ? 'email@exemplo.com' : field.field_type === 'url' ? 'https://...' : ''}
          />
        );

      case 'number':
      case 'currency':
        return (
          <Input
            id={fieldId}
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => handleChange(field.name, e.target.value ? Number(e.target.value) : null)}
            placeholder={field.field_type === 'currency' ? 'R$ 0,00' : '0'}
          />
        );

      case 'date':
        const dateValue = value ? new Date(value as string) : undefined;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateValue && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? format(dateValue, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => handleChange(field.name, date?.toISOString() || null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'select':
        const options = (field.options as string[]) || [];
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => handleChange(field.name, v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const multiOptions = (field.options as string[]) || [];
        const selectedValues = (value as string[]) || [];
        return (
          <div className="flex flex-wrap gap-2">
            {multiOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option);
                    handleChange(field.name, newValues);
                  }}
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={fieldId}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => handleChange(field.name, checked)}
            />
            <span className="text-sm text-muted-foreground">Sim</span>
          </div>
        );

      default:
        return (
          <Input
            id={fieldId}
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando campos...</div>;
  }

  if (!fields || fields.length === 0) {
    return null;
  }

  return (
    <div className="col-span-2 space-y-4 border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-muted-foreground">Campos Personalizados</h3>
      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.id} className={field.field_type === 'multiselect' ? 'col-span-2' : ''}>
            <Label htmlFor={`custom-field-${field.name}`}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {renderField(field)}
          </div>
        ))}
      </div>
    </div>
  );
}
