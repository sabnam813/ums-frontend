import { hasPermission } from './rbac';

export const isSuperAdmin = (user) => user?.role === 'super_admin';

export const isAdmin = (user) => user?.role === 'admin' || user?.role === 'super_admin';

export const canAccessTestPrep = (user) => hasPermission(user, 'testPreparation', 'access');

export const canAccessInquiry = (user) => hasPermission(user, 'inquiry', 'access');

export const canAccessFollowUp = (user) => hasPermission(user, 'followUp', 'access');

export const canAccessStudentFollowUp = (user) => hasPermission(user, 'studentFollowUp', 'access');

export const canAccessDailyReport = (user) => hasPermission(user, 'dailyReport', 'access');

export const dailyReportMode = (user) => {
  if (!user) return 'write';
  if (user.role === 'super_admin') return 'view';
  if (['write', 'view', 'both'].includes(user.dailyReportMode)) return user.dailyReportMode;
  if (user.role === 'user') return user.dailyReportViewOnly ? 'view' : 'write';
  return 'view';
};

export const isDailyReportViewOnly = (user) => dailyReportMode(user) === 'view';

export const isDailyReportPrivilegedViewer = (user) => (
  isSuperAdmin(user) || ['view', 'both'].includes(dailyReportMode(user))
);

export const isDailyReportWriter = (user) => (
  !isSuperAdmin(user) && ['write', 'both'].includes(dailyReportMode(user))
);

export const canAccessTrash = (user) => hasPermission(user, 'trash', 'access');

export const canAccessPortal = (user) => hasPermission(user, 'portal', 'access');

export const canAccessHallBooking = (user) => hasPermission(user, 'hallBooking', 'access');

export const canAccessTrainingSchedule = (user) => hasPermission(user, 'trainingSchedule', 'access');

export const canAccessAssociateDetails = (user) => hasPermission(user, 'associateDetails', 'access');

export const canAccessAnyCommission = (user) => (
  hasPermission(user, 'commissionAssociate', 'access')
  || hasPermission(user, 'commissionShareholder', 'access')
  || hasPermission(user, 'commissionDepartment', 'access')
);

export const canAccessUnicommission = (user) => hasPermission(user, 'unicommission', 'access');

export const canAccessModule = (user, moduleKey) => hasPermission(user, moduleKey, 'access');
