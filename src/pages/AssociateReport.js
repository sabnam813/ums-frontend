import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toastExcel, toastPDF } from '../utils/exportHelpers';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import { getDefaultAchFiscalYear, getFiscalYearRange } from '../utils/fiscalYear';
import { statusColor, matchesAssociateType } from '../utils/associateStatus';
import AssociateTypeFilter from '../components/shared/AssociateTypeFilter';
import './Reports.css';

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

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : format(d, 'yyyy-MM-dd');
}

export default function AssociateReport() {
  const { user } = useAuth();
  const canExportExcel = hasPermission(user, 'reports', 'exportExcel');
  const canExportPdf = hasPermission(user, 'reports', 'exportPdf');
  const canPrint = hasPermission(user, 'reports', 'print');

  const defaultRange = useMemo(() => getFiscalYearRange(getDefaultAchFiscalYear()) || { from: '', to: '' }, []);
  const [kind, setKind] = useState('applications');
  const [state, setState] = useState('active');
  const [assocType, setAssocType] = useState('All');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = kind === 'applications' ? '/reports/associates/applications' : '/reports/associates/test-prep';
      const res = await axios.get(path, { params: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, state } });
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate report';
      setError(msg);
      setData(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [kind, state, dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const rows = useMemo(() => {
    const list = (data?.rows || []).filter(r => matchesAssociateType(r.status, assocType));
    return list.map((r, i) => (r.rank != null ? { ...r, rank: i + 1 } : r));
  }, [data, assocType]);
  const totals = useMemo(() => ({
    files: rows.reduce((n, r) => n + (r.files || 0), 0),
    visaGranted: rows.reduce((n, r) => n + (r.visaGranted || 0), 0),
    bookings: rows.reduce((n, r) => n + (r.total || 0), 0),
  }), [rows]);
  const testTypes = useMemo(() => data?.testTypes || [], [data]);
  const isInactive = state === 'inactive';
  const hasData = rows.length > 0;
  const title = `${kind === 'applications' ? 'Application' : 'Test Preparation'} Report (${isInactive ? 'Inactive' : 'Active'})`;

  const table = useMemo(() => {
    if (isInactive) {
      return {
        head: ['#', 'Associate', 'Status', 'Location', 'Last Activity'],
        body: rows.map((r, i) => [i + 1, r.associate, r.status, r.location || '-', fmtDate(r.lastActivity)]),
      };
    }
    if (kind === 'applications') {
      return {
        head: ['Rank', 'Associate', 'Files', 'Visa', 'Top Country', 'Top Level'],
        body: rows.map(r => [r.rank, r.associate, r.files, r.visaGranted, r.topCountry ? `${r.topCountry} (${r.topCountryCount})` : '-', r.topLevel ? `${r.topLevel} (${r.topLevelCount})` : '-']),
      };
    }
    return {
      head: ['Rank', 'Associate', 'Bookings', ...testTypes.map(t => t.name)],
      body: rows.map(r => [r.rank, r.associate, r.total, ...testTypes.map(t => r.byType?.[t.id] || 0)]),
    };
  }, [rows, isInactive, kind, testTypes]);

  const statusOf = (name) => rows.find(r => r.associate === name)?.status;

  const filterLine = `Date: ${rangeLabel(dateFrom, dateTo)}${assocType !== 'All' ? `, Type: ${assocType}` : ''}`;

  const exportExcel = () => {
    if (!hasData) return;
    const aoa = [['UCA Management System: Associate Report'], [title], [filterLine], [`Generated: ${format(new Date(), 'PPP p')}`], [], table.head, ...table.body];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Associate Report');
    XLSX.writeFile(wb, `UMS_Associate_${kind}_${state}_${STAMP()}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    if (!hasData) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Associate Report', 14, 16);
    doc.setFontSize(10);
    doc.text(title, 14, 23);
    doc.setFontSize(9);
    doc.text(filterLine, 14, 28);
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 33);
    doc.autoTable({
      startY: 38,
      head: [table.head],
      body: table.body.map(r => r.map(v => String(v))),
      styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`UMS_Associate_${kind}_${state}_${STAMP()}.pdf`);
    toastPDF();
  };

  const printReport = () => {
    if (!hasData) return;
    const html = `<!DOCTYPE html>
<html><head><title>Associate Report</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
h2 { margin: 0 0 4px; font-size: 15px; }
h3 { margin: 0 0 6px; font-size: 12px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
table { border-collapse: collapse; width: 100%; margin-top: 6px; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
</style></head><body>
<h2>UCA Management System: Associate Report</h2>
<h3>${esc(title)}</h3>
<p>${esc(filterLine)}</p>
<p>Generated: ${esc(new Date().toLocaleString())}</p>
<table><thead><tr>${table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${table.body.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const setAllTime = () => { setDateFrom(''); setDateTo(''); };
  const setDefaultRange = () => { setDateFrom(defaultRange.from || ''); setDateTo(defaultRange.to || ''); };

  const nameCell = (name, status) => (
    <span style={statusColor(status) ? { color: statusColor(status), fontWeight: 600 } : undefined}>{name}</span>
  );

  return (
    <>
      <div className="reports-type-tabs" role="tablist" aria-label="Associate report">
        <button
          type="button" role="tab" aria-selected={kind === 'applications'}
          className={`reports-type-tab${kind === 'applications' ? ' reports-type-tab-active' : ''}`}
          onClick={() => setKind('applications')}
        >
          Application Report
        </button>
        <button
          type="button" role="tab" aria-selected={kind === 'testprep'}
          className={`reports-type-tab${kind === 'testprep' ? ' reports-type-tab-active' : ''}`}
          onClick={() => setKind('testprep')}
        >
          Test Preparation Report
        </button>
      </div>

      <div className="reports-filters-bar">
        <div className="reports-date-field">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="reports-date-field">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="reports-type-tabs" role="tablist" aria-label="Activity">
          <button
            type="button" role="tab" aria-selected={state === 'active'}
            className={`reports-type-tab${state === 'active' ? ' reports-type-tab-active' : ''}`}
            onClick={() => setState('active')}
          >
            Active
          </button>
          <button
            type="button" role="tab" aria-selected={state === 'inactive'}
            className={`reports-type-tab${state === 'inactive' ? ' reports-type-tab-active' : ''}`}
            onClick={() => setState('inactive')}
          >
            Inactive
          </button>
        </div>
        <div className="reports-date-field">
          <label>Associate Type</label>
          <AssociateTypeFilter wrap={false} value={assocType} onChange={setAssocType} />
        </div>
        <button className="reports-export-btn" onClick={setAllTime} title="Remove date limits">All time</button>
        <button className="reports-export-btn" onClick={setDefaultRange} title="Current fiscal year">This year</button>
        {hasData && (canExportExcel || canExportPdf || canPrint) && (
          <div className="reports-export-group">
            {canExportExcel && <button className="reports-export-btn" onClick={exportExcel} title="Export to Excel">Excel</button>}
            {canExportPdf && <button className="reports-export-btn" onClick={exportPDF} title="Export to PDF">PDF</button>}
            {canPrint && <button className="reports-export-btn" onClick={printReport} title="Print">Print</button>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <span>Generating report…</span>
        </div>
      ) : error ? (
        <div className="reports-empty-state"><p>{error}</p></div>
      ) : !hasData ? (
        <div className="reports-empty-state">
          <p>{isInactive ? 'No inactive associates in this range.' : 'No activity found in this range.'}</p>
          <span>Try a wider date range.</span>
        </div>
      ) : (
        <>
          <div className="reports-meta-row">
            <span>{rangeLabel(dateFrom, dateTo)}</span>
            <span>
              {rows.length} associate{rows.length === 1 ? '' : 's'}
              {!isInactive && kind === 'applications' && ` · ${totals.files} files · ${totals.visaGranted} visa`}
              {!isInactive && kind === 'testprep' && ` · ${totals.bookings} bookings`}
            </span>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  {table.head.map((h, i) => <th key={h + i} className={h === 'Associate' ? 'reports-th-country' : ''}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.body.map((r, ri) => (
                  <tr key={`${r[1]}-${ri}`}>
                    {r.map((v, ci) => (
                      ci === 1
                        ? <td key={ci} className="reports-td-country">{nameCell(v, statusOf(v))}</td>
                        : <td key={ci} className={table.head[ci] === 'Visa' || table.head[ci] === 'Bookings' ? 'reports-td-strong' : ''}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
