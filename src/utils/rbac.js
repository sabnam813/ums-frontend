
export const MODULES = [
  { key: 'applications', label: 'Applications' },
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'testPreparation', label: 'Test Preparation' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'reports', label: 'Reports' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'dailyReport', label: 'Daily Report' },
  { key: 'trash', label: 'Trash' },
  { key: 'portal', label: 'Portal' },
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
  return modulePerm[action] === true;
}

export function getModulePermission(user, moduleKey) {
  if (user?.role === 'super_admin') {
    const all = {};
    ACTION_KEYS.forEach(a => { all[a] = true; });
    return all;
  }
  return normalizeModulePermission(user?.permissions?.[moduleKey]);
}
