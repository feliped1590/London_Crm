import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ServerPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  isFetching?: boolean;
}

/**
 * Lightweight pagination control bound to server-side `.range()` queries.
 * Page is 1-based. Hides itself if there are no records.
 */
export function ServerPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  isFetching,
}: ServerPaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3">
      <div className="text-xs text-muted-foreground">
        {from}-{to} de {total.toLocaleString('pt-BR')}
        {isFetching && <span className="ml-2 opacity-60">• atualizando…</span>}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt} / pág
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isFetching}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isFetching}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
