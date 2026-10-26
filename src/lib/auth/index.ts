// ALOKHANDWALA - Role-Based Access Control (RBAC) System

import { UserRole, UserProfile } from '../schema';
import { initialUsers } from '../db/seed-data';

export interface AuthSession {
  user: UserProfile;
  role: UserRole;
}

export const PERMISSIONS = {
  // Projects
  PROJECT_VIEW_ALL: ['ADMIN'],
  PROJECT_CREATE_INSPECTION: ['ADMIN', 'SUPERVISOR'],
  PROJECT_CONFIRM: ['ADMIN'],
  PROJECT_INSTALL_SUBMIT: ['ADMIN', 'SUPERVISOR'],
  PROJECT_BUFFER_REQUEST: ['ADMIN'],
  PROJECT_EXTEND: ['ADMIN'],
  PROJECT_SHIFT: ['ADMIN'],
  PROJECT_DISMANTLE_SUBMIT: ['ADMIN'],
  PROJECT_CLOSE: ['ADMIN'],
  PROJECT_CANCEL: ['ADMIN'],

  // Inventory
  INVENTORY_VIEW: ['ADMIN'],
  INVENTORY_RESERVE: ['ADMIN'],
  INVENTORY_DISPATCH: ['ADMIN'],
  INVENTORY_RECEIVE_RETURN: ['ADMIN'],
  INVENTORY_ADJUST: ['ADMIN'],

  // Billing
  BILLING_VIEW: ['ADMIN'],
  BILLING_CREATE_INVOICE: ['ADMIN'],
  BILLING_RECORD_PAYMENT: ['ADMIN'],

  // Administration & Insights
  REPORTS_VIEW: ['ADMIN'],
  USER_MANAGEMENT: ['ADMIN'],
  AUDIT_LOGS_VIEW: ['ADMIN'],
  SETTINGS_EDIT: ['ADMIN'],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

// Current active session helper with local storage fallback or default Admin
export const DEFAULT_USER = initialUsers[0]; // Burhan Malu (ADMIN)
