import { useModuleAccess } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { PermissionAction } from '@/lib/permissions/permissionEngine';

interface AccessControlledButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  action?: PermissionAction.Create | PermissionAction.Edit | PermissionAction.Delete;
}

/**
 * A button that respects module access permissions.
 * When user has restricted access, the button is hidden or disabled.
 */
export function AccessControlledButton({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  className,
  disabled = false,
  type = 'button',
  action,
}: AccessControlledButtonProps) {
  const { canCreate, canEdit, canDelete, hasRestrictedAccess } = useModuleAccess();
  const allowedByAction = !action
    || (action === PermissionAction.Create && canCreate)
    || (action === PermissionAction.Edit && canEdit)
    || (action === PermissionAction.Delete && canDelete);

  // Compatibilidade: sem action explícita, mantém o comportamento antigo.
  if ((!action && hasRestrictedAccess) || !allowedByAction) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
      disabled={disabled}
      type={type}
    >
      {children}
    </Button>
  );
}

/**
 * A wrapper component that conditionally renders children based on access level.
 * Use this to hide create/edit/delete actions for users with restricted access.
 */
export function AccessControlledActions({ children }: { children: React.ReactNode }) {
  const { hasRestrictedAccess } = useModuleAccess();

  if (hasRestrictedAccess) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Shows a message when user has restricted access.
 */
export function RestrictedAccessBadge() {
  const { hasRestrictedAccess } = useModuleAccess();

  if (!hasRestrictedAccess) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      Modo visualização
    </div>
  );
}
