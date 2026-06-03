import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useClassificacaoAdmin, useClassificacaoAll } from '@/hooks/useClassificacaoAdmin';

type Level = 'setor' | 'segmento' | 'atividade';

interface RowItem {
  id: string;
  nome: string;
  sort_order: number | null;
  is_active: boolean | null;
}

interface EditState {
  level: Level;
  parent_id?: string;
  id?: string;
  nome: string;
  sort_order: number;
}

const LABELS: Record<Level, { title: string; singular: string }> = {
  setor: { title: 'Setores', singular: 'Setor' },
  segmento: { title: 'Segmentos', singular: 'Segmento' },
  atividade: { title: 'Atividades', singular: 'Atividade' },
};

function Column({
  level,
  items,
  selectedId,
  onSelect,
  onEdit,
  onToggle,
  onRemove,
  onAdd,
  disabledAdd,
  emptyHint,
}: {
  level: Level;
  items: RowItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (item: RowItem) => void;
  onToggle: (item: RowItem) => void;
  onRemove: (item: RowItem) => void;
  onAdd: () => void;
  disabledAdd: boolean;
  emptyHint: string;
}) {
  const cfg = LABELS[level];
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between py-3 space-y-0">
        <CardTitle className="text-sm font-semibold">{cfg.title}</CardTitle>
        <Button size="sm" variant="outline" onClick={onAdd} disabled={disabledAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">{emptyHint}</p>
        )}
        {items.map((it) => {
          const isSel = it.id === selectedId;
          return (
            <div
              key={it.id}
              className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition ${
                isSel ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
              } ${it.is_active === false ? 'opacity-50' : ''}`}
              onClick={() => onSelect(it.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{it.nome}</span>
                {it.is_active === false && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onEdit(it); }}
                  title="Editar"
                ><Pencil className="h-3 w-3" /></Button>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onToggle(it); }}
                  title={it.is_active === false ? 'Ativar' : 'Inativar'}
                >{it.is_active === false ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</Button>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                  onClick={(e) => { e.stopPropagation(); onRemove(it); }}
                  title="Remover"
                ><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ClassificacaoManager() {
  const { data, isLoading } = useClassificacaoAll();
  const { upsert, toggleActive, remove } = useClassificacaoAdmin();

  const [selectedSetor, setSelectedSetor] = useState<string | null>(null);
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const setores = (data?.setores || []) as RowItem[];
  const segmentos = useMemo(
    () => ((data?.segmentos || []) as (RowItem & { setor_id: string })[]).filter(
      (s) => !selectedSetor || s.setor_id === selectedSetor,
    ),
    [data, selectedSetor],
  );
  const atividades = useMemo(
    () => ((data?.atividades || []) as (RowItem & { segmento_id: string })[]).filter(
      (a) => !selectedSegmento || a.segmento_id === selectedSegmento,
    ),
    [data, selectedSegmento],
  );

  const openCreate = (level: Level) => {
    const parent_id =
      level === 'segmento' ? selectedSetor ?? undefined :
      level === 'atividade' ? selectedSegmento ?? undefined :
      undefined;
    setEdit({ level, parent_id, nome: '', sort_order: 0 });
  };

  const openEdit = (level: Level, item: RowItem, parent_id?: string) => {
    setEdit({ level, parent_id, id: item.id, nome: item.nome, sort_order: item.sort_order ?? 0 });
  };

  const handleSave = async () => {
    if (!edit) return;
    await upsert.mutateAsync({
      level: edit.level,
      id: edit.id,
      nome: edit.nome,
      sort_order: edit.sort_order,
      parent_id: edit.parent_id,
    });
    setEdit(null);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Estrutura usada no cadastro de clientes. Clique em um Setor para ver seus Segmentos, e em um Segmento para ver suas Atividades.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <Column
          level="setor"
          items={setores}
          selectedId={selectedSetor}
          onSelect={(id) => { setSelectedSetor(id); setSelectedSegmento(null); }}
          onEdit={(it) => openEdit('setor', it)}
          onToggle={(it) => toggleActive.mutate({ level: 'setor', id: it.id, is_active: !(it.is_active ?? true) })}
          onRemove={(it) => { if (confirm(`Inativar setor "${it.nome}"?`)) remove.mutate({ level: 'setor', id: it.id }); }}
          onAdd={() => openCreate('setor')}
          disabledAdd={false}
          emptyHint="Nenhum setor cadastrado."
        />
        <Column
          level="segmento"
          items={segmentos}
          selectedId={selectedSegmento}
          onSelect={(id) => setSelectedSegmento(id)}
          onEdit={(it) => openEdit('segmento', it, selectedSetor ?? undefined)}
          onToggle={(it) => toggleActive.mutate({ level: 'segmento', id: it.id, is_active: !(it.is_active ?? true) })}
          onRemove={(it) => { if (confirm(`Inativar segmento "${it.nome}"?`)) remove.mutate({ level: 'segmento', id: it.id }); }}
          onAdd={() => openCreate('segmento')}
          disabledAdd={!selectedSetor}
          emptyHint={selectedSetor ? 'Nenhum segmento neste setor. Clique em + Novo.' : 'Selecione um setor à esquerda.'}
        />
        <Column
          level="atividade"
          items={atividades}
          selectedId={null}
          onSelect={() => {}}
          onEdit={(it) => openEdit('atividade', it, selectedSegmento ?? undefined)}
          onToggle={(it) => toggleActive.mutate({ level: 'atividade', id: it.id, is_active: !(it.is_active ?? true) })}
          onRemove={(it) => { if (confirm(`Inativar atividade "${it.nome}"?`)) remove.mutate({ level: 'atividade', id: it.id }); }}
          onAdd={() => openCreate('atividade')}
          disabledAdd={!selectedSegmento}
          emptyHint={selectedSegmento ? 'Nenhuma atividade neste segmento.' : 'Selecione um segmento ao centro.'}
        />
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? 'Editar' : 'Novo'} {edit ? LABELS[edit.level].singular : ''}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={edit.nome}
                  onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={edit.sort_order}
                  onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !edit?.nome.trim()}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
