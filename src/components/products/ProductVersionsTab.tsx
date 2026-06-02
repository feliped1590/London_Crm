import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
  onEditVersion?: (productId: string) => void;
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
 * Lista todas as versões (pai + filhos) de um item. Cada versão é independente:
 * SKU, descrição, erp_versao e ficha técnica são por versão. Alterações em uma
 * versão NÃO se propagam para outras.
 */
export function ProductVersionsTab({ productId, canEdit, onEditVersion }: ProductVersionsTabProps) {
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
      // Load parent's full row to inherit identity/lookups
      const { data: parent, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', data.parentId)
        .single();
      if (pErr || !parent) throw pErr ?? new Error('Pai não encontrado');

      const profile = getGroupProfile(grupos.items, parent.grupo_id);

      // erp_versao próprio da nova versão
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

      // SKU estrutural próprio
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

      // Descrição (cadastro completo) própria
      const baseName = generateProductDescription({
        family: getLookupLabel(familias.items, parent.family_id),
        group: getLookupLabel(grupos.items, parent.grupo_id),
        subgroup: getLookupLabel(subgrupos.items, parent.subgrupo_id),
        productClass: getLookupLabel(classes.items, parent.class_id),
        printedName: (parent as any).nome_impresso?.trim() || undefined,
      });
      const childName = [baseName, erpVersao].filter(Boolean).join(' ');

      // Build child payload: strip identity-fixed/auto fields, override per-version data
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

      // Clona ficha técnica do pai como ponto de partida — versão evolui de forma independente.
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

      const { error: insErr } = await supabase.from('products').insert(childPayload);
      if (insErr) throw insErr;

      toast.success('Nova versão criada');
      setNewW('');
      setNewL('');
      setNewT('');
      qc.invalidateQueries({ queryKey: ['product-versions', productId] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-search'] });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar versão');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (v: VersionRow) => {
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
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        Cada versão é independente: <strong>SKU</strong>, <strong>descrição</strong>,{' '}
        <strong>erp_versao</strong> e <strong>ficha técnica</strong> são por versão.
        Identidade (família, grupo, subgrupo, classe, código ERP) é compartilhada na criação.
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 w-12">Vers.</th>
              <th className="px-3 py-2 whitespace-nowrap">Dimensões (L × C × E)</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">erp_versao</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-t align-top">
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
                <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                <td className="px-3 py-2 font-mono text-xs">{v.erp_versao || '—'}</td>
                <td className="px-3 py-2 text-xs max-w-[280px]">{v.name || '—'}</td>
                <td className="px-3 py-2">
                  <Badge variant={v.active ? 'default' : 'secondary'}>
                    {v.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canEdit && onEditVersion && v.id !== productId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditVersion(v.id)}
                      title="Editar esta versão"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEdit && v.parent_product_id !== null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(v)}
                    >
                      {v.active ? 'Inativar' : 'Reativar'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
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
