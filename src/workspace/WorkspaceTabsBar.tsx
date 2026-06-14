import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from './WorkspaceContext';
import { WORKSPACE_ROUTES } from './registry';
import { toast } from 'sonner';

export function WorkspaceTabsBar() {
  const { enabled, tabs, activeTabId, activate, requestCloseTab, blockedReason, clearBlocked } =
    useWorkspace();

  useEffect(() => {
    if (blockedReason) {
      toast.error(blockedReason);
      clearBlocked();
    }
  }, [blockedReason, clearBlocked]);

  if (!enabled || tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Abas de trabalho"
      className="flex items-end gap-1 px-4 pt-1 bg-muted/30 border-b border-border overflow-x-auto"
    >
      {tabs.map((tab) => {
        const def = WORKSPACE_ROUTES.find((r) => r.tabId(parseParams(tab.id)) === tab.id);
        const Icon = def?.icon;
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => activate(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(tab.id);
              }
            }}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm cursor-pointer select-none border border-b-0 max-w-[240px]',
              isActive
                ? 'bg-background border-border text-foreground font-medium'
                : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate" title={tab.title}>
              {tab.title}
            </span>
            {tab.isDirty && (
              <span
                aria-label="Alterações não salvas"
                title="Alterações não salvas"
                className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
              />
            )}
            <button
              type="button"
              aria-label={`Fechar aba ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                requestCloseTab(tab.id);
              }}
              className={cn(
                'ml-1 rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-muted',
                isActive && 'opacity-80',
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Helper: para descobrir def por tabId, precisamos extrair params do id ("customers:abc" -> {id:"abc"}).
// Como temos poucas rotas, fazemos um parse simples e tolerante.
function parseParams(tabId: string): Record<string, string | undefined> {
  if (tabId === 'orders') return {};
  if (tabId === 'customers') return {};
  if (tabId === 'customers:new') return {};
  if (tabId.startsWith('customers:')) return { id: tabId.slice('customers:'.length) };
  return {};
}
