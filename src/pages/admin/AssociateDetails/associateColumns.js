export const COLUMNS = [
  { key: 'sno', label: 'Sno.', type: 'number', width: 64, sticky: true, aliases: ['sno', 'sn', 'srno', 'serialno', 'serialnumber', 's.no', 'no', 'number'] },
  { key: 'dateOfOnboarding', label: 'Date of Onboarding', type: 'date', width: 130, aliases: ['dateofonboarding', 'onboardingdate', 'onboarded', 'dateonboarded', 'joineddate', 'dateofjoining'] },
  { key: 'consultancyName', label: 'Name Of Consultancy', type: 'text', width: 260, sticky: true, required: true, aliases: ['nameofconsultancy', 'consultancyname', 'consultancy', 'associatename', 'nameofassociate', 'associate', 'name', 'companyname', 'organization', 'organisation', 'agency', 'agencyname'] },
  { key: 'ownerName', label: 'Name of Owner/Director', type: 'text', width: 200, aliases: ['nameofownerdirector', 'ownername', 'owner', 'director', 'directorname', 'nameofowner', 'ownerdirector'] },
  { key: 'designation', label: 'Designation', type: 'text', width: 110, aliases: ['designation', 'position', 'title', 'role'] },
  { key: 'ownerContact', label: 'Contact No. of Owner', type: 'text', width: 150, aliases: ['contactnoofowner', 'ownercontact', 'ownerphone', 'ownermobile', 'ownercontactno', 'ownercontactnumber'] },
  { key: 'email', label: 'Email', type: 'text', width: 220, aliases: ['email', 'emailaddress', 'mail', 'emailid'] },
  { key: 'address', label: 'Address', type: 'text', width: 240, aliases: ['address', 'fulladdress'] },
  { key: 'location', label: 'Location', type: 'text', width: 120, aliases: ['location', 'city', 'district', 'place'] },
  { key: 'managerName', label: 'Name of Manager', type: 'text', width: 180, aliases: ['nameofmanager', 'managername', 'manager'] },
  { key: 'managerEmail', label: 'Email of Manager (secondary email)', type: 'text', width: 230, aliases: ['emailofmanagersecondaryemail', 'emailofmanager', 'manageremail', 'secondaryemail'] },
  { key: 'managerContact', label: 'Contact No. of Manager', type: 'text', width: 150, aliases: ['contactnoofmanager', 'managercontact', 'managerphone', 'managermobile', 'managercontactno'] },
  { key: 'officialPhone', label: 'Official Phone number', type: 'text', width: 150, aliases: ['officialphonenumber', 'officialphone', 'officephone', 'landline', 'phone', 'phonenumber'] },
  { key: 'emailAdmission', label: 'Email for Different purposes Email 1 (Admission)', type: 'text', width: 230, aliases: ['emailfordifferentpurposesemail1admission', 'email1admission', 'email1', 'admissionemail', 'emailadmission'] },
  { key: 'emailTestRegistration', label: 'Email 2 (Test Registration)', type: 'text', width: 220, aliases: ['email2testregistration', 'email2', 'testregistrationemail', 'emailtestregistration'] },
  { key: 'emailOthers', label: 'Email 3 (Others)', type: 'text', width: 220, aliases: ['email3others', 'email3', 'othersemail', 'otheremail', 'emailothers'] },
  { key: 'website', label: 'Website', type: 'text', width: 200, aliases: ['website', 'web', 'site', 'url', 'websiteurl'] },
  { key: 'referredBy', label: 'Referred by:', type: 'text', width: 150, aliases: ['referredby', 'referral', 'referrer', 'referredbyname'] },
  { key: 'association', label: 'Association', type: 'text', width: 200, aliases: ['association', 'associations', 'member', 'membership'] },
  { key: 'status', label: 'Status', type: 'text', width: 100, aliases: ['status', 'activestatus', 'activeinactive'] },
  { key: 'aliases', label: 'Aliases', type: 'text', width: 220, aliases: ['aliases', 'alias', 'othernames', 'shortnames', 'alsoknownas'] },
];

export const STICKY_COLUMNS = COLUMNS.filter(c => c.sticky);
export const CHECK_COL_WIDTH = 42;

export function stickyOffsets() {
  const out = {};
  let left = CHECK_COL_WIDTH;
  STICKY_COLUMNS.forEach(c => { out[c.key] = left; left += c.width; });
  return out;
}

export const FILTERS = [
  { key: 'location', label: 'Location' },
  { key: 'referredBy', label: 'Referred by' },
  { key: 'designation', label: 'Designation' },
];

export const IMPORT_FIELDS = COLUMNS.map(c => ({ key: c.key, label: c.label, aliases: c.aliases }));
export const EXPORT_COLUMNS = COLUMNS.map(c => ({ key: c.key, label: c.label, required: c.key === 'consultancyName' }));

export function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

const OWNER_FIELD = { ownerName: 'name', designation: 'designation', ownerContact: 'contact' };

export function ownersOf(row) {
  if (Array.isArray(row?.owners) && row.owners.length) return row.owners;
  if (row && (row.ownerName || row.designation || row.ownerContact)) {
    return [{ name: row.ownerName || '', designation: row.designation || '', contact: row.ownerContact || '' }];
  }
  return [];
}

export function cellValue(row, key) {
  if (OWNER_FIELD[key]) {
    return ownersOf(row).map(o => o[OWNER_FIELD[key]] || '').join('\n').replace(/\n+$/, '');
  }
  if (key === 'dateOfOnboarding') return fmtDate(row.dateOfOnboarding) || row.dateOfOnboardingText || '';
  if (key === 'status') return normalizeStatus(row.status);
  if (key === 'aliases') return Array.isArray(row.aliases) ? row.aliases.join(', ') : '';
  const v = row[key];
  return v === undefined || v === null ? '' : String(v);
}

export const STATUS_OPTIONS = ['Shareholder', 'Associate', 'Terminated', 'Closed'];
export const RED_STATUSES = ['Terminated', 'Closed'];
export function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  const hit = STATUS_OPTIONS.find(o => o.toLowerCase() === s);
  if (hit) return hit;
  if (s === 'inactive') return 'Closed';
  return 'Associate';
}
