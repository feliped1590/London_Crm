import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions, AccessType } from '@/hooks/useModulePermissions';
import { Loader2 } from 'lucide-react';
import { createContext, useContext } from 'react';

// Map routes to module keys
const routeToModuleKey: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/companies': 'companies',
  '/contacts': 'contacts',
  '/pipeline': 'pipeline',
  '/products': 'products',
  '/orders': 'orders',
  '/stock': 'stock',
  '/tasks': 'tasks',
  '/whatsapp': 'whatsapp',
  '/emails': 'emails',
  '/reports': 'reports',
  '/integracao-iniflex': 'iniflex',
  '/settings': 'settings',
};

// Context to share access type with child components
interface ModuleAccessContextType {
  accessType: AccessType;
  hasFullAccess: boolean;
  hasRestrictedAccess: boolean;
}

const ModuleAccessContext = createContext<ModuleAccessContextType>({
  accessType: 'none',
  hasFullAccess: false,
  hasRestrictedAccess: false,
});

export const useModuleAccess = () => useContext(ModuleAccessContext);

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { isLoading: permissionsLoading, canAccess, getAccessType, isAdmin } = useModulePermissions();
  const location = useLocation();

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Find the module key for the current route
  const currentPath = '/' + location.pathname.split('/')[1];
  const moduleKey = routeToModuleKey[currentPath];

  // If no module key found or user is admin, allow access
  if (!moduleKey || isAdmin) {
    const accessType: AccessType = 'total';
    return (
      <ModuleAccessContext.Provider value={{ accessType, hasFullAccess: true, hasRestrictedAccess: false }}>
        <Outlet />
      </ModuleAccessContext.Provider>
    );
  }

  // Check if user has access to this module
  if (!canAccess(moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Provide access type context to children
  const accessType = getAccessType(moduleKey);
  const hasFullAccess = accessType === 'total';
  const hasRestrictedAccess = accessType === 'restrito';

  return (
    <ModuleAccessContext.Provider value={{ accessType, hasFullAccess, hasRestrictedAccess }}>
      <Outlet />
    </ModuleAccessContext.Provider>
  );
}
