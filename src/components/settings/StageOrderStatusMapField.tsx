import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { OrderStatus, orderStatusConfig } from '@/types/products';

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'pendente',
  'em_producao',
  'produzido',
  'em_faturamento',
  'faturado',
  'entregue',
  'cancelado',
];

const NONE_VALUE = '__NONE__';
const ANY_TYPE = '__ANY__';

export interface StageOrderMappingDraft {
  target_order_status: OrderStatus | null;
  auto_apply: boolean;
  applies_to_order_type: 'producao' | 'pronta_entrega' | null;
}

interface StageOrderStatusMapFieldProps {
  value: StageOrderMappingDraft;
  onChange: (value: StageOrderMappingDraft) => void;
  disabled?: boolean;
}

/**
 * Form section to configure how a pipeline stage maps to an order status.
 * Used inside the stage edit dialog in UnifiedPipelineManager.
 */
export function StageOrderStatusMapField({
  value,
  onChange,
  disabled,
}: StageOrderStatusMapFieldProps) {
  const hasMapping = !!value.target_order_status;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Vínculo com Pedido</Label>
        {hasMapping ? (
          <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/40 text-primary">
            ativo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
            sem vínculo
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Quando o funil estiver configurado para controlar pedidos, esta etapa moverá
        pedidos vinculados ao status escolhido.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="map-target-status" className="text-xs">Status do Pedido</Label>
          <Select
            disabled={disabled}
            value={value.target_order_status ?? NONE_VALUE}
            onValueChange={(v) =>
              onChange({
                ...value,
                target_order_status: v === NONE_VALUE ? null : (v as OrderStatus),
              })
            }
          >
            <SelectTrigger id="map-target-status">
              <SelectValue placeholder="Sem vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sem vínculo</SelectItem>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {orderStatusConfig[status]?.label || status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="map-order-type" className="text-xs">Aplica-se a</Label>
          <Select
            disabled={disabled || !hasMapping}
            value={value.applies_to_order_type ?? ANY_TYPE}
            onValueChange={(v) =>
              onChange({
                ...value,
                applies_to_order_type:
                  v === ANY_TYPE ? null : (v as 'producao' | 'pronta_entrega'),
              })
            }
          >
            <SelectTrigger id="map-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_TYPE}>Todos os tipos</SelectItem>
              <SelectItem value="producao">Apenas Produção</SelectItem>
              <SelectItem value="pronta_entrega">Apenas Pronta Entrega</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Switch
          id="map-auto-apply"
          disabled={disabled || !hasMapping}
          checked={value.auto_apply}
          onCheckedChange={(checked) => onChange({ ...value, auto_apply: checked })}
        />
        <div className="flex-1">
          <Label htmlFor="map-auto-apply" className="text-sm cursor-pointer">
            Aplicar automaticamente
          </Label>
          <p className="text-xs text-muted-foreground">
            Quando desligado, a etapa apenas sugere o status no frontend (ideal para
            ações críticas como faturamento ou cancelamento).
          </p>
        </div>
      </div>
    </div>
  );
}
