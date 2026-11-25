export function isUKCountry(country) {
  if (!country) return false;
  const name = String(country.name || '').trim();
  const code = String(country.code || '').trim();
  return /^(united kingdom|uk|u\.k\.|great britain)$/i.test(name) || /^(uk|gb)$/i.test(code);
}

export const PROFILE_IDS = ['default', 'uk', 'europe', 'australia', 'usa', 'canada', 'asia', 'newzealand'];

export const PROFILE_NAMES = {
  default: 'Other countries',
  uk: 'United Kingdom',
  europe: 'Europe',
  australia: 'Australia',
  usa: 'USA',
  canada: 'Canada',
  asia: 'Asia',
  newzealand: 'New Zealand',
};

export const FIELD_DEFS = {
  date: { label: 'Date', kind: 'date', width: 110, fixed: true, aliases: ['applicationdate', 'dateofapplication'] },
  referredBy: { label: 'Referred By', kind: 'text', width: 100, fixed: true, aliases: ['referredby', 'referral', 'referrer'] },
  name: { label: 'Applicant Name', importLabel: 'Name', kind: 'text', width: 150, fixed: true, aliases: ['applicantname', 'studentname', 'nameofapplicant'] },
  level: { label: 'Level', kind: 'select', width: 80, fixed: true, aliases: ['programlevel', 'studylevel'] },
  course: { label: 'Course', kind: 'text', width: 130, fixed: true, aliases: ['programme', 'program', 'courseofstudy'] },
  providerName: { label: 'Provider', importLabel: 'Provider Name', kind: 'text', width: 150, fixed: true, aliases: ['provider', 'institution', 'university', 'college'] },
  initialIntake: { label: 'Initial Intake', kind: 'intake', placeholder: 'Month Year…', width: 100, aliases: ['intake', 'initialintakedate', 'intakeinitial'] },
  deferredIntake: { label: 'Deferred Intake', colLabel: 'Deferred', kind: 'intake', placeholder: 'If deferred…', width: 100, aliases: ['deferredintakedate', 'deferral', 'deferred'] },
  applicationFee: { label: 'Application Fee', kind: 'select', width: 120, aliases: ['applicationfee', 'appfee', 'applicationfeestatus'] },
  olRequest: { label: 'OL Request', kind: 'select', width: 110, aliases: ['olrequest', 'offerletterrequest'] },
  offerLetter: { label: 'OL Received', kind: 'select', width: 110, aliases: ['offer', 'offerletter', 'i20', 'olreceived'] },
  olType: { label: 'OL Type', kind: 'select', width: 110, aliases: ['oltype', 'offertype', 'offerlettertype'] },
  withdraw: { label: 'Withdraw', kind: 'select', width: 100, aliases: ['withdrawn', 'applicationwithdraw'] },
  precasDeposit: { label: 'Precas Deposit', kind: 'select', width: 120, aliases: ['precas', 'precasdeposit', 'deposit'] },
  interview: { label: 'Interview', kind: 'select', width: 100, aliases: ['interviewstatus', 'interviewresult'] },
  gsSubmission: { label: 'GS/WIP/Financial', kind: 'select', width: 140, aliases: ['gs', 'gssubmission', 'genuinestudent', 'financial', 'gis', 'gisfinancial'] },
  payment: { label: 'Payment Status', colLabel: 'Payment', kind: 'select', width: 110, aliases: ['payment', 'paymentstatus', 'tuitionfee', 'tuitionfeestatus'] },
  financialDocument: { label: 'Financial Document', kind: 'select', width: 150, aliases: ['financialdocument', 'financialdocuments', 'financialdoc', 'financialdocs'] },
  tbCertificate: { label: 'TB Certificate', kind: 'select', width: 120, aliases: ['tb', 'tbcertificate', 'tbcert', 'tbtest'] },
  coeCas: { label: 'COE/CAS', kind: 'select', width: 110, aliases: ['coe', 'cas', 'coecas', 'aipoutcome', 'aip'] },
  visaKit: { label: 'Visa Kit', kind: 'select', width: 100, aliases: ['visakit', 'kit'] },
  savisFee: { label: 'Sevis Fee', kind: 'select', width: 90, aliases: ['savis', 'savisfee', 'savisfeestatus', 'sevisfee'] },
  biometricDate: { label: 'Biometric Date', kind: 'date', width: 130, aliases: ['biometric', 'biometricdate'] },
  visaAppointmentDate: { label: 'Visa Appointment Date', kind: 'date', width: 150, aliases: ['visaappointment', 'visaappointmentdate', 'appointmentdate'] },
  visaLodgeDate: { label: 'Visa Lodgement Date', kind: 'date', width: 150, aliases: ['visalodgementdate', 'visalodgedate', 'lodgementdate', 'visalodged'] },
  visaLodgement: { label: 'Visa Granted Date', kind: 'date', width: 130, aliases: ['visalodge', 'visadate', 'visagranteddate', 'visagranted'] },
  visaOutcome: { label: 'Visa Outcome', kind: 'select', width: 100, aliases: ['visaresult', 'visastatus'] },
  visaWithdraw: { label: 'Visa Withdraw', kind: 'select', width: 110, aliases: ['visawithdrawn'] },
  refund: { label: 'Refund', kind: 'select', width: 100, aliases: ['refundstatus'] },
  eVisa: { label: 'E-Visa', kind: 'select', width: 100, aliases: ['evisa', 'evisastatus'] },
  flightDate: { label: 'Flight Date', kind: 'date', width: 120, aliases: ['flight', 'flightdate', 'departuredate'] },
  studentIdCard: { label: 'Student ID Card', kind: 'select', width: 130, aliases: ['studentid', 'studentidcard', 'idcard'] },
  remarks: { label: 'Remarks', kind: 'textarea', placeholder: 'Additional remarks, follow-up notes…', width: 150, aliases: ['notes', 'comments', 'remark'] },
  other: { label: 'Other', kind: 'text', placeholder: 'Any other info', width: 130, aliases: ['others', 'otherinfo', 'otherinformation'] },
  through: { label: 'Through', kind: 'text', placeholder: 'Channel / sub-agent this came through', width: 120, aliases: ['channel', 'subagent', 'source'] },
};

export const FORM_FIELD_KEYS = Object.keys(FIELD_DEFS);
export const DATE_KEYS = FORM_FIELD_KEYS.filter(k => FIELD_DEFS[k].kind === 'date');
export const SELECT_KEYS = FORM_FIELD_KEYS.filter(k => FIELD_DEFS[k].kind === 'select' && k !== 'level');

export const MULTI_FILTER_KEYS = ['level', ...SELECT_KEYS, 'initialIntake', 'deferredIntake'];

const S = (title, keys) => ({ title, keys });

const COMMON_VISA = ['visaLodgement', 'visaOutcome', 'visaWithdraw', 'refund'];
const ADDITIONAL = S('Additional Information', ['other', 'remarks', 'through']);
const INTAKES = S('Intakes', ['initialIntake', 'deferredIntake']);

export const PROFILE_DEFS = {
  default: {
    financialSection: 'Financial',
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment', 'coeCas', 'savisFee']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  uk: {
    financialSection: 'CAS Process',
    labels: { payment: 'Tuition Fee Status' },
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'olType', 'withdraw', 'precasDeposit', 'interview']),
      S('CAS Process', ['payment', 'tbCertificate', 'financialDocument', 'coeCas']),
      S('Visa', ['biometricDate', ...COMMON_VISA]),
      S('Pre-departure', ['eVisa', 'flightDate', 'studentIdCard']),
      ADDITIONAL,
    ],
  },
  europe: {
    financialSection: 'Financial',
    labels: { gsSubmission: 'Financial' },
    sections: [
      INTAKES,
      S('Offer', ['applicationFee', 'olRequest', 'interview', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment', 'visaKit']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  australia: {
    financialSection: 'Financial',
    labels: { gsSubmission: 'GIS/Financial', coeCas: 'COE' },
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment', 'coeCas']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  usa: {
    financialSection: 'Financial',
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'visaAppointmentDate']),
      S('Financial', ['payment', 'savisFee']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  canada: {
    financialSection: 'Financial',
    labels: { gsSubmission: 'Financial' },
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment', 'coeCas']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  asia: {
    financialSection: 'Financial',
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment']),
      S('Visa', COMMON_VISA),
      ADDITIONAL,
    ],
  },
  newzealand: {
    financialSection: 'Financial',
    labels: { coeCas: 'AIP Outcome' },
    addOptions: { payment: ['Ongoing'] },
    sections: [
      INTAKES,
      S('Offer', ['olRequest', 'offerLetter', 'withdraw', 'gsSubmission']),
      S('Financial', ['payment', 'coeCas']),
      S('Visa', ['visaLodgeDate', ...COMMON_VISA]),
      ADDITIONAL,
    ],
  },
};

const NAME_RULES = [
  ['uk', /^(united kingdom|uk|u\.k\.|great britain)$/i],
  ['australia', /^australia$/i],
  ['usa', /^(usa|u\.s\.a\.?|us|united states|united states of america)$/i],
  ['canada', /^canada$/i],
  ['newzealand', /^new zealand$/i],
];

export function resolveProfileId(country, assign) {
  if (!country) return 'default';
  const id = String(country._id || '');
  const forced = assign && assign.countries && assign.countries[id];
  if (forced && PROFILE_DEFS[forced]) return forced;
  const name = String(country.name || '').trim();
  const code = String(country.code || '').trim();
  for (const [pid, re] of NAME_RULES) {
    if (re.test(name) || (pid === 'uk' && /^(uk|gb)$/i.test(code))) return pid;
  }
  const gid = country.group ? String(country.group._id || country.group) : '';
  const gForced = assign && assign.groups && gid && assign.groups[gid];
  if (gForced && PROFILE_DEFS[gForced]) return gForced;
  const gname = String(country.groupName || (country.group && country.group.name) || '');
  if (/europe/i.test(gname)) return 'europe';
  if (/asia/i.test(gname)) return 'asia';
  return 'default';
}

function uniqueCI(list) {
  const seen = new Set();
  return list.filter(v => {
    const k = String(v).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function baseLabel(profileId, key) {
  const def = FIELD_DEFS[key];
  const prof = PROFILE_DEFS[profileId] || PROFILE_DEFS.default;
  return (prof.labels && prof.labels[key]) || (def && def.label) || key;
}

export function resolveLayout(profileId, override, optionsByField) {
  const pid = PROFILE_DEFS[profileId] ? profileId : 'default';
  const prof = PROFILE_DEFS[pid];
  const ov = override || {};
  const fieldOv = ov.fields || {};
  const orderOv = ov.order || {};
  const optOv = ov.options || {};

  const labelOf = (key, surface) => {
    const custom = fieldOv[key] && fieldOv[key].label;
    if (custom) return custom;
    const def = FIELD_DEFS[key] || {};
    const hasProfileLabel = prof.labels && prof.labels[key];
    if (surface === 'col') {
      if (hasProfileLabel) return prof.labels[key];
      return def.colLabel || def.label || key;
    }
    if (surface === 'import') return hasProfileLabel ? prof.labels[key] : (def.importLabel || def.label || key);
    return hasProfileLabel ? prof.labels[key] : (def.label || key);
  };
  const isHidden = (key) => !!(fieldOv[key] && fieldOv[key].hidden);

  const sections = prof.sections.map(sec => {
    const saved = Array.isArray(orderOv[sec.title]) ? orderOv[sec.title].filter(k => sec.keys.includes(k)) : [];
    const keys = uniqueCI([...saved, ...sec.keys.filter(k => !saved.includes(k))]);
    return { title: sec.title, keys, visible: keys.filter(k => !isHidden(k)) };
  });

  const fixedHead = ['date', 'referredBy', 'name', 'level', 'course', 'providerName'];
  const bodySections = sections.filter(s => s.title !== 'Additional Information');
  const bodyKeys = bodySections.flatMap(s => s.visible);
  const tail = ['remarks', 'other', 'through'].filter(k => !isHidden(k));
  const allKeys = [...fixedHead, ...bodyKeys, ...tail];

  const columns = allKeys.map(k => ({ key: k, label: labelOf(k, 'col'), width: (FIELD_DEFS[k] || {}).width || 120 }));
  const selectKeys = bodyKeys.filter(k => (FIELD_DEFS[k] || {}).kind === 'select');
  const filterFields = selectKeys.map(k => ({ key: k, label: labelOf(k, 'col') }));
  const bulkFields = selectKeys.map(k => ({ key: k, label: labelOf(k, 'col') }));
  const bulkDateFields = bodyKeys.filter(k => (FIELD_DEFS[k] || {}).kind === 'date' && k !== 'visaLodgement')
    .map(k => ({ key: k, label: labelOf(k, 'col') }));
  const importFields = allKeys.map(k => ({
    key: k,
    label: labelOf(k, 'import'),
    aliases: (FIELD_DEFS[k] || {}).aliases || [],
  }));
  const dateFields = ['date', ...allKeys.filter(k => (FIELD_DEFS[k] || {}).kind === 'date' && k !== 'date')];

  const optionsFor = (key) => {
    if (optOv[key] && optOv[key].length) return optOv[key];
    const base = (optionsByField && optionsByField[key]) || [];
    const extra = (prof.addOptions && prof.addOptions[key]) || [];
    return uniqueCI([...base, ...extra]);
  };

  return {
    profileId: pid,
    name: PROFILE_NAMES[pid],
    financialSection: prof.financialSection,
    sections,
    columns,
    filterFields,
    bulkFields,
    bulkDateFields,
    importFields,
    dateFields,
    labelOf,
    isHidden,
    optionsFor,
  };
}

export function mapCustomFieldsForLayout(customFieldsBySection, layout) {
  const out = {};
  const titles = new Set(layout.sections.map(s => s.title));
  Object.entries(customFieldsBySection || {}).forEach(([section, fields]) => {
    const target = section === 'Financial' && !titles.has('Financial') ? layout.financialSection : section;
    const sec = layout.sections.find(s => s.title === target);
    const known = sec ? ['first', 'last', ...sec.keys] : null;
    const mapped = fields.map(f => {
      if (!known) return f;
      const pos = f.afterFieldId || 'last';
      return known.includes(pos) ? f : { ...f, afterFieldId: 'last' };
    });
    out[target] = [...(out[target] || []), ...mapped];
  });
  return out;
}

const DEFAULT_KNOWN_POSITIONS = {
  'Basic Information': ['first', 'referredBy', 'name', 'course', 'last'],
  'Intakes': ['first', 'deferredIntake', 'last'],
  'Offer': ['first', 'offerLetter', 'gsSubmission', 'last'],
  'Financial': ['first', 'coeCas', 'last'],
  'Visa': ['first', 'visaOutcome', 'refund', 'last'],
  'Additional Information': ['first', 'other', 'remarks', 'last'],
};

export function mapDefaultCustomFields(customFieldsBySection) {
  const out = {};
  Object.entries(customFieldsBySection || {}).forEach(([section, fields]) => {
    const known = DEFAULT_KNOWN_POSITIONS[section];
    out[section] = known
      ? fields.map(f => (known.includes(f.afterFieldId || 'last') ? f : { ...f, afterFieldId: 'last' }))
      : fields;
  });
  return out;
}
