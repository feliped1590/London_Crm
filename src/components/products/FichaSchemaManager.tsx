import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileJson, Plus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface SchemaRow {
  id: string;
  tenant_id: string;
  key: string;
  version: number;
  is_active: boolean;
  title: string;
  definition: any;
  published_at: string | null;
  updated_at: string;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

export default function FichaSchemaManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SchemaRow | null>(null);
  const [editorJson, setEditorJson] = useState('');
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const { data: schemas = [], isLoading } = useQuery({
    queryKey: ['ficha_schemas_manager'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_schemas' as any)
        .select('id, tenant_id, key, version, is_active, title, definition, published_at, updated_at')
        .order('key')
        .order('version', { ascending: false });
      if (error) throw error;
      return (data as unknown) as SchemaRow[];
    },
  });

  const { data: rendererVersion } = useQuery({
    queryKey: ['ficha_renderer_version_manager'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_settings')
        .select('id, ficha_renderer_version')
        .limit(1)
        .maybeSingle();
      return data as { id: string; ficha_renderer_version: 'v1' | 'v2' } | null;
    },
  });

  const groupedByKey = schemas.reduce<Record<string, SchemaRow[]>>((acc, s) => {
    (acc[s.key] ||= []).push(s);
    return acc;
  }, {});

  const openEditor = (row: SchemaRow) => {
    setEditing(row);
    setEditorJson(JSON.stringify(row.definition, null, 2));
  };

  const closeEditor = () => {
    setEditing(null);
    setEditorJson('');
  };

  const handleSaveDraft = async () => {
    if (!editing) return;
    let parsed: any;
    try { parsed = JSON.parse(editorJson); } catch { toast.error('JSON inválido'); return; }
    const { error } = await supabase
      .from('ficha_schemas' as any)
      .update({ definition: parsed, title: parsed.title || editing.title } as any)
      .eq('id', editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Schema atualizado');
    qc.invalidateQueries({ queryKey: ['ficha_schemas_manager'] });
    qc.invalidateQueries({ queryKey: ['ficha_schema'] });
    closeEditor();
  };

  const handleNewVersion = async (row: SchemaRow) => {
    const nextVersion = Math.max(...groupedByKey[row.key].map((r) => r.version)) + 1;
    const { data, error } = await supabase
      .from('ficha_schemas' as any)
      .insert({
        tenant_id: row.tenant_id,
        key: row.key,
        version: nextVersion,
        is_active: false,
        title: row.title,
        definition: row.definition,
      } as any)
      .select('*')
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Versão ${nextVersion} criada como rascunho`);
    qc.invalidateQueries({ queryKey: ['ficha_schemas_manager'] });
    openEditor(data as unknown as SchemaRow);
  };

  const handleActivate = async (row: SchemaRow) => {
    // Desativa as outras da mesma key e ativa esta — em duas etapas para respeitar o índice parcial.
    const others = groupedByKey[row.key].filter((r) => r.id !== row.id && r.is_active);
    for (const o of others) {
      const { error } = await supabase.from('ficha_schemas' as any).update({ is_active: false } as any).eq('id', o.id);
      if (error) { toast.error(error.message); return; }
    }
    const { error } = await supabase
      .from('ficha_schemas' as any)
      .update({ is_active: true, published_at: new Date().toISOString() } as any)
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`v${row.version} ativada`);
    qc.invalidateQueries({ queryKey: ['ficha_schemas_manager'] });
    qc.invalidateQueries({ queryKey: ['ficha_schema'] });
  };

  const handleNewKey = async () => {
    if (!creatingKey) return;
    if (!KEY_RE.test(creatingKey)) { toast.error('Key deve ser snake_case (ex.: stand_up_liso)'); return; }
    const tenantId = schemas[0]?.tenant_id;
    if (!tenantId) { toast.error('Sem tenant identificado'); return; }
    const def = { key: creatingKey, title: creatingKey, sections: [] };
    const { error } = await supabase.from('ficha_schemas' as any).insert({
      tenant_id: tenantId, key: creatingKey, version: 1, is_active: false, title: creatingKey, definition: def,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Schema criado');
    setCreatingKey(null);
    qc.invalidateQueries({ queryKey: ['ficha_schemas_manager'] });
  };

  const toggleRenderer = async (next: boolean) => {
    if (!rendererVersion?.id) return;
    const value = next ? 'v2' : 'v1';
    const { error } = await supabase
      .from('tenant_settings')
      .update({ ficha_renderer_version: value } as any)
      .eq('id', rendererVersion.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Renderer alterado para ${value}`);
    qc.invalidateQueries({ queryKey: ['ficha_renderer_version_manager'] });
    qc.invalidateQueries({ queryKey: ['ficha_renderer_version'] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4 text-primary" />
            Schemas de Ficha Técnica
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Renderer dinâmico (v2)</Label>
              <Switch
                checked={rendererVersion?.ficha_renderer_version === 'v2'}
                onCheckedChange={toggleRenderer}
              />
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setCreatingKey('')}>
              <Plus className="h-3.5 w-3.5" /> Novo schema
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schemas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.key}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>
                    {row.is_active ? (
                      <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Rascunho</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.updated_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditor(row)}>Editar JSON</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleNewVersion(row)}>Nova versão</Button>
                    {!row.is_active && (
                      <Button size="sm" variant="default" onClick={() => handleActivate(row)}>Ativar</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && closeEditor()}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Editar schema — <span className="font-mono">{editing?.key}</span> v{editing?.version}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              rows={22}
              value={editorJson}
              onChange={(e) => setEditorJson(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Edição direta do JSON. Estrutura esperada: <span className="font-mono">{`{ key, title, sections: [{ id, title, layout, fields: [...] }] }`}</span>.
              Ids em snake_case. Ative a versão para que produtos passem a renderizá-la.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
              <Button onClick={handleSaveDraft}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={creatingKey !== null} onOpenChange={(o) => !o && setCreatingKey(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo schema</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">Key (snake_case)</Label>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={creatingKey ?? ''}
                onChange={(e) => setCreatingKey(e.target.value)}
                placeholder="ex.: bobina_termica"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingKey(null)}>Cancelar</Button>
              <Button onClick={handleNewKey}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
