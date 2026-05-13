import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { LookupItem } from '@/hooks/useProductLookups';

interface GroupSubgroupLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'group' | 'subgroup';
  anchor: LookupItem | null;
  options: LookupItem[];
  initialSelected: string[];
  onSave: (selectedIds: string[]) => Promise<void>;
}

export default function GroupSubgroupLinkDialog({
  open, onOpenChange, mode, anchor, options, initialSelected, onSave,
}: GroupSubgroupLinkDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setFilter('');
    }
  }, [open, initialSelected]);

  const otherLabel = mode === 'group' ? 'Subgrupos' : 'Grupos';
  const anchorLabel = mode === 'group' ? 'grupo' : 'subgrupo';

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      : options;
    return list.slice().sort((a, b) => a.label.localeCompare(b.label));
  }, [options, filter]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(selected));
      toast.success('Vínculos atualizados');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar vínculos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular {otherLabel}</DialogTitle>
          <DialogDescription>
            Selecione os {otherLabel.toLowerCase()} relacionados ao {anchorLabel}{' '}
            <span className="font-medium text-foreground">{anchor?.label}</span>.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder={`Buscar ${otherLabel.toLowerCase()}...`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <ScrollArea className="h-72 rounded-md border">
          <div className="p-2 space-y-1">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum item encontrado
              </div>
            )}
            {filtered.map(item => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <span className="font-mono text-xs text-muted-foreground w-24 truncate">{item.value}</span>
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
