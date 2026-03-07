import { useState, useMemo, useEffect } from 'react';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { Label } from '@/components/ui/label';
import { Plus, Search, Users, RefreshCw, Building2, User, Phone, TrendingUp, Clock, MessageCircle, Pencil, Trash2, Power, PowerOff, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCNPJ, formatCPF } from '@/lib/cpfCnpjMask';
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
type SortField = 'name' | 'contact' | 'phone' | 'last_activity' | 'deals' | 'owner' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface CustomerRow {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  active: boolean;
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
}

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const ITEMS_PER_PAGE = itemsPerPage;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerRow | null>(null);

  // Filters
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterSetorId, setFilterSetorId] = useState<string | null>(null);
  const [filterSegmentoId, setFilterSegmentoId] = useState<string | null>(null);
  const [filterAtividadeId, setFilterAtividadeId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount = [filterCity, filterState, filterOwner, filterIndustry, filterSetorId, filterSegmentoId, filterAtividadeId].filter(Boolean).length;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch profiles for owner filter dropdown
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
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
        owners: (profiles || []).filter(p => p.full_name).map(p => ({ id: p.user_id, name: p.full_name! })),
      };
    },
    enabled: !!profiles,
  });

  // Map sort field to DB field
  const dbSortField = useMemo(() => {
    switch (sortField) {
      case 'name': return 'name';
      case 'created_at': return 'created_at';
      case 'status': return 'status';
      case 'owner': return 'owner';
      default: return 'name';
    }
  }, [sortField]);

  // Main paginated query
  const { data: queryResult, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['customers-paginated', debouncedSearch, statusFilter, filterState, filterCity, filterOwner, filterIndustry, filterSetorId, filterSegmentoId, filterAtividadeId, dbSortField, sortDirection, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_customers_paginated', {
        p_search: debouncedSearch || null,
        p_status: statusFilter,
        p_state: filterState || null,
        p_city: filterCity || null,
        p_owner_id: filterOwner || null,
        p_industry: filterIndustry || null,
        p_setor_id: filterSetorId || null,
        p_segmento_id: filterSegmentoId || null,
        p_atividade_id: filterAtividadeId || null,
        p_sort_field: dbSortField,
        p_sort_dir: sortDirection,
        p_limit: ITEMS_PER_PAGE,
        p_offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });
      if (error) throw error;
      return data as CustomerRow[];
    },
    staleTime: 30000,
  });

  const customers = queryResult || [];
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
  const handleDeleteClick = (customer: CustomerRow, e: React.MouseEvent) => { e.stopPropagation(); setCustomerToDelete(customer); setDeleteDialogOpen(true); };
  const handleConfirmDelete = () => { if (customerToDelete) deleteMutation.mutate(customerToDelete.id); };
  const handleToggleActive = (customer: CustomerRow, e: React.MouseEvent) => { e.stopPropagation(); toggleActiveMutation.mutate({ customerId: customer.id, active: !customer.active }); };
  const handleEditClick = (customerId: string, e: React.MouseEvent) => { e.stopPropagation(); navigate(`/customers/${customerId}`); };
  const handleOpenCustomer = (customerId: string) => { navigate(`/customers/${customerId}`); };
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
    setFilterIndustry('');
    setCurrentPage(1);
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
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
    if (!date) return 'Sem atividade';
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

  // Determine display contact name
  const getContactName = (c: CustomerRow) => c.primary_contact_name || c.contact_name || null;
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

  // Determine last activity considering fallback
  const getLastActivity = (c: CustomerRow) => {
    let lastActivity = c.last_interaction_at || null;
    if (lastActivity && c.created_at && lastActivity === c.created_at) {
      if (c.last_order_at) lastActivity = c.last_order_at;
    }
    return lastActivity;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/customers/new')}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes por nome, CNPJ, contato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
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
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
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
                    <Select value={filterCity} onValueChange={(v) => { setFilterCity(v === '_all' ? '' : v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todas</SelectItem>
                        {(filterOptions?.cities || []).map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
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

                  <div className="space-y-2">
                    <Label className="text-xs">Segmento</Label>
                    <Select value={filterIndustry} onValueChange={(v) => { setFilterIndustry(v === '_all' ? '' : v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {(filterOptions?.industries || []).map((i: string) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
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
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {debouncedSearch || activeFiltersCount > 0 ? 'Tente ajustar sua busca ou filtros.' : 'Comece adicionando seu primeiro cliente.'}
              </p>
              {!debouncedSearch && activeFiltersCount === 0 && (
                <Button className="mt-4 gap-2" onClick={() => navigate('/customers/new')}>
                  <Plus className="h-4 w-4" />
                  Novo Cliente
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="name">Cliente</SortableHeader>
                      <SortableHeader field="contact">Contato Principal</SortableHeader>
                      <SortableHeader field="phone">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          Telefone
                        </div>
                      </SortableHeader>
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
                      <SortableHeader field="owner">Vendedor</SortableHeader>
                      <SortableHeader field="status">Status</SortableHeader>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {customers.map((customer) => {
                    const CustomerIcon = getCustomerIcon(customer.cnpj);
                    const contactName = getContactName(customer);
                    const phone = getContactPhone(customer);
                    const lastActivity = getLastActivity(customer);
                    const displayName = customer.fantasia || customer.name;

                    return (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenCustomer(customer.id)}
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
                        <TableCell>
                          {contactName ? (
                            <div>
                              <p className="font-medium">{contactName}</p>
                              {customer.primary_contact_job_title && (
                                <p className="text-sm text-muted-foreground">{customer.primary_contact_job_title}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem contato</span>
                          )}
                          {customer.contacts_count > 1 && (
                            <Badge variant="secondary" className="ml-2">+{customer.contacts_count - 1}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {phone ? (
                            <span className="font-mono text-sm">{phone}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${!lastActivity ? 'text-muted-foreground' : ''}`}>
                            {getLastActivityText(lastActivity)}
                          </span>
                        </TableCell>
                        <TableCell>
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
                          {customer.active ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => handleEditClick(customer.id, e)}>
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
                              {isAdmin && (
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
    </div>
  );
}
