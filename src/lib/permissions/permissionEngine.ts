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
    permissions: GranularModulePermission[] | PermissionMap,
    moduleKey: string,
    action: PermissionAction,
    options: { isPrivileged?: boolean } = {},
  ): boolean {
    if (options.isPrivileged) return true;

    const permission = Array.isArray(permissions)
      ? permissions.find((item) => item.module_key === moduleKey)
      : permissions[moduleKey];

    if (!permission?.can_view) return false;
    if (action === PermissionAction.View) return true;

    return permission[actionField[action]] === true;
  },

  getAccessType(
    permissions: GranularModulePermission[] | PermissionMap,
    moduleKey: string,
    options: { isPrivileged?: boolean } = {},
  ): AccessType {
    if (options.isPrivileged) return 'total';

    const permission = Array.isArray(permissions)
      ? permissions.find((item) => item.module_key === moduleKey)
      : permissions[moduleKey];

    if (!permission?.can_view) return 'none';
    if (permission.can_create || permission.can_edit || permission.can_delete) return 'total';
    return 'restrito';
  },
};