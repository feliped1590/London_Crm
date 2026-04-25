export enum PermissionAction {
  View = 'view',
  Create = 'create',
  Edit = 'edit',
  Delete = 'delete',
}

export type AccessType = 'total' | 'restrito' | 'none';

export interface GranularModulePermission {
  module_key: string;
  module_name: string;
  module_path: string;
  module_icon: string;
  access_type?: AccessType;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export type PermissionMap = Record<string, GranularModulePermission>;

interface PermissionEngineOptions {
  isPrivileged?: boolean;
  onMissingModule?: (moduleKey: string, action?: PermissionAction) => void;
}

const actionField: Record<PermissionAction, keyof GranularModulePermission> = {
  [PermissionAction.View]: 'can_view',
  [PermissionAction.Create]: 'can_create',
  [PermissionAction.Edit]: 'can_edit',
  [PermissionAction.Delete]: 'can_delete',
};

export const permissionEngine = {
  toMap(permissions: GranularModulePermission[] = []): PermissionMap {
    return permissions.reduce<PermissionMap>((acc, permission) => {
      acc[permission.module_key] = permission;
      return acc;
    }, {});
  },

  can(
    permissions: PermissionMap,
    moduleKey: string,
    action: PermissionAction,
    options: PermissionEngineOptions = {},
  ): boolean {
    const permission = permissions[moduleKey];

    if (!permission) {
      options.onMissingModule?.(moduleKey, action);
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
    moduleKey: string,
    options: PermissionEngineOptions = {},
  ): AccessType {
    const permission = permissions[moduleKey];

    if (!permission) {
      options.onMissingModule?.(moduleKey);
      return 'none';
    }

    if (!permission?.can_view) return 'none';
    if (permission.can_view && permission.can_create && permission.can_edit && permission.can_delete) return 'total';
    return 'restrito';
  },
};