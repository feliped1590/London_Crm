import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Inbox } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Mensagem amigável exibida em caso de erro. */
  errorMessage?: string;
  /** Conteúdo extra (ex.: botão de retry) — escondido no PDF via data-export-hide. */
  errorAction?: ReactNode;
  /** Badge/elemento exibido à direita do título (ex.: período da meta). */
  headerBadge?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function ExecutiveSection({
  title,
  description,
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'Sem dados para os filtros atuais.',
  errorMessage,
  errorAction,
  headerBadge,
  className,
  children,
}: Props) {
  return (
    <Card
      className={`bi-section p-4 bg-white border border-[#E2E8F0] shadow-none rounded-[10px] ${className ?? ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[12px] font-semibold text-[#0F172A]">{title}</h3>
          {description && <p className="text-[11px] text-[#64748B] mt-0.5">{description}</p>}
        </div>
        {headerBadge && <div className="shrink-0">{headerBadge}</div>}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <div className="bi-section-state flex flex-col items-center gap-2 text-center py-6 px-4 rounded-md border border-dashed border-[#FCD9D9] bg-[#FEF7F7]">
          <AlertTriangle className="h-6 w-6 text-[#B45309]" />
          <div className="text-sm font-medium text-[#0F172A]">
            {errorMessage ?? 'Não foi possível carregar este bloco.'}
          </div>
          <div className="text-[11px] text-[#64748B]">
            Tente ajustar os filtros (período ou entidade jurídica) ou recarregar a página.
          </div>
          {errorAction && (
            <div className="mt-1" data-export-hide="true">
              {errorAction}
            </div>
          )}
        </div>
      ) : isEmpty ? (
        <div className="bi-section-state flex flex-col items-center gap-1.5 text-center py-6 px-4 rounded-md border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
          <Inbox className="h-6 w-6 text-[#94A3B8]" />
          <div className="text-sm font-medium text-[#334155]">{emptyMessage}</div>
          <div className="text-[11px] text-[#64748B]">Sem dados para os filtros atuais.</div>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
