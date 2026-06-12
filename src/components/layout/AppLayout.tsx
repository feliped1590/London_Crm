import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Menu, Search } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AIChatWidget } from '@/components/ai-assistant/AIChatWidget';
import { LegalEntitySelector } from '@/components/layout/LegalEntitySelector';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { useLoginTaskAlert } from '@/hooks/useLoginTaskAlert';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { TaskAlertModal } from '@/components/tasks/TaskAlertModal';

export function AppLayout() {
  useSessionGuard();
  const { showModal, alertData, closeModal } = useLoginTaskAlert();
  const isMobile = useIsMobile();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();
  const { effectiveEntity } = useLegalEntities();
  const { isDeveloper } = useModulePermissions();
  const [commandOpen, setCommandOpen] = useState(false);

  // Cmd/Ctrl + K → open command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        !isMobile && "app-layout",
      )}
      style={!isMobile ? { gridTemplateColumns: `${isCollapsed ? '64px' : '256px'} 1fr` } : undefined}
    >
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-30 surface-glass px-3 py-2.5 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="min-h-[44px] min-w-[44px]"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {effectiveEntity?.logo_url ? (
            <img src={effectiveEntity.logo_url} alt={effectiveEntity.name} className="h-6 max-w-[100px] object-contain" />
          ) : (
            <span className="font-display text-base font-semibold">
              <span className="text-gradient-brand">Qualyvac</span>
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCommandOpen(true)} aria-label="Buscar">
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Mobile Backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppSidebar />

      {/* Main */}
      <div className={cn("flex flex-col min-w-0", !isMobile && "min-h-screen")}>
        {/* Desktop Header */}
        {!isMobile && (
          <header className="surface-glass sticky top-0 z-20 h-14 px-6 flex items-center gap-4">
            <button
              onClick={() => setCommandOpen(true)}
              className={cn(
                "flex items-center gap-2 h-9 px-3 rounded-lg text-sm",
                "bg-surface-elevated/60 hover:bg-surface-elevated border border-border-subtle hover:border-border",
                "text-muted-foreground hover:text-foreground transition-colors min-w-[280px] max-w-md flex-1",
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Buscar clientes, pedidos, produtos…</span>
              <span className="kbd ml-auto">⌘ K</span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <LegalEntitySelector />
              <ThemeToggle />
            </div>
          </header>
        )}

        <main className={cn("flex-1 min-w-0", isMobile ? "p-3 sm:p-4" : "p-6")}>
          <Outlet />
        </main>
      </div>

      {alertData && <TaskAlertModal open={showModal} onClose={closeModal} data={alertData} />}
      {isDeveloper && <AIChatWidget />}

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
