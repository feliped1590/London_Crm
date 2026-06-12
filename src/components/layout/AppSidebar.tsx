import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Users, Target, CheckSquare, Mail, BarChart3, Settings,
  Plug, LogOut, ChevronLeft, ChevronRight, MessageCircle, X, Package,
  ShoppingCart, Warehouse, Truck, LucideIcon, CalendarCheck, SearchCheck,
  Brain, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useMemo, useState, useEffect } from 'react';
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
  badge?: 'whatsapp';
}

interface NavGroup {
  id: string;
  label: string;
  defaultOpen?: boolean;
  items: NavItem[];
}

/**
 * Sidebar arquitetada para crescimento futuro: grupos colapsáveis
 * preparam o sistema para novos módulos (Financeiro, Marketing, RH, etc).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'work',
    label: 'Trabalho',
    defaultOpen: true,
    items: [
      { to: '/today', icon: CalendarCheck, label: 'Meu Dia', moduleKey: 'dashboard' },
      { to: '/pipeline', icon: Target, label: 'Pipeline', moduleKey: 'pipeline' },
      { to: '/tasks', icon: CheckSquare, label: 'Tarefas', moduleKey: 'tasks' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    defaultOpen: true,
    items: [
      { to: '/customers', icon: Users, label: 'Clientes', moduleKey: 'companies' },
      { to: '/products', icon: Package, label: 'Produtos', moduleKey: 'products' },
      { to: '/orders', icon: ShoppingCart, label: 'Pedidos', moduleKey: 'orders' },
      { to: '/stock', icon: Warehouse, label: 'Estoque', moduleKey: 'stock' },
      { to: '/carriers', icon: Truck, label: 'Transportadoras', moduleKey: 'carriers' },
    ],
  },
  {
    id: 'engajamento',
    label: 'Engajamento',
    defaultOpen: true,
    items: [
      { to: '/emails', icon: Mail, label: 'Emails', moduleKey: 'emails' },
      { to: '/prospecting', icon: SearchCheck, label: 'Prospecção', moduleKey: 'prospecting' },
      // { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', moduleKey: 'whatsapp', badge: 'whatsapp' },
    ],
  },
  {
    id: 'analise',
    label: 'Análise',
    defaultOpen: true,
    items: [
      { to: '/reports', icon: BarChart3, label: 'Dashboard', moduleKey: 'reports' },
      { to: '/bi', icon: Brain, label: 'Central de BI', moduleKey: 'reports' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    defaultOpen: false,
    items: [
      { to: '/integrations', icon: Plug, label: 'Integrações', moduleKey: 'integrations', devOnly: true },
      { to: '/settings', icon: Settings, label: 'Configurações', moduleKey: 'settings' },
    ],
  },
];

const GROUPS_STORAGE_KEY = 'crm-sidebar-groups';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();
  const { canAccess, isDeveloper, isPrivileged, isFullyLoaded, error: permissionsError } = useModulePermissions();
  const { effectiveEntity } = useLegalEntities();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return NAV_GROUPS.reduce((acc, g) => ({ ...acc, [g.id]: g.defaultOpen !== false }), {});
  });

  useEffect(() => {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Auto-expande o grupo que contém a rota atual
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => location.pathname.startsWith(i.to)));
    if (activeGroup && !openGroups[activeGroup.id]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.devOnly && !isDeveloper) return false;
        if (isPrivileged) return true;
        if (!isFullyLoaded || permissionsError) return true;
        return canAccess(item.moduleKey);
      }),
    })).filter(g => g.items.length > 0);
  }, [canAccess, isFullyLoaded, isDeveloper, isPrivileged, permissionsError]);

  const handleNavClick = () => { if (isMobile) closeMobile(); };

  const handleSignOut = async () => {
    if (isMobile) closeMobile();
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

  const showLabels = isMobile ? true : !isCollapsed;

  const sidebarClasses = isMobile
    ? cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out flex flex-col",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      )
    : cn(
        "bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 layout-transition border-r border-sidebar-border",
        isCollapsed ? "w-16" : "w-64",
      );

  const renderItem = (item: NavItem) => {
    const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={handleNavClick}
        onMouseEnter={() => import('@/lib/routePrefetch').then(m => m.prefetchRoute(item.to))}
        onFocus={() => import('@/lib/routePrefetch').then(m => m.prefetchRoute(item.to))}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 text-sm font-medium",
          "transition-all duration-150 ease-out",
          isMobile ? "py-2.5 min-h-[44px]" : "py-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          !showLabels && "justify-center px-0",
        )}
        title={!showLabels ? item.label : undefined}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-sidebar-primary" aria-hidden />
        )}
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-sidebar-primary")} />
        {showLabels && <span className="flex-1 truncate">{item.label}</span>}
        {showLabels && item.badge === 'whatsapp' && unreadCount && unreadCount > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
            {unreadCount}
          </Badge>
        )}
      </NavLink>
    );
  };

  return (
    <aside className={sidebarClasses}>
      {/* Brand */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {showLabels ? (
          effectiveEntity?.logo_url ? (
            <img src={effectiveEntity.logo_url} alt={effectiveEntity.name} className="h-7 max-w-[140px] object-contain" />
          ) : (
            <span className="font-display text-lg font-semibold tracking-tight">
              <span className="text-gradient-brand">Qualyvac</span>
              <span className="text-sidebar-muted ml-1.5 text-xs font-normal">CRM</span>
            </span>
          )
        ) : (
          effectiveEntity?.logo_url ? (
            <img src={effectiveEntity.logo_url} alt="" className="h-7 w-7 object-contain mx-auto" />
          ) : (
            <div className="h-7 w-7 rounded-md bg-gradient-brand mx-auto" />
          )
        )}
        {isMobile ? (
          <Button variant="ghost" size="icon" onClick={closeMobile} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn("h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent", isCollapsed && "mx-auto")}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Navigation — grouped + collapsible */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-4">
        {filteredGroups.map(group => {
          const open = openGroups[group.id] !== false;
          return (
            <div key={group.id} className="space-y-1">
              {showLabels && (
                <button
                  type="button"
                  onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !open }))}
                  className="w-full flex items-center justify-between px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-sidebar-muted hover:text-sidebar-foreground transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform duration-150", !open && "-rotate-90")}
                  />
                </button>
              )}
              {(open || !showLabels) && (
                <div className="space-y-0.5">
                  {group.items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-2">
        <UserProfileModal>
          <button className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 mb-1 w-full text-left hover:bg-sidebar-accent transition-colors cursor-pointer",
            !showLabels && "justify-center px-0",
          )}>
            <div className="h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center text-white font-semibold shrink-0 shadow-sm text-sm">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            {showLabels && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-accent-foreground">{user?.email}</p>
                <p className="text-[11px] text-sidebar-muted">Ver perfil</p>
              </div>
            )}
          </button>
        </UserProfileModal>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isMobile ? "min-h-[44px]" : "h-9",
            showLabels ? "justify-start gap-3" : "px-0 justify-center",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showLabels && <span className="text-sm">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
