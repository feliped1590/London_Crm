import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { NumberInput } from '@/components/ui/NumberInput';

export interface PaymentConditionDraft {
  id?: string;
  parcela: number;
  dias: number;
  payment_method: string;        // crm_payment_method
  tipo: 'V' | 'P';
  valor?: number | null;         // R$ quando tipo='V'
  percentual?: number | null;    // % quando tipo='P' (opcional; se null = rateio igual)
}

interface Props {
  value: PaymentConditionDraft[];
  onChange: (next: PaymentConditionDraft[]) => void;
  totalAmount: number;
  disabled?: boolean;
}

const NEW_ROW = (parcela: number): PaymentConditionDraft => ({
  parcela,
  dias: 0,
  payment_method: '',
  tipo: 'P',
  valor: null,
  percentual: null,
});

export function PaymentConditionsEditor({ value, onChange, totalAmount, disabled }: Props) {
  const [shortcutOpen, setShortcutOpen] = useState<null | 'simples' | 'entrada'>(null);
  const [simplesDias, setSimplesDias] = useState('');
  const [simplesForma, setSimplesForma] = useState('');
  const [entradaValor, setEntradaValor] = useState<number | null>(null);
  const [entradaFormaV, setEntradaFormaV] = useState('');
  const [entradaDias, setEntradaDias] = useState('');
  const [entradaFormaP, setEntradaFormaP] = useState('');

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods-mapping'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_method_erp_mapping')
        .select('crm_payment_method, erp_payment_description')
        .eq('is_active', true)
        .order('crm_payment_method');
      return (data || []) as Array<{ crm_payment_method: string; erp_payment_description: string }>;
    },
  });

  const totalAlocado = useMemo(() => {
    const somaV = value.filter(r => r.tipo === 'V').reduce((s, r) => s + (Number(r.valor) || 0), 0);
    const saldoRestante = Math.max(0, totalAmount - somaV);
    const linhasP = value.filter(r => r.tipo === 'P');
    const explicitP = linhasP.filter(r => r.percentual != null && r.percentual !== undefined);
    const implicitP = linhasP.length - explicitP.length;
    const somaPctExplicit = explicitP.reduce((s, r) => s + (Number(r.percentual) || 0), 0);
    const somaPSubtotal = saldoRestante > 0
      ? (somaPctExplicit / 100) * saldoRestante + (implicitP > 0 ? saldoRestante - (somaPctExplicit / 100) * saldoRestante : 0)
      : 0;
    // Quando há linha P implícita, ela cobre o restante; quando todas são explícitas e somam <100, sobra.
    const totalP = implicitP > 0 ? saldoRestante : (somaPctExplicit / 100) * saldoRestante;
    return { somaV, saldoRestante, somaPctExplicit, totalP, total: somaV + totalP, implicitP, linhasP: linhasP.length };
  }, [value, totalAmount]);

  const totalDifference = totalAmount - totalAlocado.total;
  const isClosed = Math.abs(totalDifference) < 0.01 && value.length > 0;

  // ─── Atualizações ───
  const updateRow = (idx: number, patch: Partial<PaymentConditionDraft>) => {
    const next = value.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const addRow = () => {
    const nextParcela = (value[value.length - 1]?.parcela ?? 0) + 1;
    const lastForma = value[value.length - 1]?.payment_method ?? '';
    onChange([...value, { ...NEW_ROW(nextParcela), payment_method: lastForma }]);
  };

  const removeRow = (idx: number) => {
    const next = value.filter((_, i) => i !== idx).map((r, i) => ({ ...r, parcela: i + 1 }));
    onChange(next);
  };

  const handleTipoChange = (idx: number, tipo: 'V' | 'P') => {
    updateRow(idx, { tipo, valor: tipo === 'V' ? value[idx].valor : null, percentual: tipo === 'P' ? value[idx].percentual : null });
  };

  // ─── Atalhos ───
  const aplicarAVista = () => {
    const forma = value[0]?.payment_method ?? paymentMethods[0]?.crm_payment_method ?? '';
    onChange([{ parcela: 1, dias: 0, payment_method: forma, tipo: 'P', valor: null, percentual: null }]);
  };

  const aplicarSimples = () => {
    const dias = simplesDias.split('/').map(s => Number(s.trim())).filter(d => !isNaN(d) && d >= 0);
    if (dias.length === 0 || !simplesForma) return;
    onChange(dias.map((d, i) => ({ parcela: i + 1, dias: d, payment_method: simplesForma, tipo: 'P', valor: null, percentual: null })));
    setShortcutOpen(null);
    setSimplesDias(''); setSimplesForma('');
  };

  const aplicarEntrada = () => {
    const valor = Number(entradaValor) || 0;
    const dias = entradaDias.split('/').map(s => Number(s.trim())).filter(d => !isNaN(d) && d >= 0);
    if (!valor || valor <= 0 || dias.length === 0 || !entradaFormaV || !entradaFormaP) return;
    const linhas: PaymentConditionDraft[] = [
      { parcela: 1, dias: 0, payment_method: entradaFormaV, tipo: 'V', valor, percentual: null },
      ...dias.map((d, i) => ({ parcela: i + 2, dias: d, payment_method: entradaFormaP, tipo: 'P' as const, valor: null, percentual: null })),
    ];
    onChange(linhas);
    setShortcutOpen(null);
    setEntradaValor(null); setEntradaDias(''); setEntradaFormaV(''); setEntradaFormaP('');
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-base">Condições de Pagamento</Label>
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={aplicarAVista}>
                À vista
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShortcutOpen(shortcutOpen === 'simples' ? null : 'simples')}>
                <Wand2 className="h-3 w-3 mr-1" /> Parcelado simples
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShortcutOpen(shortcutOpen === 'entrada' ? null : 'entrada')}>
                <Wand2 className="h-3 w-3 mr-1" /> Entrada + parcelas
              </Button>
            </div>
          )}
        </div>

        {shortcutOpen === 'simples' && (
          <div className="border rounded-md p-3 bg-muted/30 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div>
              <Label className="text-xs">Dias (separe com /)</Label>
              <Input value={simplesDias} onChange={e => setSimplesDias(e.target.value)} placeholder="28/35/42" />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={simplesForma} onValueChange={setSimplesForma}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.crm_payment_method} value={pm.crm_payment_method}>{pm.erp_payment_description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={aplicarSimples} disabled={!simplesDias || !simplesForma}>Aplicar</Button>
          </div>
        )}

        {shortcutOpen === 'entrada' && (
          <div className="border rounded-md p-3 bg-muted/30 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor da entrada (R$)</Label>
              <NumberInput value={entradaValor} onChange={setEntradaValor} decimals={2} min={0} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Forma da entrada</Label>
              <Select value={entradaFormaV} onValueChange={setEntradaFormaV}>
                <SelectTrigger><SelectValue placeholder="Antecipado..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.crm_payment_method} value={pm.crm_payment_method}>{pm.erp_payment_description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dias das parcelas restantes</Label>
              <Input value={entradaDias} onChange={e => setEntradaDias(e.target.value)} placeholder="28/35" />
            </div>
            <div>
              <Label className="text-xs">Forma das parcelas</Label>
              <Select value={entradaFormaP} onValueChange={setEntradaFormaP}>
                <SelectTrigger><SelectValue placeholder="Boleto..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.crm_payment_method} value={pm.crm_payment_method}>{pm.erp_payment_description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="button" onClick={aplicarEntrada} disabled={!entradaValor || !entradaDias || !entradaFormaV || !entradaFormaP}>
                Aplicar
              </Button>
            </div>
          </div>
        )}

        {value.length === 0 ? (
          <div className="border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
            Nenhuma condição de pagamento. Use um atalho acima ou adicione uma parcela.
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-left w-12">#</th>
                  <th className="p-2 text-left w-24">Dias</th>
                  <th className="p-2 text-left w-28">Tipo</th>
                  <th className="p-2 text-left w-36">Valor / %</th>
                  <th className="p-2 text-left">Forma de Recebimento</th>
                  {!disabled && <th className="p-2 w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {value.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 text-muted-foreground">{row.parcela}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={row.dias}
                        onChange={e => updateRow(idx, { dias: Math.max(0, Number(e.target.value) || 0) })}
                        disabled={disabled}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex border rounded-md overflow-hidden">
                        <button
                          type="button"
                          disabled={disabled}
                          className={cn('px-2 py-1 text-xs flex-1', row.tipo === 'V' ? 'bg-primary text-primary-foreground' : 'bg-background')}
                          onClick={() => handleTipoChange(idx, 'V')}
                        >R$</button>
                        <button
                          type="button"
                          disabled={disabled}
                          className={cn('px-2 py-1 text-xs flex-1', row.tipo === 'P' ? 'bg-primary text-primary-foreground' : 'bg-background')}
                          onClick={() => handleTipoChange(idx, 'P')}
                        >%</button>
                      </div>
                    </td>
                    <td className="p-2">
                      {row.tipo === 'V' ? (
                        <NumberInput
                          value={row.valor ?? null}
                          onChange={(v) => updateRow(idx, { valor: v })}
                          decimals={2}
                          min={0}
                          placeholder="R$ 0,00"
                          disabled={disabled}
                          className="h-8"
                        />
                      ) : (
                        <NumberInput
                          value={row.percentual ?? null}
                          onChange={(v) => updateRow(idx, { percentual: v })}
                          decimals={2}
                          min={0}
                          max={100}
                          suffix=" %"
                          placeholder="auto"
                          disabled={disabled}
                          className="h-8"
                        />
                          className="h-8"
                        />
                      )}
                    </td>
                    <td className="p-2">
                      <Select value={row.payment_method} onValueChange={v => updateRow(idx, { payment_method: v })} disabled={disabled}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(pm => (
                            <SelectItem key={pm.crm_payment_method} value={pm.crm_payment_method}>{pm.erp_payment_description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    {!disabled && (
                      <td className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(idx)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remover parcela</TooltipContent>
                        </Tooltip>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar parcela
          </Button>
        )}

        {value.length > 0 && totalAmount > 0 && (
          <div className={cn(
            'text-xs px-3 py-2 rounded-md',
            isClosed ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                     : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          )}>
            Total alocado: <strong>{formatCurrency(totalAlocado.total)}</strong> de {formatCurrency(totalAmount)}
            {isClosed
              ? ' ✓'
              : totalDifference > 0
                ? ` — falta ${formatCurrency(totalDifference)}`
                : ` — excede em ${formatCurrency(Math.abs(totalDifference))}`}
            {totalAlocado.implicitP > 1 && totalAlocado.somaPctExplicit === 0 && (
              <span className="block opacity-70">Saldo restante será dividido igualmente entre as {totalAlocado.implicitP} parcelas em %.</span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Validação para uso em submissão (mesma regra do backend).
 * Retorna string de erro ou null se válido.
 */
export function validatePaymentConditions(rows: PaymentConditionDraft[], totalAmount: number): string | null {
  if (rows.length === 0) return null; // opcional
  for (const r of rows) {
    if (!r.payment_method) return `Parcela ${r.parcela}: selecione a forma de recebimento.`;
    if (r.tipo === 'V' && (!r.valor || r.valor <= 0)) return `Parcela ${r.parcela}: informe o valor.`;
    if (r.tipo === 'P' && r.percentual != null && (r.percentual < 0 || r.percentual > 100)) {
      return `Parcela ${r.parcela}: percentual inválido.`;
    }
  }
  const somaV = rows.filter(r => r.tipo === 'V').reduce((s, r) => s + (r.valor || 0), 0);
  if (somaV - totalAmount > 0.01) return `Soma dos valores fixos excede o total do pedido.`;
  const linhasP = rows.filter(r => r.tipo === 'P');
  const explicitP = linhasP.filter(r => r.percentual != null);
  if (linhasP.length > 0 && explicitP.length === linhasP.length) {
    const somaPct = explicitP.reduce((s, r) => s + (r.percentual || 0), 0);
    if (Math.abs(somaPct - 100) > 0.01) return `Os percentuais devem somar exatamente 100%.`;
  }
  if (linhasP.length === 0 && Math.abs(somaV - totalAmount) > 0.01) {
    return `Soma dos valores fixos não fecha o total do pedido.`;
  }
  return null;
}
