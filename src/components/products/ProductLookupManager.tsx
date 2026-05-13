import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Layers, Box, Grid3X3, Users, Tag, Ruler, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProductLookups, type LookupItem } from '@/hooks/useProductLookups';
import { useGroupSubgroupLinks } from '@/hooks/useGroupSubgroupLinks';
import GroupSubgroupLinkDialog from './GroupSubgroupLinkDialog';

interface LookupSectionProps {
  title: string;
  icon: React.ReactNode;
  items: LookupItem[];
  allItems: LookupItem[];
  isLoading: boolean;
  onCreate: (item: { value: string; label: string; sort_order?: number }) => Promise<void>;
  onUpdate: (item: { id: string; value?: string; label?: string; sort_order?: number; is_active?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLink?: (item: LookupItem) => void;
  linkCounts?: Record<string, number>;
  linkColumnLabel?: string;
}

const ITEMS_PER_PAGE = 5;

function LookupSection({ title, icon, allItems, isLoading, onCreate, onUpdate, onDelete, onLink, linkCounts, linkColumnLabel }: LookupSectionProps) {
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formOrder, setFormOrder] = useState(0);

  const resetForm = () => {
    setFormValue('');
    setFormLabel('');
    setFormOrder(0);
    setEditing(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValue || !formLabel) {
      toast.error('Valor e Rótulo são obrigatórios');
      return;
    }
    try {
      if (editing) {
        await onUpdate({ id: editing.id, value: formValue, label: formLabel, sort_order: formOrder });
        toast.success('Atualizado com sucesso!');
      } else {
        await onCreate({ value: formValue, label: formLabel, sort_order: formOrder });
        toast.success('Criado com sucesso!');
      }
      resetForm();
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error('Valor já existe. Use um diferente.');
      } else {
        toast.error('Erro ao salvar');
      }
    }
  };

  const handleEdit = (item: LookupItem) => {
    setEditing(item);
    setFormValue(item.value);
    setFormLabel(item.label);
    setFormOrder(item.sort_order);
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (item: LookupItem) => {
    try {
      await onUpdate({ id: item.id, is_active: !item.is_active });
      toast.success(item.is_active ? 'Desativado' : 'Ativado');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = allItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-1">{allItems.length}</Badge>
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : allItems.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Rótulo</TableHead>
                  <TableHead className="w-20">Ordem</TableHead>
                  <TableHead className="w-20">Ativo</TableHead>
                  {onLink && <TableHead className="w-24">{linkColumnLabel || 'Vínculos'}</TableHead>}
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-sm">{item.value}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell>
                      <Switch checked={item.is_active} onCheckedChange={() => handleToggleActive(item)} />
                    </TableCell>
                    {onLink && (
                      <TableCell>
                        <Badge variant={(linkCounts?.[item.id] ?? 0) > 0 ? 'default' : 'secondary'}>
                          {linkCounts?.[item.id] ?? 0}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {onLink && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Vínculos" onClick={() => onLink(item)}>
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            if (confirm('Excluir este registro?')) {
                              onDelete(item.id).then(() => toast.success('Excluído!')).catch(() => toast.error('Erro ao excluir'));
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, allItems.length)} de {allItems.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{currentPage}/{totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Nenhum registro cadastrado
          </div>
        )}
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} {title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="lookup-value">Valor (código interno)</Label>
              <Input id="lookup-value" value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="Ex: bobina" required />
            </div>
            <div>
              <Label htmlFor="lookup-label">Rótulo (exibição)</Label>
              <Input id="lookup-label" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: Bobina" required />
            </div>
            <div>
              <Label htmlFor="lookup-order">Ordem de exibição</Label>
              <Input id="lookup-order" type="number" value={formOrder} onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">{editing ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ProductLookupManager() {
  const { tipos, grupos, subgrupos, familias, classes, unitMeasures } = useProductLookups();
  const { linksByGroup, linksBySubgroup, setGroupLinks, setSubgroupLinks } = useGroupSubgroupLinks();

  const [linkDialog, setLinkDialog] = useState<
    | { mode: 'group'; anchor: LookupItem }
    | { mode: 'subgroup'; anchor: LookupItem }
    | null
  >(null);

  const groupLinkCounts: Record<string, number> = Object.fromEntries(
    Object.entries(linksByGroup).map(([k, v]) => [k, v.length])
  );
  const subgroupLinkCounts: Record<string, number> = Object.fromEntries(
    Object.entries(linksBySubgroup).map(([k, v]) => [k, v.length])
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Cadastro Básico de Produtos</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie as opções disponíveis para tipos, grupos, subgrupos, famílias, classes e unidades de medida dos produtos.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Estrutura ERP</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LookupSection
            title="Tipos"
            icon={<Layers className="h-4 w-4 text-primary" />}
            items={tipos.items}
            allItems={tipos.allItems}
            isLoading={tipos.isLoadingAll}
            onCreate={(item) => tipos.create.mutateAsync(item)}
            onUpdate={(item) => tipos.update.mutateAsync(item)}
            onDelete={(id) => tipos.remove.mutateAsync(id)}
          />
          <LookupSection
            title="Grupos"
            icon={<Box className="h-4 w-4 text-primary" />}
            items={grupos.items}
            allItems={grupos.allItems}
            isLoading={grupos.isLoadingAll}
            onCreate={(item) => grupos.create.mutateAsync(item)}
            onUpdate={(item) => grupos.update.mutateAsync(item)}
            onDelete={(id) => grupos.remove.mutateAsync(id)}
          />
          <LookupSection
            title="Subgrupos"
            icon={<Grid3X3 className="h-4 w-4 text-primary" />}
            items={subgrupos.items}
            allItems={subgrupos.allItems}
            isLoading={subgrupos.isLoadingAll}
            onCreate={(item) => subgrupos.create.mutateAsync(item)}
            onUpdate={(item) => subgrupos.update.mutateAsync(item)}
            onDelete={(id) => subgrupos.remove.mutateAsync(id)}
          />
          <LookupSection
            title="Famílias"
            icon={<Users className="h-4 w-4 text-primary" />}
            items={familias.items}
            allItems={familias.allItems}
            isLoading={familias.isLoadingAll}
            onCreate={(item) => familias.create.mutateAsync(item)}
            onUpdate={(item) => familias.update.mutateAsync(item)}
            onDelete={(id) => familias.remove.mutateAsync(id)}
          />
          <LookupSection
            title="Classes"
            icon={<Tag className="h-4 w-4 text-primary" />}
            items={classes.items}
            allItems={classes.allItems}
            isLoading={classes.isLoadingAll}
            onCreate={(item) => classes.create.mutateAsync(item)}
            onUpdate={(item) => classes.update.mutateAsync(item)}
            onDelete={(id) => classes.remove.mutateAsync(id)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Características</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LookupSection
            title="Unidades de Medida"
            icon={<Ruler className="h-4 w-4 text-primary" />}
            items={unitMeasures.items}
            allItems={unitMeasures.allItems}
            isLoading={unitMeasures.isLoadingAll}
            onCreate={(item) => unitMeasures.create.mutateAsync(item)}
            onUpdate={(item) => unitMeasures.update.mutateAsync(item)}
            onDelete={(id) => unitMeasures.remove.mutateAsync(id)}
          />
        </div>
      </div>
    </div>
  );
}
