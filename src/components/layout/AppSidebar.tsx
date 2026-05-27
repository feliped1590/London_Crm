import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
   
  Building2, 
  Users, 
  Target, 
  CheckSquare, 
  Mail, 
  BarChart3, 
  Settings,
  Plug,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  X,
  RefreshCw,
  Package,
  ShoppingCart,
  Warehouse,
  Truck,
  Lightbulb,
  LucideIcon,
  DollarSign,
  CalendarCheck,
  SearchCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useUnreadCount } from '@/hooks/useWhatsApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSidebar } from '@/contexts/SidebarContext';
import { UserProfileModal } from './UserProfileModal';
import { useLegalEntities } from '@/hooks/useLegalEntities';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  moduleKey: string;
  devOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { to: '/today', icon: CalendarCheck, label: 'Meu Dia', moduleKey: 'dashboard' },
  { to: '/pipeline', icon: Target, label: 'Pipeline', moduleKey: 'pipeline' },
  { to: '/customers', icon: Users, label: 'Clientes', moduleKey: 'companies' },
  { to: '/products', icon: Package, label: 'Produtos', moduleKey: 'products' },
  { to: '/orders', icon: ShoppingCart, label: 'Pedidos', moduleKey: 'orders' },
  { to: '/stock', icon: Warehouse, label: 'Estoque', moduleKey: 'stock' },
  { to: '/carriers', icon: Truck, label: 'Transportadoras', moduleKey: 'carriers' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas', moduleKey: 'tasks' },
  // WhatsApp desativado (auditoria perf 2026-05). Reativar via src/config/features.ts
  // { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', moduleKey: 'whatsapp' },
  { to: '/emails', icon: Mail, label: 'Emails', moduleKey: 'emails' },
  { to: '/prospecting', icon: SearchCheck, label: 'Prospecção', moduleKey: 'prospecting' },
  { to: '/reports', icon: BarChart3, label: 'Dashboard', moduleKey: 'reports' },
  { to: '/integrations', icon: Plug, label: 'Integrações', moduleKey: 'integrations', devOnly: true },
  { to: '/settings', icon: Settings, label: 'Configurações', moduleKey: 'settings' },
  
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();
  const { canAccess, isDeveloper, isPrivileged, isFullyLoaded, error: permissionsError } = useModulePermissions();
  const { effectiveEntity } = useLegalEntities();

  // Filter nav items based on user permissions
  const navItems = useMemo(() => {
    if (isPrivileged) return allNavItems.filter(item => !item.devOnly || isDeveloper);
    if (!isFullyLoaded || permissionsError) return allNavItems.filter(item => !item.devOnly);
    return allNavItems.filter(item => {
      // Dev-only items require developer role
      if (item.devOnly && !isDeveloper) return false;
      return canAccess(item.moduleKey);
    });
  }, [canAccess, isFullyLoaded, isDeveloper, isPrivileged, permissionsError]);

  const handleNavClick = () => {
    if (isMobile) {
      closeMobile();
    }
  };

  const handleSignOut = async () => {
    if (isMobile) {
      closeMobile();
    }
    
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro no logout:', error);
      toast.info('Sessão encerrada');
    } finally {
      navigate('/auth', { replace: true });
    }
  };

  // Show labels: always on mobile (expanded), on desktop when not collapsed
  const showLabels = isMobile ? true : !isCollapsed;

  // Mobile: fixed overlay sidebar
  // Desktop: static sidebar that participates in grid
  const sidebarClasses = isMobile
    ? cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out flex flex-col",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )
    : cn(
        "bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 layout-transition",
        isCollapsed ? "w-16" : "w-64"
      );

  return (
    <aside className={sidebarClasses}>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {showLabels && (
          effectiveEntity?.logo_url ? (
            <img 
              src={effectiveEntity.logo_url} 
              alt={effectiveEntity.name} 
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-xl font-bold text-sidebar-primary-foreground">
              CRM <span className="text-sidebar-primary">Qualyvac Group</span>
            </span>
          )
        )}
        {!showLabels && effectiveEntity?.logo_url && (
          <img 
            src={effectiveEntity.logo_url} 
            alt={effectiveEntity.name} 
            className="h-7 w-7 object-contain mx-auto"
          />
        )}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobile}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isCollapsed && "mx-auto"
            )}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 p-2 overflow-y-auto scrollbar-thin">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');

          // Separadores visuais entre grupos lógicos (puramente visual, não muda a lista)
          // Grupos: [today, pipeline, customers, products, orders, stock, carriers] | [tasks, whatsapp, emails, prospecting] | [reports] | [integrations, settings]
          const isGroupBreak =
            item.to === '/tasks' ||
            item.to === '/reports' ||
            item.to === '/integrations' ||
            (item.to === '/settings' && !navItems.some((n) => n.to === '/integrations'));

          return (
            <div key={item.to}>
              {isGroupBreak && index > 0 && (
                <div className="my-3 border-t border-sidebar-border/50" aria-hidden="true" />
              )}
              <NavLink
                to={item.to}
                onClick={handleNavClick}
                onMouseEnter={() => {
                  import('@/lib/routePrefetch').then((m) => m.prefetchRoute(item.to));
                }}
                onFocus={() => {
                  import('@/lib/routePrefetch').then((m) => m.prefetchRoute(item.to));
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200 ease-in-out",
                  isMobile ? "py-3 min-h-[48px]" : "py-2.5",
                  isActive
                    ? "bg-gradient-primary-whisper text-sidebar-primary-foreground border-l-2 border-primary glow-active shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5 hover:glow-hover",
                  !showLabels && "justify-center px-0"
                )}
                title={!showLabels ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {showLabels && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {showLabels && item.to === '/whatsapp' && unreadCount && unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-2">
        <UserProfileModal>
          <button
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 mb-2 w-full text-left hover:bg-sidebar-accent transition-colors cursor-pointer",
              !showLabels && "justify-center px-0"
            )}
          >
            <div className="h-8 w-8 rounded-full bg-gradient-primary-strong flex items-center justify-center text-white font-medium shrink-0 shadow-sm">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            {showLabels && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
            )}
          </button>
        </UserProfileModal>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isMobile ? "min-h-[48px]" : "",
            showLabels ? "justify-start gap-3" : "px-0 justify-center"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {showLabels && <span>Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
