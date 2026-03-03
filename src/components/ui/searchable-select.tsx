import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchTerms?: string; // Additional terms to search by (e.g., CNPJ, CPF)
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  onCreateNew?: () => void;
  createNewLabel?: string;
  onSearchChange?: (search: string) => void;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
  className,
  allowClear = true,
  onCreateNew,
  createNewLabel = 'Criar novo',
  onSearchChange,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    if (onSearchChange) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearchChange(value), 300);
    }
  }, [onSearchChange]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search — skip local filtering when server-side search is active
  const filteredOptions = React.useMemo(() => {
    if (onSearchChange) return options; // Server handles filtering
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.searchTerms?.toLowerCase().includes(searchLower)
    );
  }, [options, search, onSearchChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false} filter={() => 1}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            <CommandEmpty>
              {emptyMessage}
              {onCreateNew && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={() => {
                    onCreateNew();
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {createNewLabel}
                </Button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="text-muted-foreground"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === null ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  Nenhum
                </CommandItem>
              )}
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.searchTerms && (
                      <span className="text-xs text-muted-foreground">
                        {option.searchTerms}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {/* Botão criar novo - sempre visível quando onCreateNew está definido */}
              {onCreateNew && (
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    onCreateNew();
                    setOpen(false);
                  }}
                  className="text-primary border-t mt-1 pt-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createNewLabel}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
