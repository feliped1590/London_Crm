import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProductLookups } from '@/hooks/useProductLookups';
import { useGroupSubgroupLinks } from '@/hooks/useGroupSubgroupLinks';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { NCMSelector } from '@/components/products/NCMSelector';
import { TipoProdutoFiscal } from '@/types/fiscal';
import { Product, calcularFatorMilheiro } from '@/types/products';
import { generateProductDescription } from '@/utils/products/generateProductDescription';
import { generateStructuralSku } from '@/utils/products/generateStructuralSku';
import {
  type DimensionProfile,
  validateRequiredFields,
  generateErpVersion,
  tryGenerateErpVersion,
  hasAutoDimensions,
  VersionGenerationError,
  extractGusset,
} from '@/utils/products/generateVersion';
import { type GroupLookupItem, type LookupItem } from '@/hooks/useProductLookups';
import { ConfirmStructuralChangeDialog, type StructuralFieldChange } from '@/components/products/ConfirmStructuralChangeDialog';
import { ProductVersionsTab } from '@/components/products/ProductVersionsTab';
import { type FichaTecnicaData } from '@/components/products/FichaTecnicaSection';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductGeneralEditFormProps {
  productId: string;
  embedded?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  /** Extra query keys to invalidate after save (e.g. order-items) */
  extraInvalidations?: string[][];
}

type FormData = {
  sku: string;
  name: string;
  description: string;
  tipo_id: string | undefined;
  unit_measure: string;
  unit_price: number;
  fator_kg: number;
  fator_milheiro: number;
  grupo_id: string | undefined;
  subgrupo_id: string | undefined;
  family_id: string | undefined;
  class_id: string | undefined;
  width: number;
  length: number;
  thickness: number;
  active: boolean;
  nome_impresso: string;
  ncm_code: string;
  ncm_id: string | undefined;
  cst_icms: string;
  csosn: string;
  aliquota_icms: number | undefined;
  tem_icms_st: boolean;
  aliquota_ipi: number | undefined;
  cst_pis_cofins: string;
  aliquota_pis: number | undefined;
  aliquota_cofins: number | undefined;
  tipo_produto_fiscal: TipoProdutoFiscal | undefined;
  ncm_validated_at: string | null;
  erp_product_code: string;
  tipo_item: string;
  tipo_ficha: number | undefined;
  erp_grupo: string;
  erp_subgrupo: string;
  erp_empresa: number;
  erp_versao: string;
  erp_versao_detalhes: string;
  erp_versao_roteiro: number | undefined;
  erp_versao_situacao: string;
  ficha_tecnica: FichaTecnicaData;
};

const EMPTY_FORM: FormData = {
  sku: '', name: '', description: '', tipo_id: undefined, unit_measure: 'mil',
  unit_price: 0, fator_kg: 0, fator_milheiro: 0, grupo_id: undefined, subgrupo_id: undefined,
  family_id: undefined, class_id: undefined, width: 0, length: 0, thickness: 0,
  active: true, nome_impresso: '', ncm_code: '', ncm_id: undefined, cst_icms: '', csosn: '',
  aliquota_icms: undefined, tem_icms_st: false, aliquota_ipi: undefined, cst_pis_cofins: '',
  aliquota_pis: undefined, aliquota_cofins: undefined, tipo_produto_fiscal: undefined,
  ncm_validated_at: null, erp_product_code: '', tipo_item: '', tipo_ficha: undefined,
  erp_grupo: '', erp_subgrupo: '', erp_empresa: 1, erp_versao: '', erp_versao_detalhes: '',
  erp_versao_roteiro: undefined, erp_versao_situacao: 'A', ficha_tecnica: {} as FichaTecnicaData,
};

export function ProductGeneralEditForm({
  productId,
  embedded = true,
  onSaved,
  onCancel,
  extraInvalidations = [],
}: ProductGeneralEditFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { tipos, grupos, subgrupos, familias, classes, unitMeasures } = useProductLookups();
  const { linksByGroup } = useGroupSubgroupLinks();
  const { isAdmin, can } = useModulePermissions();

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isAutoDescription, setIsAutoDescription] = useState(true);
  const [unlockErpCode, setUnlockErpCode] = useState(false);
  const [unlockDescription, setUnlockDescription] = useState(false);
  const [thicknessInput, setThicknessInput] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Structural change confirmation state
  const [showStructuralChange, setShowStructuralChange] = useState(false);
  const [structuralChangePayload, setStructuralChangePayload] = useState<{
    submitData: FormData;
    changes: StructuralFieldChange[];
    currentSku: string;
    currentName: string;
  } | null>(null);

  // Load current product
  const { data: product, isLoading } = useQuery({
    queryKey: ['product-general-edit', productId],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
      if (error) throw error;
      return data as unknown as Product;
    },
    enabled: !!productId,
    staleTime: 0,
  });

  // Helper: resolve label by id
  const getLookupLabel = (items: { id: string; label: string }[], id?: string) =>
    !id ? undefined : items.find((i) => i.id === id)?.label;
  const getLookupValue = (items: LookupItem[], id?: string) =>
    !id ? undefined : items.find((i) => i.id === id)?.value;

  const formatDimensionInput = (value?: number | null) => (value ? String(value).replace('.', ',') : '');

  const getGroupProfile = useCallback((grupoId?: string): DimensionProfile => {
    if (!grupoId) return 'none';
    const group = (grupos.items as GroupLookupItem[]).find((g) => g.id === grupoId);
    const normalized = (group?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes('bobina')) return 'partial';
    return group?.dimension_profile || 'full';
  }, [grupos.items]);

  const recalcularSku = useCallback((data: FormData) => {
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
  }, [tipos.items, familias.items, grupos.items, subgrupos.items, classes.items, getGroupProfile]);

  const recalcularDescricao = useCallback((data: FormData) => {
    const base = generateProductDescription({
      family: getLookupLabel(familias.items, data.family_id),
      group: getLookupLabel(grupos.items, data.grupo_id),
      subgroup: getLookupLabel(subgrupos.items, data.subgrupo_id),
      productClass: getLookupLabel(classes.items, data.class_id),
      printedName: data.nome_impresso?.trim() || undefined,
    });
    return [base, data.erp_versao].filter(Boolean).join(' ');
  }, [familias.items, grupos.items, subgrupos.items, classes.items]);

  const normalizeForCompare = (s: string | null | undefined) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');

  const isProductNameAuto = useCallback((p: Product): boolean => {
    const generated = recalcularDescricao({
      family_id: p.family_id, grupo_id: p.grupo_id, subgrupo_id: p.subgrupo_id,
      class_id: p.class_id, nome_impresso: (p as any).nome_impresso || '', erp_versao: p.erp_versao || '',
    } as any);
    return normalizeForCompare(p.name) === normalizeForCompare(generated);
  }, [recalcularDescricao]);

  const replaceVersionInName = (name: string, prev: string, next: string): string => {
    if (!name || !prev || !next || prev === next) return name;
    const escaped = prev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return name.replace(new RegExp(escaped, 'gi'), next);
  };

  const recalcularFatorMilheiro = (data: FormData) => {
    if (data.fator_kg && data.width && data.length && data.thickness) {
      return calcularFatorMilheiro(data.fator_kg, data.width, data.length, data.thickness);
    }
    return 0;
  };

  const checkAutoDescriptionByTipo = useCallback((tipoId: string | undefined): boolean => {
    if (!tipoId) return false;
    const tipoItem = tipos.items.find((t) => t.id === tipoId);
    return tipoItem?.label?.toLowerCase() === 'produto acabado';
  }, [tipos.items]);

  const normalizePrintedName = (value?: string | null) => {
    const normalized = value?.trim().toUpperCase();
    return normalized ? normalized : null;
  };

  // Populate form when product loads
  useEffect(() => {
    if (!product) return;
    setThicknessInput(formatDimensionInput(product.thickness));
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      tipo_id: product.tipo_id || undefined,
      unit_measure: product.unit_measure || 'mil',
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
      ficha_tecnica: ((product as any).ficha_tecnica || {}) as FichaTecnicaData,
    });
    setSelectedVersionId(product.id);
    setUnlockErpCode(false);
    setUnlockDescription(false);
  }, [product]);

  // After lookups load, set isAutoDescription
  useEffect(() => {
    if (!product || tipos.items.length === 0) return;
    setIsAutoDescription(isProductNameAuto(product));
  }, [product, tipos.items, isProductNameAuto]);

  const getDuplicateErrorMessage = (error: any) => {
    const t = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
    if (t.includes('products_sku_unique_key') || t.includes('(sku_unique)')) return 'Já existe um produto com este SKU.';
    if (t.includes('idx_products_technical_uniqueness')) return 'Já existe um produto ativo com essa mesma estrutura técnica.';
    if (t.includes('erp_product_code')) return 'Já existe outro produto com este Código ERP.';
    if (error?.code === '23505') return 'Dados únicos já cadastrados.';
    return null;
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const fatorMilheiro = calcularFatorMilheiro(data.fator_kg || 0, data.width || 0, data.length || 0, data.thickness || 0);
      const { data: updatedProduct, error } = await supabase.from('products').update({ ...data, fator_milheiro: fatorMilheiro, origem_alteracao: 'CRM' } as any).eq('id', id).select('*').single();
      if (error) throw error;
      return updatedProduct as Product;
    },
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-all'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-general-edit', productId] });
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      for (const keys of extraInvalidations) {
        queryClient.invalidateQueries({ queryKey: keys });
      }
      const versionsKey = (updatedProduct as any).parent_product_id ?? updatedProduct.id;
      queryClient.invalidateQueries({ queryKey: ['product-versions', versionsKey] });
      toast.success('Produto atualizado com sucesso!');
      onSaved?.();
    },
    onError: (error: any) => {
      const msg = getDuplicateErrorMessage(error);
      toast.error(msg || error?.message || 'Erro ao atualizar produto', { duration: 8000 });
    },
  });

  const computeStructuralChanges = (submitData: FormData): StructuralFieldChange[] => {
    if (!product) return [];
    const orig = product as any;
    const lookupLabel = (items: any[], id?: string | null) => items.find((i) => i.id === id)?.label || '';
    const diffs: StructuralFieldChange[] = [];
    const push = (label: string, from: any, to: any) => {
      const f = from == null || from === '' ? '' : String(from);
      const t2 = to == null || to === '' ? '' : String(to);
      if (f !== t2) diffs.push({ label, from: f, to: t2 });
    };
    push('Tipo', lookupLabel(tipos.items, orig.tipo_id), lookupLabel(tipos.items, submitData.tipo_id));
    push('Família', lookupLabel(familias.items, orig.family_id), lookupLabel(familias.items, submitData.family_id));
    push('Grupo', lookupLabel(grupos.items, orig.grupo_id), lookupLabel(grupos.items, submitData.grupo_id));
    push('Subgrupo', lookupLabel(subgrupos.items, orig.subgrupo_id), lookupLabel(subgrupos.items, submitData.subgrupo_id));
    push('Classe', lookupLabel(classes.items, orig.class_id), lookupLabel(classes.items, submitData.class_id));
    push('Largura', orig.width, submitData.width);
    push('Comprimento', orig.length, submitData.length);
    push('Espessura', orig.thickness, submitData.thickness);
    return diffs;
  };

  const persistSave = (submitData: FormData) => {
    updateMutation.mutate({ id: productId, ...submitData });
  };

  const executeSave = (submitData: FormData) => {
    if (product && submitData.sku && submitData.sku !== product.sku) {
      const changes = computeStructuralChanges(submitData);
      setStructuralChangePayload({ submitData, changes, currentSku: product.sku, currentName: product.name });
      setShowStructuralChange(true);
      return;
    }
    persistSave(submitData);
  };

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('Descrição é obrigatória'); return; }
    if (!formData.sku) { toast.error('SKU não foi gerado. Preencha os campos de classificação.'); return; }

    const erpRequiredErrors: string[] = [];
    if (!formData.grupo_id) erpRequiredErrors.push('Grupo');
    if (!formData.subgrupo_id) erpRequiredErrors.push('Subgrupo');
    if (!formData.family_id) erpRequiredErrors.push('Família');
    if (!formData.class_id) erpRequiredErrors.push('Classe');
    if (!formData.tipo_id) erpRequiredErrors.push('Tipo de item');
    if (!formData.tipo_ficha) erpRequiredErrors.push('Tipo de ficha');
    if (!formData.unit_measure?.trim()) erpRequiredErrors.push('Unidade de medida');
    const ncmDigits = (formData.ncm_code ?? '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(ncmDigits)) erpRequiredErrors.push('NCM (8 dígitos)');
    if (erpRequiredErrors.length > 0) {
      toast.error(`Campos obrigatórios para sincronização ERP:\n• ${erpRequiredErrors.join('\n• ')}`, { duration: 7000 });
      return;
    }

    const profile = getGroupProfile(formData.grupo_id);
    const missingFields = validateRequiredFields(formData as any, profile);
    if (missingFields.length > 0) {
      toast.error(`Campos obrigatórios não preenchidos:\n• ${missingFields.join('\n• ')}`, { duration: 6000 });
      return;
    }

    const submitData = { ...formData };
    submitData.nome_impresso = normalizePrintedName(submitData.nome_impresso) || '';
    const erpCodeTrim = (submitData.erp_product_code ?? '').trim();
    submitData.erp_product_code = (erpCodeTrim || null) as any;

    const tipoValue = tipos.items.find((t) => t.id === submitData.tipo_id)?.value;
    if (tipoValue) submitData.tipo_item = tipoValue;

    submitData.erp_grupo = grupos.items.find((g) => g.id === submitData.grupo_id)?.label?.trim() || '';
    submitData.erp_subgrupo = subgrupos.items.find((s) => s.id === submitData.subgrupo_id)?.label?.trim() || '';

    if (hasAutoDimensions(profile)) {
      try {
        const version = generateErpVersion(profile, submitData.width, submitData.length, submitData.thickness, extractGusset(submitData.ficha_tecnica));
        if (version) submitData.erp_versao = version;
      } catch (err) {
        if (err instanceof VersionGenerationError) { toast.error(err.message); return; }
        throw err;
      }
    } else if (!submitData.erp_versao || submitData.erp_versao.trim() === '') {
      toast.error('O campo Versão (ERP) é obrigatório.'); return;
    }

    executeSave(submitData);
  };

  const loadVersion = async (versionId: string) => {
    const { data, error } = await supabase.from('products').select('*').eq('id', versionId).single();
    if (error || !data) { toast.error('Erro ao carregar versão'); return; }
    const p = data as unknown as Product;
    setThicknessInput(formatDimensionInput(p.thickness));
    setFormData({
      sku: p.sku, name: p.name, description: p.description || '', tipo_id: p.tipo_id || undefined,
      unit_measure: p.unit_measure || 'mil', unit_price: p.unit_price || 0,
      fator_kg: p.fator_kg || 0, fator_milheiro: p.fator_milheiro || 0,
      grupo_id: p.grupo_id || undefined, subgrupo_id: p.subgrupo_id || undefined,
      family_id: p.family_id || undefined, class_id: p.class_id || undefined,
      width: p.width || 0, length: p.length || 0, thickness: p.thickness || 0,
      active: p.active ?? true, nome_impresso: (p as any).nome_impresso || '',
      ncm_code: p.ncm_code || '', ncm_id: p.ncm_id, cst_icms: p.cst_icms || '',
      csosn: p.csosn || '', aliquota_icms: p.aliquota_icms, tem_icms_st: p.tem_icms_st || false,
      aliquota_ipi: p.aliquota_ipi, cst_pis_cofins: p.cst_pis_cofins || '',
      aliquota_pis: p.aliquota_pis, aliquota_cofins: p.aliquota_cofins,
      tipo_produto_fiscal: p.tipo_produto_fiscal, ncm_validated_at: p.ncm_validated_at || null,
      erp_product_code: (p as any).erp_product_code || '', tipo_item: p.tipo_item || '',
      tipo_ficha: p.tipo_ficha, erp_grupo: p.erp_grupo || '', erp_subgrupo: p.erp_subgrupo || '',
      erp_empresa: p.erp_empresa || 1, erp_versao: p.erp_versao || '',
      erp_versao_detalhes: p.erp_versao_detalhes || '', erp_versao_roteiro: p.erp_versao_roteiro,
      erp_versao_situacao: p.erp_versao_situacao || 'A',
      ficha_tecnica: ((p as any).ficha_tecnica || {}) as FichaTecnicaData,
    });
    setSelectedVersionId(versionId);
    setIsAutoDescription(isProductNameAuto(p));
    setUnlockErpCode(false);
  };

  const currentDimensionProfile = getGroupProfile(formData.grupo_id);
  const isChildVersion = !!(product as any)?.parent_product_id;
  const canEditProducts = can('products', 'edit' as any);
  const structuralLocked = false;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  if (!product) {
    return <div className="p-4 text-sm text-muted-foreground">Produto não encontrado.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alterações em campos estruturais (tipo, classificação ou dimensões) irão{' '}
            <strong>regenerar o SKU</strong>. Uma confirmação será solicitada ao salvar.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          {/* NCM */}
          <div className="col-span-2">
            <NCMSelector
              value={formData.ncm_code}
              onChange={(ncmCode, ncm) => {
                const officialIpi = ncm?.aliquota_ipi_oficial ?? null;
                const shouldAutoFill = !formData.aliquota_ipi && officialIpi != null;
                setFormData({ ...formData, ncm_code: ncmCode, ncm_id: ncm?.id, ...(shouldAutoFill ? { aliquota_ipi: officialIpi } : {}) });
              }}
              productDescription={`${formData.name} ${formData.description || ''}`}
              onValidationChange={(result) => {
                if (result) setFormData(prev => ({ ...prev, ncm_validated_at: new Date().toISOString() }));
              }}
            />
          </div>

          {/* Descrição + Código ERP */}
          <div className="col-span-2 grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <div className="flex items-center justify-between h-7">
                <Label htmlFor="pgef-name">Descrição *</Label>
                {isAdmin && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                    onClick={() => {
                      if (unlockDescription) {
                        setUnlockDescription(false); setIsAutoDescription(true);
                        setFormData(prev => ({ ...prev, name: recalcularDescricao(prev) }));
                        return;
                      }
                      const ok = window.confirm('Atenção: a Descrição é gerada automaticamente. Deseja editar manualmente?');
                      if (ok) setUnlockDescription(true);
                    }}>
                    {unlockDescription ? 'Cancelar edição' : 'Editar (admin)'}
                  </Button>
                )}
              </div>
              <Input id="pgef-name" value={formData.name}
                onChange={(e) => { if (!unlockDescription) return; setFormData({ ...formData, name: e.target.value }); setIsAutoDescription(false); }}
                onBlur={() => { if (!unlockDescription && !formData.name?.trim() && checkAutoDescriptionByTipo(formData.tipo_id)) { setIsAutoDescription(true); setFormData(prev => ({ ...prev, name: recalcularDescricao(prev) })); } }}
                placeholder={isAutoDescription ? 'Descrição gerada automaticamente' : 'Digite a descrição'}
                required readOnly={!unlockDescription}
                className={!unlockDescription ? 'bg-muted cursor-not-allowed' : ''} />
              <p className="text-xs text-muted-foreground mt-1">
                {unlockDescription ? 'Edição liberada.' : 'Gerada automaticamente. Admins podem desbloquear.'}
              </p>
            </div>
            <div className="col-span-1">
              <div className="flex items-center justify-between h-7">
                <Label htmlFor="pgef-erp_code">Código ERP</Label>
                {isAdmin && !!(product as any)?.erp_product_code && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                    onClick={() => {
                      if (unlockErpCode) { setUnlockErpCode(false); return; }
                      const ok = window.confirm('Alterar o Código ERP pode quebrar o vínculo. Deseja continuar?');
                      if (ok) setUnlockErpCode(true);
                    }}>
                    {unlockErpCode ? 'Cancelar edição' : 'Editar (admin)'}
                  </Button>
                )}
              </div>
              <Input id="pgef-erp_code" value={formData.erp_product_code || ''}
                onChange={(e) => setFormData({ ...formData, erp_product_code: e.target.value })}
                placeholder="Opcional"
                readOnly={!!(product as any)?.erp_product_code && !unlockErpCode}
                className={(product as any)?.erp_product_code && !unlockErpCode ? 'bg-muted cursor-not-allowed' : ''} />
              <p className="text-xs text-muted-foreground mt-1">
                {(product as any)?.erp_product_code && !unlockErpCode ? 'Vinculado ao ERP — bloqueado.' : unlockErpCode ? 'Edição liberada.' : 'Deixe em branco para o ERP gerar.'}
              </p>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <Label>Tipo *</Label>
            <Select value={formData.tipo_id || 'none'} disabled={structuralLocked}
              onValueChange={(v) => {
                const newTipoId = v === 'none' ? undefined : v;
                const shouldAuto = checkAutoDescriptionByTipo(newTipoId);
                setIsAutoDescription(shouldAuto);
                const updated = { ...formData, tipo_id: newTipoId };
                updated.sku = recalcularSku(updated);
                if (shouldAuto) updated.name = recalcularDescricao(updated);
                setFormData(updated);
              }}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {tipos.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* SKU */}
          <div>
            <Label>Código (SKU)</Label>
            <Input value={formData.sku} readOnly disabled={structuralLocked} className="bg-muted/50 font-mono cursor-not-allowed" placeholder="Gerado automaticamente" />
            <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente a partir da classificação</p>
          </div>

          {/* Família */}
          <div>
            <Label>Família</Label>
            <Select value={formData.family_id || 'none'} disabled={structuralLocked}
              onValueChange={(v) => {
                const updated = { ...formData, family_id: v === 'none' ? undefined : v };
                updated.sku = recalcularSku(updated);
                if (!unlockDescription) updated.name = recalcularDescricao(updated);
                setFormData(updated);
              }}>
              <SelectTrigger><SelectValue placeholder="Selecione a família" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {familias.items.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade + Tipo Ficha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Unidade</Label>
              <Select value={formData.unit_measure} onValueChange={(v) => setFormData({ ...formData, unit_measure: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unitMeasures.items.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Ficha <span className="text-destructive">*</span></Label>
              <Select value={formData.tipo_ficha ? String(formData.tipo_ficha) : ''} onValueChange={(v) => setFormData({ ...formData, tipo_ficha: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Classificação Complementar */}
          <div className="col-span-2 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Classificação Complementar</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Grupo</Label>
                <Select value={formData.grupo_id || 'none'} disabled={structuralLocked}
                  onValueChange={(v) => {
                    const newGrupoId = v === 'none' ? undefined : v;
                    const updated = { ...formData, grupo_id: newGrupoId };
                    if (newGrupoId && updated.subgrupo_id) {
                      const allowed = linksByGroup[newGrupoId] || [];
                      if (allowed.length > 0 && !allowed.includes(updated.subgrupo_id)) updated.subgrupo_id = undefined;
                    }
                    updated.sku = recalcularSku(updated);
                    if (!unlockDescription) updated.name = recalcularDescricao(updated);
                    setFormData(updated);
                  }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {grupos.items.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subgrupo</Label>
                {(() => {
                  const allowedIds = formData.grupo_id ? (linksByGroup[formData.grupo_id] || []) : [];
                  const useFilter = !!formData.grupo_id && allowedIds.length > 0;
                  const visibleSubgrupos = useFilter ? subgrupos.items.filter(s => allowedIds.includes(s.id)) : subgrupos.items;
                  return (
                    <Select value={formData.subgrupo_id || 'none'} disabled={structuralLocked}
                      onValueChange={(v) => {
                        const updated = { ...formData, subgrupo_id: v === 'none' ? undefined : v };
                        updated.sku = recalcularSku(updated);
                        if (!unlockDescription) updated.name = recalcularDescricao(updated);
                        setFormData(updated);
                      }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {visibleSubgrupos.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              <div>
                <Label>Classe</Label>
                <SearchableSelect
                  options={classes.items.map((c) => ({ value: c.id, label: c.label }))}
                  value={formData.class_id || null} disabled={structuralLocked}
                  placeholder="Selecione" searchPlaceholder="Buscar classe..." emptyMessage="Nenhuma classe encontrada."
                  onChange={(v) => {
                    const updated = { ...formData, class_id: v || undefined };
                    updated.sku = recalcularSku(updated);
                    if (!unlockDescription) updated.name = recalcularDescricao(updated);
                    setFormData(updated);
                  }} />
              </div>
            </div>
          </div>

          {/* Nome Complementar */}
          <div className="col-span-2 pt-2">
            <Label>Nome Complementar</Label>
            <Input value={formData.nome_impresso}
              onChange={(e) => {
                const updated = { ...formData, nome_impresso: e.target.value };
                if (!unlockDescription) updated.name = recalcularDescricao(updated);
                setFormData(updated);
              }}
              placeholder="Ex: BONGOS BIFINHO CARNE 65G" className="uppercase" />
            <p className="text-xs text-muted-foreground mt-1">Informação adicional do cliente/produto (opcional)</p>
          </div>

          {/* Sanfona */}
          {(() => {
            const fichaProfile = (grupos.items as GroupLookupItem[]).find(g => g.id === formData.grupo_id)?.ficha_profile || 'none';
            const isStandUpGroup = fichaProfile === 'stand_up_liso' || fichaProfile === 'stand_up_impresso';
            const isSacoGroup = fichaProfile === 'saco_liso' || fichaProfile === 'saco_impresso';
            const nameHasSanfona = /sanfona/i.test(`${formData.name || ''} ${formData.nome_impresso || ''}`);
            const sanfonaRequired = isStandUpGroup || nameHasSanfona;
            const showSanfona = isStandUpGroup || isSacoGroup || sanfonaRequired;
            if (!showSanfona) return null;
            const sanfona = (formData.ficha_tecnica as any)?.sanfona || {};
            const sanfonaAtiva = sanfonaRequired ? true : !!sanfona.ativa;
            const updateSanfona = (patch: { ativa?: boolean; local?: 'Lateral' | 'Fundo'; valor?: number | undefined }) => {
              const nextFicha = { ...(formData.ficha_tecnica || {}), sanfona: { ...sanfona, ...patch } };
              const newData: any = { ...formData, ficha_tecnica: nextFicha };
              const prof = getGroupProfile(newData.grupo_id);
              if (hasAutoDimensions(prof)) newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness, extractGusset(nextFicha));
              newData.sku = recalcularSku(newData);
              if (!unlockDescription) newData.name = recalcularDescricao(newData);
              else newData.name = replaceVersionInName(newData.name, formData.erp_versao, newData.erp_versao);
              setFormData(newData);
            };
            return (
              <div className="col-span-2 pt-2">
                <section className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Sanfona</h4>
                      <p className="text-xs text-muted-foreground">{sanfonaRequired ? 'Obrigatória.' : 'Ative se este produto possui sanfona.'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sanfonaRequired && <Badge variant="destructive" className="text-xs">Obrigatória</Badge>}
                      <Switch checked={sanfonaAtiva} disabled={sanfonaRequired}
                        onCheckedChange={(checked) => {
                          if (sanfonaRequired) return;
                          if (checked) { updateSanfona({ ativa: true }); }
                          else {
                            const nextFicha = { ...(formData.ficha_tecnica || {}), sanfona: { ativa: false } };
                            const newData: any = { ...formData, ficha_tecnica: nextFicha };
                            const prof = getGroupProfile(newData.grupo_id);
                            if (hasAutoDimensions(prof)) newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness, extractGusset(nextFicha));
                            newData.sku = recalcularSku(newData);
                            if (!unlockDescription) newData.name = recalcularDescricao(newData);
                            setFormData(newData);
                          }
                        }} />
                    </div>
                  </div>
                  {sanfonaAtiva && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Localização *</Label>
                        <Select value={sanfona.local || undefined} onValueChange={(v) => updateSanfona({ ativa: true, local: v as 'Lateral' | 'Fundo' })}>
                          <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lateral">Lateral (compõe Largura)</SelectItem>
                            <SelectItem value="Fundo">Fundo (compõe Comprimento)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Valor da sanfona (mm) *</Label>
                        <Input type="number" step="0.01" min="0" value={sanfona.valor ?? ''}
                          onChange={(e) => { const raw = e.target.value; const n = raw === '' ? undefined : parseFloat(raw.replace(',', '.')); updateSanfona({ ativa: true, valor: Number.isFinite(n as number) ? (n as number) : undefined }); }}
                          placeholder="Ex.: 30" />
                      </div>
                    </div>
                  )}
                </section>
              </div>
            );
          })()}

          {/* Dimensões */}
          <div className="col-span-2 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Dimensões</h3>
            <div className={`grid gap-4 ${currentDimensionProfile === 'partial' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div>
                <Label>Largura (mm)</Label>
                <Input type="number" step="0.01" min="0" disabled={structuralLocked} value={formData.width || ''}
                  onChange={(e) => {
                    const newWidth = parseFloat(e.target.value) || 0;
                    const newData: any = { ...formData, width: newWidth };
                    newData.fator_milheiro = recalcularFatorMilheiro(newData);
                    const prof = getGroupProfile(newData.grupo_id);
                    if (hasAutoDimensions(prof)) newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness, extractGusset(newData.ficha_tecnica));
                    newData.sku = recalcularSku(newData);
                    if (!unlockDescription) newData.name = recalcularDescricao(newData);
                    else newData.name = replaceVersionInName(newData.name, formData.erp_versao, newData.erp_versao);
                    setFormData(newData);
                  }} placeholder="Em milímetros" />
              </div>
              {currentDimensionProfile !== 'partial' && (
                <div>
                  <Label>Comprimento (mm)</Label>
                  <Input type="number" step="0.01" min="0" disabled={structuralLocked} value={formData.length || ''}
                    onChange={(e) => {
                      const newLength = parseFloat(e.target.value) || 0;
                      const newData: any = { ...formData, length: newLength };
                      newData.fator_milheiro = recalcularFatorMilheiro(newData);
                      const prof = getGroupProfile(newData.grupo_id);
                      if (hasAutoDimensions(prof)) newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness, extractGusset(newData.ficha_tecnica));
                      newData.sku = recalcularSku(newData);
                      if (!unlockDescription) newData.name = recalcularDescricao(newData);
                      else newData.name = replaceVersionInName(newData.name, formData.erp_versao, newData.erp_versao);
                      setFormData(newData);
                    }} placeholder="Em milímetros" />
                </div>
              )}
              <div>
                <Label>Espessura (micras)</Label>
                <Input type="text" inputMode="decimal" disabled={structuralLocked} value={thicknessInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw !== '' && !/^\d*(?:[,.]\d*)?$/.test(raw)) return;
                    setThicknessInput(raw);
                    const normalized = raw.replace(',', '.');
                    const newThickness = normalized === '' || normalized === '.' ? 0 : parseFloat(normalized) || 0;
                    const newData: any = { ...formData, thickness: newThickness };
                    newData.fator_milheiro = recalcularFatorMilheiro(newData);
                    const prof = getGroupProfile(newData.grupo_id);
                    if (hasAutoDimensions(prof)) newData.erp_versao = tryGenerateErpVersion(prof, newData.width, newData.length, newData.thickness, extractGusset(newData.ficha_tecnica));
                    newData.sku = recalcularSku(newData);
                    if (!unlockDescription) newData.name = recalcularDescricao(newData);
                    else newData.name = replaceVersionInName(newData.name, formData.erp_versao, newData.erp_versao);
                    setFormData(newData);
                  }} placeholder="Ex.: 0,120" />
              </div>
            </div>
          </div>

          {/* Versão */}
          {formData.erp_versao && (
            <div className="col-span-2">
              <Label className="text-muted-foreground">Versão do Produto</Label>
              <Input value={formData.erp_versao} readOnly className="bg-muted/50 font-mono" />
              <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente a partir das dimensões</p>
            </div>
          )}

          {/* Observações */}
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Observações técnicas do produto" />
          </div>

          {/* Versões */}
          <div className="col-span-2 pt-4 border-t mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Versões</h3>
              {isChildVersion && <Badge variant="outline" className="text-[10px]">editando v{(product as any).versao_numero}</Badge>}
            </div>
            <ProductVersionsTab productId={productId} canEdit={canEditProducts} selectedVersionId={selectedVersionId} onSelectVersion={loadVersion} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t bg-background">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" onClick={handleSubmit} disabled={updateMutation.isPending || isCheckingDuplicate}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Structural change dialog */}
      {structuralChangePayload && (
        <ConfirmStructuralChangeDialog
          open={showStructuralChange}
          onOpenChange={(o) => { setShowStructuralChange(o); if (!o) setStructuralChangePayload(null); }}
          currentSku={structuralChangePayload.currentSku}
          newSku={structuralChangePayload.submitData.sku}
          currentName={structuralChangePayload.currentName}
          newName={structuralChangePayload.submitData.name}
          changes={structuralChangePayload.changes}
          onConfirm={() => { const data = structuralChangePayload.submitData; setStructuralChangePayload(null); persistSave(data); }}
          onDuplicate={() => { setStructuralChangePayload(null); toast.info('Use o botão Duplicar no catálogo de produtos para criar uma nova variação.'); }}
        />
      )}
    </div>
  );
}
