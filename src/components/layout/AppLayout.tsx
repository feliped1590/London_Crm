import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AIChatWidget } from '@/components/ai-assistant/AIChatWidget';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationToast } from '@/components/notifications/NotificationToast';
import { LegalEntitySelector } from '@/components/layout/LegalEntitySelector';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { useLoginTaskAlert } from '@/hooks/useLoginTaskAlert';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { TaskAlertModal } from '@/components/tasks/TaskAlertModal';
import { AI_ASSISTANT_ENABLED } from '@/config/features';

export function AppLayout() {
  useSessionGuard();
  const { showModal, alertData, closeModal } = useLoginTaskAlert();
  const isMobile = useIsMobile();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();
  const { effectiveEntity } = useLegalEntities();
  const { isDeveloper } = useModulePermissions();

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
            <img src="/london-logo.png" alt="London" className="h-7 max-w-[100px] object-contain" />
          )}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <LegalEntitySelector />
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
          <header className="surface-glass sticky top-0 z-20 h-14 px-6 grid grid-cols-3 items-center gap-4">
            <div />
            <div className="flex justify-center">
              <LegalEntitySelector />
            </div>
            <div className="flex justify-end items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
        )}

        <main className={cn("flex-1 min-w-0", isMobile ? "p-3 sm:p-4" : "p-6")}>
          <Outlet />
        </main>
      </div>

      {alertData && <TaskAlertModal open={showModal} onClose={closeModal} data={alertData} />}
      <NotificationToast />
      {isDeveloper && AI_ASSISTANT_ENABLED && <AIChatWidget />}
    </div>
  );
}
