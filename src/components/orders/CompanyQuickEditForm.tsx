import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, Building2, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { useClassificacao } from '@/hooks/useClassificacao';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { CityStateSelect } from '@/components/customer/CityStateSelect';

const employeeCounts = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

interface CompanyQuickEditFormProps {
  companyId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  fantasia: string;
  cnpj: string;
  erp_code: string;
  inscricao_estadual: string;
  contribuinte_ipi: boolean;
  setor_id: string | null;
  segmento_id: string | null;
  atividade_id: string | null;
  employee_count: string;
  phone: string;
  email: string;
  website: string;
  default_carrier_id: string | null;
  default_freight_type: string;
  address: string;
  address_number: string;
  address_complement: string;
  neighborhood: string;
  zip_code: string;
  city: string;
  state: string;
}

const EMPTY: FormState = {
  name: '', fantasia: '', cnpj: '', erp_code: '', inscricao_estadual: '',
  contribuinte_ipi: false, setor_id: null, segmento_id: null, atividade_id: null,
  employee_count: '', phone: '', email: '', website: '',
  default_carrier_id: null, default_freight_type: '',
  address: '', address_number: '', address_complement: '', neighborhood: '',
  zip_code: '', city: '', state: '',
};

export function CompanyQuickEditForm({ companyId, onSaved, onCancel }: CompanyQuickEditFormProps) {
  const queryClient = useQueryClient();
  const { setores } = useClassificacao();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [bancoPadraoErp, setBancoPadraoErp] = useState<number>(999);
  const [carrierSearch, setCarrierSearch] = useState('');

  // ---- Carrega empresa ----
  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company-quick-edit', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Empresa não encontrada');
      return data;
    },
  });

  // ---- Banco padrão ERP ----
  const { data: erpFinancial } = useQuery({
    queryKey: ['company-quick-edit-erp', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_erp_financial')
        .select('id, banco_padrao_erp')
        .eq('company_id', companyId)
        .maybeSingle();
      return data;
    },
  });

  // ---- Carriers ----
  const { data: carriers } = useQuery({
    queryKey: ['company-quick-edit-carriers', carrierSearch],
    queryFn: async () => {
      let q = supabase.from('carriers').select('id, name, trade_name').eq('active', true).order('name').limit(50);
      if (carrierSearch) q = q.ilike('name', `%${carrierSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentCarrier } = useQuery({
    queryKey: ['company-quick-edit-carrier-current', form.default_carrier_id],
    queryFn: async () => {
      if (!form.default_carrier_id) return null;
      const { data } = await supabase.from('carriers').select('id, name, trade_name').eq('id', form.default_carrier_id).maybeSingle();
      return data;
    },
    enabled: !!form.default_carrier_id,
  });

  const carrierOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; trade_name: string | null }>();
    if (currentCarrier) map.set(currentCarrier.id, currentCarrier);
    (carriers || []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).map(c => ({ value: c.id, label: c.trade_name ? `${c.trade_name} (${c.name})` : c.name }));
  }, [carriers, currentCarrier]);

  // ---- Hidrata form ----
  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name ?? '',
      fantasia: company.fantasia ?? '',
      cnpj: company.cnpj ?? '',
      erp_code: company.erp_code ?? '',
      inscricao_estadual: company.inscricao_estadual ?? '',
      contribuinte_ipi: !!company.contribuinte_ipi,
      setor_id: company.setor_id ?? null,
      segmento_id: company.segmento_id ?? null,
      atividade_id: company.atividade_id ?? null,
      employee_count: company.employee_count ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      default_carrier_id: company.default_carrier_id ?? null,
      default_freight_type: company.default_freight_type ?? '',
      address: company.address ?? '',
      address_number: company.address_number ?? '',
      address_complement: company.address_complement ?? '',
      neighborhood: company.neighborhood ?? '',
      zip_code: company.zip_code ?? '',
      city: company.city ?? '',
      state: company.state ?? '',
    });
  }, [company]);

  useEffect(() => {
    if (erpFinancial?.banco_padrao_erp != null) setBancoPadraoErp(erpFinancial.banco_padrao_erp);
  }, [erpFinancial]);

  const isErpCustomer = (company as { source?: string } | undefined)?.source === 'erp' || (company as { origin?: string } | undefined)?.origin === 'erp';

  // ---- Mutation ----
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validações mínimas (mesmas regras do CustomerDetail)
      if (!form.name.trim()) throw new Error('Razão Social é obrigatória');
      if (!form.cnpj.trim()) throw new Error('CNPJ/CPF é obrigatório');
      if (!form.phone.trim()) throw new Error('Telefone é obrigatório');

      const payload = {
        name: form.name.trim(),
        fantasia: form.fantasia.trim() || null,
        cnpj: form.cnpj.trim() || null,
        erp_code: form.erp_code.trim() || null,
        inscricao_estadual: form.inscricao_estadual.trim() || null,
        contribuinte_ipi: form.contribuinte_ipi,
        setor_id: form.setor_id || null,
        segmento_id: form.segmento_id || null,
        atividade_id: form.atividade_id || null,
        employee_count: form.employee_count || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        default_carrier_id: form.default_carrier_id || null,
        default_freight_type: form.default_freight_type || null,
        address: form.address.trim() || null,
        address_number: form.address_number.trim() || null,
        address_complement: form.address_complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        zip_code: form.zip_code.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
      };

      const { error: upErr } = await supabase
        .from('companies')
        .update(payload as never)
        .eq('id', companyId);
      if (upErr) throw upErr;

      // Banco padrão ERP (upsert)
      if (bancoPadraoErp !== (erpFinancial?.banco_padrao_erp ?? null)) {
        const tenantId = (company as { tenant_id?: string | null } | undefined)?.tenant_id;
        if (erpFinancial?.id) {
          const { error } = await supabase
            .from('company_erp_financial')
            .update({ banco_padrao_erp: bancoPadraoErp })
            .eq('id', erpFinancial.id);
          if (error) throw error;
        } else if (tenantId) {
          const { error } = await supabase
            .from('company_erp_financial')
            .insert({ company_id: companyId, tenant_id: tenantId, banco_padrao_erp: bancoPadraoErp });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success('Cliente atualizado');
      queryClient.invalidateQueries({ queryKey: ['company-quick-edit', companyId] });
      queryClient.invalidateQueries({ queryKey: ['order-company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', companyId] });
      onSaved?.();
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao salvar cliente'),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6 flex items-start gap-3 text-sm">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar este cliente.</p>
          <p className="text-muted-foreground text-xs mt-1">{(error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Informações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Informações do Cliente
            </CardTitle>
            {isErpCustomer && (
              <CardDescription className="text-xs">Cliente sincronizado do ERP — alguns campos podem ser sobrescritos.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Razão Social <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nome Fantasia</Label>
              <Input value={form.fantasia} onChange={(e) => setForm({ ...form, fantasia: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ/CPF <span className="text-destructive">*</span></Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} maxLength={18} />
            </div>
            <div className="space-y-1">
              <Label>Código ERP</Label>
              <Input value={form.erp_code} onChange={(e) => setForm({ ...form, erp_code: e.target.value })} placeholder="Ex: 12345" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Inscrição Estadual</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch
                    checked={form.inscricao_estadual === 'ISENTO'}
                    onCheckedChange={(c) => setForm({ ...form, inscricao_estadual: c ? 'ISENTO' : '' })}
                  />
                  Isento
                </label>
              </div>
              <Input
                value={form.inscricao_estadual}
                onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                disabled={form.inscricao_estadual === 'ISENTO'}
                inputMode="numeric"
                maxLength={14}
                placeholder={form.inscricao_estadual === 'ISENTO' ? 'ISENTO' : 'Somente números'}
              />
            </div>
            <div className="space-y-1">
              <Label>Banco Padrão ERP</Label>
              <Input
                type="number"
                value={bancoPadraoErp}
                onChange={(e) => setBancoPadraoErp(Number(e.target.value))}
                placeholder="999"
              />
              <p className="text-[11px] text-muted-foreground">999 = Caixa/Carteira</p>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Contribuinte de IPI</Label>
                <p className="text-xs text-muted-foreground">Define se o cliente é contribuinte do IPI</p>
              </div>
              <Switch
                checked={form.contribuinte_ipi}
                onCheckedChange={(c) => setForm({ ...form, contribuinte_ipi: c })}
              />
            </div>
            <div className="col-span-2">
              <ClassificacaoCascade
                setorId={form.setor_id}
                segmentoId={form.segmento_id}
                atividadeId={form.atividade_id}
                onSetorChange={(v) => {
                  const setorNome = v ? setores.find(s => s.id === v)?.nome : null;
                  const isIndustria = setorNome?.toLowerCase() === 'indústria';
                  setForm(prev => ({ ...prev, setor_id: v, segmento_id: null, atividade_id: null, contribuinte_ipi: isIndustria ? true : prev.contribuinte_ipi }));
                }}
                onSegmentoChange={(v) => setForm(prev => ({ ...prev, segmento_id: v, atividade_id: null }))}
                onAtividadeChange={(v) => setForm(prev => ({ ...prev, atividade_id: v }))}
                hideAtividade
              />
            </div>
            <div className="space-y-1">
              <Label>Funcionários</Label>
              <Select value={form.employee_count || undefined} onValueChange={(v) => setForm({ ...form, employee_count: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employeeCounts.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Telefone <span className="text-destructive">*</span></Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* Logística Padrão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" /> Logística Padrão
            </CardTitle>
            <CardDescription className="text-xs">Pré-selecionados em novas propostas e pedidos.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Transportadora</Label>
              <SearchableSelect
                options={carrierOptions}
                value={form.default_carrier_id}
                onChange={(v) => setForm({ ...form, default_carrier_id: v || null })}
                placeholder="Selecione"
                searchPlaceholder="Buscar transportadora..."
                onSearchChange={setCarrierSearch}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo de Frete</Label>
              <Select value={form.default_freight_type || undefined} onValueChange={(v) => setForm({ ...form, default_freight_type: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIF">CIF — Frete por conta do vendedor</SelectItem>
                  <SelectItem value="FOB">FOB — Frete por conta do cliente</SelectItem>
                  <SelectItem value="REDESPACHO">Redespacho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Logradouro</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Número</Label>
              <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Complemento</Label>
              <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} placeholder="00000-000" maxLength={9} />
            </div>
            <CityStateSelect
              city={form.city}
              state={form.state}
              onChange={({ city, state }) => setForm({ ...form, city, state })}
            />
          </CardContent>
        </Card>
      </div>

      <div className="border-t p-3 flex items-center justify-end gap-2 bg-background">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saveMutation.isPending}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
