
export function sidebarSelector(feature) {
  if (!feature) return '';
  const p = feature.path || '';
  if (feature.key === 'dashboard') return '[data-tour-path="/admin"], [data-tour-path="/dashboard"]';
  return `[data-tour-path="/admin${p}"], [data-tour-path="${p}"]`;
}

const STD_EXPORT = [
  { icon: 'download', needs: 'exportExcel', text: 'Use Excel to download the table (you can choose which columns).' },
  { icon: 'download', needs: 'exportPdf', text: 'Use PDF for a printable file of the same table.' },
  { icon: 'printer', needs: 'print', text: 'Use Print for a paper copy.' },
];

export const CURATED = {
  applications: {
    title: 'Applications',
    steps: [
      { icon: 'click', selector: '[data-tour-open="applications"]', text: 'Applications are grouped by country. Open the Applications list in the sidebar.' },
      { icon: 'globe', selector: '[data-tour-country]', text: 'Pick the country the student is applying to.' },
      { icon: 'plus', needs: 'create', selector: '.add-record-btn', text: 'Click Add to open the form. "Referred By" is a dropdown of your Associate Details.' },
      { icon: 'search', text: 'Use the search box and the filters above the table to narrow the list.' },
      { icon: 'upload', needs: 'import', text: 'Use Import to bring in many students from Excel at once.' },
      ...STD_EXPORT,
    ],
  },
  hallBooking: {
    title: 'Hall Booking',
    steps: [
      { icon: 'plus', needs: 'create', selector: '.hb-btn-primary', text: 'Click New Booking.' },
      { icon: 'form', needs: 'create', text: 'Choose Country Event for a visitor, or General Event for something like a board meeting, then fill in date, hall and time and save.' },
      { icon: 'search', selector: '.hb-toolbar', text: 'Search or filter by country and status.' },
      { icon: 'edit', needs: 'edit', text: 'Use the pencil on a row to change a booking.' },
      { icon: 'upload', needs: 'import', text: 'Use Import to add many bookings from Excel.' },
      ...STD_EXPORT,
    ],
  },
  trainingSchedule: {
    title: 'Training Schedule',
    steps: [
      { icon: 'plus', needs: 'create', selector: '.ts-btn-primary', text: 'Click New Schedule.' },
      { icon: 'form', needs: 'create', text: 'Pick the department (or All departments), type, date and time, add the venue and host, then save. A warning appears if it overlaps another meeting of the same department.' },
      { icon: 'search', selector: '.ts-toolbar', text: 'Use the search box, the department, type and status filters, the date range and the Today / This week / Upcoming chips.' },
      { icon: 'edit', needs: 'edit', text: 'Use the pencil on a row to change a schedule.' },
      { icon: 'upload', needs: 'import', text: 'Use Import to add many schedules from Excel at once.' },
      ...STD_EXPORT,
    ],
  },
  studentFollowUp: {
    title: 'Student Followup',
    steps: [
      { icon: 'plus', needs: 'create', selector: '.sfu-btn-primary', text: 'Use New Follow-up for a student who has no application yet. For an existing student, use the Followup button on their application row.' },
      { icon: 'clock', text: 'Each student has one row. Open it to see the full history and add or complete follow-ups. Reminders appear 30 minutes before the scheduled time.' },
      { icon: 'search', text: 'Use the tabs (Today, Overdue, Upcoming...) and the search box to find follow-ups.' },
      ...STD_EXPORT,
    ],
  },
  associateFollowUp: {
    title: 'Associate Followup',
    steps: [
      { icon: 'plus', needs: 'create', text: 'Add a follow-up with the date, the consultancy you spoke to and who you talked to.' },
      { icon: 'search', text: 'Search by company or person, or filter by date.' },
      ...STD_EXPORT,
    ],
  },
  commission: {
    title: 'Commission',
    steps: [
      { icon: 'folder', text: 'Commission is organised as Intake, then Country, then Associate, Shareholder or Department. Pick an intake tile first.' },
      { icon: 'plus', needs: 'create', selector: '.cms-btn-primary', text: 'Click Add and type the Name. It can be a university, college, school, agent or any partner.' },
      { icon: 'upload', needs: 'import', text: 'Import accepts any text in the Name column, not only universities.' },
      { icon: 'search', text: 'The search on the Commission home page looks across every intake, country and section.' },
      ...STD_EXPORT,
    ],
  },
  dailyReport: {
    title: 'Daily Report',
    steps: [
      { icon: 'edit', needs: 'create', selector: '.dr-report-form, form', text: "Write today's work as one point per line, then save. You can edit recent days; ask a Super Admin to unlock an older date." },
      { icon: 'users', text: 'If you can view everyone\'s reports, use the staff and date filters to review them and leave feedback.' },
    ],
  },
  unicommission: {
    title: 'Unicommission',
    steps: [
      { icon: 'folder', text: 'Pick a country. Each country has its own table, currency and commission rule (percentage of the fee or a fixed amount).' },
      { icon: 'link', text: 'Students appear here automatically when their application\'s visa outcome is set to Grant, existing grants too. Add fee, student ID and payment status here.' },
      { icon: 'plus', needs: 'create', selector: '.hb-btn-primary', text: 'Add Record is for students that are not in Applications.' },
      { icon: 'upload', needs: 'import', text: 'Import reads your Excel sheet (any sheet, even with a title row above the headings) and merges with students already here instead of duplicating them.' },
      { icon: 'search', selector: '.hb-toolbar, .uc-filters-wide', text: 'Search, filter by intake, university, associate, provider, level, payment status or visa granted dates.' },
      { icon: 'columns', selector: '.ad-table-wrap', text: 'Tick rows to bulk edit, or to export / print only those rows. With nothing ticked, everything shown is used.' },
    ],
  },
  associateDetails: {
    title: 'Associate Details',
    steps: [
      { icon: 'plus', needs: 'create', selector: '.hb-btn-primary', text: 'Click Add Associate and fill in the consultancy, owner, manager and contact details. Only the name is required.' },
      { icon: 'upload', needs: 'import', text: 'Import reads the Excel sheet using its own column headings. Re-importing updates existing consultancies by name instead of duplicating them.' },
      { icon: 'search', selector: '.hb-toolbar, .ad-filters', text: 'Search across every column, or filter by location, association, referrer and onboarding dates.' },
      { icon: 'columns', selector: '.ad-table-wrap', text: 'Scroll sideways and the Sno. and consultancy name stay fixed; scroll down and the heading stays fixed.' },
      { icon: 'link', text: 'Every associate you add here automatically appears in the "Referred By" dropdown of Applications and the "Associates" dropdown of Test Preparation.' },
      ...STD_EXPORT,
    ],
  },
  testPrep: {
    title: 'Test Preparation',
    steps: [
      { icon: 'folder', text: 'Choose a test type (IELTS, PTE and so on) to open its bookings.' },
      { icon: 'plus', needs: 'create', text: 'Add a booking: the Associates field is a dropdown of your Associate Details.' },
      { icon: 'search', text: 'Filter by associate, module, payment status or date.' },
      { icon: 'upload', needs: 'import', text: 'Use Import for many bookings at once.' },
      ...STD_EXPORT,
    ],
  },
  inquiries: {
    title: 'Inquiries',
    steps: [
      { icon: 'plus', needs: 'create', text: 'Add an inquiry with the applicant, country, level, stage and mode.' },
      { icon: 'search', text: 'Filter by stage, country, associate or date.' },
      ...STD_EXPORT,
    ],
  },
  portal: {
    title: 'Portal',
    steps: [
      { icon: 'plus', needs: 'create', text: 'Add a portal link with its category, then choose which departments can see it.' },
      { icon: 'search', text: 'Search or sort the list. Portal logins are shared only with the departments you choose.' },
    ],
  },
  trash: {
    title: 'Trash',
    steps: [
      { icon: 'trash', text: 'Anything deleted lands here for 60 days. Open an item and choose Restore to bring it back.' },
    ],
  },
  users: {
    title: 'Users',
    steps: [
      { icon: 'plus', text: 'Create a staff account, then give them a department and countries.' },
      { icon: 'shield', text: 'Use the permission matrix to give a person extra access or take some away on top of their department.' },
    ],
  },
  departments: {
    title: 'Departments',
    steps: [
      { icon: 'shield', text: 'A department holds the base permissions its members get. Personal changes are made on the user, so editing a department never wipes them.' },
    ],
  },
  reports: {
    title: 'Reports',
    steps: [
      { icon: 'chart', text: 'Pick the report (Applications, Inquiries or Test Prep), then filter by country, intake, associate and dates.' },
      ...STD_EXPORT,
    ],
  },
};

const ACTION_TEXT = {
  create: ['plus', 'Look for the Add or New button near the top right to create a record.'],
  edit: ['edit', 'Use the pencil on a row to change it.'],
  delete: ['trash', 'Deleting moves a record to Trash, where it can be restored for 60 days.'],
  import: ['upload', 'Use Import to bring in many rows from an Excel or CSV file.'],
  bulkEdit: ['edit', 'Tick several rows, then use Bulk Edit to change them together.'],
  exportExcel: ['download', 'Use Excel to download the table.'],
  exportPdf: ['download', 'Use PDF for a printable file.'],
  print: ['printer', 'Use Print for a paper copy.'],
};

export function stepsForFeature(feature, me) {
  if (!feature) return [];
  const can = (needs) => !needs || me?.isSuperAdmin || (feature.actions || []).includes(needs);
  const lead = {
    icon: 'sidebar',
    selector: sidebarSelector(feature),
    navigate: true,
    text: `${feature.label}: ${feature.desc || 'open it from the sidebar'}.`,
  };
  const curated = CURATED[feature.key];
  let body;
  if (curated) {
    body = curated.steps.filter(s => can(s.needs));
  } else {
    body = [{ icon: 'search', text: 'Use the search box and filters to find what you need.' }];
    Object.entries(ACTION_TEXT).forEach(([action, [icon, text]]) => {
      if ((feature.actions || []).includes(action) || (me?.isSuperAdmin && feature.actions?.length !== 0)) body.push({ icon, text });
    });
  }
  return [lead, ...body].map(s => ({ ...s, featureKey: feature.key, title: feature.label }));
}

export function pickFeatureForTopic(topic, features) {
  const words = String(topic || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !['how', 'the', 'can', 'add', 'new', 'make', 'create', 'use', 'teach', 'for', 'and', 'with', 'process', 'work', 'does', 'what'].includes(w));
  if (!words.length) return null;
  let best = null;
  (features || []).forEach(f => {
    const hay = ` ${[f.label, ...(f.aliases || []), f.keywords || '', f.desc || ''].join(' ').toLowerCase()} `;
    let score = 0;
    words.forEach(w => {
      const root = w.replace(/(ing|es|s)$/, '');
      if (hay.includes(` ${w} `)) score += 3;
      else if (root.length > 2 && hay.includes(root)) score += 1;
    });
    if (score > 0 && (!best || score > best.score)) best = { feature: f, score };
  });
  return best ? best.feature : null;
}
