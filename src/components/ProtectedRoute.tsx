import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions, AccessType } from '@/hooks/useModulePermissions';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { Loader2 } from 'lucide-react';
import { createContext, useContext } from 'react';

// Map routes to module keys
const routeToModuleKey: Record<string, string> = {
  '/today': 'dashboard',
  '/dashboard': 'dashboard',
  '/customers': 'companies',
  '/companies': 'companies',
  '/contacts': 'contacts',
  '/pipeline': 'pipeline',
  '/products': 'products',
  '/orders': 'orders',
  '/stock': 'stock',
  '/carriers': 'carriers',
  '/tasks': 'tasks',
  '/whatsapp': 'whatsapp',
  '/bots': 'bots',
  '/emails': 'emails',
  '/reports': 'reports',
  '/insights': 'insights',
  '/pricing': 'pricing',
  '/prospecting': 'prospecting',
  '/reallocation': 'portfolio',
  '/integrations': 'integrations',
  '/import-companies': 'import_companies',
  '/import-data': 'integrations',
  '/settings': 'settings',
};

// Context to share access type with child components
interface ModuleAccessContextType {
  moduleKey?: string;
  accessType: AccessType;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hasFullAccess: boolean;
  hasRestrictedAccess: boolean;
}

const ModuleAccessContext = createContext<ModuleAccessContextType>({
  accessType: 'none',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  hasFullAccess: false,
  hasRestrictedAccess: false,
});

export const useModuleAccess = () => useContext(ModuleAccessContext);

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { isFullyLoaded, canAccess, getAccessType, can, isAdmin } = useModulePermissions();
  const location = useLocation();

  // Auth still loading — show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No user → redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User exists — render immediately.
  // If permissions haven't loaded yet, grant temporary full access (non-blocking).
  // Once permissions load, React Query will trigger a re-render with correct access.
  const currentPath = '/' + location.pathname.split('/')[1];
  const moduleKey = routeToModuleKey[currentPath];

  if (isAdmin || !moduleKey) {
    // Admin or unknown routes: full access
    const accessType: AccessType = 'total';
    return (
      <ModuleAccessContext.Provider value={{ moduleKey, accessType, canCreate: true, canEdit: true, canDelete: true, hasFullAccess: true, hasRestrictedAccess: false }}>
        <Outlet />
      </ModuleAccessContext.Provider>
    );
  }

  if (!isFullyLoaded) {
    // Permissions still loading: render layout with restricted access (safe default)
    const accessType: AccessType = 'restrito';
    return (
      <ModuleAccessContext.Provider value={{ moduleKey, accessType, canCreate: false, canEdit: false, canDelete: false, hasFullAccess: false, hasRestrictedAccess: true }}>
        <Outlet />
      </ModuleAccessContext.Provider>
    );
  }

  // Permissions loaded — enforce access control
  if (!canAccess(moduleKey)) {
    return <Navigate to="/today" replace />;
  }

  const accessType = getAccessType(moduleKey);
  const canCreate = can(moduleKey, PermissionAction.Create);
  const canEdit = can(moduleKey, PermissionAction.Edit);
  const canDelete = can(moduleKey, PermissionAction.Delete);
  const hasFullAccess = accessType === 'total';
  const hasRestrictedAccess = accessType === 'restrito';

  return (
    <ModuleAccessContext.Provider value={{ moduleKey, accessType, canCreate, canEdit, canDelete, hasFullAccess, hasRestrictedAccess }}>
      <Outlet />
    </ModuleAccessContext.Provider>
  );
}
