import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, RotateCcw } from 'lucide-react';
import { SearchFilters } from '@/hooks/useProspecting';

interface ProspectingFiltersProps {
  onSearch: (filters: SearchFilters) => void;
  isSearching: boolean;
}

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const PORTES = [
  { value: 'MEI', label: 'MEI' },
  { value: 'ME', label: 'Microempresa' },
  { value: 'EPP', label: 'Empresa de Pequeno Porte' },
  { value: 'DEMAIS', label: 'Demais' },
];

export function ProspectingFilters({ onSearch, isSearching }: ProspectingFiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    cnpj: '',
    razaoSocial: '',
    cnae: '',
    porte: '',
    estado: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({
      cnpj: '',
      razaoSocial: '',
      cnae: '',
      porte: '',
      estado: '',
    });
  };

  // Máscara de CNPJ
  const handleCnpjChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '.' + cleaned.slice(2);
    }
    if (cleaned.length > 5) {
      formatted = formatted.slice(0, 6) + '.' + cleaned.slice(5);
    }
    if (cleaned.length > 8) {
      formatted = formatted.slice(0, 10) + '/' + cleaned.slice(8);
    }
    if (cleaned.length > 12) {
      formatted = formatted.slice(0, 15) + '-' + cleaned.slice(12, 14);
    }
    
    setFilters(prev => ({ ...prev, cnpj: formatted }));
  };

  const hasFilters = filters.cnpj;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Empresas
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Busque por CNPJ para consultar dados públicos da Receita Federal (BrasilAPI)
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={filters.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                maxLength={18}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Digite o CNPJ completo para buscar</p>
            </div>

            {/* Razão Social - informativo */}
            <div className="space-y-2">
              <Label htmlFor="razaoSocial" className="flex items-center gap-2">
                Razão Social
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">API Paga</Badge>
              </Label>
              <Input
                id="razaoSocial"
                placeholder="Busca por nome..."
                value={filters.razaoSocial}
                onChange={(e) => setFilters(prev => ({ ...prev, razaoSocial: e.target.value }))}
                disabled
                className="opacity-50"
              />
              <p className="text-xs text-muted-foreground">Requer integração com API paga</p>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label htmlFor="estado" className="flex items-center gap-2">
                Estado
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">API Paga</Badge>
              </Label>
              <Select
                value={filters.estado}
                onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value === 'all' ? '' : value }))}
                disabled
              >
                <SelectTrigger id="estado" className="opacity-50">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {ESTADOS_BRASIL.map(estado => (
                    <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Requer integração com API paga</p>
            </div>

            {/* Porte */}
            <div className="space-y-2">
              <Label htmlFor="porte" className="flex items-center gap-2">
                Porte
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">API Paga</Badge>
              </Label>
              <Select
                value={filters.porte}
                onValueChange={(value) => setFilters(prev => ({ ...prev, porte: value === 'all' ? '' : value }))}
                disabled
              >
                <SelectTrigger id="porte" className="opacity-50">
                  <SelectValue placeholder="Todos os portes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os portes</SelectItem>
                  {PORTES.map(porte => (
                    <SelectItem key={porte.value} value={porte.value}>{porte.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Requer integração com API paga</p>
            </div>

            {/* CNAE */}
            <div className="space-y-2">
              <Label htmlFor="cnae" className="flex items-center gap-2">
                CNAE
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">API Paga</Badge>
              </Label>
              <Input
                id="cnae"
                placeholder="Ex: 4751-2/01"
                value={filters.cnae}
                onChange={(e) => setFilters(prev => ({ ...prev, cnae: e.target.value }))}
                disabled
                className="opacity-50"
              />
              <p className="text-xs text-muted-foreground">Requer integração com API paga</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSearching}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button
              type="submit"
              disabled={!hasFilters || isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
