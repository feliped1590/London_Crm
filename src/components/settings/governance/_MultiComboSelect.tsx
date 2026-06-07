import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComboOption } from './_ComboSelect';

interface Props {
  options: ComboOption[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
}

export function MultiComboSelect({
  options, values, onChange, placeholder,
  emptyText = 'Nenhum resultado.', disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedOpts = options.filter((o) => values.includes(o.value));

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn('w-full justify-between font-normal', !selectedOpts.length && 'text-muted-foreground')}
          >
            <span className="truncate">
              {selectedOpts.length === 0
                ? placeholder
                : `${selectedOpts.length} selecionado${selectedOpts.length > 1 ? 's' : ''}`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const checked = values.includes(o.value);
                  return (
                    <CommandItem
                      key={o.value}
                      value={`${o.label} ${o.hint ?? ''}`}
                      onSelect={() => toggle(o.value)}
                    >
                      <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOpts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOpts.map((o) => (
            <Badge key={o.value} variant="secondary" className="gap-1 pr-1">
              <span className="text-xs">{o.label}</span>
              {!disabled && (
                <button
                  type="button"
                  className="rounded-sm hover:bg-muted-foreground/20"
                  onClick={() => toggle(o.value)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
