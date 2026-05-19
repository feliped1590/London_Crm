import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, Building2, Pencil, Trash2, Globe, Phone, Mail, RefreshCw, CheckCircle2, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { DealStageBadges } from '@/components/DealStageBadges';
import { PricingTableBadge } from '@/components/pricing/PricingTableBadge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { formatCNPJ, cleanDocument } from '@/lib/cpfCnpjMask';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { useClassificacao } from '@/hooks/useClassificacao';
import type { Tables, TablesInsert, Json } from '@/integrations/supabase/types';
import { insertItemInList, updateItemInList, removeItemFromList } from '@/lib/queryCacheManager';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ServerPagination } from '@/components/ui/server-pagination';

// Explicit column list used by the table + edit form. Avoids `select('*')`
// pulling heavy JSON / unused payload from every row.
const COMPANY_LIST_COLUMNS = `
  id, name, fantasia, cnpj, inscricao_estadual, email, phone, website, domain,
  employee_count, address, city, state, country, notes, setor_id, segmento_id,
  atividade_id, custom_fields, iniflex_id, iniflex_synced_at, owner_id,
  sales_rep_id, created_by, created_at, updated_at,
  deals(id, name, stage, value)
`;

type Company = Tables<'companies'>;

const employeeCounts = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
];

export default function Companies() {
  const { user } = useAuth();
  const { canAccessBySalesRep } = useSalesRepAccess();
  const queryClient = useQueryClient();
  const { getNomeById } = useClassificacao();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Partial<TablesInsert<'companies'>> & { cnpj?: string; inscricao_estadual?: string; fantasia?: string }>({
    name: '',
    domain: '',
    employee_count: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: 'Brasil',
    notes: '',
    cnpj: '',
    inscricao_estadual: '',
    fantasia: '',
    setor_id: null,
    segmento_id: null,
    atividade_id: null,
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  const { data: companies, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*, deals(id, name, stage, value)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (Company & { deals: { id: string; name: string; stage: any; value: number | null }[] })[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'companies'>) => {
      const { data: created, error } = await supabase.from('companies').insert(data).select('*, deals(id, name, stage, value)').single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created) => {
      insertItemInList(queryClient, ['companies'], created);
      toast.success('Empresa criada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar empresa'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Company> & { id: string }) => {
      const { data: updated, error } = await supabase.from('companies').update(data).eq('id', id).select('*, deals(id, name, stage, value)').single();
      if (error) throw error;
      return { id, updated };
    },
    onSuccess: ({ id, updated }) => {
      updateItemInList(queryClient, ['companies'], id, updated, 'company');
      toast.success('Empresa atualizada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar empresa'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
        .select();
      
      if (error) throw error;
      
      // Verificar se algum registro foi realmente deletado
      if (!data || data.length === 0) {
        throw new Error('Você não tem permissão para excluir esta empresa');
      }
      
      return id;
    },
    onSuccess: (id) => {
      removeItemFromList(queryClient, ['companies'], id, 'company');
      toast.success('Empresa excluída com sucesso!');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao excluir empresa'),
  });

  const syncInflexMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase.functions.invoke('iniflex-sync-company', {
        body: { company_id: companyId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(`Sincronizado com Iniflex! ID: ${data.iniflex_id}`);
    },
    onError: (error: any) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      domain: '',
      employee_count: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      city: '',
      state: '',
      country: 'Brasil',
      notes: '',
      cnpj: '',
      inscricao_estadual: '',
      fantasia: '',
      setor_id: null,
      segmento_id: null,
      atividade_id: null,
    });
    setCustomFieldsData({});
    setEditingCompany(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjLimpo = formData.cnpj ? cleanDocument(formData.cnpj) : null;
    const dataWithCustomFields = {
      ...formData,
      cnpj: cnpjLimpo,
      custom_fields: customFieldsData as Json,
    };
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, ...dataWithCustomFields } as any);
    } else {
      createMutation.mutate({
        ...dataWithCustomFields,
        name: formData.name || '',
        created_by: user?.id,
        owner_id: user?.id,
      } as any);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      domain: company.domain || '',
      employee_count: company.employee_count || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      country: company.country || 'Brasil',
      notes: company.notes || '',
      cnpj: (company as any).cnpj ? formatCNPJ((company as any).cnpj) : '',
      inscricao_estadual: (company as any).inscricao_estadual || '',
      fantasia: (company as any).fantasia || '',
      setor_id: company.setor_id || null,
      segmento_id: company.segmento_id || null,
      atividade_id: company.atividade_id || null,
    });
    setCustomFieldsData((company.custom_fields as Record<string, unknown>) || {});
    setIsDialogOpen(true);
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setFormData({ ...formData, cnpj: formatted });
  };

  const filteredCompanies = companies?.filter(company => {
    // All users can view all companies
    return company.name.toLowerCase().includes(search.toLowerCase()) ||
      company.email?.toLowerCase().includes(search.toLowerCase()) ||
      (company as any).cnpj?.includes(search);
  });

  const getSyncStatus = (company: any) => {
    if (company.iniflex_id) {
      return {
        synced: true,
        date: company.iniflex_synced_at ? new Date(company.iniflex_synced_at).toLocaleDateString('pt-BR') : null,
      };
    }
    return { synced: false, date: null };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas empresas e clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Empresa</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Razão Social *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fantasia">Nome Fantasia</Label>
                  <Input
                    id="fantasia"
                    value={formData.fantasia || ''}
                    onChange={(e) => setFormData({ ...formData, fantasia: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj || ''}
                    onChange={handleCnpjChange}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={formData.inscricao_estadual || ''}
                    onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                  />
                </div>
                <ClassificacaoCascade
                  setorId={formData.setor_id as string | null}
                  segmentoId={formData.segmento_id as string | null}
                  atividadeId={formData.atividade_id as string | null}
                  onSetorChange={(v) => setFormData({ ...formData, setor_id: v })}
                  onSegmentoChange={(v) => setFormData({ ...formData, segmento_id: v })}
                  onAtividadeChange={(v) => setFormData({ ...formData, atividade_id: v })}
                />
                <div>
                  <Label htmlFor="employee_count">Funcionários</Label>
                  <Select value={formData.employee_count || ''} onValueChange={(v) => setFormData({ ...formData, employee_count: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeCounts.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="domain">Domínio</Label>
                  <Input
                    id="domain"
                    value={formData.domain || ''}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <CustomFieldsRenderer
                  entity="company"
                  values={customFieldsData}
                  onChange={setCustomFieldsData}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCompany ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredCompanies?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma empresa encontrada</h3>
              <p className="text-muted-foreground">Comece adicionando sua primeira empresa.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Funil
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Tabela Preços
                    </div>
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Iniflex</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies?.map((company) => {
                  const syncStatus = getSyncStatus(company);
                  return (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{company.name}</p>
                            {(company as any).fantasia && (
                              <p className="text-xs text-muted-foreground">{(company as any).fantasia}</p>
                            )}
                            {company.website && (
                              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {company.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(company as any).cnpj ? (
                          <span className="text-sm font-mono">{formatCNPJ((company as any).cnpj)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {getNomeById.atividade(company.atividade_id) && (
                          <Badge variant="secondary">
                            {getNomeById.atividade(company.atividade_id)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DealStageBadges deals={company.deals || []} />
                      </TableCell>
                      <TableCell>
                        <PricingTableBadge entityType="company" entityId={company.id} compact />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {company.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {company.email}
                            </div>
                          )}
                          {company.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {company.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {syncStatus.synced ? (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  Sincronizado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Pendente
                                </Badge>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {syncStatus.synced 
                                ? `Sincronizado em ${syncStatus.date}` 
                                : 'Não sincronizado com Iniflex'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => syncInflexMutation.mutate(company.id)}
                                  disabled={syncInflexMutation.isPending}
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncInflexMutation.isPending ? 'animate-spin' : ''}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Sincronizar com Iniflex</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteMutation.mutate(company.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
