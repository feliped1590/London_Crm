import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Plus, Search, Package, Edit, Trash2, Filter, DollarSign, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Upload, FileUp, AlertTriangle, Copy, Clock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { formatCurrency } from '@/lib/formatters';
import { usePricingTables } from '@/hooks/usePricingTables';
import { NCMSelector } from '@/components/products/NCMSelector';
import { TipoProdutoFiscal } from '@/types/fiscal';
import { Product, calcularFatorMilheiro } from '@/types/products';
import { calculatePackagingPrice } from '@/utils/pricing/packagingPricing';
import { tokenizeSearchTerm, escapePostgrestOrToken } from '@/utils/search/normalizeSearchTerm';
import { useProductLookups } from '@/hooks/useProductLookups';
import { useGroupSubgroupLinks } from '@/hooks/useGroupSubgroupLinks';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import ProductLookupManager from '@/components/products/ProductLookupManager';
import { ProductCompaniesTab } from '@/components/products/ProductCompaniesTab';
import { generateProductDescription } from '@/utils/products/generateProductDescription';
import { generateStructuralSku } from '@/utils/products/generateStructuralSku';
import {
  type DimensionProfile,
  validateRequiredFields,
  generateErpVersion,
  tryGenerateErpVersion,
  hasAutoDimensions,
  VersionGenerationError,
} from '@/utils/products/generateVersion';
import { type GroupLookupItem, type LookupItem } from '@/hooks/useProductLookups';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { getRecentInteractionLabel, useRecentInteractions } from '@/hooks/useRecentInteractions';
import { ProductSyncBadge, ProductSyncButton } from '@/components/products/ProductSyncStatus';

type SortField = 'sku' | 'name' | 'tipo' | 'unit_price';
type SortDirection = 'asc' | 'desc';

type ProductHistoryEntry = {
  id: string;
  label: string;
  description: string;
  changed_at: string;
  user_name: string | null;
};

export default function Products() {
  const { user } = useAuth();
  const { activeLegalEntityId, isContextReady } = useLegalEntities();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getTableForProduct, calculatePrice, pricingTables, pricingRules } = usePricingTables();
  const { tipos, grupos, subgrupos, familias, classes, unitMeasures } = useProductLookups();
  const { linksByGroup } = useGroupSubgroupLinks();
  const { isAdmin, can } = useModulePermissions();
  const canCreateProducts = can('products', PermissionAction.Create);
  const canEditProducts = can('products', PermissionAction.Edit);
  const canDeleteProducts = can('products', PermissionAction.Delete);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const { data: activeTenantId } = useQuery({
    queryKey: ['products-active-tenant-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data?.active_tenant_id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const [pageTab, setPageTab] = useState('catalogo');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('active');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const ITEMS_PER_PAGE = itemsPerPage;
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const { recentItems: recentProducts, recordInteraction: recordProductInteraction } = useRecentInteractions('product');
  const createForCompanyId = searchParams.get('createForCompany');
  const handledCreateForCompanyRef = useRef<string | null>(null);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      
      // Try UTF-16 LE first (common for Excel CSV exports)
      const bytes = new Uint8Array(buffer);
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
        text = new TextDecoder('utf-16le').decode(buffer);
      } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        text = new TextDecoder('utf-16be').decode(buffer);
      } else {
        text = new TextDecoder('utf-8').decode(buffer);
      }
      
      // Clean up: remove null chars and normalize
      text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      const { data, error } = await supabase.functions.invoke('import-products-csv', {
        body: { csvContent: text },
      });
      
      if (error) throw error;
      
      if (data.inserted > 0) {
        toast.success(`Importação concluída: ${data.inserted} produtos importados`);
      }
      if (data.insert_errors > 0) {
        toast.warning(`${data.insert_errors} erros de inserção`);
      }
      if (data.warnings?.length > 0) {
        console.warn('Import warnings:', data.warnings);
        toast.info(`${data.warnings.length} avisos durante o parse`);
      }
      
      await refetch();
    } catch (err: any) {
      toast.error('Erro na importação: ' + (err.message || 'erro desconhecido'));
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-product-sync');
      if (error) throw error;
      const result = data as any;
      if (result.processed === 0) {
        toast.info('Nenhum produto pendente na fila de sincronização');
      } else {
        toast.success(`Sincronização concluída: ${result.success_count} enviado(s), ${result.error_count} erro(s)`);
      }
      await refetch();
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsSyncing(false);
    }
  };

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    tipo_id: '' as string | undefined,
    unit_measure: 'mil',
    unit_price: 0,
    fator_kg: 0,
    fator_milheiro: 0,
    grupo_id: '' as string | undefined,
    subgrupo_id: '' as string | undefined,
    family_id: '' as string | undefined,
    class_id: '' as string | undefined,
    width: 0,
    length: 0,
    thickness: 0,
    active: true,
    nome_impresso: '',
    // Campos NCM e Fiscais
    ncm_code: '',
    ncm_id: '' as string | undefined,
    cst_icms: '',
    csosn: '',
    aliquota_icms: undefined as number | undefined,
    tem_icms_st: false,
    aliquota_ipi: undefined as number | undefined,
    cst_pis_cofins: '',
    aliquota_pis: undefined as number | undefined,
    aliquota_cofins: undefined as number | undefined,
    tipo_produto_fiscal: undefined as TipoProdutoFiscal | undefined,
    ncm_validated_at: null as string | null,
    // Campos ERP Projedata
    erp_product_code: '',
    tipo_item: 'PA',
    tipo_ficha: undefined as number | undefined,
    erp_grupo: '',
    erp_subgrupo: '',
    erp_empresa: 1,
    erp_versao: '',
    erp_versao_detalhes: '',
    erp_versao_roteiro: undefined as number | undefined,
    erp_versao_situacao: 'A',
  });

  const [formTab, setFormTab] = useState('geral');
  const [isAutoDescription, setIsAutoDescription] = useState(true);

  // Resolve lookup label by id
  const getLookupLabel = (items: { id: string; label: string }[], id?: string) => {
    if (!id) return undefined;
    return items.find((i) => i.id === id)?.label;
  };

  // Resolve lookup value (code) by id — for SKU generation
  const getLookupValue = (items: LookupItem[], id?: string) => {
    if (!id) return undefined;
    return items.find((i) => i.id === id)?.value;
  };

  const findLookupId = (items: LookupItem[], matchers: string[]) => {
    const normalizedMatchers = matchers.map((m) => m.toLowerCase());
    return items.find((item) => {
      const value = item.value?.toLowerCase() || '';
      const label = item.label?.toLowerCase() || '';
      return normalizedMatchers.some((matcher) => value === matcher || label.includes(matcher));
    })?.id;
  };

  const getDefaultTipoId = () => findLookupId(tipos.items, ['pa', 'produto acabado']);
  const getDefaultUnitMeasure = () => unitMeasures.items.find((u) => u.value?.toLowerCase() === 'mil' || u.label?.toLowerCase().includes('milheiro'))?.value || 'mil';

  const getAutoNcmByGroup = (grupoId?: string) => {
    if (!grupoId) return null;
    const group = (grupos.items as GroupLookupItem[]).find((g) => g.id === grupoId);
    const ncm = (group?.default_ncm_code || '').replace(/\D/g, '');
    return /^\d{8}$/.test(ncm) ? ncm : null;
  };

  // Lista de NCMs configurados como padrão de algum grupo (para permitir auto-substituição)
  const knownDefaultNcms = (): string[] => {
    return Array.from(
      new Set(
        (grupos.items as GroupLookupItem[])
          .map((g) => (g.default_ncm_code || '').replace(/\D/g, ''))
          .filter((n) => /^\d{8}$/.test(n)),
      ),
    );
  };

  // Resolve perfil de dimensão do grupo pelo banco (dimension_profile)
  const getGroupProfile = (grupoId?: string): DimensionProfile => {
    if (!grupoId) return 'none';
    const group = (grupos.items as GroupLookupItem[]).find((g) => g.id === grupoId);
    return group?.dimension_profile || 'none';
  };

  const isGroupPrinted = (grupoId?: string): boolean => {
    if (!grupoId) return false;
    const group = (grupos.items as GroupLookupItem[]).find((g) => g.id === grupoId);
    return group?.is_printed ?? false;
  };

  const normalizePrintedName = (value?: string | null) => {
    const normalized = value?.trim().toUpperCase();
    return normalized ? normalized : null;
  };

  const getDuplicateErrorMessage = (error: any) => {
    const errorText = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      errorText.includes('products_sku_unique_key') ||
      errorText.includes('key (sku_unique)') ||
      errorText.includes('(sku_unique)=')
    ) {
      return 'Já existe um produto com este código único (SKU). Use outro código para continuar.';
    }

    if (errorText.includes('idx_products_technical_uniqueness')) {
      return 'Já existe um produto ativo com essa mesma estrutura técnica (tipo, grupo, subgrupo, família, classe, dimensões e nome do impresso).';
    }

    if (
      errorText.includes('products_erp_product_code_unique') ||
      errorText.includes('(erp_product_code)') ||
      errorText.includes('erp_product_code')
    ) {
      return 'Já existe um produto com este Código ERP';
    }

    if (error?.code === '23505') {
      return 'Já existe um produto com dados únicos já cadastrados. Verifique o código e a estrutura técnica.';
    }

    if (errorText.includes('campos estruturais')) {
      return 'Campos estruturais não podem ser alterados após criação. Utilize a opção de duplicar produto.';
    }

    return null;
  };

  const currentDimensionProfile = getGroupProfile(formData.grupo_id);
  const isAutoVersion = hasAutoDimensions(currentDimensionProfile);
  const currentGroupIsPrinted = isGroupPrinted(formData.grupo_id);
  const isEditing = !!editingProduct;

  useEffect(() => {
    if (defaultsApplied || editingProduct || tipos.items.length === 0 || unitMeasures.items.length === 0) return;

    setDefaultsApplied(true);
    setFormData((prev) => {
      const defaultTipoId = getDefaultTipoId();
      const defaultUnitMeasure = getDefaultUnitMeasure();
      if (defaultTipoId && checkAutoDescriptionByTipo(defaultTipoId)) {
        setIsAutoDescription(true);
      }
      return {
        ...prev,
        tipo_id: prev.tipo_id || defaultTipoId,
        unit_measure: prev.unit_measure || defaultUnitMeasure,
      };
    });
  }, [defaultsApplied, editingProduct, tipos.items, unitMeasures.items]);

  // Recalcula o SKU estrutural a partir dos códigos de lookup + dimensões
  const recalcularSku = (data: typeof formData) => {
    const profile = getGroupProfile(data.grupo_id);
    return generateStructuralSku({
      tipoCode: getLookupValue(tipos.items, data.tipo_id),
      familyCode: getLookupValue(familias.items, data.family_id),
      groupCode: getLookupValue(grupos.items as LookupItem[], data.grupo_id),
      subgroupCode: getLookupValue(subgrupos.items, data.subgrupo_id),
      classCode: getLookupValue(classes.items, data.class_id),
      width: data.width,
      length: data.length,
      thickness: data.thickness,
      dimensionProfile: profile,
    });
  };

  // Recalcula a descrição inteligente
  const recalcularDescricao = (data: typeof formData) => {
    const printed = isGroupPrinted(data.grupo_id);
    const base = generateProductDescription({
      family: getLookupLabel(familias.items, data.family_id),
      group: getLookupLabel(grupos.items, data.grupo_id),
      subgroup: getLookupLabel(subgrupos.items, data.subgrupo_id),
      productClass: getLookupLabel(classes.items, data.class_id),
      printedName: printed ? data.nome_impresso : undefined,
    });
    return [base, data.erp_versao].filter(Boolean).join(' ');
  };

  // Recalcula o fator milheiro quando os valores mudam
  const recalcularFatorMilheiro = (data: typeof formData) => {
    if (data.fator_kg && data.width && data.length && data.thickness) {
      return calcularFatorMilheiro(data.fator_kg, data.width, data.length, data.thickness);
    }
    return 0;
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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );

  // Count query for total
  const { data: totalCount } = useQuery({
    queryKey: ['products-count', activeLegalEntityId, filterTipo, filterActive, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      if (filterTipo !== 'all') {
        query = query.eq('tipo_id', filterTipo);
      }
      if (filterActive === 'active') {
        query = query.eq('active', true);
      } else if (filterActive === 'inactive') {
        query = query.eq('active', false);
      }
      if (searchTerm) {
        for (const raw of tokenizeSearchTerm(searchTerm)) {
          const t = escapePostgrestOrToken(raw);
          if (t) query = query.or(`name.ilike.%${t}%,sku.ilike.%${t}%,sku_unique.ilike.%${t}%,erp_product_code.ilike.%${t}%,erp_grupo.ilike.%${t}%,erp_subgrupo.ilike.%${t}%,erp_versao.ilike.%${t}%,nome_impresso.ilike.%${t}%`);
        }
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: isContextReady,
    staleTime: 0,
  });

  const totalItems = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;

  const { data: products, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['products', activeLegalEntityId, filterTipo, filterActive, searchTerm, sortField, sortDirection, safePage],
    queryFn: async () => {
      const orderColumn = sortField === 'tipo' ? 'tipo_id' : sortField;
      let query = supabase
        .from('products')
        .select('*')
        .order(orderColumn, { ascending: sortDirection === 'asc' })
        .range(startIndex, startIndex + ITEMS_PER_PAGE - 1);

      if (filterTipo !== 'all') {
        query = query.eq('tipo_id', filterTipo);
      }
      if (filterActive === 'active') {
        query = query.eq('active', true);
      } else if (filterActive === 'inactive') {
        query = query.eq('active', false);
      }
      if (searchTerm) {
        for (const raw of tokenizeSearchTerm(searchTerm)) {
          const t = escapePostgrestOrToken(raw);
          if (t) query = query.or(`name.ilike.%${t}%,sku.ilike.%${t}%,sku_unique.ilike.%${t}%,erp_product_code.ilike.%${t}%,erp_grupo.ilike.%${t}%,erp_subgrupo.ilike.%${t}%,erp_versao.ilike.%${t}%,nome_impresso.ilike.%${t}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Product[];
    },
    enabled: isContextReady,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: productHistory = [], isLoading: isProductHistoryLoading } = useQuery({
    queryKey: ['product-history', editingProduct?.id],
    queryFn: async () => {
      if (!editingProduct) return [];

      const { data: auditData, error: auditError } = await supabase
        .from('product_ncm_audit')
        .select('id, old_ncm, new_ncm, reason, changed_at, changed_by')
        .eq('product_id', editingProduct.id)
        .order('changed_at', { ascending: false });
      if (auditError) throw auditError;

      const userIds = Array.from(new Set([
        editingProduct.created_by,
        ...(auditData || []).map((entry) => entry.changed_by),
      ].filter(Boolean) as string[]));

      const { data: profilesData } = userIds.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
        : { data: [] };

      const profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.full_name;
        return acc;
      }, {} as Record<string, string | null>);

      const entries: ProductHistoryEntry[] = [
        {
          id: `product-created-${editingProduct.id}`,
          label: 'Produto criado',
          description: editingProduct.sku ? `${editingProduct.sku} - ${editingProduct.name}` : editingProduct.name,
          changed_at: editingProduct.created_at,
          user_name: profilesMap[editingProduct.created_by || ''] || null,
        },
        ...(auditData || []).map((entry) => ({
          id: entry.id,
          label: 'NCM / Fiscal alterado',
          description: [entry.old_ncm || 'vazio', entry.new_ncm || 'vazio'].join(' → '),
          changed_at: entry.changed_at || editingProduct.created_at,
          user_name: profilesMap[entry.changed_by || ''] || null,
        })),
      ];

      return entries.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
    },
    enabled: !!editingProduct?.id,
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const handleProductSyncUpdated = useCallback((syncedProduct: Partial<Product> & { id: string; erp_product_code?: string | null }) => {
    queryClient.setQueriesData({ queryKey: ['products'] }, (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((product: Product) => product.id === syncedProduct.id ? { ...product, ...syncedProduct } : product);
    });

    setEditingProduct((current) => current?.id === syncedProduct.id ? { ...current, ...syncedProduct } as Product : current);
    if (editingProduct?.id === syncedProduct.id) {
      setFormData((current) => ({
        ...current,
        erp_product_code: syncedProduct.erp_product_code ?? current.erp_product_code,
      }));
    }
  }, [editingProduct?.id, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const fatorMilheiro = calcularFatorMilheiro(
        data.fator_kg || 0,
        data.width || 0,
        data.length || 0,
        data.thickness || 0
      );
      const { data: createdProduct, error } = await supabase.from('products').insert({
        sku: data.sku!,
        name: data.name!,
        description: data.description,
        legal_entity_id: activeLegalEntityId ?? null,
        created_by: user?.id ?? null,
        tipo_id: data.tipo_id || null,
        grupo_id: data.grupo_id || null,
        subgrupo_id: data.subgrupo_id || null,
        family_id: data.family_id || null,
        class_id: data.class_id || null,
        unit_measure: data.unit_measure,
        unit_price: data.unit_price,
        fator_kg: data.fator_kg,
        fator_milheiro: fatorMilheiro,
        width: data.width,
        length: data.length,
        thickness: data.thickness,
        active: data.active,
        // Campos NCM e Fiscais
        ncm_code: data.ncm_code || null,
        ncm_id: data.ncm_id || null,
        cst_icms: data.cst_icms || null,
        csosn: data.csosn || null,
        aliquota_icms: data.aliquota_icms || null,
        tem_icms_st: data.tem_icms_st || false,
        aliquota_ipi: data.aliquota_ipi || null,
        cst_pis_cofins: data.cst_pis_cofins || null,
        aliquota_pis: data.aliquota_pis || null,
        aliquota_cofins: data.aliquota_cofins || null,
        tipo_produto_fiscal: data.tipo_produto_fiscal || null,
        ncm_validated_at: data.ncm_validated_at || null,
        // Campos ERP Projedata
        tipo_item: data.tipo_item || null,
        tipo_ficha: data.tipo_ficha || null,
        erp_grupo: data.erp_grupo || null,
        erp_subgrupo: data.erp_subgrupo || null,
        erp_empresa: data.erp_empresa || 1,
        erp_versao: data.erp_versao || null,
        erp_versao_detalhes: data.erp_versao_detalhes || null,
        erp_versao_roteiro: data.erp_versao_roteiro || null,
        erp_versao_situacao: data.erp_versao_situacao || 'A',
        erp_product_code: data.erp_product_code?.trim() || null,
        nome_impresso: data.nome_impresso?.trim().toUpperCase() || null,
      }).select('*').single();
      if (error) throw error;
      if (createForCompanyId && createdProduct?.id && user?.id) {
        const { error: linkError } = await supabase.from('company_products').insert([{
          tenant_id: createdProduct.tenant_id,
          company_id: createForCompanyId,
          product_id: createdProduct.id,
          relationship_type: 'INTEREST',
          created_by: user.id,
          updated_by: user.id,
        }]);
        if (linkError) throw linkError;
      }
      return createdProduct as Product;
    },
    onSuccess: (createdProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (createForCompanyId) {
        queryClient.invalidateQueries({ queryKey: ['company-products', createForCompanyId] });
        queryClient.invalidateQueries({ queryKey: ['company-products-available-products', createForCompanyId] });
      }
      toast.success('Produto criado com sucesso!');
      setEditingProduct(createdProduct);
      setFormTab('clientes');
      recordProductInteraction({ entityId: createdProduct.id, tenantId: createdProduct.tenant_id, interactionType: 'create' });
      if (createForCompanyId) {
        setSearchParams({}, { replace: true });
      }
    },
    onError: (error: any) => {
      const duplicateMessage = getDuplicateErrorMessage(error);
      toast.error(duplicateMessage || 'Erro ao criar produto', { duration: 8000 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const fatorMilheiro = calcularFatorMilheiro(
        data.fator_kg || 0,
        data.width || 0,
        data.length || 0,
        data.thickness || 0
      );
      const { data: updatedProduct, error } = await supabase.from('products').update({
        ...data,
        fator_milheiro: fatorMilheiro,
      } as any).eq('id', id).select('*').single();
      if (error) throw error;
      return updatedProduct as Product;
    },
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      recordProductInteraction({ entityId: updatedProduct.id, tenantId: updatedProduct.tenant_id, interactionType: 'update' });
      toast.success('Produto atualizado!');
      resetForm();
    },
    onError: (error: any) => {
      const duplicateMessage = getDuplicateErrorMessage(error);
      toast.error(duplicateMessage || 'Erro ao atualizar produto', { duration: 8000 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído!');
    },
    onError: () => toast.error('Erro ao excluir produto'),
  });

  const resetForm = () => {
    const defaultTipoId = getDefaultTipoId();
    const shouldAutoDescription = checkAutoDescriptionByTipo(defaultTipoId);

    setFormData({
      sku: '',
      name: '',
      description: '',
      tipo_id: defaultTipoId,
      unit_measure: getDefaultUnitMeasure(),
      unit_price: 0,
      fator_kg: 0,
      fator_milheiro: 0,
      grupo_id: undefined,
      subgrupo_id: undefined,
      family_id: undefined,
      class_id: undefined,
      width: 0,
      length: 0,
      thickness: 0,
      active: true,
      nome_impresso: '',
      ncm_code: '',
      ncm_id: undefined,
      cst_icms: '',
      csosn: '',
      aliquota_icms: undefined,
      tem_icms_st: false,
      aliquota_ipi: undefined,
      cst_pis_cofins: '',
      aliquota_pis: undefined,
      aliquota_cofins: undefined,
      tipo_produto_fiscal: undefined,
      ncm_validated_at: null,
      erp_product_code: '',
      tipo_item: 'PA',
      tipo_ficha: undefined,
      erp_grupo: '',
      erp_subgrupo: '',
      erp_empresa: 1,
      erp_versao: '',
      erp_versao_detalhes: '',
      erp_versao_roteiro: undefined,
      erp_versao_situacao: 'A',
    });
    setEditingProduct(null);
    setIsDialogOpen(false);
    setFormTab('geral');
    setIsAutoDescription(shouldAutoDescription);
  };

  const closeProductDialog = () => {
    if (createForCompanyId) {
      setSearchParams({}, { replace: true });
    }
    resetForm();
  };

  const checkAutoDescriptionByTipo = (tipoId: string | undefined): boolean => {
    if (!tipoId) return false;
    const tipoItem = tipos.items.find(t => t.id === tipoId);
    return tipoItem?.label?.toLowerCase() === 'produto acabado';
  };

  const [similarProducts, setSimilarProducts] = useState<{id: string; sku: string; name: string; nome_impresso: string | null}[]>([]);
  const [showSimilarAlert, setShowSimilarAlert] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<typeof formData | null>(null);

  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const checkDuplicateProduct = async (productData: typeof formData): Promise<boolean> => {
    // Must match idx_products_technical_uniqueness exactly:
    // tenant_id, tipo_id, grupo_id, subgrupo_id, family_id, class_id, width, length, thickness, nome_impresso
    if (!activeTenantId) {
      console.warn('Tenant ativo não encontrado para validação prévia de duplicidade.');
      return false;
    }

    let query = supabase
      .from('products')
      .select('id, sku, name')
      .eq('tenant_id', activeTenantId)
      .eq('active', true);

    // Handle nullable UUID fields — use .is(null) for empty, .eq for values
    const uuidFields = ['tipo_id', 'grupo_id', 'subgrupo_id', 'family_id', 'class_id'] as const;
    for (const field of uuidFields) {
      const value = (productData as any)[field];
      if (value) {
        query = query.eq(field, value);
      } else {
        query = query.is(field, null);
      }
    }

    const w = productData.width ?? null;
    const l = productData.length ?? null;
    const t = productData.thickness ?? null;

    if (w !== null && w !== undefined) {
      query = query.eq('width', w);
    } else {
      query = query.is('width', null);
    }
    if (l !== null && l !== undefined) {
      query = query.eq('length', l);
    } else {
      query = query.is('length', null);
    }
    if (t !== null && t !== undefined) {
      query = query.eq('thickness', t);
    } else {
      query = query.is('thickness', null);
    }

    // Handle nome_impresso for uniqueness
    const ni = normalizePrintedName(productData.nome_impresso);
    if (ni) {
      query = query.eq('nome_impresso', ni);
    } else {
      query = query.is('nome_impresso', null);
    }

    // Exclude current product when editing
    if (editingProduct) {
      query = query.neq('id', editingProduct.id);
    }

    query = query.limit(1);

    const { data: duplicateRows, error } = await query;
    if (error) {
      console.error('Erro ao verificar duplicidade:', error);
      return false;
    }

    if (duplicateRows && duplicateRows.length > 0) {
      const existing = duplicateRows[0];
      toast.error(
        `Produto duplicado! Já existe um produto ativo com a mesma estrutura técnica (incluindo nome do impresso): ${existing.sku} - ${existing.name}`,
        { duration: 6000 }
      );
      return true;
    }

    return false;
  };

  // Find products with same structure (for UX alert, not blocking)
  const findSimilarProducts = async (data: typeof formData) => {
    if (!activeTenantId) return [];
    let query = supabase
      .from('products')
      .select('id, sku, name, nome_impresso')
      .eq('tenant_id', activeTenantId)
      
      .eq('active', true);

    const uuidFields = ['tipo_id', 'grupo_id', 'subgrupo_id', 'family_id', 'class_id'] as const;
    for (const field of uuidFields) {
      const value = (data as any)[field];
      if (value) query = query.eq(field, value);
      else query = query.is(field, null);
    }

    // Match dimensions
    if (data.width) query = query.eq('width', data.width);
    else query = query.is('width', null);
    if (data.length) query = query.eq('length', data.length);
    else query = query.is('length', null);
    if (data.thickness) query = query.eq('thickness', data.thickness);
    else query = query.is('thickness', null);

    // Do NOT filter by nome_impresso — we want all commercial variations
    const { data: rows } = await query.limit(10);
    return (rows || []) as {id: string; sku: string; name: string; nome_impresso: string | null}[];
  };

  const executeSave = (submitData: typeof formData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Descrição é obrigatória');
      return;
    }

    // SKU é gerado automaticamente — validar que foi gerado
    if (!formData.sku) {
      toast.error('SKU não foi gerado. Preencha os campos de classificação.');
      return;
    }

    // Validação dos campos obrigatórios para sincronização com o ERP Projedata
    // (codigo / erp_product_code é opcional: vazio = CREATE; preenchido = UPDATE)
    // Grupo e Subgrupo ERP são derivados automaticamente da descrição (label)
    // do Grupo/Subgrupo selecionado pelo usuário no CRM.
    const erpRequiredErrors: string[] = [];
    if (!formData.grupo_id) erpRequiredErrors.push('Grupo');
    if (!formData.subgrupo_id) erpRequiredErrors.push('Subgrupo');
    if (!formData.family_id) erpRequiredErrors.push('Família');
    if (!formData.class_id) erpRequiredErrors.push('Classe');
    if (!formData.tipo_item?.trim()) erpRequiredErrors.push('Tipo de item');
    if (!formData.tipo_ficha) erpRequiredErrors.push('Tipo de ficha');
    if (!formData.unit_measure?.trim()) erpRequiredErrors.push('Unidade de medida');
    const ncmDigits = (formData.ncm_code ?? '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(ncmDigits)) erpRequiredErrors.push('NCM (8 dígitos)');
    if (erpRequiredErrors.length > 0) {
      toast.error(
        `Campos obrigatórios para sincronização ERP:\n• ${erpRequiredErrors.join('\n• ')}`,
        { duration: 7000 },
      );
      setFormTab('geral');
      return;
    }

    // Validação de nome_impresso para grupos impressos
    if (isGroupPrinted(formData.grupo_id) && !formData.nome_impresso?.trim()) {
      toast.error('O campo "Nome do Impresso" é obrigatório para produtos impressos.', { duration: 6000 });
      return;
    }

    // Validação dinâmica por perfil de dimensão do grupo
    const profile = getGroupProfile(formData.grupo_id);
    const missingFields = validateRequiredFields(formData as any, profile);
    if (missingFields.length > 0) {
      toast.error(
        `Campos obrigatórios não preenchidos:\n• ${missingFields.join('\n• ')}`,
        { duration: 6000 }
      );
      return;
    }

    // Normalização de nome_impresso e geração automática de erp_versao
    const submitData = { ...formData };
    submitData.nome_impresso = normalizePrintedName(submitData.nome_impresso) || '';

    // Deriva erp_grupo / erp_subgrupo a partir da DESCRIÇÃO (label) do Grupo/Subgrupo
    // selecionado pelo usuário no CRM. O ERP espera receber a descrição cadastrada,
    // não um código separado.
    const grupoLabel = grupos.items.find((g) => g.id === submitData.grupo_id)?.label?.trim() || '';
    const subgrupoLabel = subgrupos.items.find((s) => s.id === submitData.subgrupo_id)?.label?.trim() || '';
    submitData.erp_grupo = grupoLabel;
    submitData.erp_subgrupo = subgrupoLabel;
    if (hasAutoDimensions(profile)) {
      try {
        const version = generateErpVersion(profile, submitData.width, submitData.length, submitData.thickness);
        if (version) {
          submitData.erp_versao = version;
        }
      } catch (err) {
        if (err instanceof VersionGenerationError) {
          toast.error(err.message);
          return;
        }
        throw err;
      }
    } else {
      if (!submitData.erp_versao || submitData.erp_versao.trim() === '') {
        toast.error('O campo Versão (ERP) é obrigatório. Preencha manualmente.');
        return;
      }
    }

    if (!submitData.unit_price || submitData.unit_price === 0) {
      const fatorMilheiro = recalcularFatorMilheiro(submitData);
      if (fatorMilheiro > 0) {
        submitData.unit_price = fatorMilheiro;
      }
    }

    setIsCheckingDuplicate(true);
    try {
      // Skip duplicate check in edit mode (structural fields are locked)
      if (!isEditing) {
        const isDuplicate = await checkDuplicateProduct(submitData);
        if (isDuplicate) return;

        // Check for similar structures (alert, not blocking)
        const similar = await findSimilarProducts(submitData);
        if (similar.length > 0) {
          setSimilarProducts(similar);
          setPendingSubmitData(submitData);
          setShowSimilarAlert(true);
          return;
        }
      }

      executeSave(submitData);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleConfirmSimilar = () => {
    if (pendingSubmitData) {
      executeSave(pendingSubmitData);
    }
    setShowSimilarAlert(false);
    setPendingSubmitData(null);
    setSimilarProducts([]);
  };

  const handleCancelSimilar = () => {
    setShowSimilarAlert(false);
    setPendingSubmitData(null);
    setSimilarProducts([]);
  };

  const handleEdit = (product: Product) => {
    recordProductInteraction({ entityId: product.id, tenantId: product.tenant_id, interactionType: 'view' });
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      tipo_id: product.tipo_id || undefined,
      unit_measure: product.unit_measure || getDefaultUnitMeasure(),
      unit_price: product.unit_price || 0,
      fator_kg: product.fator_kg || 0,
      fator_milheiro: product.fator_milheiro || 0,
      grupo_id: product.grupo_id || undefined,
      subgrupo_id: product.subgrupo_id || undefined,
      family_id: product.family_id || undefined,
      class_id: product.class_id || undefined,
      width: product.width || 0,
      length: product.length || 0,
      thickness: product.thickness || 0,
      active: product.active ?? true,
      nome_impresso: (product as any).nome_impresso || '',
      ncm_code: product.ncm_code || '',
      ncm_id: product.ncm_id,
      cst_icms: product.cst_icms || '',
      csosn: product.csosn || '',
      aliquota_icms: product.aliquota_icms,
      tem_icms_st: product.tem_icms_st || false,
      aliquota_ipi: product.aliquota_ipi,
      cst_pis_cofins: product.cst_pis_cofins || '',
      aliquota_pis: product.aliquota_pis,
      aliquota_cofins: product.aliquota_cofins,
      tipo_produto_fiscal: product.tipo_produto_fiscal,
      ncm_validated_at: product.ncm_validated_at || null,
      erp_product_code: (product as any).erp_product_code || '',
      tipo_item: product.tipo_item || '',
      tipo_ficha: product.tipo_ficha,
      erp_grupo: product.erp_grupo || '',
      erp_subgrupo: product.erp_subgrupo || '',
      erp_empresa: product.erp_empresa || 1,
      erp_versao: product.erp_versao || '',
      erp_versao_detalhes: product.erp_versao_detalhes || '',
      erp_versao_roteiro: product.erp_versao_roteiro,
      erp_versao_situacao: product.erp_versao_situacao || 'A',
    });
    setIsDialogOpen(true);
    setFormTab('geral');
    setIsAutoDescription(false);
  };

  useEffect(() => {
    if (!createForCompanyId || handledCreateForCompanyRef.current === createForCompanyId || !canCreateProducts) return;
    handledCreateForCompanyRef.current = createForCompanyId;
    setEditingProduct(null);
    resetForm();
    setIsDialogOpen(true);
  }, [createForCompanyId, canCreateProducts]);

  const handleDuplicate = (product: Product) => {
    setEditingProduct(null); // modo criação — campos estruturais editáveis
    const duplicatedData = {
      sku: '', // será regenerado automaticamente
      name: product.name,
      description: product.description || '',
      tipo_id: product.tipo_id || undefined,
      unit_measure: product.unit_measure || getDefaultUnitMeasure(),
      unit_price: product.unit_price || 0,
      fator_kg: product.fator_kg || 0,
      fator_milheiro: product.fator_milheiro || 0,
      grupo_id: product.grupo_id || undefined,
      subgrupo_id: product.subgrupo_id || undefined,
      family_id: product.family_id || undefined,
      class_id: product.class_id || undefined,
      width: product.width || 0,
      length: product.length || 0,
      thickness: product.thickness || 0,
      active: true,
      nome_impresso: '', // limpar — nova variação comercial
      ncm_code: product.ncm_code || '',
      ncm_id: product.ncm_id,
      cst_icms: product.cst_icms || '',
      csosn: product.csosn || '',
      aliquota_icms: product.aliquota_icms,
      tem_icms_st: product.tem_icms_st || false,
      aliquota_ipi: product.aliquota_ipi,
      cst_pis_cofins: product.cst_pis_cofins || '',
      aliquota_pis: product.aliquota_pis,
      aliquota_cofins: product.aliquota_cofins,
      tipo_produto_fiscal: product.tipo_produto_fiscal,
      ncm_validated_at: product.ncm_validated_at || null,
      erp_product_code: '',
      tipo_item: product.tipo_item || '',
      tipo_ficha: product.tipo_ficha,
      erp_grupo: product.erp_grupo || '',
      erp_subgrupo: product.erp_subgrupo || '',
      erp_empresa: product.erp_empresa || 1,
      erp_versao: product.erp_versao || '',
      erp_versao_detalhes: product.erp_versao_detalhes || '',
      erp_versao_roteiro: product.erp_versao_roteiro,
      erp_versao_situacao: product.erp_versao_situacao || 'A',
    };
    // Regenerar SKU
    duplicatedData.sku = recalcularSku(duplicatedData);
    setFormData(duplicatedData);
    setIsDialogOpen(true);
    setFormTab('geral');
    setIsAutoDescription(true);
    toast.info('Produto duplicado. Ajuste os campos desejados e salve como novo produto.');
  };

  // Helper to get pricing info for a product
  const getProductPricingInfo = (product: Product) => {
    const table = getTableForProduct(product.id);
    if (!table) return null;
    
    const { finalPrice, rule } = calculatePrice(
      table.id,
      product.id,
      product.tipo_id || null,
      1,
      product.unit_price || 0
    );
    
    return {
      table,
      finalPrice,
      rule,
      hasDiscount: finalPrice < (product.unit_price || 0),
    };
  };

  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Catálogo de itens de embalagem</p>
        </div>
      </div>

      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="catalogo" className="gap-2 flex-1 sm:flex-none">
            <Package className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="cadastro-basico" className="gap-2 flex-1 sm:flex-none">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Cadastro Básico</span>
              <span className="sm:hidden">Cadastro</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="cadastro-basico">
          {isAdmin && <ProductLookupManager />}
        </TabsContent>

        <TabsContent value="catalogo">
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            closeProductDialog();
            return;
          }
          setIsDialogOpen(true);
        }}>
           <div className="flex items-center gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="gap-2 opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Enviar ao ERP</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Integração ERP em desenvolvimento</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            {canCreateProducts && (
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  size="sm"
                  onClick={() => {
                    setEditingProduct(null);
                    resetForm();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Produto</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DialogTrigger>
            )}
          </div>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[70vw] max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3 pr-8">
                <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                {editingProduct && (
                  <div className="flex items-center gap-2">
                    <ProductSyncBadge
                      productId={editingProduct.id}
                      erpProductCode={(editingProduct as any).erp_product_code}
                      onProductUpdated={handleProductSyncUpdated}
                    />
                    {canEditProducts && (
                      <ProductSyncButton
                        productId={editingProduct.id}
                        erpProductCode={(editingProduct as any).erp_product_code}
                        onProductUpdated={handleProductSyncUpdated}
                      />
                    )}
                  </div>
                )}
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={formTab} onValueChange={setFormTab}>
                <TabsList className={`grid w-full ${editingProduct ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="geral" className="gap-2">
                    <Package className="h-4 w-4" />
                    Geral
                  </TabsTrigger>
                  <TabsTrigger value="clientes" className="gap-2">
                    <User className="h-4 w-4" />
                    Clientes vinculados
                  </TabsTrigger>
                  {editingProduct && (
                    <TabsTrigger value="historico" className="gap-2">
                      <Clock className="h-4 w-4" />
                      Histórico
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="geral" className="space-y-4 mt-4">
                  {isEditing && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Este produto já foi criado e sua estrutura não pode ser alterada.
                        Para mudanças estruturais, utilize a opção <strong>"Duplicar Produto"</strong>.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {/* NCM */}
                    <div className="col-span-2">
                      <NCMSelector
                        value={formData.ncm_code}
                        onChange={(ncmCode, ncm) => {
                          const officialIpi = ncm?.aliquota_ipi_oficial ?? null;
                          const shouldAutoFill = !formData.aliquota_ipi && officialIpi != null;
                          setFormData({ 
                            ...formData, 
                            ncm_code: ncmCode,
                            ncm_id: ncm?.id,
                            ...(shouldAutoFill ? { aliquota_ipi: officialIpi } : {}),
                          });
                        }}
                        productDescription={`${formData.name} ${formData.description || ''}`}
                        onValidationChange={(result) => {
                          if (result) {
                            setFormData(prev => ({ ...prev, ncm_validated_at: new Date().toISOString() }));
                          }
                        }}
                      />
                    </div>
                    {/* Código ERP */}
                    <div className="col-span-2">
                      <Label htmlFor="erp_product_code">Código ERP</Label>
                      <Input
                        id="erp_product_code"
                        value={formData.erp_product_code || ''}
                        onChange={(e) => setFormData({ ...formData, erp_product_code: e.target.value })}
                        placeholder="Opcional — preencher só se já existir no ERP"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Opcional. Deixe em branco para que o ERP gere o código no primeiro envio. Preencha apenas se o produto já existir no ERP.
                      </p>
                    </div>

                    {/* Descrição */}
                    <div className="col-span-2">
                      <Label htmlFor="name">Descrição *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          setIsAutoDescription(false);
                        }}
                        onBlur={() => {
                          if (!formData.name?.trim() && checkAutoDescriptionByTipo(formData.tipo_id)) {
                            setIsAutoDescription(true);
                            setFormData(prev => ({ ...prev, name: recalcularDescricao(prev) }));
                          }
                        }}
                        placeholder={isAutoDescription ? "Descrição do produto (gerada automaticamente)" : "Digite a descrição do produto"}
                        required
                      />
                    </div>
                    {/* Tipo */}
                    <div>
                      <Label htmlFor="tipo">Tipo *</Label>
                      <Select
                        value={formData.tipo_id || 'none'}
                        disabled={isEditing}
                        onValueChange={(v) => {
                          const newTipoId = v === 'none' ? undefined : v;
                          const shouldAuto = checkAutoDescriptionByTipo(newTipoId);
                          setIsAutoDescription(shouldAuto);
                          const updated = { ...formData, tipo_id: newTipoId };
                          updated.sku = recalcularSku(updated);
                          if (shouldAuto) updated.name = recalcularDescricao(updated);
                          setFormData(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {tipos.items.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Código (SKU) — readonly, auto-gerado */}
                    <div>
                      <Label htmlFor="sku">Código (SKU)</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        readOnly
                        disabled={isEditing}
                        className="bg-muted/50 font-mono cursor-not-allowed"
                        placeholder="Gerado automaticamente"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente a partir da classificação</p>
                    </div>
                    {/* Família */}
                    <div>
                      <Label htmlFor="familia">Família</Label>
                      <Select
                        value={formData.family_id || 'none'}
                        disabled={isEditing}
                        onValueChange={(v) => {
                          const updated = { ...formData, family_id: v === 'none' ? undefined : v };
                          updated.sku = recalcularSku(updated);
                          if (isAutoDescription) updated.name = recalcularDescricao(updated);
                          setFormData(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a família" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {familias.items.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Tipo de Ficha */}
                    <div>
                      <Label htmlFor="tipo_ficha" className="flex items-center gap-1">
                        Tipo de Ficha <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.tipo_ficha ? String(formData.tipo_ficha) : ''}
                        onValueChange={(v) => setFormData({ ...formData, tipo_ficha: Number(v) })}
                      >
                        <SelectTrigger id="tipo_ficha">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Obrigatório para sincronização com o ERP.
                      </p>
                    </div>
                    {/* Unidade */}
                    <div>
                      <Label htmlFor="unit_measure">Unidade</Label>
                      <Select
                        value={formData.unit_measure}
                        onValueChange={(v) => setFormData({ ...formData, unit_measure: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitMeasures.items.map((u) => (
                            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Classificação Complementar */}
                    <div className="col-span-2 pt-2">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Classificação Complementar</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="grupo">Grupo</Label>
                          <Select
                            value={formData.grupo_id || 'none'}
                            disabled={isEditing}
                            onValueChange={(v) => {
                              const newGrupoId = v === 'none' ? undefined : v;
                              const autoNcm = !isEditing ? getAutoNcmByGroup(newGrupoId) : null;
                              const canApplyAutoNcm = !formData.ncm_code || knownDefaultNcms().includes(formData.ncm_code);
                              const updated = {
                                ...formData,
                                grupo_id: newGrupoId,
                                ...(!isEditing && autoNcm && canApplyAutoNcm ? { ncm_code: autoNcm, ncm_id: undefined } : {}),
                              };
                              if (!isGroupPrinted(newGrupoId)) {
                                updated.nome_impresso = '';
                              }
                              // Limpa subgrupo se não pertencer aos vínculos do novo grupo
                              if (newGrupoId && updated.subgrupo_id) {
                                const allowed = linksByGroup[newGrupoId] || [];
                                if (allowed.length > 0 && !allowed.includes(updated.subgrupo_id)) {
                                  updated.subgrupo_id = undefined;
                                }
                              }
                              updated.sku = recalcularSku(updated);
                              if (isAutoDescription) updated.name = recalcularDescricao(updated);
                              setFormData(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {grupos.items.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="subgrupo">Subgrupo</Label>
                          <Select
                            value={formData.subgrupo_id || 'none'}
                            disabled={isEditing}
                            onValueChange={(v) => {
                              const updated = { ...formData, subgrupo_id: v === 'none' ? undefined : v };
                              updated.sku = recalcularSku(updated);
                              if (isAutoDescription) updated.name = recalcularDescricao(updated);
                              setFormData(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {subgrupos.items.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="classe">Classe</Label>
                          <Select
                            value={formData.class_id || 'none'}
                            disabled={isEditing}
                            onValueChange={(v) => {
                              const updated = { ...formData, class_id: v === 'none' ? undefined : v };
                              updated.sku = recalcularSku(updated);
                              if (isAutoDescription) updated.name = recalcularDescricao(updated);
                              setFormData(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {classes.items.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Nome do Impresso (condicional) */}
                    {currentGroupIsPrinted && (
                      <div className="col-span-2 pt-2">
                        <Label htmlFor="nome_impresso" className="flex items-center gap-1">
                          Nome do Impresso <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="nome_impresso"
                          value={formData.nome_impresso}
                          onChange={(e) => {
                            const updated = { ...formData, nome_impresso: e.target.value };
                            if (isAutoDescription) updated.name = recalcularDescricao(updated);
                            setFormData(updated);
                          }}
                          placeholder="Ex: BONGOS BIFINHO CARNE 65G"
                          className="uppercase"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Nome do cliente/produto impresso que compõe a descrição final
                        </p>
                      </div>
                    )}

                    {/* Dimensões */}
                    <div className="col-span-2 pt-2">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Dimensões</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="width">Largura (mm)</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isEditing}
                            value={formData.width || ''}
                            onChange={(e) => {
                              const newWidth = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, width: newWidth };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              const prof = getGroupProfile(newData.grupo_id);
                              if (hasAutoDimensions(prof)) {
                                newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness);
                              }
                              newData.sku = recalcularSku(newData);
                              if (isAutoDescription) newData.name = recalcularDescricao(newData);
                              setFormData(newData);
                            }}
                            placeholder="Em milímetros"
                          />
                        </div>
                        <div>
                          <Label htmlFor="length">Comprimento (mm)</Label>
                          <Input
                            id="length"
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isEditing}
                            value={formData.length || ''}
                            onChange={(e) => {
                              const newLength = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, length: newLength };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              const prof = getGroupProfile(newData.grupo_id);
                              if (hasAutoDimensions(prof)) {
                                newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness);
                              }
                              newData.sku = recalcularSku(newData);
                              if (isAutoDescription) newData.name = recalcularDescricao(newData);
                              setFormData(newData);
                            }}
                            placeholder="Em milímetros"
                          />
                        </div>
                        <div>
                          <Label htmlFor="thickness">Espessura (micras)</Label>
                          <Input
                            id="thickness"
                            type="number"
                            step="0.001"
                            min="0"
                            disabled={isEditing}
                            value={formData.thickness || ''}
                            onChange={(e) => {
                              const newThickness = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, thickness: newThickness };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              const prof = getGroupProfile(newData.grupo_id);
                              if (hasAutoDimensions(prof)) {
                                newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness);
                              }
                              newData.sku = recalcularSku(newData);
                              if (isAutoDescription) newData.name = recalcularDescricao(newData);
                              setFormData(newData);
                            }}
                            placeholder="Em micras"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Versão do Produto (readonly, tempo real) */}
                    {formData.erp_versao && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Versão do Produto</Label>
                        <Input
                          value={formData.erp_versao}
                          readOnly
                          className="bg-muted/50 font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente a partir das dimensões</p>
                      </div>
                    )}

                    {/* Observações */}
                    <div className="col-span-2">
                      <Label htmlFor="description">Observações</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        placeholder="Observações técnicas do produto"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id="active"
                        checked={formData.active}
                        onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                      />
                      <Label htmlFor="active">Produto Ativo</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="clientes" className="space-y-4 mt-4">
                  <ProductCompaniesTab productId={editingProduct?.id} canEdit={canEditProducts} />
                </TabsContent>

                {editingProduct && (
                  <TabsContent value="historico" className="space-y-4 mt-4">
                    {isProductHistoryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : (
                      <div className="relative pl-6">
                        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                        <div className="space-y-4">
                          {productHistory.map((entry) => (
                            <div key={entry.id} className="relative">
                              <div className="absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                              <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="flex items-start gap-2">
                                  <Package className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm">{entry.label}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{entry.description}</div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{new Date(entry.changed_at).toLocaleString('pt-BR')}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{entry.user_name || 'Sistema'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={closeProductDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || isCheckingDuplicate}>
                  {isCheckingDuplicate ? 'Verificando...' : editingProduct ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU ou nome..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {tipos.items.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {recentProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Itens recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentProducts.map((product) => (
                <Button
                  key={product.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-full flex-col items-start gap-0 px-3 py-2 text-left"
                  onClick={() => handleEdit(product as unknown as Product)}
                >
                  <span className="max-w-[260px] truncate font-medium">{product.name}</span>
                  <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                    {getRecentInteractionLabel(product.interaction_type)} • {product.sku}
                    {product.ncm_code ? ` • NCM ${product.ncm_code}` : ''}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : products && products.length > 0 ? (
            <div className="table-responsive">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="tipo">Tipo</SortableHeader>
                    <TableHead>Família</TableHead>
                    <SortableHeader field="sku">Código</SortableHeader>
                    <SortableHeader field="name">Descrição</SortableHeader>
                    <TableHead>Unidade</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead>Largura</TableHead>
                    <TableHead>Comprimento</TableHead>
                    <TableHead>Espessura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ERP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {products?.map((product) => {
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.tipo_id ? (
                          <Badge variant="secondary">
                            {tipos.items.find((c) => c.id === product.tipo_id)?.label || '—'}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {product.family_id ? (
                          <span className="text-sm">
                            {familias.items.find((f) => f.id === product.family_id)?.label || '—'}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{product.unit_measure || '—'}</TableCell>
                      <TableCell>
                        {product.ncm_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {product.ncm_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{product.width ? `${product.width}` : '—'}</TableCell>
                      <TableCell className="text-sm">{product.length ? `${product.length}` : '—'}</TableCell>
                      <TableCell className="text-sm">{product.thickness ? `${product.thickness}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? 'default' : 'outline'}>
                          {product.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ProductSyncBadge
                          productId={product.id}
                          erpProductCode={(product as any).erp_product_code}
                          onProductUpdated={handleProductSyncUpdated}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEditProducts && (
                            <ProductSyncButton
                              productId={product.id}
                              erpProductCode={(product as any).erp_product_code}
                              onProductUpdated={handleProductSyncUpdated}
                            />
                          )}
                          {canCreateProducts && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicate(product)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicar produto (cria novo com base neste)</TooltipContent>
                          </Tooltip>
                          )}
                          {canEditProducts && (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteProducts && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este produto?')) {
                                  deleteMutation.mutate(product.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>Nenhum produto encontrado</p>
              {canCreateProducts && <Button variant="link" onClick={() => setIsDialogOpen(true)}>
                Criar primeiro produto
              </Button>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between">
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
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  className={safePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
              {getPageNumbers().map((page, idx) =>
                page === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}><PaginationEllipsis /></PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      onClick={() => setCurrentPage(page)} 
                      isActive={safePage === page} 
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  className={safePage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
        </TabsContent>
      </Tabs>

      {/* AlertDialog para produtos com mesma estrutura */}
      <AlertDialog open={showSimilarAlert} onOpenChange={setShowSimilarAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estrutura já existente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Já existem produtos com essa mesma estrutura técnica:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {similarProducts.map((p) => (
                    <li key={p.id} className="text-sm">
                      <span className="font-mono font-medium">{p.sku}</span>
                      {' — '}
                      {p.nome_impresso || p.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3">Deseja continuar e criar o produto mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSimilar}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSimilar}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
