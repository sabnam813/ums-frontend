import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { FISCAL_YEARS } from '../../utils/fiscalYear';
import { toastPDF, IconDownload, IconPrint } from '../../utils/exportHelpers';
import './Achievements.css';
import './TPAchievements.css';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

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

const MONTH_ROWS = [
  'Shrawan', 'Bhadra', 'Ashoj', 'Q1',
  'Kartik', 'Mangsir', 'Poush', 'Q2',
  'Magh', 'Falgun', 'Chaitra', 'Q3',
  'Baishakh', 'Jestha', 'Ashadh', 'Q4',
];

const NEPALI_MONTH_DATES_BY_FY = {
  '2082/83': {
    Shrawan: { from: '2025-07-16', to: '2025-08-15' },
    Bhadra: { from: '2025-08-16', to: '2025-09-15' },
    Ashoj: { from: '2025-09-16', to: '2025-10-16' },
    Kartik: { from: '2025-10-17', to: '2025-11-15' },
    Mangsir: { from: '2025-11-16', to: '2025-12-14' },
    Poush: { from: '2025-12-15', to: '2026-01-13' },
    Magh: { from: '2026-01-14', to: '2026-02-12' },
    Falgun: { from: '2026-02-13', to: '2026-03-13' },
    Chaitra: { from: '2026-03-14', to: '2026-04-12' },
    Baishakh: { from: '2026-04-13', to: '2026-05-13' },
    Jestha: { from: '2026-05-14', to: '2026-06-13' },
    Ashadh: { from: '2026-06-14', to: '2026-07-16' },
  },
  '2083/84': {
    Shrawan: { from: '2026-07-17', to: '2026-08-16' },
    Bhadra: { from: '2026-08-17', to: '2026-09-16' },
    Ashoj: { from: '2026-09-17', to: '2026-10-17' },
    Kartik: { from: '2026-10-18', to: '2026-11-16' },
    Mangsir: { from: '2026-11-17', to: '2026-12-15' },
    Poush: { from: '2026-12-16', to: '2027-01-14' },
    Magh: { from: '2027-01-15', to: '2027-02-12' },
    Falgun: { from: '2027-02-13', to: '2027-03-14' },
    Chaitra: { from: '2027-03-15', to: '2027-04-13' },
    Baishakh: { from: '2027-04-14', to: '2027-05-14' },
    Jestha: { from: '2027-05-15', to: '2027-06-14' },
    Ashadh: { from: '2027-06-15', to: '2027-07-15' },
  },
  '2084/85': {
    Shrawan: { from: '2027-07-16', to: '2027-08-16' },
    Bhadra: { from: '2027-08-17', to: '2027-09-16' },
    Ashoj: { from: '2027-09-17', to: '2027-10-17' },
    Kartik: { from: '2027-10-18', to: '2027-11-16' },
    Mangsir: { from: '2027-11-17', to: '2027-12-15' },
    Poush: { from: '2027-12-16', to: '2028-01-14' },
    Magh: { from: '2028-01-15', to: '2028-02-12' },
    Falgun: { from: '2028-02-13', to: '2028-03-14' },
    Chaitra: { from: '2028-03-15', to: '2028-04-13' },
    Baishakh: { from: '2028-04-14', to: '2028-05-14' },
    Jestha: { from: '2028-05-15', to: '2028-06-14' },
    Ashadh: { from: '2028-06-15', to: '2028-07-15' },
  },
};

function pillClass(pct) {
  if (pct >= 90) return 'ach-pill-good';
  if (pct >= 60) return 'ach-pill-mid';
  return 'ach-pill-bad';
}

const EditIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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
const TrashIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

export default function TPAchievements() {
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'tpAchievements', 'create');
  const canEdit = hasPermission(user, 'tpAchievements', 'edit');
  const canDelete = hasPermission(user, 'tpAchievements', 'delete');
  const canExportPdf = hasPermission(user, 'tpAchievements', 'exportPdf');
  const canPrint = hasPermission(user, 'tpAchievements', 'print');

  const [fiscalYear, setFiscalYear] = useState('2083/84');
  const [view, setView] = useState('monthly');
  const [weeklyMonth, setWeeklyMonth] = useState(NEPALI_MONTHS[0]);

  const [testTypes, setTestTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [pendingWeeks, setPendingWeeks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingKey, setEditingKey] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(null);
  const [clearingCell, setClearingCell] = useState(null);

  const canManage = canCreate || canEdit;
  const canClear = canDelete;

  const loadTestTypes = useCallback(async () => {
    try {
      const res = await axios.get('/tp-achievements/test-types');
      setTestTypes(res.data.testTypes || []);
    } catch {
      toast.error('Failed to load test types');
    }
  }, []);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/tp-achievements', {
        params: { periodType: 'monthly', fiscalYear },
      });
      setRows(res.data || []);
    } catch {
      toast.error('Failed to load TP achievements');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  const loadWeekly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/tp-achievements', { params: { periodType: 'weekly', fiscalYear, nepaliMonth: weeklyMonth } });
      setRows(res.data || []);
      setPendingWeeks([]);
    } catch {
      toast.error('Failed to load weekly TP achievements');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, weeklyMonth]);

  useEffect(() => { loadTestTypes(); }, [loadTestTypes]);
  useEffect(() => {
    if (view === 'monthly') loadMonthly();
    else loadWeekly();
  }, [view, loadMonthly, loadWeekly]);

  const monthlyByKey = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[`${r.nepaliMonth}_${r.testType?._id}`] = r; });
    return map;
  }, [rows]);

  const weeklyByKey = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[`${r.weekNumber}_${r.testType?._id}`] = r; });
    return map;
  }, [rows]);

  const weekList = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.weekNumber)) map.set(r.weekNumber, { weekNumber: r.weekNumber, from: r.fromDate, to: r.toDate });
    });
    pendingWeeks.forEach(w => {
      if (!map.has(w.weekNumber)) map.set(w.weekNumber, w);
    });
    return Array.from(map.values()).sort((a, b) => a.weekNumber - b.weekNumber);
  }, [rows, pendingWeeks]);

  function addWeek() {
    const lastWeek = weekList[weekList.length - 1];
    const nextNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;
    let from;
    if (lastWeek?.to) {
      const d = new Date(lastWeek.to);
      d.setDate(d.getDate() + 1);
      from = d.toISOString().slice(0, 10);
    } else {
      const monthRange = (NEPALI_MONTH_DATES_BY_FY[fiscalYear] || {})[weeklyMonth];
      from = monthRange ? monthRange.from : new Date().toISOString().slice(0, 10);
    }
    const toD = new Date(from);
    toD.setDate(toD.getDate() + 6);
    const to = toD.toISOString().slice(0, 10);
    setPendingWeeks(prev => [...prev, { weekNumber: nextNumber, from, to }]);
    startEdit(`${weeklyMonth}_${nextNumber}`, () => null, { from, to });
  }

  async function deleteWeek(weekNumber) {
    if (!window.confirm(`Delete Week ${weekNumber} and all its targets for ${weeklyMonth}? This can't be undone.`)) return;
    setDeletingWeek(weekNumber);
    try {
      const existsOnServer = rows.some(r => r.weekNumber === weekNumber);
      if (existsOnServer) {
        await axios.delete('/tp-achievements/week', { params: { fiscalYear, nepaliMonth: weeklyMonth, weekNumber } });
      }
      setPendingWeeks(prev => prev.filter(w => w.weekNumber !== weekNumber));
      toast.success(`Week ${weekNumber} deleted`);
      loadWeekly();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete week');
    } finally {
      setDeletingWeek(null);
    }
  }

  function quarterTotals(quarter) {
    const months = Object.keys(QUARTER_MAP).filter(m => QUARTER_MAP[m] === quarter);
    const totals = {};
    testTypes.forEach(tt => {
      let target = 0, achieved = 0;
      months.forEach(m => {
        const d = monthlyByKey[`${m}_${tt._id}`];
        if (d) { target += d.target || 0; achieved += d.achieved || 0; }
      });
      totals[tt._id] = { target, achieved };
    });
    return totals;
  }

  const fiscalYearTotal = useMemo(() => {
    const totals = {};
    testTypes.forEach(tt => {
      let target = 0, achieved = 0;
      NEPALI_MONTHS.forEach(m => {
        const d = monthlyByKey[`${m}_${tt._id}`];
        if (d) { target += d.target || 0; achieved += d.achieved || 0; }
      });
      totals[tt._id] = { target, achieved };
    });
    return totals;
  }, [monthlyByKey, testTypes]);

  function rowGrandTotal(getCellFn, testTypeList) {
    let target = 0, achieved = 0;
    testTypeList.forEach(tt => {
      const cell = getCellFn(tt._id);
      target += cell?.target || 0;
      achieved += cell?.achieved || 0;
    });
    return { target, achieved };
  }

  function startEdit(key, existingLookup, dateDefaults) {
    const values = {};
    testTypes.forEach(tt => {
      const d = existingLookup(tt._id);
      values[tt._id] = d ? String(d.target ?? 0) : '';
    });
    if (dateDefaults) {
      values._from = dateDefaults.from;
      values._to = dateDefaults.to;
    }
    setEditValues(values);
    setEditingKey(key);
  }

  async function saveMonthly(nepaliMonth) {
    const dates = (NEPALI_MONTH_DATES_BY_FY[fiscalYear] || {})[nepaliMonth];
    if (!dates) {
      toast.error('No date range configured for this fiscal year / month');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(testTypes.map(tt => axios.post('/tp-achievements', {
        periodType: 'monthly',
        fiscalYear,
        nepaliMonth,
        fromDate: dates.from,
        toDate: dates.to,
        testType: tt._id,
        target: Number(editValues[tt._id]) || 0,
      })));
      toast.success(`${nepaliMonth} targets saved`);
      setEditingKey(null);
      loadMonthly();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save targets');
    } finally {
      setSaving(false);
    }
  }

  async function saveWeekly(weekNumber) {
    const week = weekList.find(w => w.weekNumber === weekNumber);
    const from = editValues._from || week?.from;
    const to = editValues._to || week?.to;
    if (!from || !to) {
      toast.error('Please set a date range for this week');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(testTypes.map(tt => axios.post('/tp-achievements', {
        periodType: 'weekly',
        fiscalYear,
        nepaliMonth: weeklyMonth,
        weekNumber,
        fromDate: from,
        toDate: to,
        testType: tt._id,
        target: Number(editValues[tt._id]) || 0,
      })));
      toast.success(`Week ${weekNumber} targets saved`);
      setEditingKey(null);
      setPendingWeeks(prev => prev.filter(w => w.weekNumber !== weekNumber));
      loadWeekly();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save targets');
    } finally {
      setSaving(false);
    }
  }

  async function clearCell(doc, refetch) {
    if (!doc?._id) return;
    if (!window.confirm(`Clear this target? The achievement count for this cell will also stop showing until a new target is set.`)) return;
    setClearingCell(doc._id);
    try {
      await axios.delete(`/tp-achievements/${doc._id}`);
      toast.success('Cleared');
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to clear');
    } finally {
      setClearingCell(null);
    }
  }

  function buildExportTable() {
    const head = [
      [
        { content: view === 'monthly' ? 'Months' : 'Week', rowSpan: 2 },
        ...testTypes.map(tt => ({ content: tt.name, colSpan: 2 })),
        { content: 'Total', rowSpan: 2 },
      ],
      testTypes.flatMap(() => ['Target', 'Achievement']),
    ];

    let body;
    if (view === 'monthly') {
      body = MONTH_ROWS.map(rowKey => {
        const isQuarter = rowKey.startsWith('Q');
        const getCell = isQuarter ? id => quarterTotals(rowKey)[id] : id => monthlyByKey[`${rowKey}_${id}`];
        const grand = rowGrandTotal(getCell, testTypes);
        const row = [
          rowKey,
          ...testTypes.flatMap(tt => { const d = getCell(tt._id); return [d?.target ?? 0, d?.achieved ?? 0]; }),
          grand.achieved,
        ];
        return isQuarter ? row.map(c => ({ content: c, styles: { fontStyle: 'bold' } })) : row;
      });
      body.push([
        { content: `Total (FY ${fiscalYear})`, styles: { fontStyle: 'bold' } },
        ...testTypes.flatMap(tt => [
          { content: fiscalYearTotal[tt._id]?.target ?? 0, styles: { fontStyle: 'bold' } },
          { content: fiscalYearTotal[tt._id]?.achieved ?? 0, styles: { fontStyle: 'bold' } },
        ]),
        { content: rowGrandTotal(id => fiscalYearTotal[id], testTypes).achieved, styles: { fontStyle: 'bold' } },
      ]);
    } else {
      body = weekList.map(w => {
        const grand = rowGrandTotal(id => weeklyByKey[`${w.weekNumber}_${id}`], testTypes);
        return [
          `Week ${w.weekNumber}`,
          ...testTypes.flatMap(tt => { const d = weeklyByKey[`${w.weekNumber}_${tt._id}`]; return [d?.target ?? 0, d?.achieved ?? 0]; }),
          grand.achieved,
        ];
      });
    }

    const title = view === 'monthly'
      ? `TP Achievements — Monthly / Quarterly (FY ${fiscalYear})`
      : `TP Achievements — Weekly (${weeklyMonth}, FY ${fiscalYear})`;

    return { head, body, title };
  }

  function exportPDF() {
    try {
      const { head, body, title } = buildExportTable();
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(13);
      doc.text(title, 14, 14);
      doc.autoTable({
        startY: 20,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        margin: { left: 8, right: 8 },
      });
      const fileLabel = view === 'monthly' ? `monthly-${fiscalYear.replace('/', '-')}` : `weekly-${weeklyMonth}-${fiscalYear.replace('/', '-')}`;
      doc.save(`TP-Achievements-${fileLabel}.pdf`);
      toastPDF();
    } catch (e) {
      toast.error('PDF export failed');
    }
  }

  function handlePrint() {
    const { head, body, title } = buildExportTable();
    const cellHtml = (c) => {
      if (c && typeof c === 'object') return escapeHtml(c.content);
      return escapeHtml(c);
    };
    const headRows = head.map((row, i) => `<tr>${row.map(c => {
      const attrs = [];
      if (c && typeof c === 'object') {
        if (c.rowSpan) attrs.push(`rowspan="${c.rowSpan}"`);
        if (c.colSpan) attrs.push(`colspan="${c.colSpan}"`);
      }
      return `<th ${attrs.join(' ')}>${cellHtml(c)}</th>`;
    }).join('')}</tr>`).join('');
    const bodyRows = body.map(row => `<tr>${row.map((c, i) => `<td${i === 0 ? ' class="rowlabel"' : ''}>${cellHtml(c)}</td>`).join('')}</tr>`).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
    h2 { margin: 0 0 8px; font-size: 15px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
    th { background: #f0f0f0; font-weight: 600; }
    td.rowlabel { text-align: left; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body>
  <h2>${escapeHtml(title)}</h2>
  <table>
    <thead>${headRows}</thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  }

  return (
    <div className="ach-page">
      <div className="ach-page-head">
        <div>
          <h1>TP Achievements</h1>
          <p>Booking targets vs. achievements per test type </p>
        </div>
        <div className="tpach-header-actions">
          {(canExportPdf || canPrint) && (
            <div className="ach-export-group">
              {canExportPdf && (
                <button className="ach-export-btn" onClick={exportPDF}>
                  <IconDownload /> PDF
                </button>
              )}
              {canPrint && (
                <button className="ach-export-btn" onClick={handlePrint}>
                  <IconPrint /> Print
                </button>
              )}
            </div>
          )}
          <div className="tpach-view-toggle">
            <button
              className={`tpach-toggle-btn ${view === 'monthly' ? 'active' : ''}`}
              onClick={() => setView('monthly')}
            >
              Monthly / Quarterly
            </button>
            <button
              className={`tpach-toggle-btn ${view === 'weekly' ? 'active' : ''}`}
              onClick={() => setView('weekly')}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      <div className="ach-card">
        <div className="ach-card-head">
          <div>
            <h2>{view === 'monthly' ? 'PTE, IELTS and Duolingo Booking' : `Weekly Target — ${weeklyMonth}`}</h2>
            <p>
              {view === 'monthly'
                ? `Fiscal year ${fiscalYear}, grouped by Nepali month with quarterly rollups.`
                : `Add or remove weeks as needed for ${weeklyMonth}, ${fiscalYear}.`}
            </p>
          </div>
          <div className="tpach-filters">
            <div className="ach-field">
              <label>Fiscal Year</label>
              <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}>
                {FISCAL_YEARS.map(fy => (
                  <option key={fy.label} value={fy.label}>{fy.label}</option>
                ))}
              </select>
            </div>
            {view === 'weekly' && (
              <div className="ach-field">
                <label>Nepali Month</label>
                <select value={weeklyMonth} onChange={e => setWeeklyMonth(e.target.value)}>
                  {NEPALI_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="ach-loading"><span className="ach-spinner" /> Loading…</div>
        ) : testTypes.length === 0 ? (
          <div className="ach-empty">No active test types found. Add one under Test Preparation first.</div>
        ) : view === 'monthly' ? (
          <div className="ach-table-wrap tpach-scroll-wrap">
            <table className="ach-table tpach-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Months</th>
                  {testTypes.map(tt => (
                    <th key={tt._id} colSpan={2}>{tt.name}</th>
                  ))}
                  <th rowSpan={2}>Total</th>
                </tr>
                <tr>
                  {testTypes.map(tt => (
                    <React.Fragment key={tt._id}>
                      <th className="tpach-subhead">Target</th>
                      <th className="tpach-subhead">Achievement</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MONTH_ROWS.map(rowKey => {
                  const isQuarter = rowKey.startsWith('Q');
                  if (isQuarter) {
                    const totals = quarterTotals(rowKey);
                    const grand = rowGrandTotal(id => totals[id], testTypes);
                    return (
                      <tr key={rowKey} className="tpach-quarter-row">
                        <td><strong>{rowKey}</strong></td>
                        {testTypes.map(tt => (
                          <React.Fragment key={tt._id}>
                            <td><strong>{totals[tt._id]?.target ?? 0}</strong></td>
                            <td><strong>{totals[tt._id]?.achieved ?? 0}</strong></td>
                          </React.Fragment>
                        ))}
                        <td><strong>{grand.achieved}</strong></td>
                      </tr>
                    );
                  }
                  const isEditing = editingKey === rowKey;
                  const grand = rowGrandTotal(id => monthlyByKey[`${rowKey}_${id}`], testTypes);
                  return (
                    <tr key={rowKey}>
                      <td><strong>{rowKey}</strong></td>
                      {testTypes.map(tt => {
                        const d = monthlyByKey[`${rowKey}_${tt._id}`];
                        return (
                          <React.Fragment key={tt._id}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="number" min="0" className="ach-inline-input"
                                  value={editValues[tt._id] ?? ''}
                                  onChange={e => setEditValues(v => ({ ...v, [tt._id]: e.target.value }))}
                                />
                              ) : (
                                <span className="tpach-target-cell">
                                  <span className="ach-target-chip">{d?.target ?? 0}</span>
                                  {d?._id && canClear && (
                                    <button
                                      className="tpach-clear-btn"
                                      title="Clear this target (and its achievement count)"
                                      disabled={clearingCell === d._id}
                                      onClick={() => clearCell(d, loadMonthly)}
                                    >
                                      {TrashIcon}
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td>
                              <strong>{d?.achieved ?? 0}</strong>
                              {d?.target > 0 && (
                                <span className={`ach-pill ${pillClass(d.pctAchieved ?? 0)}`} style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px' }}>
                                  {d.pctAchieved ?? 0}%
                                </span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td>
                        <strong>{grand.achieved}</strong>
                        <div className="tpach-row-actions">
                          {isEditing ? (
                            <>
                              <button className="ach-btn ach-btn-primary ach-btn-sm" disabled={saving} onClick={() => saveMonthly(rowKey)}>{CheckIcon} Save</button>
                              <button className="ach-btn ach-btn-outline ach-btn-sm" onClick={() => setEditingKey(null)}>{XIcon} Cancel</button>
                            </>
                          ) : canManage ? (
                            <button className="ach-icon-btn" title="Edit targets" onClick={() => startEdit(rowKey, id => monthlyByKey[`${rowKey}_${id}`])}>{EditIcon}</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="tpach-fy-total-row">
                  <td><strong>Total (FY {fiscalYear})</strong></td>
                  {testTypes.map(tt => (
                    <React.Fragment key={tt._id}>
                      <td><strong>{fiscalYearTotal[tt._id]?.target ?? 0}</strong></td>
                      <td><strong>{fiscalYearTotal[tt._id]?.achieved ?? 0}</strong></td>
                    </React.Fragment>
                  ))}
                  <td><strong>{rowGrandTotal(id => fiscalYearTotal[id], testTypes).achieved}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ach-table-wrap tpach-scroll-wrap">
            {canManage && (
              <button className="ach-btn ach-btn-outline ach-btn-sm" style={{ margin: '0 0 12px' }} onClick={addWeek}>
                + Add Week
              </button>
            )}
            <table className="ach-table tpach-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Week</th>
                  {testTypes.map(tt => (
                    <th key={tt._id} colSpan={2}>{tt.name}</th>
                  ))}
                  <th rowSpan={2}>Total</th>
                </tr>
                <tr>
                  {testTypes.map(tt => (
                    <React.Fragment key={tt._id}>
                      <th className="tpach-subhead">Target</th>
                      <th className="tpach-subhead">Achievement</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekList.length === 0 ? (
                  <tr><td colSpan={testTypes.length * 2 + 2} className="ach-empty">No weeks added yet for {weeklyMonth}. Click "+ Add Week" to start.</td></tr>
                ) : weekList.map(w => {
                  const rowKey = `${weeklyMonth}_${w.weekNumber}`;
                  const isEditing = editingKey === rowKey;
                  const grand = rowGrandTotal(id => weeklyByKey[`${w.weekNumber}_${id}`], testTypes);
                  const dateLabel = w.from && w.to
                    ? `${new Date(w.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(w.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                    : '';
                  return (
                    <tr key={w.weekNumber}>
                      <td>
                        <strong>Week {w.weekNumber}</strong>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <input type="date" value={(editValues._from || w.from || '').slice(0, 10)} onChange={e => setEditValues(v => ({ ...v, _from: e.target.value }))} style={{ fontSize: 11, padding: 2, width: 120 }} />
                            <input type="date" value={(editValues._to || w.to || '').slice(0, 10)} onChange={e => setEditValues(v => ({ ...v, _to: e.target.value }))} style={{ fontSize: 11, padding: 2, width: 120 }} />
                          </div>
                        ) : dateLabel ? (
                          <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{dateLabel}</div>
                        ) : null}
                      </td>
                      {testTypes.map(tt => {
                        const d = weeklyByKey[`${w.weekNumber}_${tt._id}`];
                        return (
                          <React.Fragment key={tt._id}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="number" min="0" className="ach-inline-input"
                                  value={editValues[tt._id] ?? ''}
                                  onChange={e => setEditValues(v => ({ ...v, [tt._id]: e.target.value }))}
                                />
                              ) : (
                                <span className="tpach-target-cell">
                                  <span className="ach-target-chip">{d?.target ?? 0}</span>
                                  {d?._id && canClear && (
                                    <button
                                      className="tpach-clear-btn"
                                      title="Clear this target (and its achievement count)"
                                      disabled={clearingCell === d._id}
                                      onClick={() => clearCell(d, loadWeekly)}
                                    >
                                      {TrashIcon}
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td>
                              <strong>{d?.achieved ?? 0}</strong>
                              {d?.target > 0 && (
                                <span className={`ach-pill ${pillClass(d.pctAchieved ?? 0)}`} style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px' }}>
                                  {d.pctAchieved ?? 0}%
                                </span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td>
                        <strong>{grand.achieved}</strong>
                        <div className="tpach-row-actions">
                          {isEditing ? (
                            <>
                              <button className="ach-btn ach-btn-primary ach-btn-sm" disabled={saving} onClick={() => saveWeekly(w.weekNumber)}>{CheckIcon} Save</button>
                              <button className="ach-btn ach-btn-outline ach-btn-sm" onClick={() => setEditingKey(null)}>{XIcon} Cancel</button>
                            </>
                          ) : canManage ? (
                            <>
                              <button className="ach-icon-btn" title="Edit targets" onClick={() => startEdit(rowKey, id => weeklyByKey[`${w.weekNumber}_${id}`], { from: w.from, to: w.to })}>{EditIcon}</button>
                              <button className="ach-icon-btn" title="Delete week" disabled={deletingWeek === w.weekNumber} onClick={() => deleteWeek(w.weekNumber)}>{XIcon}</button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
