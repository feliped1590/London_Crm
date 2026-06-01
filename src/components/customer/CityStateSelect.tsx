import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';
import { useErpCities, normalizeCityName } from '@/hooks/useErpCities';

const BR_UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface CityStateSelectProps {
  city: string;
  state: string;
  onChange: (next: { city: string; state: string }) => void;
  disabled?: boolean;
  required?: boolean;
  /** Optional layout: by default renders two columns inside a grid parent. */
  className?: string;
}

/**
 * Pair of selects for State (UF) and City, sourced from `erp_cities`.
 * Guarantees that the saved city/uf exists in the ERP mapping, eliminating
 * "city not mapped" sync errors.
 *
 * Behaviors:
 * - Empty mapping table → falls back to plain inputs with a warning.
 * - Legacy value not in mapping → shown as a disabled "(não mapeada)" item
 *   at the top of the list so the user is forced to pick a valid one.
 */
export function CityStateSelect({
  city,
  state,
  onChange,
  disabled,
  required,
  className,
}: CityStateSelectProps) {
  const { data, isLoading } = useErpCities();

  const ufKey = (state || '').toUpperCase();
  const cityList = useMemo(() => data.citiesByUf[ufKey] ?? [], [data, ufKey]);

  const hasMapping = data.ufs.length > 0;

  const currentCityIsMapped = useMemo(() => {
    if (!city || !ufKey) return true;
    const target = normalizeCityName(city);
    return cityList.some((c) => normalizeCityName(c.nome) === target);
  }, [city, ufKey, cityList]);

  // Fallback: tenant has no ERP cities mapped yet — keep plain inputs.
  if (!isLoading && !hasMapping) {
    return (
      <>
        <div>
          <Label htmlFor="city">
            Cidade {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => onChange({ city: e.target.value, state })}
            disabled={disabled}
            required={required}
          />
        </div>
        <div>
          <Label htmlFor="state">
            Estado {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="state"
            value={state}
            onChange={(e) =>
              onChange({ city, state: e.target.value.toUpperCase().slice(0, 2) })
            }
            disabled={disabled}
            maxLength={2}
            placeholder="UF"
            required={required}
          />
        </div>
        <div className="col-span-2">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Nenhuma cidade mapeada no ERP. Cadastre em Configurações → ERP →
              Cidades para liberar a sincronização.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <Label htmlFor="state">
          Estado {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={ufKey || undefined}
          onValueChange={(value) => {
            // Trocar UF limpa a cidade (não faz sentido manter)
            onChange({ state: value, city: '' });
          }}
          disabled={disabled || isLoading}
        >
          <SelectTrigger id="state">
            <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione a UF'} />
          </SelectTrigger>
          <SelectContent>
            {BR_UFS.map((uf) => {
              const mapped = data.ufs.includes(uf);
              return (
                <SelectItem key={uf} value={uf}>
                  {uf}{!mapped ? ' (sem cidades mapeadas)' : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="city">
          Cidade {required && <span className="text-destructive">*</span>}
        </Label>
        {ufKey && cityList.length === 0 ? (
          <>
            <Select disabled>
              <SelectTrigger id="city">
                <SelectValue placeholder="Nenhuma cidade mapeada para esta UF" />
              </SelectTrigger>
              <SelectContent />
            </Select>
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Nenhuma cidade mapeada no ERP para {ufKey}. Solicite ao
              administrador o cadastro da cidade antes de prosseguir.
            </p>
          </>
        ) : (
          <Select
            value={currentCityIsMapped && city ? city : undefined}
            onValueChange={(value) => onChange({ city: value, state: ufKey })}
            disabled={disabled || isLoading || !ufKey}
          >
            <SelectTrigger id="city">
              <SelectValue
                placeholder={!ufKey ? 'Selecione a UF primeiro' : 'Selecione a cidade'}
              />
            </SelectTrigger>
            <SelectContent>
              {!currentCityIsMapped && city && (
                <SelectItem value={`__legacy__:${city}`} disabled>
                  {city} (não mapeada — selecione outra)
                </SelectItem>
              )}
              {cityList.map((c) => (
                <SelectItem key={`${c.uf}-${c.codigo_erp}-${c.nome}`} value={c.nome}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!currentCityIsMapped && city && cityList.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Cidade atual não está mapeada no ERP. Selecione uma da lista para
            permitir a sincronização.
          </p>
        )}
      </div>
    </>
  );
}
