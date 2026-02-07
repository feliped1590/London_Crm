import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calculator, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TipoProdutoFiscal, tipoProdutoFiscalOptions } from '@/types/fiscal';

interface FiscalData {
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
  tem_icms_st?: boolean;
  aliquota_ipi?: number;
  cst_pis_cofins?: string;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  tipo_produto_fiscal?: TipoProdutoFiscal;
}

interface FiscalSuggestionsCardProps {
  data: FiscalData;
  onChange: (field: keyof FiscalData, value: any) => void;
  disabled?: boolean;
  ncmCode?: string;
  isSuggestion?: boolean;
}

export function FiscalSuggestionsCard({
  data,
  onChange,
  disabled = false,
  ncmCode,
  isSuggestion = false,
}: FiscalSuggestionsCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Dados Fiscais</CardTitle>
          </div>
          {isSuggestion && (
            <Badge variant="outline" className="text-xs">
              Sugerido pelo NCM
            </Badge>
          )}
        </div>
        <CardDescription>
          Classificação tributária do produto
          {ncmCode && <span className="font-mono ml-1">({ncmCode})</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipo de Produto Fiscal */}
        <div className="grid gap-2">
          <Label htmlFor="tipo_produto_fiscal">Tipo de Produto</Label>
          <Select
            value={data.tipo_produto_fiscal || 'none'}
            onValueChange={(v) => onChange('tipo_produto_fiscal', v === 'none' ? undefined : v as TipoProdutoFiscal)}
            disabled={disabled}
          >
            <SelectTrigger id="tipo_produto_fiscal">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não especificado</SelectItem>
              {tipoProdutoFiscalOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ICMS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="cst_icms">CST ICMS</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Código de Situação Tributária do ICMS (Lucro Presumido/Real)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="cst_icms"
              value={data.cst_icms || ''}
              onChange={(e) => onChange('cst_icms', e.target.value)}
              placeholder="Ex: 00, 10, 20"
              maxLength={3}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="csosn">CSOSN</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Código de Situação da Operação do Simples Nacional</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="csosn"
              value={data.csosn || ''}
              onChange={(e) => onChange('csosn', e.target.value)}
              placeholder="Ex: 101, 102, 500"
              maxLength={4}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="aliquota_icms">Alíquota ICMS (%)</Label>
            <Input
              id="aliquota_icms"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={data.aliquota_icms || ''}
              onChange={(e) => onChange('aliquota_icms', parseFloat(e.target.value) || undefined)}
              placeholder="0.00"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center justify-between">
              ICMS-ST
              <Switch
                checked={data.tem_icms_st || false}
                onCheckedChange={(v) => onChange('tem_icms_st', v)}
                disabled={disabled}
              />
            </Label>
            <p className="text-xs text-muted-foreground">
              Substituição Tributária
            </p>
          </div>
        </div>

        {/* IPI */}
        <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="aliquota_ipi">Alíquota IPI (%)</Label>
            <Badge variant="outline" className="text-xs">Snapshot</Badge>
          </div>
          <Input
            id="aliquota_ipi"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={data.aliquota_ipi || ''}
            onChange={(e) => onChange('aliquota_ipi', parseFloat(e.target.value) || undefined)}
            placeholder="0.00"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Valor gravado no cadastro. Não é recalculado automaticamente.
          </p>
        </div>

        {/* PIS/COFINS */}
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cst_pis_cofins">CST PIS/COFINS</Label>
            <Input
              id="cst_pis_cofins"
              value={data.cst_pis_cofins || ''}
              onChange={(e) => onChange('cst_pis_cofins', e.target.value)}
              placeholder="Ex: 01, 04"
              maxLength={2}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="aliquota_pis">PIS (%)</Label>
            <Input
              id="aliquota_pis"
              type="number"
              step="0.0001"
              min="0"
              max="100"
              value={data.aliquota_pis || ''}
              onChange={(e) => onChange('aliquota_pis', parseFloat(e.target.value) || undefined)}
              placeholder="0.0000"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="aliquota_cofins">COFINS (%)</Label>
            <Input
              id="aliquota_cofins"
              type="number"
              step="0.0001"
              min="0"
              max="100"
              value={data.aliquota_cofins || ''}
              onChange={(e) => onChange('aliquota_cofins', parseFloat(e.target.value) || undefined)}
              placeholder="0.0000"
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
