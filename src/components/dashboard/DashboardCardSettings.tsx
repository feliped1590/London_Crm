import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GripVertical, Users, Building2, Layers, Activity, TrendingUp, Handshake } from 'lucide-react';
import { useDashboardCards, AVAILABLE_CARDS, type UserCardPreference } from '@/hooks/useDashboardCards';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Building2, Layers, Activity, TrendingUp, Handshake,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardCardSettings({ open, onOpenChange }: Props) {
  const { allPreferences, savePreferences, isSaving } = useDashboardCards();
  const [cards, setCards] = useState<UserCardPreference[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      // Ensure all available cards are present
      const existing = new Map(allPreferences.map((c) => [c.card_key, c]));
      const full = AVAILABLE_CARDS.map((def, i) => {
        const pref = existing.get(def.key);
        return {
          card_key: def.key,
          position: pref?.position ?? i,
          enabled: pref?.enabled ?? true,
        };
      }).sort((a, b) => a.position - b.position);
      setCards(full);
    }
  }, [open, allPreferences]);

  const handleToggle = (key: string) => {
    setCards((prev) => prev.map((c) => c.card_key === key ? { ...c, enabled: !c.enabled } : c));
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    setCards((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIndex, 1);
      next.splice(i, 0, item);
      return next.map((c, idx) => ({ ...c, position: idx }));
    });
    setDragIndex(i);
  };

  const handleSave = async () => {
    try {
      await savePreferences(cards);
      toast.success('Painel personalizado salvo!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar preferências');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar painel</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {cards.map((card, i) => {
            const def = AVAILABLE_CARDS.find((c) => c.key === card.card_key);
            if (!def) return null;
            const Icon = ICON_MAP[def.icon] || Users;
            return (
              <div
                key={card.card_key}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={() => setDragIndex(null)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Label className="flex-1 text-sm cursor-pointer">{def.label}</Label>
                <Switch
                  checked={card.enabled}
                  onCheckedChange={() => handleToggle(card.card_key)}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
