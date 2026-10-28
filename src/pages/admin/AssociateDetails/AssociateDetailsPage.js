import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission } from '../../../utils/rbac';
import AssociateDetailForm from './AssociateDetailForm';
import AssociateDetailBulkEditModal from './AssociateDetailBulkEditModal';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../../components/shared/SelectColumnsModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import {
  COLUMNS, STATUS_OPTIONS, RED_STATUSES, normalizeStatus, IMPORT_FIELDS, EXPORT_COLUMNS, CHECK_COL_WIDTH, STICKY_COLUMNS, stickyOffsets, cellValue,
} from './associateColumns';
import '../HallBooking/HallBooking.css';
import './AssociateDetails.css';
import AssociateName from '../../../components/shared/AssociateName';
import { associateColorSync } from '../../../hooks/useAssociateOptions';
import { statusColor, htmlStyleAttr, pdfColorHook } from '../../../utils/associateStatus';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sortValue(row, key, type) {
  if (type === 'number') return Number(row[key]) || 0;
  if (key === 'dateOfOnboarding') return row.dateOfOnboarding ? new Date(row.dateOfOnboarding).getTime() : 0;
  return cellValue(row, key).toLowerCase();
}

const OWNER_COLS = ['ownerName', 'designation', 'ownerContact'];
const EMPTY_FILTERS = { location: '', referredBy: '', designation: '', status: '', dateFrom: '', dateTo: '' };

export default function AssociateDetailsPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, 'associateDetails', 'view');
  const canCreate = hasPermission(user, 'associateDetails', 'create');
  const canEdit = hasPermission(user, 'associateDetails', 'edit');
  const canDelete = hasPermission(user, 'associateDetails', 'delete');
  const canImport = hasPermission(user, 'associateDetails', 'import');
  const canExportExcel = canView || hasPermission(user, 'associateDetails', 'exportExcel');
  const canExportPdf = canView || hasPermission(user, 'associateDetails', 'exportPdf');
  const canPrint = canView || hasPermission(user, 'associateDetails', 'print');
  const canBulkEdit = hasPermission(user, 'associateDetails', 'bulkEdit');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sno', dir: 'asc' });
  const debounce = useRef(null);
  const offsets = useMemo(() => stickyOffsets(), []);
  const lastStickyKey = STICKY_COLUMNS[STICKY_COLUMNS.length - 1]?.key;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;


  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: search || undefined };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await axios.get('/associate-details', { params });
      setRows(res.data.associates || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load associate details');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, filters]);


  useEffect(() => {
    if (!canView) return undefined;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(fetchRows, 300);
    return () => clearTimeout(debounce.current);
  }, [fetchRows, canView]);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sortedRows = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortConfig.key);
    const list = [...rows].sort((a, b) => {
      const av = sortValue(a, sortConfig.key, col?.type);
      const bv = sortValue(b, sortConfig.key, col?.type);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sortConfig]);

  const toggleAll = () => {
    if (selectedIds.size === sortedRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedRows.map(r => r._id)));
  };
  const toggleSort = (key) => setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const handleSave = async (form) => {
    if (editRow && !window.confirm('Save changes to this associate?')) return;
    if (editRow) {
      await axios.put(`/associate-details/${editRow._id}`, form);
      toast.success('Associate updated');
    } else {
      await axios.post('/associate-details', form);
      toast.success('Associate added');
    }
    setShowForm(false);
    setEditRow(null);
    fetchRows();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Move "${row.consultancyName}" to trash? You can restore it later from the Trash page.`)) return;
    try {
      await axios.delete(`/associate-details/${row._id}`);
      setRows(prev => prev.filter(r => r._id !== row._id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(row._id); return n; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Move ${selectedIds.size} selected associate${selectedIds.size > 1 ? 's' : ''} to trash?`)) return;
    try {
      await axios.delete('/associate-details/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setRows(prev => prev.filter(r => !selectedIds.has(r._id)));
      setSelectedIds(new Set());
      toast.success('Selected associates moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      fetchRows();
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/associate-details/bulk-edit', { ids, updates });
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
      const res = await axios.post('/associate-details/bulk-import', { rows: imported });
      const summary = {
        total: res.data.total ?? imported.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) toast(`${res.data.added} added, ${res.data.updated} updated, ${summary.failed} skipped`, { icon: '!' });
      else toast.success(`${res.data.added} added, ${res.data.updated} updated`);
      fetchRows();
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const sourceRows = () => (selectedIds.size > 0 ? sortedRows.filter(r => selectedIds.has(r._id)) : sortedRows);
  const pickColumns = (keys) => keys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);

  const exportExcel = (keys) => {
    const cols = pickColumns(keys);
    const data = sourceRows().map(r => {
      const o = {};
      cols.forEach(c => { o[c.label] = cellValue(r, c.key); });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols.map(c => c.label) });
    ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(12, c.label.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associates Details');
    XLSX.writeFile(wb, `Associate_Details_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (keys) => {
    const cols = pickColumns(keys);
    const src = sourceRows();
    const doc = new jsPDF({ orientation: 'landscape', format: cols.length > 8 ? 'a3' : 'a4' });
    doc.setFontSize(14);
    doc.text('Associate Details', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${src.length} associate${src.length !== 1 ? 's' : ''}`, 14, 20);
    doc.autoTable({
      startY: 24,
      head: [cols.map(c => c.label)],
      body: src.map(r => cols.map(c => cellValue(r, c.key) || '-')),
      styles: { fontSize: cols.length > 12 ? 6 : 7.5, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 6, right: 6 },
      didParseCell: pdfColorHook(cols.map(c => c.key), ['consultancyName', 'referredBy'], (v, i) => (i !== undefined && src[i] && v === (src[i].consultancyName || '') ? statusColor(normalizeStatus(src[i].status)) : associateColorSync(v))),
    });
    doc.save(`Associate_Details_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (keys) => {
    const cols = pickColumns(keys);
    const src = sourceRows();
    const head = cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const body = src.map(r => `<tr>${cols.map(c => `<td${c.key === 'consultancyName' ? htmlStyleAttr(statusColor(normalizeStatus(r.status))) : c.key === 'referredBy' ? htmlStyleAttr(associateColorSync(cellValue(r, c.key))) : ''}>${escapeHtml(cellValue(r, c.key) || '-')}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Associate Details</title><style>
@page { size: A3 landscape; margin: 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; color: #000; }
h2 { margin: 0 0 4px; font-size: 14px; } p { margin: 0 0 8px; color: #555; font-size: 9px; }
table { border-collapse: collapse; width: 100%; table-layout: auto; }
td { white-space: pre-line; }
th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; white-space: pre-wrap; }
th { background: #f0f0f0; font-weight: 600; } tr:nth-child(even) { background: #fafafa; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
</style></head><body><h2>Associate Details</h2><p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${src.length} associate${src.length !== 1 ? 's' : ''}</p>
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

  const allColumnKeys = useMemo(() => EXPORT_COLUMNS.map(c => c.key), []);

  if (!canView) {
    return <div className="hb-page"><div className="hb-empty-hint">You do not have permission to view Associate Details.</div></div>;
  }

  const renderCell = (r, c) => {
    const v = cellValue(r, c.key);
    if (!v) return <span className="ad-cell-empty">—</span>;
    if (c.key === 'website') {
      const href = /^https?:\/\//i.test(v) ? v : `http://${v}`;
      return <a className="ad-link" href={href} target="_blank" rel="noopener noreferrer">{v}</a>;
    }
    if (c.key === 'consultancyName') {
      const color = statusColor(normalizeStatus(r.status));
      return <span className="ad-cell" title={v} style={{ color, fontWeight: 600 }}>{v}</span>;
    }
    if (c.key === 'referredBy') return <span className="ad-cell" title={v}><AssociateName name={v} /></span>;
    if (OWNER_COLS.includes(c.key)) return <span className="ad-cell ad-multiline" title={v}>{v}</span>;
    return <span className="ad-cell" title={v}>{v}</span>;
  };

  const stickyStyle = (c) => (c.sticky ? { left: offsets[c.key] } : undefined);

  return (
    <div className="ad-page">
      <div className="hb-page-header">
        <div>
          <h2>Associate Details</h2>
          <p className="hb-page-sub">Partner consultancies, owners, managers and contacts</p>
        </div>
        <div className="hb-header-actions">
          {canImport && <button className="hb-btn-outline" onClick={() => setShowBulkImport(true)}><IconFile /> Import</button>}
          {canExportExcel && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('excel')}><IconDownload /> Excel</button>}
          {canExportPdf && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('pdf')}><IconDownload /> PDF</button>}
          {canPrint && <button className="hb-btn-outline" onClick={() => setColumnPickerFor('print')}><IconPrint /> Print</button>}
          {canCreate && (
            <button className="hb-btn-primary" onClick={() => { setEditRow(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Add Associate
            </button>
          )}
        </div>
      </div>

      <div className="hb-toolbar">
        <div className="hb-search-box">
          <IconSearch />
          <input type="text" placeholder="Search name, owner, email, phone, address, location…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="ad-filters">
        <select className="hb-filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)} title="Status">
          <option value="">All</option>
          {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="ad-date-filter">
          <span>Onboarded</span>
          <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} aria-label="Onboarded from" />
          <span>to</span>
          <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} aria-label="Onboarded to" />
        </div>
        {activeFilterCount > 0 && <button className="ad-clear-filters" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>}
      </div>

      {selectedIds.size > 0 && (
        <div className="hb-bulk-bar">
          <span>{selectedIds.size} selected</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
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
                <input type="checkbox" checked={sortedRows.length > 0 && selectedIds.size === sortedRows.length} onChange={toggleAll} aria-label="Select all" />
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
            {loading && <tr><td colSpan={COLUMNS.length + 2} className="ad-empty">Loading…</td></tr>}
            {!loading && sortedRows.length === 0 && <tr><td colSpan={COLUMNS.length + 2} className="ad-empty">No associates found.</td></tr>}
            {!loading && sortedRows.map(r => (
              <tr key={r._id} className={`${selectedIds.has(r._id) ? 'ad-selected' : ''} ${RED_STATUSES.includes(normalizeStatus(r.status)) ? 'ad-inactive' : ''}`}>
                <td className="ad-sticky" style={{ left: 0 }}>
                  <input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} aria-label="Select row" />
                </td>
                {COLUMNS.map(c => (
                  <td
                    key={c.key}
                    className={`${c.sticky ? 'ad-sticky' : ''} ${c.key === lastStickyKey ? 'ad-sticky-last' : ''} ${c.key === 'consultancyName' ? 'ad-name' : ''}`}
                    style={stickyStyle(c)}
                  >
                    {renderCell(r, c)}
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
        <span>{sortedRows.length} associate{sortedRows.length !== 1 ? 's' : ''}{activeFilterCount > 0 || search ? ' (filtered)' : ''}</span>
      </div>

      {showForm && (
        <AssociateDetailForm row={editRow} onSave={handleSave} onClose={() => { setShowForm(false); setEditRow(null); }} />
      )}
      {showBulkEdit && (
        <AssociateDetailBulkEditModal count={selectedIds.size} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />
      )}
      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import Associate Details"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'consultancyName', label: 'Name Of Consultancy' }}
          dateFields={['dateOfOnboarding']}
        />
      )}
      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={allColumnKeys}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Associate Details'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
