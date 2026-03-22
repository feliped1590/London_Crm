import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Building2, Users, User, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { AdminInterventionModal } from '@/components/governance/AdminInterventionModal';
import { useClassificacao } from '@/hooks/useClassificacao';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioGovernance } from '@/hooks/usePortfolioGovernance';
import type { SameGroupCompany, UnifiedCustomer } from '@/hooks/useCustomerDetail';
import type { Json } from '@/integrations/supabase/types';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatCNPJ, cleanDocument } from '@/lib/cpfCnpjMask';
import { formatCurrency } from '@/lib/formatters';
import { resolveUserForSalesRep } from '@/lib/ownership';

const employeeCounts = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const STAGE_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado ganho',
  fechado_perdido: 'Fechado perdido',
};

const STAGE_ORDER = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

interface CustomerOverviewTabProps {
  customer: UnifiedCustomer;
  customerId: string;
  sameGroupCompanies: SameGroupCompany[];
  sameGroupCompaniesLoading: boolean;
  groupDealMetrics?: {
    total_deals: number;
    total_value: number;
    counts_by_stage: Record<string, number>;
  };
  groupDealMetricsLoading: boolean;
  isEditing: boolean;
  companyForm: any;
  setCompanyForm: React.Dispatch<React.SetStateAction<any>>;
  customFieldsData: Record<string, unknown>;
  setCustomFieldsData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  sellers: any[] | undefined;
  currentOwner: any;
  selectValue: string;
  assignOwnerMutation: any;
  updateCompanyMutation: any;
}

export function CustomerOverviewTab({
  customer,
  customerId,
  sameGroupCompanies,
  sameGroupCompaniesLoading,
  groupDealMetrics,
  groupDealMetricsLoading,
  isEditing,
  companyForm,
  setCompanyForm,
  customFieldsData,
  setCustomFieldsData,
  sellers,
  currentOwner,
  selectValue,
  assignOwnerMutation,
  updateCompanyMutation,
}: CustomerOverviewTabProps) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { logIntervention } = usePortfolioGovernance();
  const { setores } = useClassificacao();
  const { salesReps } = useSalesReps();
  const queryClient = useQueryClient();

  const [showOwnerInterventionModal, setShowOwnerInterventionModal] = useState(false);
  const [pendingOwnerChange, setPendingOwnerChange] = useState<string | null>(null);

  const isErpCustomer = customer.source === 'erp';
  const pipelineBreakdown = useMemo(
    () =>
      Object.entries(groupDealMetrics?.counts_by_stage || {}).sort(([stageA], [stageB]) => {
        const indexA = STAGE_ORDER.indexOf(stageA);
        const indexB = STAGE_ORDER.indexOf(stageB);
        const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

        if (normalizedA !== normalizedB) return normalizedA - normalizedB;
        return stageA.localeCompare(stageB);
      }),
    [groupDealMetrics],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
          <CardDescription>
            {isErpCustomer
              ? 'Dados sincronizados do ERP Iniflex (somente leitura)'
              : 'Dados cadastrais e informações de contato'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Razão Social</Label>
              <Input id="name" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div>
              <Label htmlFor="fantasia">Nome Fantasia</Label>
              <Input id="fantasia" value={companyForm.fantasia} onChange={(e) => setCompanyForm({ ...companyForm, fantasia: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ/CPF</Label>
              <Input id="cnpj" value={companyForm.cnpj} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })} disabled={!isEditing || isErpCustomer} maxLength={18} />
            </div>
            <div>
              <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
              <Input id="inscricao_estadual" value={companyForm.inscricao_estadual} onChange={(e) => setCompanyForm({ ...companyForm, inscricao_estadual: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="contribuinte_ipi" className="text-sm font-medium">Contribuinte de IPI</Label>
                <p className="text-xs text-muted-foreground">Define se o cliente é contribuinte do IPI</p>
              </div>
              <Switch id="contribuinte_ipi" checked={companyForm.contribuinte_ipi} onCheckedChange={(checked) => setCompanyForm({ ...companyForm, contribuinte_ipi: checked })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div className="col-span-2">
              {isErpCustomer ? (
                <>
                  <Label>Segmento (ERP)</Label>
                  <Input value={customer.segmento || ''} disabled />
                </>
              ) : (
                <ClassificacaoCascade
                  setorId={companyForm.setor_id}
                  segmentoId={companyForm.segmento_id}
                  atividadeId={companyForm.atividade_id}
                  onSetorChange={(v) => {
                    const setorNome = v ? setores.find(s => s.id === v)?.nome : null;
                    const isIndustria = setorNome?.toLowerCase() === 'indústria';
                    setCompanyForm((prev: any) => ({ ...prev, setor_id: v, segmento_id: null, atividade_id: null, contribuinte_ipi: isIndustria ? true : prev.contribuinte_ipi }));
                  }}
                  onSegmentoChange={(v) => setCompanyForm((prev: any) => ({ ...prev, segmento_id: v, atividade_id: null }))}
                  onAtividadeChange={(v) => setCompanyForm((prev: any) => ({ ...prev, atividade_id: v }))}
                  disabled={!isEditing}
                />
              )}
            </div>
            {!isErpCustomer && (
              <div>
                <Label htmlFor="employee_count">Funcionários</Label>
                <Select value={companyForm.employee_count} onValueChange={(v) => setCompanyForm({ ...companyForm, employee_count: v })} disabled={!isEditing}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employeeCounts.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isErpCustomer && customer.regiao && (
              <div><Label>Região</Label><Input value={customer.regiao} disabled /></div>
            )}
            {isErpCustomer && customer.tipo_pessoa && (
              <div><Label>Tipo de Pessoa</Label><Input value={customer.tipo_pessoa === 'J' ? 'Jurídica' : 'Física'} disabled /></div>
            )}
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            {!isErpCustomer && (
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={companyForm.website} onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} disabled={!isEditing} />
              </div>
            )}
            {!isErpCustomer && (
              <div className="col-span-2">
                <DefaultCarrierCard
                  companyId={customerId}
                  defaultCarrierId={(customer as any)?.default_carrier_id}
                  defaultFreightType={(customer as any)?.default_freight_type}
                  isEditing={isEditing}
                />
              </div>
            )}
            <div className="col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={companyForm.state} onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })} disabled={!isEditing || isErpCustomer} />
            </div>
            {!isErpCustomer && (
              <div className="col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" value={companyForm.notes} onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })} disabled={!isEditing} rows={3} />
              </div>
            )}
            {isEditing && !isErpCustomer && (
              <CustomFieldsRenderer entity="company" values={customFieldsData} onChange={setCustomFieldsData} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Rep info */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Empresas do mesmo grupo (raiz do CNPJ)
          </CardTitle>
          <CardDescription>
            Agrupamento documental por raiz do CNPJ, separado da hierarquia operacional de matriz e filial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!customer.cnpj_root ? (
            <p className="text-sm text-muted-foreground">
              Sem CNPJ válido para identificar grupo documental por raiz.
            </p>
          ) : sameGroupCompaniesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Buscando empresas do mesmo grupo...
            </div>
          ) : sameGroupCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma outra empresa encontrada com a mesma raiz de CNPJ neste tenant.
            </p>
          ) : (
            <div className="space-y-3">
              {sameGroupCompanies.map((company) => {
                const displayName = company.fantasia || company.name;
                const relationshipLabel = company.is_matriz ? 'Matriz' : 'Filial';

                return (
                  <div
                    key={company.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{displayName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {company.cnpj && <span>{formatCNPJ(company.cnpj)}</span>}
                        {company.city && company.state && <span>• {company.city}/{company.state}</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {relationshipLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {customer.cnpj_root && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Resumo comercial do grupo
            </CardTitle>
            <CardDescription>
              Todos os negócios do grupo econômico identificado pela mesma raiz do CNPJ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupDealMetricsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Carregando resumo comercial do grupo...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Negócios do grupo</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {groupDealMetrics?.total_deals ?? 0}
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Valor total</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatCurrency(groupDealMetrics?.total_value ?? 0)}
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Pipeline</p>

                  {pipelineBreakdown.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nenhum negócio encontrado para este grupo.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {pipelineBreakdown.map(([stage, count]) => (
                        <div key={stage} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground">{STAGE_LABELS[stage] || stage}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(() => {
        const salesRepId = (customer as any)?.sales_rep_id;
        const salesRep = salesRepId ? salesReps?.find(r => r.id === salesRepId) : null;
        return (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Vendedor Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesRep ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {salesRep.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{salesRep.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {salesRep.type === 'representante' ? 'Representante' : 'Interno'}
                      {salesRep.phone && ` • ${salesRep.phone}`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum vendedor comercial vinculado</p>
              )}
              {isAdmin && isEditing && (
                <div className="mt-3">
                  <Select
                    value={salesRepId || ''}
                    onValueChange={async (v) => {
                      const nextSalesRepId = v || null;
                      const legacyOwnerId = await resolveUserForSalesRep(
                        nextSalesRepId,
                        'CustomerOverviewTab:update_sales_rep',
                      );

                      const updateData: Record<string, string | null> = {
                        sales_rep_id: nextSalesRepId,
                      };

                      if (legacyOwnerId) {
                        // LEGACY: owner_id será removido futuramente. Não usar como fonte de ownership.
                        updateData.owner_id = legacyOwnerId;
                      } else if (nextSalesRepId) {
                        console.warn('Sales_rep sem usuário vinculado durante operação crítica', {
                          salesRepId: nextSalesRepId,
                          operationContext: 'CustomerOverviewTab:update_sales_rep',
                        });
                      }

                      const { error } = await supabase.from('companies').update(updateData).eq('id', customerId);
                      if (error) { toast.error('Erro ao atualizar'); return; }
                      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
                      toast.success('Vendedor comercial atualizado!');
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {salesReps?.filter(r => r.active).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Admin: Assign user (ERP legacy only) */}
      {isAdmin && isErpCustomer && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-[300px]">
                {/* LEGACY: owner_id será removido futuramente. Não usar como fonte de ownership. */}
                <SearchableSelect
                  options={(sellers || []).map(s => ({ value: s.id, label: s.full_name }))}
                  value={selectValue === 'none' ? null : selectValue}
                  onChange={(v) => {
                    const newProfileId = v || null;
                    if (currentOwner && currentOwner.user_id !== user?.id) {
                      setPendingOwnerChange(newProfileId);
                      setShowOwnerInterventionModal(true);
                    } else {
                      assignOwnerMutation.mutate(newProfileId);
                    }
                  }}
                  placeholder="Selecione um usuário"
                  searchPlaceholder="Buscar usuário..."
                  disabled={assignOwnerMutation.isPending}
                />
              </div>
              {currentOwner && (
                <span className="text-sm text-muted-foreground">
                  Atual: <span className="font-medium">{currentOwner.full_name}</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AdminInterventionModal
        open={showOwnerInterventionModal}
        onOpenChange={(open) => {
          setShowOwnerInterventionModal(open);
          if (!open) setPendingOwnerChange(null);
        }}
        clientName={customer?.fantasia || customer?.name || 'Cliente'}
        clientOwnerName={currentOwner?.full_name || 'Vendedor atual'}
        actionDescription={`alterar o vendedor responsável de "${currentOwner?.full_name || 'atual'}" para "${
          pendingOwnerChange
            ? sellers?.find(s => s.id === pendingOwnerChange)?.full_name || 'Nenhum'
            : 'Nenhum'
        }"`}
        onConfirm={async (justification) => {
          try {
            await logIntervention({
              actionType: 'CHANGE_OWNER',
              entityType: 'company',
              entityId: customerId || '',
              entityName: customer?.name,
              clientId: customerId,
              clientName: customer?.name,
              clientOwnerId: currentOwner?.user_id,
              clientOwnerName: currentOwner?.full_name,
              justification,
              details: {
                previousOwnerId: currentOwner?.user_id,
                previousOwnerName: currentOwner?.full_name,
                newOwnerId: pendingOwnerChange ? sellers?.find(s => s.id === pendingOwnerChange)?.user_id : null,
                newOwnerName: pendingOwnerChange ? sellers?.find(s => s.id === pendingOwnerChange)?.full_name : null,
                source: customer?.source,
              },
            });
            await assignOwnerMutation.mutateAsync(pendingOwnerChange);
            setShowOwnerInterventionModal(false);
            setPendingOwnerChange(null);
          } catch {
            toast.error('Erro ao registrar intervenção');
          }
        }}
        isLoading={assignOwnerMutation.isPending}
      />
    </>
  );
}

// Subcomponent: Default Carrier & Freight
function DefaultCarrierCard({ companyId, defaultCarrierId, defaultFreightType, isEditing }: { companyId: string; defaultCarrierId?: string | null; defaultFreightType?: string | null; isEditing: boolean }) {
  const queryClient = useQueryClient();
  const [carrierSearch, setCarrierSearch] = useState('');

  const { data: carriers } = useQuery({
    queryKey: ['carriers-for-default', carrierSearch],
    queryFn: async () => {
      let query = supabase.from('carriers').select('id, name, trade_name').eq('active', true).order('name').limit(50);
      if (carrierSearch) query = query.ilike('name', `%${carrierSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentCarrier } = useQuery({
    queryKey: ['carrier-current', defaultCarrierId],
    queryFn: async () => {
      if (!defaultCarrierId) return null;
      const { data, error } = await supabase.from('carriers').select('id, name, trade_name').eq('id', defaultCarrierId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!defaultCarrierId,
  });

  const carrierOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; trade_name: string | null }>();
    if (currentCarrier) map.set(currentCarrier.id, currentCarrier);
    (carriers || []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).map(c => ({ value: c.id, label: c.trade_name ? `${c.trade_name} (${c.name})` : c.name }));
  }, [carriers, currentCarrier]);

  const updateCarrierMutation = useMutation({
    mutationFn: async (carrierId: string | null) => {
      const { error } = await supabase.from('companies').update({ default_carrier_id: carrierId }).eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] });
      toast.success('Transportadora padrão atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar transportadora padrão'),
  });

  const updateFreightMutation = useMutation({
    mutationFn: async (freightType: string | null) => {
      const { error } = await supabase.from('companies').update({ default_freight_type: freightType } as any).eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] });
      toast.success('Tipo de frete padrão atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar tipo de frete padrão'),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Logística Padrão
        </CardTitle>
        <CardDescription>
          Transportadora e frete pré-selecionados em novas propostas e pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transportadora</Label>
            <SearchableSelect
              options={carrierOptions}
              value={defaultCarrierId || null}
              onChange={(v) => updateCarrierMutation.mutate(v || null)}
              placeholder="Selecione uma transportadora"
              searchPlaceholder="Buscar transportadora..."
              disabled={!isEditing}
              onSearchChange={setCarrierSearch}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Frete</Label>
            <Select value={defaultFreightType || ''} onValueChange={(v) => updateFreightMutation.mutate(v || null)} disabled={!isEditing}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de frete padrão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CIF">CIF — Frete por conta do vendedor</SelectItem>
                <SelectItem value="FOB">FOB — Frete por conta do cliente</SelectItem>
                <SelectItem value="REDESPACHO">Redespacho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
