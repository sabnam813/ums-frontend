export const SECTIONS = ['associate', 'shareholder', 'department'];

export const SECTION_META = {
  associate: { label: 'Associate', permKey: 'commissionAssociate', hasNote: true, hasRemarks: true },
  shareholder: { label: 'Shareholder', permKey: 'commissionShareholder', hasNote: true, hasRemarks: true, hasPartner: true },
  department: { label: 'Department', permKey: 'commissionDepartment', hasNote: false, hasRemarks: false },
};

export function sectionLabel(section) {
  return SECTION_META[section]?.label || section;
}

export function sectionPermKey(section) {
  return SECTION_META[section]?.permKey || '';
}

export const DIRECT_INDIRECT_OPTIONS = ['Direct', 'Indirect'];
