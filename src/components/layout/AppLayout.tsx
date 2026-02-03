import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { GlobalSearch } from './GlobalSearch';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AIChatWidget } from '@/components/ai-assistant/AIChatWidget';
import { CopilotWidget } from '@/components/copilot/CopilotWidget';

export function AppLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="min-h-[44px] min-w-[44px]"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <span className="text-lg font-bold ml-3">
            CRM<span className="text-primary">Pro</span>
          </span>
        </header>
      )}

      {/* Desktop Header with Global Search */}
      {!isMobile && (
        <header className="fixed top-0 left-64 right-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-3">
          <div className="max-w-md">
            <GlobalSearch />
          </div>
        </header>
      )}

      {/* Mobile Backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AppSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <main className={cn(
        "min-h-screen",
        !isMobile && "pl-64 pt-16"
      )}>
        <div className={cn(
          isMobile ? "p-4" : "p-6"
        )}>
          <Outlet />
        </div>
      </main>

      {/* AI Copilot Widget */}
      <CopilotWidget />

      {/* AI Assistant Widget */}
      <AIChatWidget />
    </div>
  );
}
