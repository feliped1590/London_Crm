import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
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
  Lightbulb,
  LucideIcon,
  DollarSign,
  HelpCircle,
  CalendarCheck,
  SearchCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useUnreadCount } from '@/hooks/useWhatsApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useModulePermissions } from '@/hooks/useModulePermissions';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  moduleKey: string;
}

const allNavItems: NavItem[] = [
  { to: '/today', icon: CalendarCheck, label: 'Meu Dia', moduleKey: 'dashboard' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral', moduleKey: 'dashboard' },
  { to: '/pipeline', icon: Target, label: 'Pipeline', moduleKey: 'pipeline' },
  { to: '/customers', icon: Users, label: 'Clientes', moduleKey: 'companies' },
  { to: '/products', icon: Package, label: 'Produtos', moduleKey: 'products' },
  { to: '/pricing', icon: DollarSign, label: 'Tabelas de Preços', moduleKey: 'pricing' },
  { to: '/prospecting', icon: SearchCheck, label: 'Prospecção', moduleKey: 'prospecting' },
  { to: '/orders', icon: ShoppingCart, label: 'Pedidos', moduleKey: 'orders' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas', moduleKey: 'tasks' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', moduleKey: 'whatsapp' },
  { to: '/bots', icon: Target, label: 'Bots', moduleKey: 'bots' },
  { to: '/emails', icon: Mail, label: 'Emails', moduleKey: 'emails' },
  { to: '/reports', icon: BarChart3, label: 'Dashboard', moduleKey: 'reports' },
  { to: '/integrations', icon: Plug, label: 'Integrações', moduleKey: 'integrations' },
  { to: '/settings', icon: Settings, label: 'Configurações', moduleKey: 'settings' },
  { to: '/help', icon: HelpCircle, label: 'Ajuda', moduleKey: 'help' },
];

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();
  const { canAccess, isAdmin, isLoading: permissionsLoading } = useModulePermissions();

  // Filter nav items based on user permissions
  const navItems = useMemo(() => {
    if (permissionsLoading) return [];
    return allNavItems.filter(item => canAccess(item.moduleKey));
  }, [canAccess, permissionsLoading]);

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleSignOut = async () => {
    if (isMobile && onClose) {
      onClose();
    }
    
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro no logout:', error);
      toast.info('Sessão encerrada');
    } finally {
      // SEMPRE navegar para auth, mesmo com erro ou timeout
      navigate('/auth', { replace: true });
    }
  };

  // Mobile: always expanded, use isOpen prop
  // Desktop: use collapsed state
  const sidebarClasses = isMobile
    ? cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )
    : cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      );

  const showLabels = isMobile ? true : !collapsed;

  return (
    <aside className={sidebarClasses}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {showLabels && (
          <span className="text-xl font-bold text-sidebar-primary-foreground">
            CRM<span className="text-sidebar-primary">Pro</span>
          </span>
        )}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {showLabels && (
                <span className="flex-1">{item.label}</span>
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
        <div className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 mb-2",
          !showLabels && "justify-center"
        )}>
          <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-medium shrink-0">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          {showLabels && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          )}
        </div>
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
