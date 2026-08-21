import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { FISCAL_YEARS } from '../../utils/fiscalYear';
import { useFiscalYear } from '../../context/FiscalYearContext';
import './Achievements.css';

const NEPALI_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashoj',
  'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra',
  'Baishakh', 'Jestha', 'Ashadh',
];

const QUARTER_MAP = {
  Shrawan: 'Q1', Bhadra: 'Q1', Ashoj: 'Q1',
  Kartik: 'Q2', Mangsir: 'Q2', Poush: 'Q2',
  Magh: 'Q3', Falgun: 'Q3', Chaitra: 'Q3',
  Baishakh: 'Q4', Jestha: 'Q4', Ashadh: 'Q4',
};

const QUARTER_LABELS = {
  Q1: 'Q1 (Shrawan–Ashoj)',
  Q2: 'Q2 (Kartik–Poush)',
  Q3: 'Q3 (Magh–Chaitra)',
  Q4: 'Q4 (Baishakh–Ashadh)',
};

const NEPALI_MONTH_DATES_BY_FY = {
  '2082/83': {
    Shrawan:  { from: '2025-07-16', to: '2025-08-15' },
    Bhadra:   { from: '2025-08-16', to: '2025-09-15' },
    Ashoj:    { from: '2025-09-16', to: '2025-10-16' },
    Kartik:   { from: '2025-10-17', to: '2025-11-15' },
    Mangsir:  { from: '2025-11-16', to: '2025-12-14' },
    Poush:    { from: '2025-12-15', to: '2026-01-13' },
    Magh:     { from: '2026-01-14', to: '2026-02-12' },
    Falgun:   { from: '2026-02-13', to: '2026-03-13' },
    Chaitra:  { from: '2026-03-14', to: '2026-04-12' },
    Baishakh: { from: '2026-04-13', to: '2026-05-13' },
    Jestha:   { from: '2026-05-14', to: '2026-06-13' },
    Ashadh:   { from: '2026-06-14', to: '2026-07-16' },
  },
  '2083/84': {
    Shrawan:  { from: '2026-07-17', to: '2026-08-16' },
    Bhadra:   { from: '2026-08-17', to: '2026-09-16' },
    Ashoj:    { from: '2026-09-17', to: '2026-10-17' },
    Kartik:   { from: '2026-10-18', to: '2026-11-16' },
    Mangsir:  { from: '2026-11-17', to: '2026-12-15' },
    Poush:    { from: '2026-12-16', to: '2027-01-14' },
    Magh:     { from: '2027-01-15', to: '2027-02-12' },
    Falgun:   { from: '2027-02-13', to: '2027-03-14' },
    Chaitra:  { from: '2027-03-15', to: '2027-04-13' },
    Baishakh: { from: '2027-04-14', to: '2027-05-14' },
    Jestha:   { from: '2027-05-15', to: '2027-06-14' },
    Ashadh:   { from: '2027-06-15', to: '2027-07-15' },
  },
  '2084/85': {
    Shrawan:  { from: '2027-07-16', to: '2027-08-16' },
    Bhadra:   { from: '2027-08-17', to: '2027-09-16' },
    Ashoj:    { from: '2027-09-17', to: '2027-10-17' },
    Kartik:   { from: '2027-10-18', to: '2027-11-16' },
    Mangsir:  { from: '2027-11-17', to: '2027-12-15' },
    Poush:    { from: '2027-12-16', to: '2028-01-14' },
    Magh:     { from: '2028-01-15', to: '2028-02-12' },
    Falgun:   { from: '2028-02-13', to: '2028-03-14' },
    Chaitra:  { from: '2028-03-15', to: '2028-04-13' },
    Baishakh: { from: '2028-04-14', to: '2028-05-14' },
    Jestha:   { from: '2028-05-15', to: '2028-06-14' },
    Ashadh:   { from: '2028-06-15', to: '2028-07-15' },
  },
};

const STAGES = [
  { key: 'inquiry', label: 'Inquiry', short: 'Inq' },
  { key: 'wip', label: 'GS / WIP / Financial', short: 'WIP' },
  { key: 'visaLodge', label: 'Visa Lodge', short: 'V.Lodge' },
  { key: 'visa', label: 'Visa', short: 'Visa' },
];

const RATIO_LABELS = [
  { key: 'inquiryToWip', label: 'Inquiry → WIP' },
  { key: 'wipToVisaLodge', label: 'WIP → Visa Lodge' },
  { key: 'visaLodgeToVisa', label: 'Visa Lodge → Visa' },
  { key: 'inquiryToVisa', label: 'Inquiry → Visa' },
];

const emptyTargets = () => ({ inquiry: '', wip: '', visaLodge: '', visa: '' });

function pillClass(pct) {
  if (pct >= 90) return 'ach-pill-good';
  if (pct >= 60) return 'ach-pill-mid';
  return 'ach-pill-bad';
}

const SearchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);

const PlusIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const RefreshIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.36 2.6"/>
    <path d="M21 3v6h-6"/>
  </svg>
);

const EditIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const CheckIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function Achievements() {
  const { user } = useAuth();
  const { achFiscalYear, setAchFiscalYear } = useFiscalYear();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  const canCreate = hasPermission(user, 'achievements', 'create');
  const canEdit = hasPermission(user, 'achievements', 'edit');
  const canDelete = hasPermission(user, 'achievements', 'delete');
  const canExportExcel = hasPermission(user, 'achievements', 'exportExcel');
  const canExportPdf = hasPermission(user, 'achievements', 'exportPdf');
  const canPrint = hasPermission(user, 'achievements', 'print');

  const [fyMode, setFyMode] = useState(achFiscalYear || '2083/84');

  const [allCountries, setAllCountries] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [sortCol, setSortCol] = useState('nepaliMonth');
  const [sortDir, setSortDir] = useState('asc');

  const [formMonth, setFormMonth] = useState(NEPALI_MONTHS[0]);
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formCountries, setFormCountries] = useState([]);
  const [addCountryId, setAddCountryId] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editTargets, setEditTargets] = useState(emptyTargets());

  const [quarterlyData, setQuarterlyData] = useState(null);
  const [qLoading, setQLoading] = useState(false);

  const entryFY = fyMode === 'all' ? '2083/84' : fyMode;

  useEffect(() => {
    setAchFiscalYear(fyMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fyMode]);

  useEffect(() => {
    const monthDates = (NEPALI_MONTH_DATES_BY_FY[entryFY] || {})[formMonth];
    if (monthDates) {
      setFormFrom(monthDates.from);
      setFormTo(monthDates.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryFY, formMonth]);

  useEffect(() => {
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCountries() {
    try {
      const endpoint = isSuperAdmin ? '/countries' : '/countries/mine';
      const r = await axios.get(endpoint);
      const list = (r.data?.countries || []).filter(c => c.status !== 'inactive');
      setAllCountries(list);

      if (!isAdmin && list.length > 0 && !filterCountry) {
        setFilterCountry(list[0]._id);
      }
    } catch {
      toast.error('Could not load countries');
    }
  }

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fyMode !== 'all') params.fiscalYear = fyMode;
      if (filterCountry) params.country = filterCountry;
      if (filterQuarter) params.quarter = filterQuarter;

      const r = await axios.get('/achievements', { params });
      setRows(r.data || []);
    } catch (err) {
      toast.error('Could not load achievements');
    } finally {
      setLoading(false);
    }
  }, [fyMode, filterCountry, filterQuarter]);

  useEffect(() => { loadRows(); }, [loadRows]);

  function handleMonthChange(m) {
    setFormMonth(m);
    const monthDates = (NEPALI_MONTH_DATES_BY_FY[entryFY] || {})[m];
    if (monthDates) {
      setFormFrom(monthDates.from);
      setFormTo(monthDates.to);
    }
  }

  function addCountryToForm() {
    if (!addCountryId) return;
    if (formCountries.find(fc => fc.id === addCountryId)) {
      toast.error('Country already added');
      return;
    }
    const c = allCountries.find(c => c._id === addCountryId);
    if (!c) return;
    setFormCountries(prev => [...prev, { id: c._id, name: c.name, flag: c.flag, targets: emptyTargets() }]);
    setAddCountryId('');
  }

  function removeCountryFromForm(id) {
    setFormCountries(prev => prev.filter(fc => fc.id !== id));
  }

  function setCountryStageTarget(id, stageKey, val) {
    setFormCountries(prev => prev.map(fc => fc.id === id ? { ...fc, targets: { ...fc.targets, [stageKey]: val } } : fc));
  }

  function targetsValid(targets) {
    return STAGES.every(s => {
      const v = targets[s.key];
      return v === '' || (!isNaN(Number(v)) && Number(v) >= 0);
    });
  }

  function cleanTargets(targets) {
    const out = {};
    STAGES.forEach(s => { out[s.key] = Number(targets[s.key]) || 0; });
    return out;
  }

  async function handleSave() {
    if (formCountries.length === 0) {
      toast.error('Add at least one country');
      return;
    }
    const invalid = formCountries.find(fc => !targetsValid(fc.targets));
    if (invalid) {
      toast.error(`Please enter valid stage targets for ${invalid.name}`);
      return;
    }
    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const fc of formCountries) {
      try {
        await axios.post('/achievements', {
          fiscalYear: entryFY,
          nepaliMonth: formMonth,
          fromDate: formFrom,
          toDate: formTo,
          country: fc.id,
          targets: cleanTargets(fc.targets),
        });
        saved++;
      } catch (err) {
        failed++;
        console.error(err);
      }
    }
    setSaving(false);
    if (saved > 0) toast.success(`Saved ${saved} target${saved > 1 ? 's' : ''}`);
    if (failed > 0) toast.error(`${failed} save${failed > 1 ? 's' : ''} failed`);
    setFormCountries([]);
    loadRows();
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const displayed = rows
    .filter(r => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.nepaliMonth.toLowerCase().includes(q) && !(r.country?.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'nepaliMonth') {
        va = NEPALI_MONTHS.indexOf(a.nepaliMonth);
        vb = NEPALI_MONTHS.indexOf(b.nepaliMonth);
      } else if (sortCol === 'country') {
        va = a.country?.name || '';
        vb = b.country?.name || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  function SortArrow({ col }) {
    if (sortCol !== col) return <span style={{ color: 'var(--gray-300)', marginLeft: 3 }}>↕</span>;
    return <span style={{ color: 'var(--uca-blue)', marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this target row?')) return;
    try {
      await axios.delete(`/achievements/${id}`);
      toast.success('Deleted');
      setRows(prev => prev.filter(r => r._id !== id));
    } catch {
      toast.error('Delete failed');
    }
  }

  function startEdit(row) {
    setEditingId(row._id);
    setEditTargets({
      inquiry: String(row.targets?.inquiry ?? 0),
      wip: String(row.targets?.wip ?? 0),
      visaLodge: String(row.targets?.visaLodge ?? 0),
      visa: String(row.targets?.visa ?? 0),
    });
  }

  async function handleInlineSave(row) {
    if (!targetsValid(editTargets)) { toast.error('Invalid target'); return; }
    try {
      await axios.put(`/achievements/${row._id}`, { targets: cleanTargets(editTargets) });
      toast.success('Targets updated');
      setEditingId(null);
      loadRows();
    } catch {
      toast.error('Update failed');
    }
  }

  async function generateQuarterly() {
    setQLoading(true);
    setQuarterlyData(null);
    try {
      const params = {};
      params.fiscalYear = fyMode === 'all' ? entryFY : fyMode;
      if (filterCountry) params.country = filterCountry;
      const r = await axios.get('/achievements/quarterly', { params });
      setQuarterlyData(r.data || []);
    } catch {
      toast.error('Could not generate report');
    } finally {
      setQLoading(false);
    }
  }

  function exportExcel() {
    try {
      const XLSX = window.XLSX;
      if (!XLSX) { toast.error('Excel library not loaded'); return; }
      const header = [
        'Nepali Month', 'From', 'To', 'Quarter', 'Fiscal Year', 'Country',
        ...STAGES.flatMap(s => [`${s.label} Target`, `${s.label} Achieved`, `${s.label} % Achieved`]),
        ...RATIO_LABELS.map(r => `Ratio: ${r.label}`),
      ];
      const data = [
        header,
        ...displayed.map(r => [
          r.nepaliMonth,
          r.fromDate ? new Date(r.fromDate).toLocaleDateString() : '',
          r.toDate ? new Date(r.toDate).toLocaleDateString() : '',
          r.quarter || '',
          r.fiscalYear || '',
          r.country?.name || '',
          ...STAGES.flatMap(s => [r.targets?.[s.key] ?? 0, r.achieved?.[s.key] ?? 0, `${r.pctAchieved?.[s.key] ?? 0}%`]),
          ...RATIO_LABELS.map(rl => `${r.ratios?.[rl.key] ?? 0}%`),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Achievements');
      const fileLabel = fyMode === 'all' ? 'all-years' : fyMode.replace('/', '-');
      XLSX.writeFile(wb, `achievements-${fileLabel}.xlsx`);
    } catch (e) {
      toast.error('Excel export failed');
    }
  }

  function exportPDF() {
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) { toast.error('PDF library not loaded'); return; }
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(13);
      const fyLabel = fyMode === 'all' ? 'All Years' : `Fiscal Year ${fyMode}`;
      doc.text(`Achievements: ${fyLabel}`, 14, 14);
      doc.autoTable({
        startY: 22,
        head: [['Month', 'FY', 'Country', ...STAGES.flatMap(s => [`${s.short} Tgt`, `${s.short} Ach`, `${s.short} %`])]],
        body: displayed.map(r => [
          r.nepaliMonth,
          r.fiscalYear || '',
          r.country?.name || '',
          ...STAGES.flatMap(s => [r.targets?.[s.key] ?? 0, r.achieved?.[s.key] ?? 0, `${r.pctAchieved?.[s.key] ?? 0}%`]),
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [46, 79, 143] },
      });
      const fileLabel = fyMode === 'all' ? 'all-years' : fyMode.replace('/', '-');
      doc.save(`achievements-${fileLabel}.pdf`);
    } catch (e) {
      toast.error('PDF export failed');
    }
  }

  const quarterlyByQ = {};
  if (quarterlyData) {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      quarterlyByQ[q] = quarterlyData.filter(d => d.quarter === q);
    });
  }

  const availableToAdd = allCountries.filter(c => !formCountries.find(fc => fc.id === c._id));

  const filterCountryOptions = allCountries;

  return (
    <div className="ach-page">
      <div className="ach-page-head">
        <div>
          <h1>Achievements: Target vs. Achievement</h1>
          <p>Set monthly stage targets per country. Achievement is pulled automatically from Applications.</p>
        </div>
        {canCreate && (
          <button
            className="ach-btn ach-btn-primary"
            onClick={() => document.getElementById('ach-entry-card').scrollIntoView({ behavior: 'smooth' })}
          >
            {PlusIcon} New Monthly Entry
          </button>
        )}
      </div>

      {}
      <div className="ach-fy-banner">
        <span className="ach-fy-dot" />
        <span style={{ marginRight: 8 }}>View:</span>
        <div className="ach-fy-tabs">
          <button
            className={`ach-fy-tab ${fyMode === 'all' ? 'active' : ''}`}
            onClick={() => setFyMode('all')}
          >
            All Years
          </button>
          {FISCAL_YEARS.map(fy => (
            <button
              key={fy.label}
              className={`ach-fy-tab ${fyMode === fy.label ? 'active' : ''}`}
              onClick={() => setFyMode(fy.label)}
            >
              {fy.label}
            </button>
          ))}
        </div>
        {fyMode !== 'all' && (
          <span className="ach-fy-badge">(B.S.)</span>
        )}
      </div>

      {}
      {canCreate && (
      <div className="ach-card" id="ach-entry-card">
        <div className="ach-card-head">
          <div>
            <h2>Add Monthly Targets</h2>
            <p>
              Targets are entered per stage. Achievement and conversion ratios are read-only, computed automatically.
              <strong> Saving under fiscal year: {entryFY}</strong>
            </p>
          </div>
        </div>

        <div className="ach-entry-grid">
          <div className="ach-field">
            <label>Nepali Month</label>
            <select value={formMonth} onChange={e => handleMonthChange(e.target.value)}>
              {NEPALI_MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="ach-field">
            <label>From (English Date, auto)</label>
            <input type="date" value={formFrom} onChange={e => setFormFrom(e.target.value)} />
          </div>
          <div className="ach-field">
            <label>To (English Date, auto)</label>
            <input type="date" value={formTo} onChange={e => setFormTo(e.target.value)} />
          </div>
          <div className="ach-field">
            <label>Quarter (auto)</label>
            <input type="text" value={`${QUARTER_MAP[formMonth]} (${QUARTER_LABELS[QUARTER_MAP[formMonth]].slice(3)})`} disabled />
          </div>
          <div className="ach-field">
            <label>Fiscal Year</label>
            <select
              value={entryFY}
              onChange={e => {
                if (fyMode !== 'all') setFyMode(e.target.value);
              }}
              style={{ fontWeight: 600 }}
            >
              {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
            </select>
          </div>
        </div>

        <div className="ach-countries-table">
          <div className="ach-country-header ach-country-header-stages">
            <div>Country</div>
            {STAGES.map(s => <div key={s.key}>{s.label} Target</div>)}
            <div></div>
          </div>

          {formCountries.length === 0 && (
            <div className="ach-empty" style={{ padding: '18px 8px' }}>
              Add countries below to set stage targets.
            </div>
          )}

          {formCountries.map(fc => (
            <FormCountryRow
              key={fc.id}
              fc={fc}
              formMonth={formMonth}
              formFrom={formFrom}
              formTo={formTo}
              entryFY={entryFY}
              onTarget={setCountryStageTarget}
              onRemove={removeCountryFromForm}
            />
          ))}

          <div className="ach-add-country-bar">
            <select
              value={addCountryId}
              onChange={e => setAddCountryId(e.target.value)}
            >
              <option value="">Select country to add…</option>
              {availableToAdd.map(c => (
                <option key={c._id} value={c._id}>{c.flag || ''} {c.name}</option>
              ))}
            </select>
            <button className="ach-btn ach-btn-outline ach-btn-sm" onClick={addCountryToForm} disabled={!addCountryId}>
              {PlusIcon} Add Country
            </button>
          </div>
        </div>

        <div className="ach-form-actions">
          <button
            className="ach-btn ach-btn-outline"
            onClick={() => setFormCountries([])}
            disabled={saving}
          >
            Clear
          </button>
          <button
            className="ach-btn ach-btn-primary"
            onClick={handleSave}
            disabled={saving || formCountries.length === 0}
          >
            {saving ? 'Saving…' : 'Save Monthly Entry'}
          </button>
        </div>
      </div>
      )}

      {}
      <div className="ach-card">
        <div className="ach-card-head">
          <div>
            <h2>Monthly Target vs. Achievement</h2>
            <p>
              {fyMode === 'all'
                ? 'Showing all years across all countries and stages.'
                : `Showing fiscal year ${fyMode} across all countries and stages.`}
              {!isSuperAdmin && !isAdmin && ' Filtered to your assigned countries.'}
            </p>
          </div>
        </div>

        <div className="ach-toolbar">
          <div className="ach-search-box">
            {SearchIcon}
            <input
              type="text"
              placeholder="Search month or country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="ach-filter-select"
            value={filterCountry}
            onChange={e => setFilterCountry(e.target.value)}
          >
            <option value="">
              {isSuperAdmin || isAdmin ? 'All Countries' : 'My Countries'}
            </option>
            {filterCountryOptions.map(c => <option key={c._id} value={c._id}>{c.flag || ''} {c.name}</option>)}
          </select>
          <select
            className="ach-filter-select"
            value={filterQuarter}
            onChange={e => setFilterQuarter(e.target.value)}
          >
            <option value="">All Quarters</option>
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <option key={q} value={q}>{QUARTER_LABELS[q]}</option>
            ))}
          </select>
          <div className="ach-export-group">
            {canExportExcel && (
              <button className="ach-export-btn" onClick={exportExcel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
            )}
            {canExportPdf && (
              <button className="ach-export-btn" onClick={exportPDF}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                PDF
              </button>
            )}
            {canPrint && (
              <button className="ach-export-btn" onClick={() => window.print()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="ach-loading"><span className="ach-spinner" /> Loading…</div>
        ) : (
          <div className="ach-table-wrap">
            <table className="ach-table ach-table-stages">
              <thead>
                <tr>
                  <th rowSpan={2} onClick={() => handleSort('nepaliMonth')}>
                    Month <SortArrow col="nepaliMonth" />
                  </th>
                  <th rowSpan={2}>Quarter</th>
                  {fyMode === 'all' && <th rowSpan={2}>FY</th>}
                  <th rowSpan={2} onClick={() => handleSort('country')}>
                    Country <SortArrow col="country" />
                  </th>
                  {STAGES.map(s => (
                    <th key={s.key} colSpan={3} className="ach-stage-group-head">{s.label}</th>
                  ))}
                  <th colSpan={4} className="ach-stage-group-head">Conversion Ratios (auto)</th>
                  <th rowSpan={2}>Actions</th>
                </tr>
                <tr>
                  {STAGES.map(s => (
                    <React.Fragment key={s.key}>
                      <th className="ach-subhead">Target</th>
                      <th className="ach-subhead">Achieved</th>
                      <th className="ach-subhead">%</th>
                    </React.Fragment>
                  ))}
                  {RATIO_LABELS.map(r => (
                    <th key={r.key} className="ach-subhead" title={r.label}>{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={3 + (fyMode === 'all' ? 1 : 0) + STAGES.length * 3 + RATIO_LABELS.length + 1}>
                      <div className="ach-empty">No rows match your search or filter.</div>
                    </td>
                  </tr>
                ) : (
                  displayed.map(row => {
                    const isEditing = editingId === row._id;
                    return (
                      <tr key={row._id}>
                        <td>
                          <strong>{row.nepaliMonth}</strong>
                          <div className="ach-date-sub">
                            {row.fromDate ? new Date(row.fromDate).toLocaleDateString() : ''} – {row.toDate ? new Date(row.toDate).toLocaleDateString() : ''}
                          </div>
                        </td>
                        <td><span className="ach-quarter-tag">{row.quarter}</span></td>
                        {fyMode === 'all' && (
                          <td><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)' }}>{row.fiscalYear}</span></td>
                        )}
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.country?.flag && <span>{row.country.flag}</span>}
                            {row.country?.name || '—'}
                          </span>
                        </td>
                        {STAGES.map(s => (
                          <React.Fragment key={s.key}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="number" min="0" className="ach-inline-input"
                                  value={editTargets[s.key]}
                                  onChange={e => setEditTargets(t => ({ ...t, [s.key]: e.target.value }))}
                                />
                              ) : (
                                <span className="ach-target-chip" title="Click Edit to change">
                                  {row.targets?.[s.key] ?? 0}
                                </span>
                              )}
                            </td>
                            <td><strong>{row.achieved?.[s.key] ?? 0}</strong></td>
                            <td>
                              <span className={`ach-pill ${pillClass(row.pctAchieved?.[s.key] ?? 0)}`}>
                                {row.pctAchieved?.[s.key] ?? 0}%
                              </span>
                            </td>
                          </React.Fragment>
                        ))}
                        {RATIO_LABELS.map(r => (
                          <td key={r.key}>
                            <span className="ach-ratio-badge">{row.ratios?.[r.key] ?? 0}%</span>
                          </td>
                        ))}
                        <td>
                          <div className="ach-row-actions">
                            {isEditing ? (
                              <>
                                <button className="ach-icon-btn" title="Save" onClick={() => handleInlineSave(row)}>{CheckIcon}</button>
                                <button className="ach-icon-btn" title="Cancel" onClick={() => setEditingId(null)}>{XIcon}</button>
                              </>
                            ) : (
                              <>
                                {canEdit && (
                                  <button className="ach-icon-btn" title="Edit targets" onClick={() => startEdit(row)}>{EditIcon}</button>
                                )}
                                {canDelete && (
                                  <button className="ach-icon-btn danger" title="Delete row" onClick={() => handleDelete(row._id)}>{TrashIcon}</button>
                                )}
                                {!canEdit && !canDelete && <span style={{ color: 'var(--text-secondary, #888)', fontSize: 12 }}>—</span>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      <div className="ach-card">
        <div className="ach-card-head">
          <div>
            <h2>Quarterly Report</h2>
            <p>
              Auto-rolls up the 3 months in each quarter, per stage.
              {fyMode === 'all'
                ? ` Report generated for ${entryFY} (select a specific FY above to change).`
                : ` Report for ${fyMode}.`}
            </p>
          </div>
          <button
            className="ach-btn ach-btn-primary ach-btn-sm"
            onClick={generateQuarterly}
            disabled={qLoading}
          >
            {RefreshIcon} {qLoading ? 'Generating…' : 'Generate Quarterly Report'}
          </button>
        </div>

        {qLoading && (
          <div className="ach-loading"><span className="ach-spinner" /> Generating…</div>
        )}

        {!qLoading && quarterlyData === null && (
          <div className="ach-empty">Click "Generate Quarterly Report" to see Q1–Q4 stage totals per country.</div>
        )}

        {!qLoading && quarterlyData !== null && (
          <div className="ach-quarterly-grid">
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <div className="ach-q-block" key={q}>
                <div className="ach-q-block-head">
                  <strong>{q}</strong>
                  <span>{QUARTER_LABELS[q].slice(3)}</span>
                </div>
                {(quarterlyByQ[q] || []).length === 0 ? (
                  <div className="ach-empty" style={{ padding: '14px' }}>No data for {q}</div>
                ) : (
                  <table className="ach-q-table">
                    <thead>
                      <tr>
                        <th>Country</th>
                        {STAGES.map(s => <th key={s.key}>{s.short}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(quarterlyByQ[q] || []).map((d, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {d.country?.flag && <span>{d.country.flag}</span>}
                              {d.country?.name || '—'}
                            </span>
                          </td>
                          {STAGES.map(s => (
                            <td key={s.key}>
                              <div className="ach-q-stage-cell">
                                <span>{d.totalAchieved?.[s.key] ?? 0}/{d.totalTargets?.[s.key] ?? 0}</span>
                                <span className={`ach-pill ${pillClass(d.pctAchieved?.[s.key] ?? 0)}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                  {d.pctAchieved?.[s.key] ?? 0}%
                                </span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormCountryRow({ fc, formMonth, formFrom, formTo, entryFY, onTarget, onRemove }) {
  const [achieved, setAchieved] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!fc.id || !formFrom || !formTo) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingA(true);
      try {
        const r = await axios.get('/achievements', {
          params: { country: fc.id, fiscalYear: entryFY },
        });
        const match = (r.data || []).find(d =>
          d.nepaliMonth === formMonth &&
          d.country?._id === fc.id
        );
        setAchieved(match ? match.achieved : null);
      } catch {
        setAchieved(null);
      } finally {
        setLoadingA(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [fc.id, formMonth, formFrom, formTo, entryFY]);

  return (
    <div className="ach-country-row ach-country-row-stages">
      <div className="ach-country-name">
        {fc.flag && <span className="ach-country-flag">{fc.flag}</span>}
        {fc.name}
      </div>
      {STAGES.map(s => (
        <div key={s.key} className="ach-stage-input-cell">
          <input
            type="number"
            min="0"
            placeholder="0"
            className="ach-target-input"
            value={fc.targets[s.key]}
            onChange={e => onTarget(fc.id, s.key, e.target.value)}
          />
          {loadingA ? (
            <small className="ach-stage-hint">…</small>
          ) : achieved ? (
            <small className="ach-stage-hint">{achieved[s.key] ?? 0} achieved</small>
          ) : (
            <small className="ach-stage-hint muted">not yet saved</small>
          )}
        </div>
      ))}
      <div>
        <button className="ach-remove-btn" onClick={() => onRemove(fc.id)} title="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
