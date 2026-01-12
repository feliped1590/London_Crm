import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Target, 
  CheckSquare, 
  Mail, 
  BarChart3, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useUnreadCount } from '@/hooks/useWhatsApp';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies', icon: Building2, label: 'Empresas' },
  { to: '/contacts', icon: Users, label: 'Contatos' },
  { to: '/pipeline', icon: Target, label: 'Pipeline' },
  { to: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/emails', icon: Mail, label: 'Emails' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { data: unreadCount } = useUnreadCount();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <span className="text-xl font-bold text-sidebar-primary-foreground">
            CRM<span className="text-sidebar-primary">Pro</span>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.to === '/whatsapp' && unreadCount && unreadCount > 0 && (
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
          collapsed && "justify-center"
        )}>
          <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-medium shrink-0">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "px-0 justify-center" : "justify-start gap-3"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </div>
    </aside>
  );
}