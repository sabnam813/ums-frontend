import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import CountryFlag from '../components/shared/CountryFlag';
import { toastExcel, toastPDF } from '../utils/exportHelpers';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import './Reports.css';
import { statusColor } from '../utils/associateStatus';

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

const VIEWS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'country', label: 'By Country' },
  { key: 'level', label: 'By Level' },
  { key: 'top', label: 'Top per Country' },
];

const STAMP = () => format(new Date(), 'yyyy-MM-dd');

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function rangeLabel(from, to) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'All time';
}

export default function AssociateReport() {
  const { user } = useAuth();
  const canExportExcel = hasPermission(user, 'reports', 'exportExcel');
  const canExportPdf = hasPermission(user, 'reports', 'exportPdf');
  const canPrint = hasPermission(user, 'reports', 'print');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState([]);
  const [intakeFilter, setIntakeFilter] = useState([]);
  const [levelFilter, setLevelFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('ranking');
  const [metric, setMetric] = useState('granted');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search.trim() || undefined,
      };
      if (countryFilter.length) params.country = countryFilter.join(',');
      if (intakeFilter.length) params.intake = intakeFilter.join(',');
      if (levelFilter.length) params.level = levelFilter.join(',');
      const res = await axios.get('/reports/associates', { params });
      setReport(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate report';
      setError(msg);
      setReport(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, countryFilter, intakeFilter, levelFilter, search]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countryOptions = useMemo(() => (report?.filterOptions?.countries || []).map(c => ({ value: String(c._id), label: c.name })), [report]);
  const intakeOptions = useMemo(() => (report?.filterOptions?.intakes || []).map(v => ({ value: v, label: v })), [report]);
  const levelOptions = useMemo(() => (report?.filterOptions?.levels || []).map(v => ({ value: v, label: v })), [report]);

  const associates = report?.associates || [];
  const countryColumns = report?.countryColumns || [];
  const levelColumns = report?.levelColumns || [];
  const topByCountry = report?.topByCountry || [];
  const hasData = associates.length > 0;

  const topAssociate = associates.find(a => a.visaGranted > 0);

  const metricKey = metric === 'granted' ? 'granted' : 'total';
  const metricLabel = metric === 'granted' ? 'Visa Granted' : 'Applications';

  const countryCell = (a, cid) => {
    const e = a.byCountry.find(x => x.countryId === cid);
    return e ? e[metricKey] : 0;
  };
  const levelCell = (a, lv) => {
    const e = a.byLevel.find(x => x.level === lv);
    return e ? e[metricKey] : 0;
  };

  const topCountryOf = (a) => {
    const e = a.byCountry.find(x => x.granted > 0);
    return e ? `${e.countryName} (${e.granted})` : '';
  };
  const topLevelOf = (a) => {
    const e = a.byLevel.find(x => x.granted > 0);
    return e ? `${e.level} (${e.granted})` : '';
  };

  const filterLines = useMemo(() => {
    const f = report?.filters || {};
    const names = countryOptions.filter(o => (f.country || []).includes(o.value)).map(o => o.label);
    return [
      `Visa Granted Date: ${rangeLabel(f.dateFrom, f.dateTo)}`,
      `Country: ${names.length ? names.join(', ') : 'All'}`,
      `Intake: ${(f.intake || []).length ? f.intake.join(', ') : 'All'}`,
      `Level: ${(f.level || []).length ? f.level.join(', ') : 'All'}`,
      `Associate search: ${f.search || 'None'}`,
    ];
  }, [report, countryOptions]);

  const rankingTable = () => ({
    title: 'Associate Ranking (by visa granted)',
    head: ['Rank', 'Associate', 'Applications', 'Visa Granted', 'Visa Rejected', 'Visa Waiting', 'Grant %', 'Top Country', 'Top Level'],
    body: associates.map(a => [a.rank, a.associate, a.total, a.visaGranted, a.visaRejected, a.visaWaiting, `${a.grantRate}%`, topCountryOf(a) || '-', topLevelOf(a) || '-']),
  });

  const matrixTable = (kind) => {
    const isCountry = kind === 'country';
    const cols = isCountry ? countryColumns.map(c => ({ id: c.countryId, label: c.countryName })) : levelColumns.map(l => ({ id: l, label: l }));
    const body = associates.map(a => {
      const cells = cols.map(c => (isCountry ? countryCell(a, c.id) : levelCell(a, c.id)));
      return [a.associate, ...cells, cells.reduce((s, v) => s + v, 0)];
    });
    const totals = cols.map((c, i) => body.reduce((s, r) => s + r[i + 1], 0));
    body.push(['Total', ...totals, totals.reduce((s, v) => s + v, 0)]);
    return {
      title: `${metricLabel} by ${isCountry ? 'Country' : 'Level'}`,
      head: ['Associate', ...cols.map(c => c.label), 'Total'],
      body,
    };
  };

  const topTable = () => ({
    title: 'Top Associate per Country (by visa granted)',
    head: ['Country', 'Top Associate', 'Visa Granted'],
    body: topByCountry.map(t => [t.countryName, t.topAssociate || '-', t.granted]),
  });

  const allTables = () => [rankingTable(), matrixTable('country'), matrixTable('level'), topTable()];

  const exportExcel = () => {
    if (!hasData) return;
    const wb = XLSX.utils.book_new();
    const names = ['Ranking', 'By Country', 'By Level', 'Top per Country'];
    allTables().forEach((t, i) => {
      const aoa = [
        ['UCA Management System: Associate Report'],
        [t.title],
        ...filterLines.map(l => [l]),
        [`Generated: ${format(new Date(), 'PPP p')}`],
        [],
        t.head,
        ...t.body,
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), names[i]);
    });
    XLSX.writeFile(wb, `UMS_Associate_Report_${STAMP()}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    if (!hasData) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Associate Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    filterLines.forEach(l => { doc.text(l, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    let startY = y + 6;
    allTables().forEach((t, i) => {
      if (i > 0) {
        startY = doc.lastAutoTable.finalY + 10;
        if (startY > 175) { doc.addPage(); startY = 16; }
      }
      doc.setFontSize(10);
      doc.text(t.title, 14, startY);
      doc.autoTable({
        startY: startY + 3,
        head: [t.head],
        body: t.body.map(r => r.map(v => String(v))),
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        margin: { left: 8, right: 8 },
      });
    });
    doc.save(`UMS_Associate_Report_${STAMP()}.pdf`);
    toastPDF();
  };

  const printReport = () => {
    if (!hasData) return;
    const sections = allTables().map(t => `<h3>${esc(t.title)}</h3>
<table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${t.body.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
    const html = `<!DOCTYPE html>
<html><head><title>Associate Report</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
h3 { margin: 14px 0 4px; font-size: 12px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
table { border-collapse: collapse; width: 100%; margin-top: 4px; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
tr { page-break-inside: avoid; }
</style></head><body>
<h2>UCA Management System: Associate Report</h2>
${filterLines.map(l => `<p>${esc(l)}</p>`).join('')}
<p>Generated: ${esc(new Date().toLocaleString())}</p>
${sections}
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCountryFilter([]);
    setIntakeFilter([]);
    setLevelFilter([]);
    setSearch('');
  };

  const selectStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', width: '100%' };

  return (
    <>
      <div className="reports-filters-bar">
        <div className="reports-date-field">
          <label>Visa Granted From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="reports-date-field">
          <label>Visa Granted To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="reports-select-field">
          <label>Country</label>
          <Select
            isMulti
            className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
            options={countryOptions}
            value={countryOptions.filter(o => countryFilter.includes(o.value))}
            onChange={opts => setCountryFilter((opts || []).map(o => o.value))}
            placeholder="All countries…"
          />
        </div>
        <div className="reports-select-field">
          <label>Intake</label>
          <Select
            isMulti
            className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
            options={intakeOptions}
            value={intakeOptions.filter(o => intakeFilter.includes(o.value))}
            onChange={opts => setIntakeFilter((opts || []).map(o => o.value))}
            placeholder="All intakes…"
          />
        </div>
        <div className="reports-select-field">
          <label>Level</label>
          <Select
            isMulti
            className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
            options={levelOptions}
            value={levelOptions.filter(o => levelFilter.includes(o.value))}
            onChange={opts => setLevelFilter((opts || []).map(o => o.value))}
            placeholder="All levels…"
          />
        </div>
        <div className="reports-date-field">
          <label>Associate</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') fetchReport(); }}
            placeholder="Search name…"
            style={selectStyle}
          />
        </div>
        <button className="reports-generate-btn" onClick={fetchReport} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
          </svg>
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
        <button className="reports-export-btn" onClick={() => { clearFilters(); }} title="Clear filters">Clear</button>
        {hasData && (canExportExcel || canExportPdf || canPrint) && (
          <div className="reports-export-group">
            {canExportExcel && (
              <button className="reports-export-btn" onClick={exportExcel} title="Export to Excel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Excel
              </button>
            )}
            {canExportPdf && (
              <button className="reports-export-btn" onClick={exportPDF} title="Export to PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                PDF
              </button>
            )}
            {canPrint && (
              <button className="reports-export-btn" onClick={printReport} title="Print">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                Print
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <span>Generating report…</span>
        </div>
      ) : error ? (
        <div className="reports-empty-state">
          <p>{error}</p>
        </div>
      ) : !hasData ? (
        <div className="reports-empty-state">
          <p>No application records found for the selected filters.</p>
          <span>Try widening the date range or clearing filters above.</span>
        </div>
      ) : (
        <>
          <div className="reports-meta-row">
            <span>Visa granted date: <strong>{rangeLabel(report.filters?.dateFrom, report.filters?.dateTo)}</strong></span>
            <span>{associates.length} associate{associates.length === 1 ? '' : 's'}</span>
          </div>

          <div className="reports-summary-cards">
            <div className="reports-summary-card reports-summary-card-accent">
              <span className="reports-summary-label">Associates</span>
              <span className="reports-summary-value">{report.totals?.associates ?? 0}</span>
            </div>
            <div className="reports-summary-card">
              <span className="reports-summary-label">Applications</span>
              <span className="reports-summary-value">{report.totals?.applications ?? 0}</span>
            </div>
            <div className="reports-summary-card reports-summary-card-positive">
              <span className="reports-summary-label">Visa Granted</span>
              <span className="reports-summary-value">{report.totals?.visaGranted ?? 0}</span>
            </div>
            <div className="reports-summary-card reports-summary-card-positive">
              <span className="reports-summary-label">Top Associate</span>
              <span className="reports-summary-value ar-top-name">{topAssociate ? `${topAssociate.associate} (${topAssociate.visaGranted})` : '-'}</span>
            </div>
          </div>

          <div className="ar-view-bar">
            <div className="reports-type-tabs" role="tablist" aria-label="Associate report view">
              {VIEWS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={view === v.key}
                  className={`reports-type-tab${view === v.key ? ' reports-type-tab-active' : ''}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {(view === 'country' || view === 'level') && (
              <div className="ar-metric">
                <label>Show</label>
                <select value={metric} onChange={e => setMetric(e.target.value)} style={selectStyle}>
                  <option value="granted">Visa Granted</option>
                  <option value="total">Applications</option>
                </select>
              </div>
            )}
          </div>

          {view === 'ranking' && (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th className="reports-th-country">Associate</th>
                    <th>Applications</th>
                    <th>Visa Granted</th>
                    <th>Visa Rejected</th>
                    <th>Visa Waiting</th>
                    <th>Grant %</th>
                    <th>Top Country</th>
                    <th>Top Level</th>
                  </tr>
                </thead>
                <tbody>
                  {associates.map(a => (
                    <tr key={a.associate}>
                      <td>{a.rank}</td>
                      <td className="reports-td-country"><span style={statusColor(a.status) ? { color: statusColor(a.status), fontWeight: 600 } : undefined}>{a.associate}</span></td>
                      <td>{a.total}</td>
                      <td className="reports-td-strong">{a.visaGranted}</td>
                      <td>{a.visaRejected}</td>
                      <td>{a.visaWaiting}</td>
                      <td>{a.grantRate}%</td>
                      <td>{topCountryOf(a) || '-'}</td>
                      <td>{topLevelOf(a) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'country' && (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th className="reports-th-country">Associate</th>
                    {countryColumns.map(c => (
                      <th key={c.countryId}>
                        <span className="ar-col-head"><CountryFlag country={{ ...c, name: c.countryName }} size={16} rounded={3} />{c.countryName}</span>
                      </th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {associates.map(a => {
                    const cells = countryColumns.map(c => countryCell(a, c.countryId));
                    return (
                      <tr key={a.associate}>
                        <td className="reports-td-country"><span style={statusColor(a.status) ? { color: statusColor(a.status), fontWeight: 600 } : undefined}>{a.associate}</span></td>
                        {cells.map((v, i) => <td key={countryColumns[i].countryId} className={v ? 'reports-td-strong' : ''}>{v || '-'}</td>)}
                        <td className="reports-td-strong">{cells.reduce((s, v) => s + v, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'level' && (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th className="reports-th-country">Associate</th>
                    {levelColumns.map(l => <th key={l}>{l}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {associates.map(a => {
                    const cells = levelColumns.map(l => levelCell(a, l));
                    return (
                      <tr key={a.associate}>
                        <td className="reports-td-country"><span style={statusColor(a.status) ? { color: statusColor(a.status), fontWeight: 600 } : undefined}>{a.associate}</span></td>
                        {cells.map((v, i) => <td key={levelColumns[i]} className={v ? 'reports-td-strong' : ''}>{v || '-'}</td>)}
                        <td className="reports-td-strong">{cells.reduce((s, v) => s + v, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'top' && (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th className="reports-th-country">Country</th>
                    <th>Top Associate</th>
                    <th>Visa Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {topByCountry.map(t => (
                    <tr key={t.countryId}>
                      <td className="reports-td-country">
                        <CountryFlag country={{ ...t, name: t.countryName }} size={20} rounded={3} />
                        <span>{t.countryName}</span>
                      </td>
                      <td>{t.topAssociate || '-'}</td>
                      <td className="reports-td-strong">{t.granted || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
