import { hasPermission } from './rbac';

export const isSuperAdmin = (user) => user?.role === 'super_admin';

export const isAdmin = (user) => user?.role === 'admin' || user?.role === 'super_admin';

export const canAccessTestPrep = (user) => hasPermission(user, 'testPreparation', 'access');

export const canAccessInquiry = (user) => hasPermission(user, 'inquiry', 'access');

export const canAccessFollowUp = (user) => hasPermission(user, 'followUp', 'access');

export const canAccessDailyReport = (user) => hasPermission(user, 'dailyReport', 'access');

export const canAccessTrash = (user) => hasPermission(user, 'trash', 'access');

export const canAccessPortal = (user) => hasPermission(user, 'portal', 'access');

export const canAccessModule = (user, moduleKey) => hasPermission(user, moduleKey, 'access');
