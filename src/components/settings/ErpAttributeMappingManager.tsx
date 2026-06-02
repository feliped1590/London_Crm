import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Catalog = {
  id: string;
  tenant_id: string;
  erp_codigo: number;
  descricao: string;
  tipo: string;
  grupo_tecnico: string | null;
  unidade: string | null;
  tolerancia_mais: number | null;
  tolerancia_menos: number | null;
  aceita_tolerancia: boolean;
  obrigatorio: boolean;
  ativo: boolean;
  observacoes: string | null;
};

type Mapping = {
  id: string;
  tenant_id: string;
  attribute_catalog_id: string;
  crm_source: 'ficha_tecnica' | 'product_column' | 'derived';
  crm_path: string;
  crm_label: string | null;
  transform: string | null;
  ativo: boolean;
};

const EMPTY_CATALOG: Partial<Catalog> = {
  erp_codigo: 0,
  descricao: '',
  tipo: 'number',
  grupo_tecnico: '',
  aceita_tolerancia: true,
  obrigatorio: false,
  ativo: true,
};

const EMPTY_MAPPING: Partial<Mapping> = {
  crm_source: 'ficha_tecnica',
  crm_path: '',
  crm_label: '',
  ativo: true,
};

export function ErpAttributeMappingManager() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('catalog');

  // Tenant atual
  const { data: tenantId } = useQuery({
    queryKey: ['current-tenant-id'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_current_user_tenant_id' as any).maybeSingle();
      if (data) return data as string;
      const { data: ut } = await supabase.from('user_tenants').select('tenant_id').limit(1).maybeSingle();
      return ut?.tenant_id ?? null;
    },
  });

  const catalogQ = useQuery({
    queryKey: ['erp-attribute-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('erp_attribute_catalog' as any)
        .select('*')
        .order('erp_codigo');
      if (error) throw error;
      return ((data ?? []) as unknown) as Catalog[];
    },
  });

  const mappingQ = useQuery({
    queryKey: ['product-attribute-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_attribute_mapping' as any)
        .select('*');
      if (error) throw error;
      return ((data ?? []) as unknown) as Mapping[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atributos ERP (Ficha Técnica)</CardTitle>
        <CardDescription>
          Catálogo de atributos do ERP e mapeamento com campos da ficha técnica do CRM. Cada atributo é sincronizado individualmente via IMP_ATRIBFICHA_V1.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="catalog">Catálogo ({catalogQ.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="mapping">Mapeamento ({mappingQ.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="queue">Fila de Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-4">
            <CatalogTab
              tenantId={tenantId as string | null}
              items={catalogQ.data ?? []}
              loading={catalogQ.isLoading}
              onChanged={() => qc.invalidateQueries({ queryKey: ['erp-attribute-catalog'] })}
            />
          </TabsContent>

          <TabsContent value="mapping" className="mt-4">
            <MappingTab
              tenantId={tenantId as string | null}
              catalog={catalogQ.data ?? []}
              items={mappingQ.data ?? []}
              loading={mappingQ.isLoading}
              onChanged={() => qc.invalidateQueries({ queryKey: ['product-attribute-mapping'] })}
            />
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            <QueueTab catalog={catalogQ.data ?? []} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── CATÁLOGO ───────────────────────────
function CatalogTab({ tenantId, items, loading, onChanged }: {
  tenantId: string | null;
  items: Catalog[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Catalog> | null>(null);

  const save = useMutation({
    mutationFn: async (payload: Partial<Catalog>) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const row = { ...payload, tenant_id: tenantId };
      if (payload.id) {
        const { error } = await supabase.from('erp_attribute_catalog' as any).update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('erp_attribute_catalog' as any).insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Atributo salvo'); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_attribute_catalog' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Atributo removido'); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => setEditing({ ...EMPTY_CATALOG })}>
              <Plus className="h-4 w-4" /> Novo atributo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? 'Editar atributo' : 'Novo atributo ERP'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código ERP *</Label>
                  <Input type="number" value={editing?.erp_codigo ?? ''}
                    onChange={(e) => setEditing({ ...editing!, erp_codigo: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing?.tipo ?? 'number'} onValueChange={(v) => setEditing({ ...editing!, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Numérico</SelectItem>
                      <SelectItem value="string">Texto</SelectItem>
                      <SelectItem value="enum">Lista</SelectItem>
                      <SelectItem value="boolean">Sim/Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição *</Label>
                <Input value={editing?.descricao ?? ''}
                  onChange={(e) => setEditing({ ...editing!, descricao: e.target.value })} placeholder="Ex: Largura" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Grupo técnico</Label>
                  <Input value={editing?.grupo_tecnico ?? ''}
                    onChange={(e) => setEditing({ ...editing!, grupo_tecnico: e.target.value })}
                    placeholder="Dimensões, Impressão..." />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Input value={editing?.unidade ?? ''}
                    onChange={(e) => setEditing({ ...editing!, unidade: e.target.value })}
                    placeholder="mm, kg, un..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tolerância +</Label>
                  <Input type="number" step="0.01" value={editing?.tolerancia_mais ?? ''}
                    onChange={(e) => setEditing({ ...editing!, tolerancia_mais: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Tolerância –</Label>
                  <Input type="number" step="0.01" value={editing?.tolerancia_menos ?? ''}
                    onChange={(e) => setEditing({ ...editing!, tolerancia_menos: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={editing?.aceita_tolerancia ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing!, aceita_tolerancia: v })} />
                  <Label className="text-sm">Aceita tolerância</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing?.obrigatorio ?? false}
                    onCheckedChange={(v) => setEditing({ ...editing!, obrigatorio: v })} />
                  <Label className="text-sm">Obrigatório</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing?.ativo ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing!, ativo: v })} />
                  <Label className="text-sm">Ativo</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={save.isPending || !editing?.descricao || !editing?.erp_codigo}
                onClick={() => save.mutate(editing!)}>
                {save.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tol. +/–</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>}
          {!loading && items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-muted-foreground text-sm">Nenhum atributo cadastrado.</TableCell></TableRow>
          )}
          {items.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="font-mono">{it.erp_codigo}</TableCell>
              <TableCell>{it.descricao}{it.unidade ? ` (${it.unidade})` : ''}</TableCell>
              <TableCell className="text-muted-foreground">{it.grupo_tecnico || '—'}</TableCell>
              <TableCell><Badge variant="outline">{it.tipo}</Badge></TableCell>
              <TableCell className="text-xs">
                {it.aceita_tolerancia ? `+${it.tolerancia_mais ?? 0} / –${it.tolerancia_menos ?? 0}` : '—'}
              </TableCell>
              <TableCell>
                <Badge variant={it.ativo ? 'default' : 'secondary'}>{it.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm(`Remover atributo ${it.descricao}?`)) remove.mutate(it.id);
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

// ─────────────────────────── MAPEAMENTO ───────────────────────────
const CRM_PATH_PRESETS: { label: string; source: 'ficha_tecnica' | 'product_column' | 'derived'; path: string }[] = [
  { label: 'Tipo Solda — derivado do Subgrupo (apenas Saco/Stand Up)', source: 'derived', path: 'tipo_solda' },
  { label: 'Largura (mm) — produto', source: 'product_column', path: 'width' },
  { label: 'Comprimento (mm) — produto', source: 'product_column', path: 'length' },
  { label: 'Espessura (mm) — produto', source: 'product_column', path: 'thickness' },
  { label: 'Peso (kg) — produto', source: 'product_column', path: 'weight' },
  { label: 'Fator KG — produto', source: 'product_column', path: 'fator_kg' },
  { label: 'Fator milheiro — produto', source: 'product_column', path: 'fator_milheiro' },
  { label: 'Stand Up — Distância do picote', source: 'ficha_tecnica', path: 'stand_up.distancia_picote' },
  { label: 'Stand Up — Distância do zíper', source: 'ficha_tecnica', path: 'stand_up.distancia_ziper' },
  { label: 'Embalagem — Quantidade', source: 'ficha_tecnica', path: 'embalagem.quantidade' },
  { label: 'Bobina — Peso por bobina', source: 'ficha_tecnica', path: 'bobina.peso_bobina' },
  { label: 'Bobina — Diâmetro', source: 'ficha_tecnica', path: 'bobina.diametro_bobina' },
  { label: 'Bobina — Metragem', source: 'ficha_tecnica', path: 'bobina.metragem_bobina' },
  { label: 'Bobina — Emendas', source: 'ficha_tecnica', path: 'bobina.emendas_por_bobina' },
  { label: 'Impressão — Quantidade de cores', source: 'ficha_tecnica', path: 'impressao.qtd_cores' },
  { label: 'Impressão — Repetição lateral', source: 'ficha_tecnica', path: 'impressao.repeticao_lateral' },
  { label: 'Impressão — Repetição longitudinal', source: 'ficha_tecnica', path: 'impressao.repeticao_longitudinal' },
  { label: 'Impressão — Passo', source: 'ficha_tecnica', path: 'impressao.passo' },
];

function MappingTab({ tenantId, catalog, items, loading, onChanged }: {
  tenantId: string | null;
  catalog: Catalog[];
  items: Mapping[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Mapping> | null>(null);

  const save = useMutation({
    mutationFn: async (payload: Partial<Mapping>) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const row = { ...payload, tenant_id: tenantId };
      if (payload.id) {
        const { error } = await supabase.from('product_attribute_mapping' as any).update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_attribute_mapping' as any).insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Mapeamento salvo'); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_attribute_mapping' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Mapeamento removido'); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const catalogById = new Map(catalog.map((c) => [c.id, c]));

  return (
    <>
      <div className="flex justify-end mb-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => setEditing({ ...EMPTY_MAPPING })}>
              <Plus className="h-4 w-4" /> Novo mapeamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? 'Editar mapeamento' : 'Novo mapeamento'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Atributo ERP *</Label>
                <Select value={editing?.attribute_catalog_id}
                  onValueChange={(v) => setEditing({ ...editing!, attribute_catalog_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {catalog.filter((c) => c.ativo).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.erp_codigo} — {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Campo do CRM *</Label>
                <Select value={editing?.crm_source && editing?.crm_path
                  ? `${editing.crm_source}::${editing.crm_path}` : undefined}
                  onValueChange={(v) => {
                    const [source, path] = v.split('::');
                    setEditing({ ...editing!, crm_source: source as any, crm_path: path });
                  }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CRM_PATH_PRESETS.map((p) => (
                      <SelectItem key={`${p.source}::${p.path}`} value={`${p.source}::${p.path}`}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Caminho: <code>{editing?.crm_source}.{editing?.crm_path}</code>
                </p>
              </div>
              <div>
                <Label>Rótulo (opcional)</Label>
                <Input value={editing?.crm_label ?? ''}
                  onChange={(e) => setEditing({ ...editing!, crm_label: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing?.ativo ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing!, ativo: v })} />
                <Label className="text-sm">Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={save.isPending || !editing?.attribute_catalog_id || !editing?.crm_path}
                onClick={() => save.mutate(editing!)}>
                {save.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atributo ERP</TableHead>
            <TableHead>Campo CRM</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow>}
          {!loading && items.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">Nenhum mapeamento configurado.</TableCell></TableRow>
          )}
          {items.map((it) => {
            const cat = catalogById.get(it.attribute_catalog_id);
            return (
              <TableRow key={it.id}>
                <TableCell>{cat ? `${cat.erp_codigo} — ${cat.descricao}` : it.attribute_catalog_id}</TableCell>
                <TableCell className="font-mono text-xs">{it.crm_source}.{it.crm_path}</TableCell>
                <TableCell><Badge variant={it.ativo ? 'default' : 'secondary'}>{it.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    if (confirm('Remover mapeamento?')) remove.mutate(it.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

// ─────────────────────────── FILA ───────────────────────────
function QueueTab({ catalog }: { catalog: Catalog[] }) {
  const qc = useQueryClient();
  const queueQ = useQuery({
    queryKey: ['attribute-sync-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attribute_sync_queue' as any)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  const catalogById = new Map(catalog.map((c) => [c.id, c]));

  const runWorker = async () => {
    try {
      const { error } = await supabase.functions.invoke('process-attribute-sync', { body: {} });
      if (error) throw error;
      toast.success('Worker disparado');
      qc.invalidateQueries({ queryKey: ['attribute-sync-queue'] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusVariant = (s: string): any => {
    if (s === 'sent') return 'default';
    if (s === 'error') return 'destructive';
    if (s === 'blocked_no_erp_code' || s === 'blocked_validation') return 'outline';
    return 'secondary';
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" variant="outline" className="gap-1" onClick={runWorker}>
          <RefreshCw className="h-4 w-4" /> Processar fila agora
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atributo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tentativas</TableHead>
            <TableHead>Erro</TableHead>
            <TableHead>Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(queueQ.data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-muted-foreground text-sm">Fila vazia.</TableCell></TableRow>
          )}
          {(queueQ.data ?? []).map((it: any) => {
            const c = catalogById.get(it.attribute_catalog_id);
            return (
              <TableRow key={it.id}>
                <TableCell>{c ? `${c.erp_codigo} — ${c.descricao}` : '—'}</TableCell>
                <TableCell><Badge variant={statusVariant(it.status)}>{it.status}</Badge></TableCell>
                <TableCell>{it.attempt_count}/{it.max_attempts}</TableCell>
                <TableCell className="text-xs text-destructive max-w-xs truncate">{it.error_message || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(it.updated_at).toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

export default ErpAttributeMappingManager;
