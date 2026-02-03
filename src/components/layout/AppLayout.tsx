import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { GlobalSearch } from './GlobalSearch';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AIChatWidget } from '@/components/ai-assistant/AIChatWidget';
import { CopilotWidget } from '@/components/copilot/CopilotWidget';
import { useSidebar } from '@/contexts/SidebarContext';

export function AppLayout() {
  const isMobile = useIsMobile();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        // Desktop: CSS Grid layout que reage ao sidebar
        !isMobile && "app-layout"
      )}
      style={!isMobile ? { 
        gridTemplateColumns: `${isCollapsed ? '64px' : '256px'} 1fr` 
      } : undefined}
    >
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="min-h-[44px] min-w-[44px]"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <span className="text-lg font-bold ml-3">
            CRM<span className="text-primary">Pro</span>
          </span>
        </header>
      )}

      {/* Mobile Backdrop */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - fixed no mobile, static no desktop */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col min-w-0",
        !isMobile && "min-h-screen"
      )}>
        {/* Desktop Header with Global Search */}
        {!isMobile && (
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-3">
            <div className="max-w-md">
              <GlobalSearch />
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className={cn(
          "flex-1 min-w-0",
          isMobile ? "p-4" : "p-6"
        )}>
          <Outlet />
        </main>
      </div>

      {/* AI Copilot Widget */}
      <CopilotWidget />

      {/* AI Assistant Widget */}
      <AIChatWidget />
    </div>
  );
}
