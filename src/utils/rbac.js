
export const MODULES = [
  { key: 'applications', label: 'Applications' },
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'followUp', label: 'Associate Follow Up' },
  { key: 'studentFollowUp', label: 'Student Follow Up' },
  { key: 'testPreparation', label: 'Test Preparation' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'reports', label: 'Reports' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'tpAchievements', label: 'TP Achievements' },
  { key: 'dailyReport', label: 'Daily Report' },
  { key: 'trash', label: 'Trash' },
  { key: 'portal', label: 'Portal' },
  { key: 'hallBooking', label: 'Hall Booking' },
  { key: 'trainingSchedule', label: 'Training Schedule' },
  { key: 'associateDetails', label: 'Associate Details' },
  { key: 'commissionAssociate', label: 'Commission — Associate' },
  { key: 'commissionShareholder', label: 'Commission — Shareholder' },
  { key: 'commissionDepartment', label: 'Commission — Department' },
  { key: 'unicommission', label: 'Unicommission' },
];

export const ACTIONS = [
  { key: 'access', label: 'Access' },
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'import', label: 'Import' },
  { key: 'exportExcel', label: 'Export (Excel)' },
  { key: 'exportPdf', label: 'Export (PDF)' },
  { key: 'print', label: 'Print' },
  { key: 'bulkEdit', label: 'Bulk Edit' },
  { key: 'reports', label: 'Reports' },
  { key: 'manageFields', label: 'Manage Fields' },
  { key: 'settings', label: 'Settings' },
];

export const MODULE_KEYS = MODULES.map(m => m.key);
const VIEW_GRANTS = ['exportExcel', 'exportPdf', 'print'];
export const ACTION_KEYS = ACTIONS.map(a => a.key);

function normalizeModulePermission(modulePerm) {
  const perm = {};
  ACTION_KEYS.forEach(a => { perm[a] = modulePerm ? modulePerm[a] === true : false; });
  return perm;
}

export function hasPermission(user, moduleKey, action = 'access') {
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  const modulePerm = normalizeModulePermission(user.permissions?.[moduleKey]);
  if (!modulePerm.access) return false;
  if (action === 'access') return true;
  if (VIEW_GRANTS.includes(action) && modulePerm.view) return true;
  return modulePerm[action] === true;
}

export function getModulePermission(user, moduleKey) {
  if (user?.role === 'super_admin') {
    const all = {};
    ACTION_KEYS.forEach(a => { all[a] = true; });
    return all;
  }
  const perm = normalizeModulePermission(user?.permissions?.[moduleKey]);
  if (perm.access && perm.view) VIEW_GRANTS.forEach(a => { perm[a] = true; });
  return perm;
}

const ADMIN_DEFAULT_ACTIONS = ['access', 'view', 'exportExcel', 'exportPdf', 'print', 'reports'];
const ADMIN_NO_AUTO_GRANT = ['commissionAssociate', 'commissionShareholder', 'commissionDepartment', 'unicommission'];

export function emptyPermissions() {
  const perms = {};
  MODULE_KEYS.forEach(k => {
    perms[k] = {};
    ACTION_KEYS.forEach(a => { perms[k][a] = false; });
  });
  return perms;
}

export function normalizePerms(raw) {
  const perms = emptyPermissions();
  MODULE_KEYS.forEach(k => ACTION_KEYS.forEach(a => { perms[k][a] = !!raw?.[k]?.[a]; }));
  return perms;
}

function finalizePerms(perms) {
  MODULE_KEYS.forEach(k => {
    const m = perms[k];
    if (!m.access) ACTION_KEYS.forEach(a => { m[a] = false; });
    else if (!ACTION_KEYS.some(a => a !== 'access' && m[a])) m.view = true;
  });
  return perms;
}

export function defaultPermsForRole(role = 'user') {
  const perms = emptyPermissions();
  if (role === 'admin') {
    MODULE_KEYS.forEach(k => {
      if (ADMIN_NO_AUTO_GRANT.includes(k)) return;
      ADMIN_DEFAULT_ACTIONS.forEach(a => { perms[k][a] = true; });
    });
  } else {
    ['applications', 'dailyReport'].forEach(k => {
      ['access', 'view', 'create', 'edit'].forEach(a => { perms[k][a] = true; });
    });
  }
  return perms;
}

export function basePermissions(role, depts) {
  if (!depts || depts.length === 0) return defaultPermsForRole(role);
  const base = emptyPermissions();
  depts.forEach(d => {
    MODULE_KEYS.forEach(k => ACTION_KEYS.forEach(a => { if (d.permissions?.[k]?.[a]) base[k][a] = true; }));
  });
  return finalizePerms(base);
}

export function deptReportMode(dept) {
  if (['write', 'view', 'both'].includes(dept?.dailyReportMode)) return dept.dailyReportMode;
  return dept?.dailyReportViewOnly ? 'view' : 'write';
}

export function baseReportMode(role, depts) {
  if (!depts || depts.length === 0) return role === 'user' ? 'write' : 'view';
  const modes = depts.map(deptReportMode);
  const w = modes.some(m => m === 'write' || m === 'both');
  const v = modes.some(m => m === 'view' || m === 'both');
  return w && v ? 'both' : v ? 'view' : 'write';
}

export function diffFromBase(effective, base) {
  const eff = finalizePerms(normalizePerms(effective));
  const out = {};
  MODULE_KEYS.forEach(k => ACTION_KEYS.forEach(a => {
    if (eff[k][a] !== base[k][a]) { out[k] = out[k] || {}; out[k][a] = eff[k][a]; }
  }));
  return out;
}

export function applyOverrides(base, overrides) {
  const perms = normalizePerms(base);
  MODULE_KEYS.forEach(k => {
    const mod = overrides?.[k];
    if (mod) ACTION_KEYS.forEach(a => { if (typeof mod[a] === 'boolean') perms[k][a] = mod[a]; });
  });
  return finalizePerms(perms);
}

export const PRESETS = [
  { key: 'none', label: 'None', actions: [] },
  { key: 'view', label: 'View', actions: ['access', 'view', 'exportExcel', 'exportPdf', 'print'] },
  { key: 'editor', label: 'Editor', actions: ['access', 'view', 'create', 'edit', 'exportExcel', 'exportPdf', 'print'] },
  { key: 'full', label: 'Full', actions: ACTION_KEYS },
];

export const REPORT_MODES = [
  { key: 'write', label: 'Write own', hint: 'Writes their own daily report only.' },
  { key: 'view', label: 'View others', hint: 'Sees everyone\'s reports, can\'t write their own.' },
  { key: 'both', label: 'Both', hint: 'Sees everyone\'s reports and writes their own.' },
];
