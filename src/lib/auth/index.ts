// ALOKHANDWALA - Role-Based Access Control (RBAC) System

import { UserRole, UserProfile } from '../schema';
import { initialUsers } from '../db/seed-data';

export interface AuthSession {
  user: UserProfile;
  role: UserRole;
}

export const PERMISSIONS = {
  // Projects
  PROJECT_VIEW_ALL: ['ADMIN', 'ACCOUNTANT'],
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
  INVENTORY_VIEW: ['ADMIN', 'ACCOUNTANT'],
  INVENTORY_RESERVE: ['ADMIN'],
  INVENTORY_DISPATCH: ['ADMIN'],
  INVENTORY_RECEIVE_RETURN: ['ADMIN'],
  INVENTORY_ADJUST: ['ADMIN'],

  // Challan Management
  CHALLAN_VIEW: ['ADMIN', 'ACCOUNTANT', 'SUPERVISOR'],
  CHALLAN_CREATE: ['ADMIN', 'SUPERVISOR'],
  CHALLAN_EDIT: ['ADMIN', 'SUPERVISOR'],
  CHALLAN_DELETE: ['ADMIN'],
  CHALLAN_RECORD_RETURN: ['ADMIN', 'SUPERVISOR'],
  CHALLAN_RECORD_LOSS: ['ADMIN'],
  CHALLAN_CLOSE: ['ADMIN'],

  // Billing
  BILLING_VIEW: ['ADMIN', 'ACCOUNTANT', 'CLIENT'],
  BILLING_CREATE_INVOICE: ['ADMIN', 'ACCOUNTANT'],
  BILLING_RECORD_PAYMENT: ['ADMIN', 'ACCOUNTANT'],

  // Administration & Insights
  REPORTS_VIEW: ['ADMIN', 'ACCOUNTANT'],
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
