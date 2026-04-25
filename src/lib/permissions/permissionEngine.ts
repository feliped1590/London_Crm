export enum PermissionAction {
  View = 'view',
  Create = 'create',
  Edit = 'edit',
  Delete = 'delete',
}

export type AccessType = 'total' | 'restrito' | 'none';

export const MODULE_KEYS = [
  'dashboard',
  'companies',
  'contacts',
  'pipeline',
  'products',
  'orders',
  'stock',
  'tasks',
  'whatsapp',
  'emails',
  'reports',
  'insights',
  'settings',
  'carriers',
  'import_companies',
  'bots',
  'portfolio',
  'prospecting',
  'integrations',
  'pricing',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type KnownOrDynamicModuleKey = ModuleKey | (string & {});

export interface GranularModulePermission {
  module_key: KnownOrDynamicModuleKey;
  module_name: string;
  module_path: string;
  module_icon: string;
  access_type?: AccessType;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export type PermissionMap = Readonly<Record<string, Readonly<GranularModulePermission>>>;

interface PermissionEngineOptions {
  isPrivileged?: boolean;
  failFast?: boolean;
  onMissingModule?: (moduleKey: string, action?: PermissionAction) => void;
}

function handleMissingModule(moduleKey: string, action: PermissionAction | undefined, options: PermissionEngineOptions) {
  options.onMissingModule?.(moduleKey, action);

  if (options.failFast) {
    throw new Error(`[permissionEngine] Módulo inexistente ou não carregado: ${moduleKey}${action ? `:${action}` : ''}`);
  }
}

const actionField: Record<PermissionAction, keyof GranularModulePermission> = {
  [PermissionAction.View]: 'can_view',
  [PermissionAction.Create]: 'can_create',
  [PermissionAction.Edit]: 'can_edit',
  [PermissionAction.Delete]: 'can_delete',
};

export const permissionEngine = {
  toMap(permissions: GranularModulePermission[] = []): PermissionMap {
    const map = permissions.reduce<Record<string, Readonly<GranularModulePermission>>>((acc, permission) => {
      acc[permission.module_key] = Object.freeze({ ...permission });
      return acc;
    }, {});

    return Object.freeze(map);
  },

  can(
    permissions: PermissionMap,
    moduleKey: KnownOrDynamicModuleKey,
    action: PermissionAction,
    options: PermissionEngineOptions = {},
  ): boolean {
    const permission = permissions[moduleKey];

    if (!permission) {
      handleMissingModule(moduleKey, action, options);
      return false;
    }

    if (options.isPrivileged && action !== PermissionAction.Delete) return true;

    if (!permission?.can_view) return false;
    if (action === PermissionAction.View) return true;
    if (action === PermissionAction.Delete) {
      return permission.can_edit === true && permission.can_delete === true;
    }

    return permission[actionField[action]] === true;
  },

  getAccessType(
    permissions: PermissionMap,
    moduleKey: KnownOrDynamicModuleKey,
    options: PermissionEngineOptions = {},
  ): AccessType {
    const permission = permissions[moduleKey];

    if (!permission) {
      handleMissingModule(moduleKey, undefined, options);
      return 'none';
    }

    if (!permission?.can_view) return 'none';
    if (permission.can_view && permission.can_create && permission.can_edit && permission.can_delete) return 'total';
    return 'restrito';
  },
};