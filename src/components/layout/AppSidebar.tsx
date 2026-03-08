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
  HelpCircle,
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  { to: '/carriers', icon: Truck, label: 'Transportadoras', moduleKey: 'companies' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas', moduleKey: 'tasks' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', moduleKey: 'whatsapp' },
  { to: '/emails', icon: Mail, label: 'Emails', moduleKey: 'emails' },
  { to: '/prospecting', icon: SearchCheck, label: 'Prospecção', moduleKey: 'prospecting' },
  { to: '/reports', icon: BarChart3, label: 'Dashboard', moduleKey: 'reports' },
  { to: '/integrations', icon: Plug, label: 'Integrações', moduleKey: 'integrations', devOnly: true },
  { to: '/settings', icon: Settings, label: 'Configurações', moduleKey: 'settings' },
  { to: '/help', icon: HelpCircle, label: 'Ajuda', moduleKey: 'help' },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();
  const { canAccess, isAdmin, isLoading: permissionsLoading } = useModulePermissions();
  const { effectiveEntity } = useLegalEntities();

  // Check if user is developer
  const { data: isDeveloper } = useQuery({
    queryKey: ['is_developer', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'desenvolvedor')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Filter nav items based on user permissions
  const navItems = useMemo(() => {
    if (permissionsLoading) return [];
    return allNavItems.filter(item => {
      // Dev-only items require developer role
      if (item.devOnly && !isDeveloper) return false;
      return canAccess(item.moduleKey);
    });
  }, [canAccess, permissionsLoading, isDeveloper]);

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
              CRM<span className="text-sidebar-primary">Pro</span>
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
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                isMobile ? "py-3 min-h-[48px]" : "py-2.5",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
            <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-medium shrink-0">
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
