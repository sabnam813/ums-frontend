import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import UnicommissionForm from './UnicommissionForm';
import UnicommissionBulkEditModal from './UnicommissionBulkEditModal';
import UnicommissionSettingsModal from './UnicommissionSettingsModal';
import BulkImportModal from '../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../components/shared/SelectColumnsModal';
import CountryFlag from '../../components/shared/CountryFlag';
import useIntakeOptions from '../../hooks/useIntakeOptions';
import useLevelOptions from '../../hooks/useLevelOptions';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../utils/exportHelpers';
import {
  COLUMNS, IMPORT_FIELDS, EXPORT_COLUMNS, DEFAULT_EXPORT_KEYS, CHECK_COL_WIDTH, STICKY_COLUMNS, stickyOffsets,
  PAYMENT_STATUSES, cellValue, sortValue, totalsByCurrency, totalsText, fmtMoney, ruleLabel,
} from './unicommissionColumns';
import '../admin/HallBooking/HallBooking.css';
import '../admin/AssociateDetails/AssociateDetails.css';
import './Unicommission.css';
import AssociateName from '../../components/shared/AssociateName';
import { associateColorSync } from '../../hooks/useAssociateOptions';
import { htmlStyleAttr, pdfColorHook } from '../../utils/associateStatus';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const EMPTY_FILTERS = {
  intake: '', level: '', status: '', visaFrom: '', visaTo: '',
};

export default function UnicommissionCountryPage() {
  const { countryId } = useParams();
  const { user } = useAuth();
  const base = checkIsAdmin(user) ? '/admin/unicommission' : '/unicommission';
  const can = a => hasPermission(user, 'unicommission', a);
  const canView = can('view');
  const canCreate = can('create');
  const canEdit = can('edit');
  const canDelete = can('delete');
  const canImport = can('import');
  const canExportExcel = can('exportExcel');
  const canExportPdf = can('exportPdf');
  const canPrint = can('print');
  const canBulkEdit = can('bulkEdit');
  const canSettings = can('settings');

  const [country, setCountry] = useState(null);
  const [setting, setSetting] = useState({ currency: '', commissionType: 'percentage', commissionValue: null });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sn', dir: 'asc' });
  const debounce = useRef(null);
  const offsets = useMemo(() => stickyOffsets(), []);
  const lastStickyKey = STICKY_COLUMNS[STICKY_COLUMNS.length - 1]?.key;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const countryName = country?.name || '';

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { country: countryId, q: search || undefined };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await axios.get('/unicommission/rows', { params });
      setCountry(res.data.country || null);
      setSetting(res.data.setting || { currency: '', commissionType: 'percentage', commissionValue: null });
      setRows(res.data.rows || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Unicommission records');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [countryId, search, filters]);

  useEffect(() => {
    if (!canView) return undefined;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(fetchRows, 300);
    return () => clearTimeout(debounce.current);
  }, [fetchRows, canView]);

  const positions = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => m.set(r._id, i + 1));
    return m;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortConfig.key) || COLUMNS[0];
    return [...rows].sort((a, b) => {
      const ctxA = { position: positions.get(a._id), countryName };
      const ctxB = { position: positions.get(b._id), countryName };
      const av = sortValue(a, col, ctxA);
      const bv = sortValue(b, col, ctxB);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortConfig, positions, countryName]);

  const intakeOptions = useIntakeOptions(meta.intake || []);
  const levelOptions = useLevelOptions(meta.level);

  const selectedRows = useMemo(() => sortedRows.filter(r => selectedIds.has(r._id)), [sortedRows, selectedIds]);
  const totalsRows = selectedRows.length > 0 ? selectedRows : sortedRows;
  const totals = useMemo(() => totalsByCurrency(totalsRows), [totalsRows]);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every(r => selectedIds.has(r._id));
  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(prev => { const n = new Set(prev); sortedRows.forEach(r => n.delete(r._id)); return n; });
    else setSelectedIds(prev => { const n = new Set(prev); sortedRows.forEach(r => n.add(r._id)); return n; });
  };
  const toggleSort = (key) => setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const handleSave = async (form) => {
    if (editRow && !window.confirm('Save changes to this record?')) return;
    if (editRow) {
      await axios.put(`/unicommission/rows/${editRow._id}`, form);
      toast.success('Record updated');
    } else {
      await axios.post('/unicommission/rows', { ...form, country: countryId });
      toast.success('Record added');
    }
    setShowForm(false);
    setEditRow(null);
    fetchRows();
  };

  const handleSaveSettings = async (values) => {
    const res = await axios.put(`/unicommission/settings/${countryId}`, values);
    const s = res.data.setting || values;
    setSetting({ currency: s.currency || '', commissionType: s.commissionType, commissionValue: s.commissionValue ?? null });
    setShowSettings(false);
    toast.success('Settings saved');
    fetchRows();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Move "${row.studentName}" to trash? You can restore it later from the Trash page.`)) return;
    try {
      await axios.delete(`/unicommission/rows/${row._id}`);
      setRows(prev => prev.filter(r => r._id !== row._id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(row._id); return n; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Move ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''} to trash?`)) return;
    try {
      await axios.delete('/unicommission/rows/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setRows(prev => prev.filter(r => !selectedIds.has(r._id)));
      setSelectedIds(new Set());
      toast.success('Selected records moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      fetchRows();
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/unicommission/rows/bulk-edit', { ids, updates });
      toast.success(`${ids.length} row${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkImport = async (imported) => {
    if (!imported || imported.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const res = await axios.post('/unicommission/rows/bulk-import', { country: countryId, rows: imported });
      const d = res.data;
      const summary = { total: d.total ?? imported.length, created: d.created, failed: d.failed ?? 0, failures: d.failures || [] };
      if (summary.failed > 0) toast(`${d.added} added, ${d.updated} updated, ${summary.failed} skipped`, { icon: '!' });
      else toast.success(`${d.added} added, ${d.updated} updated`);
      if ((d.unmatchedAssociates || []).length) {
        toast(`${d.unmatchedAssociates.length} associate name(s) are not in Associate Details, e.g. ${d.unmatchedAssociates.slice(0, 3).join(', ')}`, { icon: 'i', duration: 7000 });
      }
      fetchRows();
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const sourceRows = () => (selectedRows.length > 0 ? selectedRows : sortedRows);
  const pickColumns = (keys) => keys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
  const exportCell = (r, key, i) => cellValue(r, key, { index: i + 1, countryName });
  const scopeText = (src) => (selectedRows.length > 0 ? `${src.length} selected` : `${src.length} record${src.length !== 1 ? 's' : ''}`);

  const exportExcel = (keys) => {
    const cols = pickColumns(keys);
    const src = sourceRows();
    const data = src.map((r, i) => {
      const o = {};
      cols.forEach(c => { o[c.label] = exportCell(r, c.key, i); });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols.map(c => c.label) });
    ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(12, c.label.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (countryName || 'Unicommission').slice(0, 31));
    XLSX.writeFile(wb, `Unicommission_${countryName || 'Country'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (keys) => {
    const cols = pickColumns(keys);
    const src = sourceRows();
    const doc = new jsPDF({ orientation: 'landscape', format: cols.length > 9 ? 'a3' : 'a4' });
    doc.setFontSize(14);
    doc.text(`Unicommission — ${countryName}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  ${scopeText(src)}`, 14, 20);
    const t = totalsText(src);
    if (t) doc.text(t, 14, 25);
    doc.autoTable({
      startY: t ? 29 : 24,
      head: [cols.map(c => c.label)],
      body: src.map((r, i) => cols.map(c => exportCell(r, c.key, i) || '-')),
      styles: { fontSize: cols.length > 12 ? 6 : 7.5, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 6, right: 6 },
      didParseCell: pdfColorHook(cols.map(c => c.key), ['associate'], (v) => associateColorSync(v)),
    });
    doc.save(`Unicommission_${countryName || 'Country'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (keys) => {
    const cols = pickColumns(keys);
    const src = sourceRows();
    const head = cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const body = src.map((r, i) => `<tr>${cols.map(c => `<td${c.key === 'associate' ? htmlStyleAttr(associateColorSync(exportCell(r, c.key, i))) : ''}>${escapeHtml(exportCell(r, c.key, i) || '-')}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Unicommission ${escapeHtml(countryName)}</title><style>
@page { size: A3 landscape; margin: 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; color: #000; }
h2 { margin: 0 0 4px; font-size: 14px; } p { margin: 0 0 8px; color: #555; font-size: 9px; }
table { border-collapse: collapse; width: 100%; table-layout: auto; }
th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; white-space: pre-wrap; }
th { background: #f0f0f0; font-weight: 600; } tr:nth-child(even) { background: #fafafa; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
</style></head><body><h2>Unicommission — ${escapeHtml(countryName)}</h2><p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${escapeHtml(scopeText(src))}${totalsText(src) ? ` &middot; ${escapeHtml(totalsText(src))}` : ''}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const handleColumnsConfirm = (keys) => {
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(keys);
    else if (target === 'pdf') exportPDF(keys);
    else if (target === 'print') handlePrint(keys);
  };

  if (!canView) {
    return <div className="hb-page"><div className="hb-empty-hint">You do not have permission to view Unicommission.</div></div>;
  }

  const renderCell = (r, c, i) => {
    if (c.key === 'paymentStatus') return <span className={`uc-badge uc-badge-${r.paymentStatus || 'Pending'}`}>{r.paymentStatus || 'Pending'}</span>;
    if (c.key === 'source') {
      const flagged = !!r.sourceFlag;
      return <span className={`uc-src ${flagged ? 'uc-src-flag' : ''}`}>{cellValue(r, 'source')}</span>;
    }
    const v = cellValue(r, c.key, { index: positions.get(r._id) ?? i + 1, countryName });
    if (!v) return <span className="ad-cell-empty">—</span>;
    if (c.key === 'associate') return <span className="ad-cell" title={v}><AssociateName name={v} /></span>;
    return <span className={`ad-cell ${c.type === 'amount' ? 'uc-num' : ''}`} title={v}>{v}</span>;
  };

  const stickyStyle = (c) => (c.sticky ? { left: offsets[c.key] } : undefined);
  const totalCols = COLUMNS.length + 2;
  const optionList = (key) => (key === 'level' ? levelOptions : (meta[key] || []));
  const filterNote = activeFilterCount > 0 || search ? ' (filtered)' : '';
  const base2 = `${base}`;

  return (
    <div className="ad-page">
      <div className="uc-breadcrumb"><Link to={base2}>Unicommission</Link> / <span>{countryName || '…'}</span></div>
      <div className="hb-page-header">
        <div className="uc-head-title">
          {country && <CountryFlag country={country} size={32} rounded={5} />}
          <div>
            <h2>{countryName ? `${countryName} — Unicommission` : 'Unicommission'}</h2>
            <p className="hb-page-sub">
              <span className="uc-setting-chip">
                {setting.currency || 'No currency set'}
                {setting.commissionValue != null ? ` · ${ruleLabel(setting.commissionType, setting.commissionValue, setting.currency)} ${setting.commissionType === 'percentage' ? 'of fee' : 'per student'}` : ' · no default commission'}
                {canSettings && <button type="button" onClick={() => setShowSettings(true)}>Change</button>}
              </span>
            </p>
          </div>
        </div>
        <div className="hb-header-actions">
          {canImport && <button className="hb-btn-outline" onClick={() => setShowBulkImport(true)}><IconFile /> Import</button>}
          {canExportExcel && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('excel')}><IconDownload /> Excel</button>}
          {canExportPdf && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('pdf')}><IconDownload /> PDF</button>}
          {canPrint && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('print')}><IconPrint /> Print</button>}
          {canCreate && (
            <button className="hb-btn-primary" onClick={() => { setEditRow(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Add Record
            </button>
          )}
        </div>
      </div>

      <div className="hb-toolbar">
        <div className="hb-search-box">
          <IconSearch />
          <input type="text" placeholder="Search name, university, associate, course, provider, ID" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="uc-filters-wide">
        <select className="hb-filter-select" value={filters.intake} onChange={e => setFilter('intake', e.target.value)} title="Intake">
          <option value="">All intakes</option>
          {intakeOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="hb-filter-select" value={filters.level} onChange={e => setFilter('level', e.target.value)} title="Level">
          <option value="">All levels</option>
          {optionList('level').map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="hb-filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)} title="Payment status">
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="ad-date-filter">
          <span>Visa granted</span>
          <input type="date" value={filters.visaFrom} onChange={e => setFilter('visaFrom', e.target.value)} aria-label="Visa granted from" />
          <span>to</span>
          <input type="date" value={filters.visaTo} onChange={e => setFilter('visaTo', e.target.value)} aria-label="Visa granted to" />
        </div>
        {activeFilterCount > 0 && <button className="ad-clear-filters" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>}
      </div>

      {selectedIds.size > 0 && (
        <div className="hb-bulk-bar">
          <span>{selectedRows.length} selected{selectedRows.length !== selectedIds.size ? ` (${selectedIds.size} incl. hidden by filters)` : ''}</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
          {canExportExcel && <button onClick={() => setColumnPickerFor('excel')}>Excel (selected)</button>}
          {canExportPdf && <button onClick={() => setColumnPickerFor('pdf')}>PDF (selected)</button>}
          {canPrint && <button onClick={() => setColumnPickerFor('print')}>Print (selected)</button>}
          {canDelete && <button className="hb-danger" onClick={handleBulkDelete}>Delete Selected</button>}
          <button className="hb-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="ad-table-wrap">
        <table className="ad-table">
          <colgroup>
            <col style={{ width: CHECK_COL_WIDTH }} />
            {COLUMNS.map(c => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 84 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="ad-sticky" style={{ left: 0 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              {COLUMNS.map(c => (
                <th
                  key={c.key}
                  className={`sortable ${sortConfig.key === c.key ? 'sorted' : ''} ${c.sticky ? 'ad-sticky' : ''} ${c.key === lastStickyKey ? 'ad-sticky-last' : ''}`}
                  style={stickyStyle(c)}
                  onClick={() => toggleSort(c.key)}
                  title={`Sort by ${c.label}`}
                >
                  <span className="th-content">
                    {c.label}
                    <span className="sort-icon">{sortConfig.key === c.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </span>
                </th>
              ))}
              <th className="ad-actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={totalCols} className="ad-empty">Loading…</td></tr>}
            {!loading && sortedRows.length === 0 && (
              <tr><td colSpan={totalCols} className="ad-empty">
                {rows.length === 0 && activeFilterCount === 0 && !search
                  ? 'No records yet. Students appear here automatically once an application in this country is marked "Grant", or add / import them.'
                  : 'No records match your search or filters.'}
              </td></tr>
            )}
            {!loading && sortedRows.map((r, i) => (
              <tr key={r._id} className={selectedIds.has(r._id) ? 'ad-selected' : ''}>
                <td className="ad-sticky" style={{ left: 0 }}>
                  <input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} aria-label="Select row" />
                </td>
                {COLUMNS.map(c => (
                  <td
                    key={c.key}
                    className={`${c.sticky ? 'ad-sticky' : ''} ${c.key === lastStickyKey ? 'ad-sticky-last' : ''} ${c.key === 'studentName' ? 'ad-name' : ''}`}
                    style={stickyStyle(c)}
                  >
                    {renderCell(r, c, i)}
                  </td>
                ))}
                <td className="ad-actions-cell">
                  <div className="ad-row-actions">
                    {canEdit && (
                      <button className="hb-icon-sm" title="Edit" onClick={() => { setEditRow(r); setShowForm(true); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                    )}
                    {canDelete && (
                      <button className="hb-icon-sm hb-danger" title="Delete" onClick={() => handleDelete(r)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ad-footer">
        <span>{sortedRows.length} record{sortedRows.length !== 1 ? 's' : ''}{filterNote}</span>
      </div>
      {Object.keys(totals).length > 0 && (
        <div className="uc-totals">
          <span>{selectedRows.length > 0 ? 'Selected total:' : 'Total:'}</span>
          {Object.entries(totals).map(([cur, v]) => (
            <span key={cur}>
              {cur !== '—' ? <strong>{cur}</strong> : null} Fee <strong>{fmtMoney(v.fee, cur === '—' ? '' : cur) || '0'}</strong>
              {' · '}Commission <strong>{fmtMoney(v.commission, cur === '—' ? '' : cur) || '0'}</strong>
            </span>
          ))}
        </div>
      )}

      {showForm && (
        <UnicommissionForm row={editRow} countryName={countryName} setting={setting} onSave={handleSave} onClose={() => { setShowForm(false); setEditRow(null); }} />
      )}
      {showBulkEdit && (
        <UnicommissionBulkEditModal count={selectedIds.size} intakeOptions={intakeOptions} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />
      )}
      {showSettings && (
        <UnicommissionSettingsModal countryName={countryName} setting={setting} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}
      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title={`Import Unicommission — ${countryName}`}
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'studentName', label: 'Students Name' }}
          dateFields={['visaGrantedDate']}
          detectHeader
        />
      )}
      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={DEFAULT_EXPORT_KEYS}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Unicommission'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
