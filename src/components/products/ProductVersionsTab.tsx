import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProductLookups, type LookupItem } from '@/hooks/useProductLookups';
import { getGroupProfile } from '@/utils/products/getGroupProfile';
import {
  generateErpVersion,
  extractGusset,
  VersionGenerationError,
} from '@/utils/products/generateVersion';
import { generateStructuralSku } from '@/utils/products/generateStructuralSku';
import { generateProductDescription } from '@/utils/products/generateProductDescription';

interface ProductVersionsTabProps {
  productId: string;
  canEdit: boolean;
  selectedVersionId?: string | null;
  onSelectVersion?: (productId: string) => void;
}

interface VersionRow {
  id: string;
  parent_product_id: string | null;
  versao_numero: number;
  sku: string;
  name: string | null;
  width: number | null;
  length: number | null;
  thickness: number | null;
  erp_versao: string | null;
  erp_product_code: string | null;
  active: boolean;
}

const getLookupValue = (items: LookupItem[], id?: string | null) =>
  id ? items.find((i) => i.id === id)?.value : undefined;
const getLookupLabel = (items: { id: string; label: string }[], id?: string | null) =>
  id ? items.find((i) => i.id === id)?.label : undefined;

/**
 * Grade de versões: cada linha é uma versão independente. Clique seleciona
 * a versão e o formulário superior passa a editá-la. Status (ativa/inativa)
 * vive somente aqui.
 */
export function ProductVersionsTab({
  productId,
  canEdit,
  selectedVersionId,
  onSelectVersion,
}: ProductVersionsTabProps) {
  const qc = useQueryClient();
  const { tipos, grupos, subgrupos, familias, classes } = useProductLookups();
  const [newW, setNewW] = useState<string>('');
  const [newL, setNewL] = useState<string>('');
  const [newT, setNewT] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['product-versions', productId],
    queryFn: async () => {
      const { data: self } = await supabase
        .from('products')
        .select('id, parent_product_id')
        .eq('id', productId)
        .single();
      const parentId = self?.parent_product_id ?? self?.id ?? productId;

      const { data: versions, error } = await supabase
        .from('products')
        .select('id, parent_product_id, versao_numero, sku, name, width, length, thickness, erp_versao, erp_product_code, active')
        .or(`id.eq.${parentId},parent_product_id.eq.${parentId}`)
        .order('versao_numero', { ascending: true });
      if (error) throw error;
      return { parentId, versions: (versions ?? []) as VersionRow[] };
    },
    enabled: !!productId,
  });

  const handleCreate = async () => {
    if (!data?.parentId) return;
    const w = Number(newW.replace(',', '.'));
    const l = Number(newL.replace(',', '.'));
    const t = Number(newT.replace(',', '.'));
    if (!w || !l || !t) {
      toast.error('Informe largura, comprimento e espessura');
      return;
    }
    const dup = data.versions.find(
      (v) =>
        Number(v.width) === w &&
        Number(v.length) === l &&
        Number(v.thickness) === t,
    );
    if (dup) {
      toast.error(`Já existe a versão ${dup.versao_numero} com essas dimensões`);
      return;
    }

    setCreating(true);
    try {
      const { data: parent, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', data.parentId)
        .single();
      if (pErr || !parent) throw pErr ?? new Error('Pai não encontrado');

      const profile = getGroupProfile(grupos.items, parent.grupo_id);

      let erpVersao = '';
      try {
        erpVersao =
          generateErpVersion(profile, w, l, t, extractGusset((parent as any).ficha_tecnica)) || '';
      } catch (err) {
        if (err instanceof VersionGenerationError) {
          toast.error(err.message);
          setCreating(false);
          return;
        }
        throw err;
      }

      const childSku = generateStructuralSku({
        tipoCode: getLookupValue(tipos.items, parent.tipo_id),
        familyCode: getLookupValue(familias.items, parent.family_id),
        groupCode: getLookupValue(grupos.items as LookupItem[], parent.grupo_id),
        subgroupCode: getLookupValue(subgrupos.items, parent.subgrupo_id),
        classCode: getLookupValue(classes.items, parent.class_id),
        width: w,
        length: l,
        thickness: t,
        dimensionProfile: profile,
      });

      const baseName = generateProductDescription({
        family: getLookupLabel(familias.items, parent.family_id),
        group: getLookupLabel(grupos.items, parent.grupo_id),
        subgroup: getLookupLabel(subgrupos.items, parent.subgrupo_id),
        productClass: getLookupLabel(classes.items, parent.class_id),
        printedName: (parent as any).nome_impresso?.trim() || undefined,
      });
      const childName = [baseName, erpVersao].filter(Boolean).join(' ');

      const {
        id: _id,
        sku: _sku,
        sku_unique: _su,
        created_at: _ca,
        updated_at: _ua,
        crm_last_update_at: _cu,
        erp_versao: _ev,
        erp_hash: _eh,
        erp_last_sync_at: _es,
        erp_synced_at: _esy,
        structure_hash: _sh,
        versao_numero: _vn,
        parent_product_id: _pp,
        ...inherit
      } = parent as any;

      const fichaClone = JSON.parse(JSON.stringify((parent as any).ficha_tecnica ?? {}));

      const childPayload: any = {
        ...inherit,
        parent_product_id: data.parentId,
        width: w,
        length: l,
        thickness: t,
        active: true,
        origem_alteracao: 'CRM',
        pendente_envio: true,
        sku: childSku || `${parent.sku || 'TEMP'}-v`,
        name: childName || parent.name,
        erp_versao: erpVersao || null,
        ficha_tecnica: fichaClone,
      };

      const { data: inserted, error: insErr } = await supabase
        .from('products')
        .insert(childPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      toast.success('Nova versão criada');
      setNewW('');
      setNewL('');
      setNewT('');
      qc.invalidateQueries({ queryKey: ['product-versions', productId] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-search'] });
      if (inserted?.id && onSelectVersion) {
        onSelectVersion(inserted.id);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar versão');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, v: VersionRow) => {
    e.stopPropagation();
    if (!canEdit) return;
    const { error } = await supabase
      .from('products')
      .update({ active: !v.active, origem_alteracao: 'CRM' })
      .eq('id', v.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['product-versions', productId] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['products-search'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const versions = data?.versions ?? [];

  return (
    <div className="w-full space-y-4">
      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        Clique em uma versão para editá-la no formulário acima. Cada versão tem{' '}
        <strong>dimensões, sanfona, SKU, descrição, erp_versao, ficha técnica e status</strong>{' '}
        próprios. Identidade (família, grupo, subgrupo, classe, código ERP) é compartilhada.
      </div>

      <div className="w-full rounded-md border overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-3 py-2 w-16">Vers.</th>
              <th className="px-3 py-2 whitespace-nowrap w-44">Dimensões (L × C × E)</th>
              <th className="px-3 py-2 w-56">SKU</th>
              <th className="px-3 py-2 w-32">erp_versao</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2 w-24">Status</th>
              <th className="px-3 py-2 text-right w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const isSelected = v.id === selectedVersionId;
              return (
                <tr
                  key={v.id}
                  onClick={() => onSelectVersion?.(v.id)}
                  className={cn(
                    'border-t align-top cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-l-primary'
                      : 'hover:bg-accent/50 border-l-4 border-l-transparent',
                  )}
                >
                  <td className="px-3 py-2 font-mono">
                    v{v.versao_numero}
                    {v.parent_product_id === null && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        principal
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {v.width ?? '—'} × {v.length ?? '—'} × {v.thickness ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{v.sku}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.erp_versao || '—'}</td>
                  <td className="px-3 py-2 text-xs">{v.name || '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={v.active ? 'default' : 'secondary'}>
                      {v.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canEdit && v.parent_product_id !== null && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleToggleActive(e, v)}
                      >
                        {v.active ? 'Inativar' : 'Reativar'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Copy className="h-4 w-4" />
            Nova versão (mesma identidade, dimensões diferentes)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>Largura</Label>
              <Input
                value={newW}
                onChange={(e) => setNewW(e.target.value)}
                placeholder="ex: 15"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Comprimento</Label>
              <Input
                value={newL}
                onChange={(e) => setNewL(e.target.value)}
                placeholder="ex: 30"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Espessura</Label>
              <Input
                value={newT}
                onChange={(e) => setNewT(e.target.value)}
                placeholder="ex: 0,09"
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar versão
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
