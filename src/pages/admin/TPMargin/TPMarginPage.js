import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission } from '../../../utils/rbac';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import '../TrainingSchedule/TrainingSchedule.css';
import './TPMargin.css';

const IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['date', 'bookingdate', 'entrydate'] },
  { key: 'particular', label: 'Particulars', aliases: ['particulars', 'particular', 'test', 'testtype', 'exam', 'details'] },
  { key: 'price', label: 'Price', aliases: ['price', 'amount', 'fee'] },
  { key: 'totalMargin', label: 'Total Margin', aliases: ['totalmargin', 'total', 'margin', 'pricemargin'] },
  { key: 'associateMargin', label: 'Associate Margin', aliases: ['associatemargin', 'associate', 'associateshare'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'remark', 'notes', 'comments'] },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function dateKey(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calcUca(total, assoc) {
  const t = Number(total) || 0;
  const a = Number(assoc) || 0;
  return Math.round((t - a) * 100) / 100;
}

function MarginForm({ row, particulars, onSave, onClose }) {
  const isEdit = !!row;
  const [form, setForm] = useState({
    date: row ? dateKey(row.date) : format(new Date(), 'yyyy-MM-dd'),
    particular: row?.particular || particulars[0] || '',
    price: row ? String(row.price ?? '') : '',
    totalMargin: row ? String(row.totalMargin ?? '') : '',
    associateMargin: row ? String(row.associateMargin ?? '') : '',
    remarks: row?.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.date) { setError('Date is required'); return; }
    if (!form.particular) { setError('Particulars is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="ts-modal ts-modal-sm animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group">
            <div>
              <h3>{isEdit ? 'Edit TP Margin' : 'Add TP Margin'}</h3>
              <p>Test preparation margin entry</p>
            </div>
          </div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="ts-modal-body">
            {error && <div className="ts-error">{error}</div>}
            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="ts-field">
                <label>Particulars *</label>
                <select value={form.particular} onChange={e => set('particular', e.target.value)} required>
                  {!particulars.includes(form.particular) && form.particular && <option value={form.particular}>{form.particular}</option>}
                  {particulars.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Price</label>
                <input type="number" step="0.01" className="tpm-field-num" value={form.price} onChange={e => set('price', e.target.value)} />
              </div>
              <div className="ts-field">
                <label>Total Margin</label>
                <input type="number" step="0.01" className="tpm-field-num" value={form.totalMargin} onChange={e => set('totalMargin', e.target.value)} />
              </div>
              <div className="ts-field">
                <label>Associate Margin</label>
                <input type="number" step="0.01" className="tpm-field-num" value={form.associateMargin} onChange={e => set('associateMargin', e.target.value)} />
              </div>
              <div className="ts-field">
                <label>UCA Margin</label>
                <input type="number" className="tpm-field-num" value={calcUca(form.totalMargin, form.associateMargin)} readOnly tabIndex={-1} />
              </div>
            </div>
            <div className="ts-field">
              <label>Remarks</label>
              <input type="text" maxLength={500} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
          <div className="ts-modal-footer">
            <button type="button" className="ts-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="ts-btn-save" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MarginBulkEdit({ count, particulars, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ particular: false, date: false, price: false, totalMargin: false, associateMargin: false, remarks: false });
  const [vals, setVals] = useState({ particular: particulars[0] || '', date: format(new Date(), 'yyyy-MM-dd'), price: '', totalMargin: '', associateMargin: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const toggle = (k) => setEnabled(e => ({ ...e, [k]: !e[k] }));
  const setVal = (k, v) => setVals(x => ({ ...x, [k]: v }));
  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const save = async () => {
    const updates = {};
    Object.keys(enabled).forEach(k => { if (enabled[k]) updates[k] = vals[k]; });
    if (!Object.keys(updates).length) return;
    setSaving(true);
    try { await onSave(updates); } finally { setSaving(false); }
  };

  const row = (k, label, input) => (
    <label className="ts-be-row">
      <input type="checkbox" checked={enabled[k]} onChange={() => toggle(k)} />
      <span className="ts-be-label">{label}</span>
      {enabled[k] && input}
    </label>
  );

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="ts-modal ts-modal-sm animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group">
            <div>
              <h3>Bulk Edit TP Margin</h3>
              <p>Updating <strong>{count}</strong> row{count > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ts-modal-body">
          {row('particular', 'Particulars', (
            <select className="ts-be-input" value={vals.particular} onChange={e => setVal('particular', e.target.value)}>
              {particulars.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ))}
          {row('date', 'Date', <input type="date" className="ts-be-input" value={vals.date} onChange={e => setVal('date', e.target.value)} />)}
          {row('price', 'Price', <input type="number" step="0.01" className="ts-be-input" value={vals.price} onChange={e => setVal('price', e.target.value)} />)}
          {row('totalMargin', 'Total Margin', <input type="number" step="0.01" className="ts-be-input" value={vals.totalMargin} onChange={e => setVal('totalMargin', e.target.value)} />)}
          {row('associateMargin', 'Associate Margin', <input type="number" step="0.01" className="ts-be-input" value={vals.associateMargin} onChange={e => setVal('associateMargin', e.target.value)} />)}
          {row('remarks', 'Remarks', <input type="text" maxLength={500} className="ts-be-input" value={vals.remarks} onChange={e => setVal('remarks', e.target.value)} />)}
          <span className="ts-be-enabled-count">{enabledCount} field{enabledCount !== 1 ? 's' : ''} selected</span>
        </div>
        <div className="ts-modal-footer">
          <button type="button" className="ts-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="ts-btn-save" onClick={save} disabled={saving || enabledCount === 0}>{saving ? 'Saving…' : 'Apply'}</button>
        </div>
      </div>
    </div>
  );
}

export default function TPMarginPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, 'tpMargin', 'view');
  const canCreate = hasPermission(user, 'tpMargin', 'create');
  const canEdit = hasPermission(user, 'tpMargin', 'edit');
  const canDelete = hasPermission(user, 'tpMargin', 'delete');
  const canImport = hasPermission(user, 'tpMargin', 'import');
  const canExportExcel = hasPermission(user, 'tpMargin', 'exportExcel');
  const canExportPdf = hasPermission(user, 'tpMargin', 'exportPdf');
  const canPrint = hasPermission(user, 'tpMargin', 'print');
  const canBulkEdit = hasPermission(user, 'tpMargin', 'bulkEdit');

  const [rows, setRows] = useState([]);
  const [particulars, setParticulars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [particularFilter, setParticularFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [inlineId, setInlineId] = useState('');
  const [inlineForm, setInlineForm] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'asc' });
  const debounce = useRef(null);

  const currentParams = useCallback(() => ({
    q: search || undefined,
    particular: particularFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [search, particularFilter, dateFrom, dateTo]);

  const fetchRows = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/tp-margins', { params });
      setRows(res.data.rows || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load TP margins');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadParticulars = useCallback(() => {
    axios.get('/tp-margins/particulars')
      .then(res => setParticulars(res.data.particulars || []))
      .catch(() => setParticulars([]));
  }, []);

  useEffect(() => { if (canView) loadParticulars(); }, [canView, loadParticulars]);

  useEffect(() => {
    if (!canView) return undefined;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { fetchRows(currentParams()); }, 300);
    return () => clearTimeout(debounce.current);
  }, [canView, currentParams, fetchRows]);

  const refetch = () => { fetchRows(currentParams()); loadParticulars(); };

  const numbered = useMemo(() => rows.map((r, i) => ({ ...r, sn: i + 1 })), [rows]);

  const sortedRows = useMemo(() => {
    const list = [...numbered].sort((a, b) => {
      const k = sortConfig.key;
      let av;
      let bv;
      if (k === 'date') { av = dateKey(a.date); bv = dateKey(b.date); }
      else if (k === 'particular') { av = (a.particular || '').toLowerCase(); bv = (b.particular || '').toLowerCase(); }
      else if (k === 'remarks') { av = (a.remarks || '').toLowerCase(); bv = (b.remarks || '').toLowerCase(); }
      else if (k === 'ucaMargin') { av = calcUca(a.totalMargin, a.associateMargin); bv = calcUca(b.totalMargin, b.associateMargin); }
      else { av = Number(a[k]) || 0; bv = Number(b[k]) || 0; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [numbered, sortConfig]);

  const toggleSort = (key) => setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selectedIds.size === sortedRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedRows.map(r => r._id)));
  };

  const handleAdd = async (form) => {
    await axios.post('/tp-margins', form);
    toast.success('TP margin added');
    setShowForm(false);
    refetch();
  };

  const startInline = (r) => {
    setInlineId(r._id);
    setInlineForm({
      date: dateKey(r.date), particular: r.particular || '',
      price: String(r.price ?? ''), totalMargin: String(r.totalMargin ?? ''), associateMargin: String(r.associateMargin ?? ''),
      remarks: r.remarks || '',
    });
  };

  const setInline = (k, v) => setInlineForm(f => ({ ...f, [k]: v }));

  const saveInline = async () => {
    if (!inlineForm.date || !inlineForm.particular) { toast.error('Date and Particulars are required'); return; }
    try {
      await axios.put(`/tp-margins/${inlineId}`, inlineForm);
      toast.success('Row updated');
      setInlineId('');
      setInlineForm(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update row');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this row to trash?')) return;
    try {
      await axios.delete(`/tp-margins/${id}`);
      setRows(prev => prev.filter(r => r._id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete row');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected row${selectedIds.size > 1 ? 's' : ''} to trash?`)) return;
    try {
      await axios.delete('/tp-margins/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setRows(prev => prev.filter(r => !selectedIds.has(r._id)));
      setSelectedIds(new Set());
      toast.success('Selected rows moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      refetch();
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected row${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/tp-margins/bulk-edit', { ids, updates });
      toast.success(`${ids.length} row${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkImport = async (importRows) => {
    if (!importRows || importRows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const prepared = importRows.map(r => ({
        date: r.date || '', particular: r.particular || '',
        price: r.price ?? '', totalMargin: r.totalMargin ?? '', associateMargin: r.associateMargin ?? '',
        remarks: r.remarks || '',
      }));
      const res = await axios.post('/tp-margins/bulk-import', { rows: prepared });
      const summary = {
        total: res.data.total ?? importRows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      else toast.success(`${summary.created} row${summary.created !== 1 ? 's' : ''} imported`);
      refetch();
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Particulars', 'Price', 'Total Margin', 'Associate Margin', 'Remarks'],
      [format(new Date(), 'yyyy-MM-dd'), particulars[0] || 'IELTS', 20000, 1000, 400, ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TP Margin');
    XLSX.writeFile(wb, 'TP_Margin_Template.xlsx');
  };

  const exportSource = () => (selectedIds.size > 0 ? sortedRows.filter(r => selectedIds.has(r._id)) : sortedRows);
  const HEAD = ['SN', 'Date', 'Particulars', 'Price', 'Total Margin', 'Associate Margin', 'UCA Margin', 'Remarks'];
  const ucaOf = (r) => calcUca(r.totalMargin, r.associateMargin);
  const bodyOf = (src) => src.map((r, i) => [i + 1, dateKey(r.date), r.particular, money(r.price), money(r.totalMargin), money(r.associateMargin), money(ucaOf(r)), r.remarks || '']);
  const exportExcel = () => {
    const src = exportSource();
    const aoa = [
      HEAD,
      ...src.map((r, i) => [i + 1, dateKey(r.date), r.particular, Number(r.price) || 0, Number(r.totalMargin) || 0, Number(r.associateMargin) || 0, ucaOf(r), r.remarks || '']),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'TP Margin');
    XLSX.writeFile(wb, `TP_Margin_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    const src = exportSource();
    const doc = new jsPDF({ orientation: 'portrait' });
    doc.setFontSize(14);
    doc.text('TP Margin', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Rows: ${src.length}`, 14, 22);
    doc.autoTable({
      startY: 26,
      head: [HEAD],
      body: bodyOf(src),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      margin: { left: 10, right: 10 },
    });
    doc.save(`TP_Margin_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = () => {
    const src = exportSource();
    const head = HEAD.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const body = bodyOf(src).map(r => `<tr>${r.map((v, i) => `<td${i >= 3 && i <= 6 ? ' class="n"' : ''}>${escapeHtml(v)}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html>
<html><head><title>TP Margin</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
p { margin: 0 0 8px; color: #555; font-size: 10px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
td.n { text-align: right; }
tr:nth-child(even) { background: #fafafa; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
</style></head><body>
<h2>TP Margin</h2>
<p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${src.length} row${src.length !== 1 ? 's' : ''}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const importOptionsByField = useMemo(() => ({ particular: particulars }), [particulars]);

  if (!canView) {
    return <div className="ts-page"><div className="ts-empty-hint">You do not have permission to view TP Margin.</div></div>;
  }

  const cols = [
    { key: 'sn', label: 'SN', sortable: false },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'particular', label: 'Particulars', sortable: true },
    { key: 'price', label: 'Price', sortable: true, num: true },
    { key: 'totalMargin', label: 'Total Margin', sortable: true, num: true },
    { key: 'associateMargin', label: 'Associate Margin', sortable: true, num: true },
    { key: 'ucaMargin', label: 'UCA Margin', sortable: true, num: true },
    { key: 'remarks', label: 'Remarks', sortable: true },
  ];

  return (
    <div className="ts-page">
      <div className="ts-page-header">
        <div>
          <h2>TP Margin</h2>
          <p className="ts-page-sub">Test preparation margins</p>
        </div>
        <div className="ts-header-actions">
          {canImport && <button className="ts-btn-outline" onClick={() => setShowBulkImport(true)}><IconFile /> Import</button>}
          {canExportExcel && <button className="ts-btn-outline" onClick={exportExcel}><IconDownload /> Excel</button>}
          {canExportPdf && <button className="ts-btn-outline" onClick={exportPDF}><IconDownload /> PDF</button>}
          {canPrint && <button className="ts-btn-outline" onClick={handlePrint}><IconPrint /> Print</button>}
          {canCreate && (
            <button className="ts-btn-primary" onClick={() => setShowForm(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Add
            </button>
          )}
        </div>
      </div>

      <div className="ts-toolbar">
        <div className="ts-search-box">
          <IconSearch />
          <input type="text" placeholder="Search particulars or remarks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="ts-filter-select" value={particularFilter} onChange={e => setParticularFilter(e.target.value)}>
          <option value="">All particulars</option>
          {particulars.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="ts-date-filter">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span>To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {canImport && <button className="ts-btn-outline" onClick={downloadTemplate}><IconDownload /> Template</button>}
      </div>

      {selectedIds.size > 0 && (
        <div className="ts-bulk-bar">
          <span>{selectedIds.size} selected</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
          {canDelete && <button className="ts-danger" onClick={handleBulkDelete}>Delete Selected</button>}
          <button className="ts-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="ts-table-wrap">
        <table className="ts-table tpm-table">
          <thead>
            <tr>
              <th className="ts-th-check">
                <input type="checkbox" checked={sortedRows.length > 0 && selectedIds.size === sortedRows.length} onChange={toggleAll} />
              </th>
              {cols.map(c => (
                <th
                  key={c.key}
                  className={`${c.sortable ? 'sortable' : ''} ${sortConfig.key === c.key ? 'sorted' : ''} ${c.num ? 'tpm-num' : ''}`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="th-content">
                    {c.label}
                    {c.sortable && <span className="sort-icon">{sortConfig.key === c.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                  </span>
                </th>
              ))}
              {(canEdit || canDelete) && <th className="ts-th-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="ts-empty-hint">Loading…</td></tr>}
            {!loading && sortedRows.length === 0 && <tr><td colSpan={10} className="ts-empty-hint">No rows found.</td></tr>}
            {!loading && sortedRows.map((r, idx) => {
              const editing = inlineId === r._id && inlineForm;
              return (
                <tr key={r._id}>
                  <td><input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                  <td className="tpm-sn">{idx + 1}</td>
                  {editing ? (
                    <>
                      <td><input type="date" className="tpm-inline" value={inlineForm.date} onChange={e => setInline('date', e.target.value)} /></td>
                      <td>
                        <select className="tpm-inline" value={inlineForm.particular} onChange={e => setInline('particular', e.target.value)}>
                          {!particulars.includes(inlineForm.particular) && inlineForm.particular && <option value={inlineForm.particular}>{inlineForm.particular}</option>}
                          {particulars.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td><input type="number" step="0.01" className="tpm-inline tpm-inline-num" value={inlineForm.price} onChange={e => setInline('price', e.target.value)} /></td>
                      <td><input type="number" step="0.01" className="tpm-inline tpm-inline-num" value={inlineForm.totalMargin} onChange={e => setInline('totalMargin', e.target.value)} /></td>
                      <td><input type="number" step="0.01" className="tpm-inline tpm-inline-num" value={inlineForm.associateMargin} onChange={e => setInline('associateMargin', e.target.value)} /></td>
                      <td className="tpm-num">{money(calcUca(inlineForm.totalMargin, inlineForm.associateMargin))}</td>
                      <td><input type="text" maxLength={500} className="tpm-inline" value={inlineForm.remarks} onChange={e => setInline('remarks', e.target.value)} /></td>
                      <td>
                        <div className="tpm-actions-cell">
                          <button className="tpm-save-sm" onClick={saveInline}>Save</button>
                          <button className="tpm-cancel-sm" onClick={() => { setInlineId(''); setInlineForm(null); }}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="ts-date-cell">{dateKey(r.date)}</td>
                      <td className="ts-td-name">{r.particular}</td>
                      <td className="tpm-num">{money(r.price)}</td>
                      <td className="tpm-num">{money(r.totalMargin)}</td>
                      <td className="tpm-num">{money(r.associateMargin)}</td>
                      <td className="tpm-num">{money(ucaOf(r))}</td>
                      <td>{r.remarks || ''}</td>
                      {(canEdit || canDelete) && (
                        <td className="ts-td-actions">
                          {canEdit && (
                            <button className="ts-icon-sm" title="Edit" onClick={() => startInline(r)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                          )}
                          {canDelete && (
                            <button className="ts-icon-sm ts-danger" title="Delete" onClick={() => handleDelete(r._id)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                            </button>
                          )}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ts-footer">
        <span>{sortedRows.length} row{sortedRows.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && <MarginForm row={null} particulars={particulars} onSave={handleAdd} onClose={() => setShowForm(false)} />}

      {showBulkEdit && (
        <MarginBulkEdit count={selectedIds.size} particulars={particulars} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />
      )}

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import TP Margin"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'particular', label: 'Particulars' }}
          dateFields={['date']}
          optionsByField={importOptionsByField}
        />
      )}
    </div>
  );
}
