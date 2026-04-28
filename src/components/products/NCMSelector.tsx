import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, Search, Check, AlertTriangle, X, Info } from 'lucide-react';
import { useNCMValidation } from '@/hooks/useNCMValidation';
import { NCMCode, NCMSemanticValidation, riskLevelConfig } from '@/types/fiscal';
import { cn } from '@/lib/utils';

interface NCMSelectorProps {
  value: string;
  onChange: (ncmCode: string, ncm?: NCMCode) => void;
  productDescription?: string;
  onValidationChange?: (result: NCMSemanticValidation | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export function NCMSelector({
  value,
  onChange,
  productDescription,
  onValidationChange,
  disabled = false,
  required = false,
  error,
}: NCMSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<NCMCode[]>([]);
  const [selectedNCM, setSelectedNCM] = useState<NCMCode | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    searchNCM,
    fetchNCMByCode,
    validateNCM,
    validationResult,
    isValidating,
    clearValidation,
  } = useNCMValidation({
    onValidationComplete: onValidationChange,
  });

  // Carregar NCM selecionado quando value muda externamente
  useEffect(() => {
    if (value && value.length === 8 && selectedNCM?.codigo !== value) {
      fetchNCMByCode(value).then((ncm) => {
        if (ncm) {
          setSelectedNCM(ncm);
        } else {
          setSelectedNCM(null);
        }
      });
    } else if (!value) {
      setSelectedNCM(null);
      clearValidation();
    }
  }, [value, fetchNCMByCode, selectedNCM, clearValidation]);

  // Debounced search
  const handleSearch = useCallback(async (term: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchNCM(term);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchNCM]);

  // Efeito para buscar quando searchTerm muda
  useEffect(() => {
    handleSearch(searchTerm);
  }, [searchTerm, handleSearch]);

  // Selecionar NCM
  const handleSelect = useCallback((ncm: NCMCode) => {
    setSelectedNCM(ncm);
    onChange(ncm.codigo, ncm);
    setOpen(false);
    setSearchTerm('');
    setSearchResults([]);

    // Validar semanticamente se tiver descrição do produto
    if (productDescription && productDescription.length > 3) {
      validateNCM(productDescription, ncm.codigo, ncm.descricao);
    }
  }, [onChange, productDescription, validateNCM]);

  // Limpar seleção
  const handleClear = useCallback(() => {
    setSelectedNCM(null);
    onChange('');
    clearValidation();
  }, [onChange, clearValidation]);

  // Input manual de NCM
  const handleManualInput = useCallback((inputValue: string) => {
    // Apenas números, máximo 8 dígitos
    const cleanValue = inputValue.replace(/\D/g, '').slice(0, 8);
    
    if (cleanValue.length === 8) {
      // Buscar o NCM completo
      fetchNCMByCode(cleanValue).then((ncm) => {
        if (ncm) {
          handleSelect(ncm);
        } else {
          // NCM não encontrado
          setSelectedNCM(null);
          onChange(cleanValue);
          onValidationChange?.({
            compatible: false,
            confidence: 0,
            risk_level: 'high',
            summary: 'NCM não encontrado na base oficial.',
          });
        }
      });
    } else {
      onChange(cleanValue);
      if (cleanValue.length === 0) {
        clearValidation();
      }
    }
  }, [fetchNCMByCode, handleSelect, onChange, onValidationChange, clearValidation]);

  // Renderizar badge de status
  const renderStatusBadge = (ncm: NCMCode) => {
    if (ncm.status === 'inativo') {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Inativo</Badge>;
    }
    if (ncm.status === 'obsoleto') {
      return <Badge variant="outline" className="text-red-600 border-red-300 text-xs">Obsoleto</Badge>;
    }
    return null;
  };

  // Renderizar badge de validação semântica
  const renderValidationBadge = () => {
    if (isValidating) {
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Validando...
        </Badge>
      );
    }

    if (!validationResult) return null;

    const config = riskLevelConfig[validationResult.risk_level];
    const Icon = validationResult.risk_level === 'low' ? Check : 
                 validationResult.risk_level === 'medium' ? AlertTriangle : X;

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1 text-xs",
          config.color,
          config.bgColor,
          config.borderColor
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Renderizar tags fiscais
  const renderFiscalTags = (ncm: NCMCode) => {
    const tags = [];

    if (ncm.aliquota_ipi_oficial && ncm.aliquota_ipi_oficial > 0) {
      tags.push(
        <Badge key="ipi" variant="secondary" className="text-xs">
          IPI {ncm.aliquota_ipi_oficial}%
        </Badge>
      );
    }

    return tags;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ncm" className="flex items-center gap-1">
        NCM {required && <span className="text-destructive">*</span>}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
              <Info className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm">
            <p className="font-medium mb-1">Nomenclatura Comum do Mercosul</p>
            <p className="text-muted-foreground">
              Código de 8 dígitos que classifica mercadorias para fins fiscais e de comércio exterior.
            </p>
          </PopoverContent>
        </Popover>
      </Label>

      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "flex-1 justify-between font-mono",
                !selectedNCM && !value && "text-muted-foreground",
                error && "border-destructive"
              )}
              disabled={disabled}
            >
              {selectedNCM ? (
                <span className="flex items-center gap-2">
                  <span>{selectedNCM.codigo}</span>
                  {renderStatusBadge(selectedNCM)}
                </span>
              ) : value ? (
                <span className="flex items-center gap-2">
                  <span>{value}</span>
                  <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                    Não encontrado
                  </Badge>
                </span>
              ) : (
                "Buscar NCM..."
              )}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Digite código ou descrição..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 && searchTerm.length >= 2 ? (
                  <CommandEmpty>
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Nenhum NCM encontrado</p>
                      {searchTerm.match(/^\d{8}$/) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Código não existe na base oficial
                        </p>
                      )}
                    </div>
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {searchResults.map((ncm) => (
                      <CommandItem
                        key={ncm.id}
                        value={ncm.codigo}
                        onSelect={() => handleSelect(ncm)}
                        className="flex flex-col items-start gap-1 py-3"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-mono font-medium">{ncm.codigo}</span>
                          {renderStatusBadge(ncm)}
                          {renderFiscalTags(ncm)}
                          {selectedNCM?.id === ncm.id && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {ncm.descricao}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Input direto para digitar NCM */}
        <Input
          id="ncm"
          value={value}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder="00000000"
          className={cn(
            "w-28 font-mono text-center",
            error && "border-destructive"
          )}
          maxLength={8}
          disabled={disabled}
        />

        {(selectedNCM || value) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Descrição do NCM selecionado */}
      {selectedNCM && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground flex-1">
              {selectedNCM.descricao}
            </p>
            {renderValidationBadge()}
          </div>
          
          {/* Resumo da validação semântica */}
          {validationResult && !isValidating && (
            <div className={cn(
              "text-xs p-2 rounded border",
              riskLevelConfig[validationResult.risk_level].bgColor,
              riskLevelConfig[validationResult.risk_level].borderColor,
              riskLevelConfig[validationResult.risk_level].color
            )}>
              {validationResult.summary}
            </div>
          )}
        </div>
      )}

      {/* Erro de validação */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
