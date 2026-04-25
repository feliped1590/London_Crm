export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export class PermissionDeniedError extends Error {
  status = 403;
  code = 'PERMISSION_DENIED';

  constructor(moduleKey: string, action: PermissionAction) {
    super(`Permissão negada para ${moduleKey}:${action}`);
    this.name = 'PermissionDeniedError';
  }
}

export async function requireModulePermission(
  supabase: any,
  userId: string | null | undefined,
  moduleKey: string,
  action: PermissionAction,
): Promise<void> {
  if (!userId) throw new PermissionDeniedError(moduleKey, action);

  const { data, error } = await supabase.rpc('has_module_permission', {
    _user_id: userId,
    _module_key: moduleKey,
    _action: action,
  });

  if (error) {
    console.error(`[permissionEngine] Falha ao validar ${moduleKey}:${action}`, error.message);
    throw new PermissionDeniedError(moduleKey, action);
  }

  if (data !== true) throw new PermissionDeniedError(moduleKey, action);
}

export function permissionErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(error instanceof PermissionDeniedError)) return null;

  return new Response(
    JSON.stringify({ error: error.message, code: error.code }),
    { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}