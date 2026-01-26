import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check } from 'lucide-react';
import {
  DashboardWidget,
  MetricType,
  METRIC_DEFINITIONS,
  CATEGORY_LABELS,
  CHART_TYPE_LABELS,
} from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (widgets: DashboardWidget[]) => void;
  existingWidgets: DashboardWidget[];
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
  existingWidgets,
}: AddWidgetDialogProps) {
  const [selected, setSelected] = useState<MetricType[]>([]);

  // WhatsApp category temporarily hidden - under development
  const categories = ['deals', 'tasks', 'contacts', 'proposals', 'orders', 'products'] as const;

  const toggleMetric = (type: MetricType) => {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAdd = () => {
    const newWidgets: DashboardWidget[] = selected.map((type, index) => {
      const def = METRIC_DEFINITIONS.find((m) => m.type === type)!;
      return {
        id: `widget-${Date.now()}-${index}`,
        type,
        chartType: def.defaultChart,
        title: def.label,
        size: def.defaultSize,
        position: existingWidgets.length + index,
      };
    });
    onAdd(newWidgets);
    setSelected([]);
    onOpenChange(false);
  };

  const isAlreadyAdded = (type: MetricType) =>
    existingWidgets.some((w) => w.type === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Adicionar Widgets</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="deals" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-0">
                <div className="grid gap-2">
                  {METRIC_DEFINITIONS.filter((m) => m.category === cat).map((metric) => {
                    const isSelected = selected.includes(metric.type);
                    const alreadyAdded = isAlreadyAdded(metric.type);

                    return (
                      <button
                        key={metric.type}
                        onClick={() => !alreadyAdded && toggleMetric(metric.type)}
                        disabled={alreadyAdded}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                          isSelected && 'border-primary bg-primary/5',
                          alreadyAdded && 'opacity-50 cursor-not-allowed',
                          !isSelected && !alreadyAdded && 'hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center justify-center w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0',
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{metric.label}</span>
                            {alreadyAdded && (
                              <Badge variant="secondary" className="text-xs">
                                Já adicionado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {metric.description}
                          </p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {metric.supportedCharts.map((chart) => (
                              <Badge key={chart} variant="outline" className="text-xs">
                                {CHART_TYPE_LABELS[chart]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={selected.length === 0}>
            Adicionar {selected.length > 0 && `(${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
