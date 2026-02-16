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
import { DealStageBadges } from '@/components/DealStageBadges';
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
import type { Tables } from '@/integrations/supabase/types';

type DealStage = Tables<'deals'>['stage'];
const ITEMS_PER_PAGE = 25;

interface CustomerDeal {
  id: string;
  name: string;
  stage: DealStage;
  value: number | null;
}

interface CustomerListItem {
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
  tipo_cliente: 'PJ' | 'PF';
  source: 'crm' | 'erp';
  active: boolean;
  owner_id: string | null;
  owner_name: string | null;
  primary_contact: {
    id: string;
    name: string;
    job_title: string | null;
    mobile: string | null;
    email: string | null;
  } | null;
  deals: CustomerDeal[];
  last_activity_at: string | null;
  contacts_count: number;
  created_at: string | null;
}

type StatusFilter = 'active' | 'inactive' | 'all';
type SortField = 'name' | 'contact' | 'phone' | 'last_activity' | 'deals' | 'owner' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerListItem | null>(null);

  // Filters
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount = [filterCity, filterState, filterOwner, filterIndustry].filter(Boolean).length;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });

  const profilesMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles?.forEach(p => { if (p.user_id && p.full_name) map.set(p.user_id, p.full_name); });
    return map;
  }, [profiles]);

  // Fetch activity summary from the view
  const { data: activitySummary } = useQuery({
    queryKey: ['company-activity-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_activity_summary')
        .select('company_id, last_interaction_at, last_order_at, total_orders, total_order_value');
      if (error) throw error;
      return data;
    },
  });

  const activityMap = useMemo(() => {
    const map = new Map<string, { last_interaction_at: string | null; last_order_at: string | null }>();
    activitySummary?.forEach(s => {
      map.set(s.company_id, {
        last_interaction_at: s.last_interaction_at,
        last_order_at: s.last_order_at,
      });
    });
    return map;
  }, [activitySummary]);

  // Fetch companies
  const { data: customers, isLoading: loadingCompanies, refetch, isFetching } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          id, name, fantasia, cnpj, phone, email, industry, city, state, address, active,
          custom_fields, owner_id, created_at,
          contacts(id, first_name, last_name, job_title, mobile, email),
          deals(id, name, stage, value)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return companies;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Transform companies
  const transformedCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.map((company: any) => {
      const contacts = company.contacts || [];
      const primaryContact = contacts[0];
      const tipoCliente = (company.custom_fields as any)?.tipo_cliente || (company.cnpj ? 'PJ' : 'PJ');

      // Use activity summary view for last_interaction_at (includes deals, tasks, emails, whatsapp)
      const summary = activityMap.get(company.id);
      // Determine best last activity: use last_interaction_at but exclude if it equals company_created_at (fallback)
      let lastActivity = summary?.last_interaction_at || null;
      // If last_interaction_at equals created_at, check if there's a real activity
      if (lastActivity && company.created_at && lastActivity === company.created_at) {
        // Check if there's an order that's more recent
        if (summary?.last_order_at) {
          lastActivity = summary.last_order_at;
        }
      }

      return {
        id: company.id,
        name: company.fantasia || company.name,
        fantasia: company.fantasia,
        cnpj: company.cnpj,
        phone: company.phone,
        email: company.email,
        industry: company.industry,
        city: company.city,
        state: company.state,
        address: company.address,
        tipo_cliente: tipoCliente,
        source: 'crm' as const,
        active: company.active !== false,
        owner_id: company.owner_id,
        owner_name: company.owner_id ? profilesMap.get(company.owner_id) || null : null,
        primary_contact: primaryContact ? {
          id: primaryContact.id,
          name: `${primaryContact.first_name}${primaryContact.last_name ? ' ' + primaryContact.last_name : ''}`,
          job_title: primaryContact.job_title,
          mobile: primaryContact.mobile,
          email: primaryContact.email,
        } : null,
        deals: company.deals || [],
        last_activity_at: lastActivity,
        contacts_count: contacts.length,
        created_at: company.created_at,
      } as CustomerListItem;
    });
  }, [customers, profilesMap, activityMap]);

  // Fetch crm_clients (ERP)
  const { data: crmClients, isLoading: loadingErp } = useQuery({
    queryKey: ['crm-clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_clients')
        .select('id, razao_social, nome_fantasia, cnpj_cpf, telefone, celular, emails, regiao, tipo_pessoa, insc_estadual, raw_data');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Combine companies + crm_clients
  const allCustomers = useMemo(() => {
    const companyCnpjs = new Set(transformedCustomers?.map(c => c.cnpj?.replace(/\D/g, '')).filter(Boolean));
    const companiesList = transformedCustomers || [];
    const erpClients: CustomerListItem[] = (crmClients || [])
      .filter(c => { const cleanDoc = c.cnpj_cpf?.replace(/\D/g, '') || ''; return !companyCnpjs.has(cleanDoc); })
      .map(c => {
        const rawData = c.raw_data as any;
        return {
          id: c.id, name: c.nome_fantasia || c.razao_social || '', fantasia: c.nome_fantasia,
          cnpj: c.cnpj_cpf, phone: c.telefone || c.celular, email: c.emails?.[0] || null,
          industry: null, city: rawData?.loc_cidade || null, state: rawData?.loc_uf || null,
          address: rawData?.loc_endereco ? `${rawData.loc_endereco}${rawData.loc_numero ? ', ' + rawData.loc_numero : ''}` : null,
          tipo_cliente: (c.tipo_pessoa === 'PF' ? 'PF' : 'PJ') as 'PJ' | 'PF',
          source: 'erp' as const, active: true, owner_id: null, owner_name: null,
          primary_contact: null, deals: [], last_activity_at: null, contacts_count: 0, created_at: null,
        };
      });
    return [...companiesList, ...erpClients];
  }, [transformedCustomers, crmClients]);

  const isLoading = loadingCompanies || loadingErp;

  // Unique values for filters
  const filterOptions = useMemo(() => {
    const cities = new Set<string>();
    const states = new Set<string>();
    const owners = new Set<string>();
    const industries = new Set<string>();
    allCustomers.forEach(c => {
      if (c.city) cities.add(c.city);
      if (c.state) states.add(c.state);
      if (c.owner_name) owners.add(c.owner_name);
      if (c.industry) industries.add(c.industry);
    });
    return {
      cities: Array.from(cities).sort(),
      states: Array.from(states).sort(),
      owners: Array.from(owners).sort(),
      industries: Array.from(industries).sort(),
    };
  }, [allCustomers]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente excluído com sucesso!');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error: any) => {
      console.error('Error deleting customer:', error);
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
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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
  const handleDeleteClick = (customer: CustomerListItem, e: React.MouseEvent) => { e.stopPropagation(); setCustomerToDelete(customer); setDeleteDialogOpen(true); };
  const handleConfirmDelete = () => { if (customerToDelete) deleteMutation.mutate(customerToDelete.id); };
  const handleToggleActive = (customer: CustomerListItem, e: React.MouseEvent) => { e.stopPropagation(); toggleActiveMutation.mutate({ customerId: customer.id, active: !customer.active }); };
  const handleEditClick = (customerId: string, e: React.MouseEvent) => { e.stopPropagation(); navigate(`/customers/${customerId}`); };
  const handleOpenCustomer = (customerId: string) => { navigate(`/customers/${customerId}`); };
  const handleOpenWhatsApp = (customer: CustomerListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = customer.primary_contact?.mobile || customer.phone;
    if (!phone) { toast.error('Este cliente não possui telefone cadastrado'); return; }
    const contactName = customer.primary_contact?.name || customer.name;
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactName=${encodeURIComponent(contactName)}`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setFilterCity('');
    setFilterState('');
    setFilterOwner('');
    setFilterIndustry('');
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

  // Filter + search + sort
  const filteredCustomers = useMemo(() => {
    let result = allCustomers || [];

    // Status filter
    if (statusFilter === 'active') result = result.filter(c => c.active);
    else if (statusFilter === 'inactive') result = result.filter(c => !c.active);

    // Advanced filters
    if (filterCity) result = result.filter(c => c.city === filterCity);
    if (filterState) result = result.filter(c => c.state === filterState);
    if (filterOwner) result = result.filter(c => c.owner_name === filterOwner);
    if (filterIndustry) result = result.filter(c => c.industry === filterIndustry);

    // Search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const searchDigits = debouncedSearch.replace(/\D/g, '');
      result = result.filter(customer =>
        customer.name?.toLowerCase().includes(searchLower) ||
        customer.fantasia?.toLowerCase().includes(searchLower) ||
        (searchDigits && customer.cnpj?.replace(/\D/g, '').includes(searchDigits)) ||
        customer.address?.toLowerCase().includes(searchLower) ||
        customer.city?.toLowerCase().includes(searchLower) ||
        customer.state?.toLowerCase().includes(searchLower) ||
        (searchDigits && customer.phone?.replace(/\D/g, '').includes(searchDigits)) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.primary_contact?.name?.toLowerCase().includes(searchLower) ||
        customer.industry?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || ''; bVal = b.name?.toLowerCase() || ''; break;
        case 'contact':
          aVal = a.primary_contact?.name?.toLowerCase() || ''; bVal = b.primary_contact?.name?.toLowerCase() || ''; break;
        case 'phone':
          aVal = (a.primary_contact?.mobile || a.phone || '').replace(/\D/g, '');
          bVal = (b.primary_contact?.mobile || b.phone || '').replace(/\D/g, ''); break;
        case 'last_activity':
          aVal = a.last_activity_at || ''; bVal = b.last_activity_at || ''; break;
        case 'deals':
          aVal = a.deals.length; bVal = b.deals.length; break;
        case 'owner':
          aVal = a.owner_name?.toLowerCase() || ''; bVal = b.owner_name?.toLowerCase() || ''; break;
        case 'status':
          aVal = a.active ? 1 : 0; bVal = b.active ? 1 : 0; break;
        case 'created_at':
          aVal = a.created_at || ''; bVal = b.created_at || ''; break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allCustomers, debouncedSearch, statusFilter, sortField, sortDirection, filterCity, filterState, filterOwner, filterIndustry]);

  // Pagination
  const totalItems = filteredCustomers?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedCustomers = useMemo(() => filteredCustomers?.slice(startIndex, endIndex) || [], [filteredCustomers, startIndex, endIndex]);

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

  const getCustomerIcon = (tipo: 'PJ' | 'PF') => tipo === 'PJ' ? Building2 : User;

  const formatDocument = (cnpj: string | null, tipo: 'PJ' | 'PF') => {
    if (!cnpj) return '-';
    return tipo === 'PJ' ? formatCNPJ(cnpj) : formatCPF(cnpj);
  };

  const getLastActivityText = (date: string | null) => {
    if (!date) return 'Sem atividade';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
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
                        {filterOptions.states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cidade</Label>
                    <Select value={filterCity} onValueChange={(v) => { setFilterCity(v === '_all' ? '' : v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todas</SelectItem>
                        {filterOptions.cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Vendedor</Label>
                    <Select value={filterOwner} onValueChange={(v) => { setFilterOwner(v === '_all' ? '' : v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {filterOptions.owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Segmento</Label>
                    <Select value={filterIndustry} onValueChange={(v) => { setFilterIndustry(v === '_all' ? '' : v); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {filterOptions.industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
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
          ) : filteredCustomers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">Comece adicionando seu primeiro cliente.</p>
              <Button className="mt-4 gap-2" onClick={() => navigate('/customers/new')}>
                <Plus className="h-4 w-4" />
                Novo Cliente
              </Button>
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
                  {paginatedCustomers.map((customer) => {
                    const CustomerIcon = getCustomerIcon(customer.tipo_cliente);
                    const phone = customer.primary_contact?.mobile || customer.phone;

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
                              <p className="font-medium">{customer.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {customer.cnpj && <span>{formatDocument(customer.cnpj, customer.tipo_cliente)}</span>}
                                {customer.city && customer.state && <span>• {customer.city}/{customer.state}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.primary_contact ? (
                            <div>
                              <p className="font-medium">{customer.primary_contact.name}</p>
                              {customer.primary_contact.job_title && (
                                <p className="text-sm text-muted-foreground">{customer.primary_contact.job_title}</p>
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
                          <span className={`text-sm ${!customer.last_activity_at ? 'text-muted-foreground' : ''}`}>
                            {getLastActivityText(customer.last_activity_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {customer.deals.length > 0 ? (
                            <DealStageBadges deals={customer.deals} />
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
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
                                  <Button variant="ghost" size="icon" onClick={(e) => handleEditClick(customer.id, e)} disabled={customer.source === 'erp'}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{customer.source === 'erp' ? 'Dados gerenciados pelo ERP' : 'Editar'}</TooltipContent>
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
                                    <Button variant="ghost" size="icon" onClick={(e) => handleToggleActive(customer, e)} disabled={customer.source === 'erp' || toggleActiveMutation.isPending}>
                                      {customer.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-primary" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {customer.source === 'erp' ? 'Dados gerenciados pelo ERP' : customer.active ? 'Desativar cliente' : 'Ativar cliente'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {isAdmin && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={(e) => handleDeleteClick(customer, e)} disabled={customer.source === 'erp'} className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{customer.source === 'erp' ? 'Dados gerenciados pelo ERP' : 'Excluir cliente'}</TooltipContent>
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

              {totalPages > 1 && (
                <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Exibindo {startIndex + 1}-{endIndex} de {totalItems} clientes
                  </p>
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
              Tem certeza que deseja excluir o cliente <strong>{customerToDelete?.name}</strong>?
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
