import { useState, useMemo, useEffect } from 'react';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users, RefreshCw, Building2, User, TrendingUp, Clock, MessageCircle, Pencil, Trash2, Power, PowerOff, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Wand2, Send, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { toast } from 'sonner';
import { CompanySyncBadge, CompanySyncButton } from '@/components/customers/CompanySyncStatus';
import { CompanySyncProvider } from '@/components/sync/SyncBatchProviders';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCNPJ, formatCPF } from '@/lib/cpfCnpjMask';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { getRecentInteractionLabel, useRecentInteractions } from '@/hooks/useRecentInteractions';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const DEFAULT_ITEMS_PER_PAGE = 25;

type StatusFilter = 'active' | 'inactive' | 'all';
type SortField = 'name' | 'contact' | 'phone' | 'last_activity' | 'deals' | 'owner' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface CustomerRow {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  active: boolean;
  tenant_id?: string;
  custom_fields: any;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string | null;
  contact_name: string | null;
  primary_contact_name: string | null;
  primary_contact_job_title: string | null;
  primary_contact_mobile: string | null;
  primary_contact_email: string | null;
  contacts_count: number;
  deals_count: number;
  deals_open_count: number;
  deals_won_count: number;
  deals_lost_count: number;
  deals_total_value: number;
  last_interaction_at: string | null;
  last_order_at: string | null;
  total_count: number;
  setor_id: string | null;
  segmento_id: string | null;
  contribuinte_ipi: boolean;
  atividade_id: string | null;
  last_relevant_interaction_at: string | null;
  last_relevant_legal_entity_id: string | null;
  last_relevant_legal_entity_name: string | null;
  last_relevant_interaction_source: string | null;
}

export default function Customers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isAdmin, isDeveloper, isVendedor, can } = useModulePermissions();
  const canCreateCustomers = can('companies', PermissionAction.Create);
  const canEditCustomers = can('companies', PermissionAction.Edit);
  const canDeleteCustomers = can('companies', PermissionAction.Delete);
  const { mySalesRepIds, hasDirectAccess, isAdmin: isSalesRepAdmin } = useSalesRepAccess();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const ITEMS_PER_PAGE = itemsPerPage;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortField, setSortField] = useState<SortField>('last_activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerRow | null>(null);
  const { recentItems: recentCustomers, recordInteraction: recordCustomerInteraction } = useRecentInteractions('company');

  // Filters
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterSetorId, setFilterSetorId] = useState<string | null>(null);
  const [filterSegmentoId, setFilterSegmentoId] = useState<string | null>(null);
  const [filterAtividadeId, setFilterAtividadeId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Lifecycle filter from URL
  const lifecycleFromUrl = searchParams.get('lifecycle') || '';
  const [filterLifecycle, setFilterLifecycle] = useState(lifecycleFromUrl);

  // Sync URL param changes
  useEffect(() => {
    const lc = searchParams.get('lifecycle') || '';
    setFilterLifecycle(lc);
    setCurrentPage(1);
  }, [searchParams]);

  
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<any>(null);
  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);
  const [enrichOffset, setEnrichOffset] = useState(0);
  const [enrichBatchSize, setEnrichBatchSize] = useState(50);
  const [enrichSalesRepId, setEnrichSalesRepId] = useState<string>('all');
  const [enrichPrioritizeAsterisks, setEnrichPrioritizeAsterisks] = useState(true);
  const activeFiltersCount = [filterCity, filterState, filterOwner, filterSetorId, filterSegmentoId, filterAtividadeId, filterLifecycle].filter(Boolean).length;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch sales reps for vendor filter dropdown
  const { data: salesRepsFilter } = useQuery({
    queryKey: ['sales-reps-for-customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_reps').select('id, name').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['customer-filter-options'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_filter_options');
      if (error) throw error;
      const row = data?.[0] || data;
      return {
        states: (row as any)?.states || [],
        cities: (row as any)?.cities || [],
        industries: (row as any)?.industries || [],
        owners: (salesRepsFilter || []).map(sr => ({ id: sr.id, name: sr.name })),
      };
    },
    enabled: !!salesRepsFilter,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Map sort field to DB field
  const dbSortField = useMemo(() => {
    switch (sortField) {
      case 'name': return 'name';
      case 'contact': return 'contact';
      case 'phone': return 'phone';
      case 'last_activity': return 'last_activity';
      
      case 'deals': return 'deals';
      case 'owner': return 'owner';
      case 'created_at': return 'created_at';
      default: return 'name';
    }
  }, [sortField]);

  // Main paginated query - all users see all customers
  const { data: queryResult, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['customers-paginated', debouncedSearch, statusFilter, filterState, filterCity, filterOwner, filterSetorId, filterSegmentoId, filterAtividadeId, filterLifecycle, dbSortField, sortDirection, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_customers_paginated', {
        p_search: debouncedSearch || null,
        p_status: statusFilter,
        p_state: filterState || null,
        p_city: filterCity || null,
        p_owner_id: filterOwner || null,
        p_setor_id: filterSetorId || null,
        p_segmento_id: filterSegmentoId || null,
        p_atividade_id: filterAtividadeId || null,
        p_lifecycle_stage: filterLifecycle || null,
        p_sort_field: dbSortField,
        p_sort_dir: sortDirection,
        p_limit: ITEMS_PER_PAGE,
        p_offset: (currentPage - 1) * ITEMS_PER_PAGE,
        p_allowed_sales_rep_ids: null,
      } as any);
      if (error) throw error;
      return data as unknown as CustomerRow[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const customers = queryResult || [];
  // IDs visíveis — alimenta CompanySyncProvider (1 query agregada, 1 canal Realtime)
  const visibleCustomerIds = useMemo(() => customers.map((c: any) => c.id), [customers]);
  const totalItems = customers.length > 0 ? Number(customers[0].total_count) : 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + customers.length, totalItems);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['customer-filter-options'] });
      toast.success('Cliente excluído com sucesso!');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir cliente: ' + (error.message || 'Erro desconhecido'));
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ customerId, active }: { customerId: string; active: boolean }) => {
      const { error } = await supabase.from('companies').update({ active }).eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
      toast.success(variables.active ? 'Cliente ativado!' : 'Cliente desativado!');
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao alterar status: ' + (message || 'Erro desconhecido'));
      }
    },
  });

  const handleRefresh = async () => { await refetch(); toast.success('Dados atualizados!'); };

  const handleEnrichBatch = async (offset = 0) => {
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-companies-batch', {
        body: { 
          limit: enrichBatchSize, 
          offset,
          sales_rep_id: enrichSalesRepId !== 'all' ? enrichSalesRepId : undefined,
          prioritize_asterisks: enrichPrioritizeAsterisks,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message, { duration: 6000 });
        setEnrichResult((prev: any) => {
          if (prev && offset > 0) {
            // Accumulate results from multiple batches
            return {
              ...data,
              enriched: prev.enriched + data.enriched,
              failed: prev.failed + data.failed,
              total_checked: prev.total_checked + data.total_checked,
              details: [...(prev.details || []), ...(data.details || [])],
            };
          }
          return data;
        });
        setEnrichDialogOpen(true);
        if (data.has_more) {
          setEnrichOffset(data.next_offset);
        } else {
          setEnrichOffset(0);
        }
        if (data.enriched > 0) {
          queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-card-metrics'] });
        }
      } else {
        toast.error(data?.error || 'Erro no enriquecimento');
      }
    } catch (err: any) {
      toast.error('Erro ao enriquecer: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsEnriching(false);
    }
  };
  const handleDeleteClick = (customer: CustomerRow, e: React.MouseEvent) => { e.stopPropagation(); setCustomerToDelete(customer); setDeleteDialogOpen(true); };
  const handleConfirmDelete = () => { if (customerToDelete) deleteMutation.mutate(customerToDelete.id); };
  const handleToggleActive = (customer: CustomerRow, e: React.MouseEvent) => { e.stopPropagation(); toggleActiveMutation.mutate({ customerId: customer.id, active: !customer.active }); };
  const handleEditClick = (customer: CustomerRow, e: React.MouseEvent) => {
    e.stopPropagation();
    recordCustomerInteraction({ entityId: customer.id, tenantId: customer.tenant_id, interactionType: 'open' });
    navigate(`/customers/${customer.id}`);
  };
  const handleOpenCustomer = (customer: CustomerRow) => {
    recordCustomerInteraction({ entityId: customer.id, tenantId: customer.tenant_id, interactionType: 'view' });
    navigate(`/customers/${customer.id}`);
  };
  const handleOpenWhatsApp = (customer: CustomerRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = customer.primary_contact_mobile || customer.phone;
    if (!phone) { toast.error('Este cliente não possui telefone cadastrado'); return; }
    const contactName = customer.primary_contact_name || customer.contact_name || customer.name;
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactName=${encodeURIComponent(contactName)}`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterCity('');
    setFilterState('');
    setFilterOwner('');
    setFilterSetorId(null);
    setFilterSegmentoId(null);
    setFilterAtividadeId(null);
    setFilterLifecycle('');
    setSearchParams({});
    setCurrentPage(1);
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );

  const getCustomerIcon = (cnpj: string | null) => {
    if (!cnpj) return Building2;
    const digits = cnpj.replace(/\D/g, '');
    return digits.length <= 11 ? User : Building2;
  };

  const formatDocument = (cnpj: string | null) => {
    if (!cnpj) return '-';
    const digits = cnpj.replace(/\D/g, '');
    return digits.length <= 11 ? formatCPF(cnpj) : formatCNPJ(cnpj);
  };

  const getLastActivityText = (date: string | null) => {
    if (!date) return 'Sem interação';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };


  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const getContactPhone = (c: CustomerRow) => c.primary_contact_mobile || c.phone;

  // Deal summary badges
  const DealSummaryBadges = ({ customer }: { customer: CustomerRow }) => {
    if (customer.deals_count === 0) return <span className="text-muted-foreground text-sm">-</span>;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {customer.deals_open_count > 0 && (
          <Badge variant="secondary" className="text-xs">{customer.deals_open_count} aberto{customer.deals_open_count > 1 ? 's' : ''}</Badge>
        )}
        {customer.deals_won_count > 0 && (
          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-0 text-xs">{customer.deals_won_count} ganho{customer.deals_won_count > 1 ? 's' : ''}</Badge>
        )}
        {customer.deals_lost_count > 0 && (
          <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-0 text-xs">{customer.deals_lost_count} perdido{customer.deals_lost_count > 1 ? 's' : ''}</Badge>
        )}
      </div>
    );
  };

  // Determine last activity - use the consolidated last interaction date from the backend
  const getLastActivity = (c: CustomerRow) => {
    return c.last_interaction_at || null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie sua carteira de clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDeveloper && (
            <div className="flex items-center gap-1 flex-wrap">
              <Select value={enrichSalesRepId} onValueChange={(v) => setEnrichSalesRepId(v)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {(salesRepsFilter || []).map(sr => (
                    <SelectItem key={sr.id} value={sr.id}>{sr.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(enrichBatchSize)} onValueChange={(v) => setEnrichBatchSize(Number(v))}>
                <SelectTrigger className="w-[90px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1.000</SelectItem>
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={enrichPrioritizeAsterisks ? "default" : "outline"} 
                      size="sm" 
                      className="h-8 w-8 p-0 text-xs font-bold"
                      onClick={() => setEnrichPrioritizeAsterisks(!enrichPrioritizeAsterisks)}
                    >
                      *
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{enrichPrioritizeAsterisks ? 'Priorizando clientes com asteriscos (*)' : 'Sem priorização por asteriscos'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEnrichOffset(0); setEnrichResult(null); handleEnrichBatch(0); }} disabled={isEnriching}>
                <Wand2 className={cn("h-4 w-4", isEnriching && "animate-spin")} />
                <span className="hidden sm:inline">{isEnriching ? 'Enriquecendo...' : 'Enriquecer dados'}</span>
              </Button>
            </div>
          )}
          {canCreateCustomers && (
            <Button className="gap-2" size="sm" onClick={() => navigate('/customers/new')}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Cliente</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border-subtle shadow-[var(--shadow-sm)] overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes por nome, CNPJ, contato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}>
                <SelectTrigger className="w-[120px] sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              {/* Filters popover */}
              <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 relative">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">Filtros</span>
                    {activeFiltersCount > 0 && (
                      <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Filtros</h4>
                      {activeFiltersCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                          <X className="h-3 w-3" /> Limpar
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Estado</Label>
                      <Select value={filterState} onValueChange={(v) => { setFilterState(v === '_all' ? '' : v); setCurrentPage(1); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todos</SelectItem>
                          {(filterOptions?.states || []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Digite para filtrar..."
                        value={filterCity}
                        onChange={(e) => { setFilterCity(e.target.value); setCurrentPage(1); }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Vendedor</Label>
                      <Select value={filterOwner} onValueChange={(v) => { setFilterOwner(v === '_all' ? '' : v); setCurrentPage(1); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todos</SelectItem>
                          {(filterOptions?.owners || []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <ClassificacaoCascade
                      setorId={filterSetorId}
                      segmentoId={filterSegmentoId}
                      atividadeId={filterAtividadeId}
                      onSetorChange={(v) => { setFilterSetorId(v); setCurrentPage(1); }}
                      onSegmentoChange={(v) => { setFilterSegmentoId(v); setCurrentPage(1); }}
                      onAtividadeChange={(v) => { setFilterAtividadeId(v); setCurrentPage(1); }}
                      compact
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentCustomers.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4 text-primary" />
                Clientes recentes
              </div>
              <div className="flex flex-wrap gap-2">
                {recentCustomers.map((customer) => (
                  <Button
                    key={customer.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto max-w-full flex-col items-start gap-0 px-3 py-2 text-left"
                    onClick={() => handleOpenCustomer(customer as unknown as CustomerRow)}
                  >
                    <span className="max-w-[220px] truncate font-medium">{customer.fantasia || customer.name}</span>
                    <span className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {getRecentInteractionLabel(customer.interaction_type)}
                      {customer.cnpj ? ` • ${formatDocument(customer.cnpj)}` : ''}
                      {customer.city && customer.state ? ` • ${customer.city}/${customer.state}` : ''}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {debouncedSearch || activeFiltersCount > 0 ? 'Tente ajustar sua busca ou filtros.' : 'Comece adicionando seu primeiro cliente.'}
              </p>
              {!debouncedSearch && activeFiltersCount === 0 && canCreateCustomers && (
                <Button className="mt-4 gap-2" onClick={() => navigate('/customers/new')}>
                  <Plus className="h-4 w-4" />
                  Novo Cliente
                </Button>
              )}
            </div>
          ) : (
            <>
              <CompanySyncProvider ids={visibleCustomerIds}>
              <div className="table-responsive">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="name">Cliente</SortableHeader>
                      <SortableHeader field="last_activity">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Última Atividade
                        </div>
                      </SortableHeader>
                      <SortableHeader field="deals">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Negócios
                        </div>
                      </SortableHeader>
                      <SortableHeader field="owner">Vendedor Comercial</SortableHeader>
                      <TableHead>IPI</TableHead>
                      <TableHead>Cód. ERP</TableHead>
                      <TableHead>ERP</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {customers.map((customer) => {
                    const CustomerIcon = getCustomerIcon(customer.cnpj);
                    const phone = getContactPhone(customer);
                    const lastActivityText = getLastActivityText(getLastActivity(customer));
                    const displayName = customer.fantasia || customer.name;

                    return (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => handleOpenCustomer(customer)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <CustomerIcon className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{displayName}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {customer.cnpj && <span>{formatDocument(customer.cnpj)}</span>}
                                {customer.city && customer.state && <span>• {customer.city}/{customer.state}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className={`block text-sm whitespace-nowrap ${!customer.last_interaction_at ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {lastActivityText}
                          </span>
                        </TableCell>
                        <TableCell className="align-middle">
                          <DealSummaryBadges customer={customer} />
                        </TableCell>
                        <TableCell>
                          {customer.owner_name ? (
                            <span className="text-sm">{customer.owner_name}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.contribuinte_ipi ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Sim</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {(customer as any).erp_code
                            ? <span className="font-medium">{(customer as any).erp_code}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <CompanySyncBadge companyId={customer.id} erpCode={(customer as any).erp_code} />
                            {(isAdmin || isDeveloper || isVendedor) && (
                              <CompanySyncButton companyId={customer.id} erpCode={(customer as any).erp_code} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => handleEditClick(customer, e)} disabled={!canEditCustomers}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => handleOpenWhatsApp(customer, e)} disabled={!phone}>
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{phone ? 'Abrir WhatsApp' : 'Sem telefone'}</TooltipContent>
                              </Tooltip>
                              {isAdmin && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={(e) => handleToggleActive(customer, e)} disabled={toggleActiveMutation.isPending}>
                                      {customer.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-primary" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{customer.active ? 'Desativar cliente' : 'Ativar cliente'}</TooltipContent>
                                </Tooltip>
                              )}
                              {canDeleteCustomers && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={(e) => handleDeleteClick(customer, e)} className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir cliente</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </div>
              </CompanySyncProvider>


              {totalItems > 0 && (
                <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Linhas por página</span>
                    <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-[70px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground ml-2">
                      {totalItems} registros encontrados
                    </span>
                  </div>
                  {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) =>
                        page === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${idx}`}><PaginationEllipsis /></PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">{page}</PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{customerToDelete?.fantasia || customerToDelete?.name}</strong>?
              <br />Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enrichment Results Dialog */}
      <Dialog open={enrichDialogOpen} onOpenChange={setEnrichDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resultado do Enriquecimento</DialogTitle>
          </DialogHeader>
          {enrichResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{enrichResult.enriched}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{enrichResult.failed}</p>
                  <p className="text-xs text-muted-foreground">Com erro</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{enrichResult.total_checked}</p>
                  <p className="text-xs text-muted-foreground">Verificados</p>
                </Card>
              </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Campos Atualizados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enrichResult.details || []).map((d: any) => {
                      const fieldLabels: Record<string, string> = {
                        name: 'Razão Social',
                        fantasia: 'Nome Fantasia',
                        address: 'Endereço',
                        address_number: 'Número',
                        address_complement: 'Complemento',
                        neighborhood: 'Bairro',
                        city: 'Cidade',
                        state: 'Estado',
                        zip_code: 'CEP',
                        phone: 'Telefone',
                        email: 'E-mail',
                      };
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate" title={d.name}>
                            {d.name}
                          </TableCell>
                          <TableCell>
                            {d.status === 'enriched' && <Badge className="bg-green-500/10 text-green-600 border-0 text-xs">Atualizado</Badge>}
                            {d.status === 'no_update_needed' && <Badge variant="secondary" className="text-xs">Completo</Badge>}
                            {d.status === 'api_error' && <Badge variant="destructive" className="text-xs">Erro API</Badge>}
                            {d.status === 'update_error' && <Badge variant="destructive" className="text-xs">Erro BD</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.fields_updated.length > 0
                              ? d.fields_updated.map((f: string) => fieldLabels[f] || f).join(', ')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {enrichResult.has_more && (
                <div className="flex justify-end pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => handleEnrichBatch(enrichOffset)}
                    disabled={isEnriching}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", isEnriching && "animate-spin")} />
                    {isEnriching ? 'Processando...' : 'Processar próximo lote'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
