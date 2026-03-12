import { formatCurrency } from '@/lib/formatters';
import { IpiMode, ipiModeConfig } from '@/types/products';

interface DocumentTotalsProps {
  subtotalProducts: number;
  totalIpi: number;
  total: number;
  ipiMode: IpiMode;
}

export function DocumentTotals({ subtotalProducts, totalIpi, total, ipiMode }: DocumentTotalsProps) {
  return (
    <div className="flex justify-end">
      <div className="text-right p-4 bg-muted rounded-lg space-y-1">
        <div className="flex justify-between gap-8 text-sm">
          <span className="text-muted-foreground">Subtotal Produtos:</span>
          <span>{formatCurrency(subtotalProducts)}</span>
        </div>
        {ipiMode !== 'isento' && (
          <div className="flex justify-between gap-8 text-sm">
            <span className="text-muted-foreground">
              IPI Total {ipiMode === 'incluso' ? '(informativo)' : ''}:
            </span>
            <span>{formatCurrency(totalIpi)}</span>
          </div>
        )}
        <div className="flex justify-between gap-8 pt-1 border-t">
          <span className="text-muted-foreground font-medium">Valor Total:</span>
          <span className="text-2xl font-bold">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
