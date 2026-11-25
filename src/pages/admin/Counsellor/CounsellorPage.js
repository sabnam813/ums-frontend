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
import AssociateSelect from '../../../components/shared/AssociateSelect';
import useAssociateOptions from '../../../hooks/useAssociateOptions';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import '../TrainingSchedule/TrainingSchedule.css';
import './Counsellor.css';

const IMPORT_FIELDS = [
  { key: 'associate', label: 'Associate', aliases: ['associate', 'associates', 'consultancy', 'agent'] },
  { key: 'counsellorName', label: 'Counsellor Name', aliases: ['counselorname', 'counsellor', 'counselor', 'name'] },
  { key: 'phone', label: 'Counsellor Phone no', aliases: ['phone', 'phoneno', 'phonenumber', 'mobile', 'contact', 'counsellorphone', 'counselorphone'] },
  { key: 'email', label: 'Counsellor Email', aliases: ['email', 'emailaddress', 'mail', 'counsellormail', 'counselormail'] },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CounsellorForm({ onSave, onClose }) {
  const [form, setForm] = useState({ associate: '', counsellorName: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.associate.trim()) { setError('Associate is required'); return; }
    if (!form.counsellorName.trim()) { setError('Counsellor name is required'); return; }
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
          <div className="ts-title-group"><div><h3>Add Counsellor</h3><p>Counsellor details of an associate</p></div></div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}><CloseIcon /></button>
        </div>
        <form onSubmit={submit}>
          <div className="ts-modal-body">
            {error && <div className="ts-error">{error}</div>}
            <div className="ts-field">
              <label>Associate *</label>
              <AssociateSelect value={form.associate} onChange={v => set('associate', v)} placeholder="Type to search associate…" clearable={false} />
            </div>
            <div className="ts-field">
              <label>Counsellor Name *</label>
              <input className="cn-input" type="text" value={form.counsellorName} onChange={e => set('counsellorName', e.target.value)} />
            </div>
            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Counsellor Phone no</label>
                <input className="cn-input" type="text" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="ts-field">
                <label>Counsellor Email</label>
                <input className="cn-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="ts-modal-footer">
            <button type="button" className="ts-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="ts-btn-save" disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CounsellorBulkEdit({ count, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ associate: false, phone: false, email: false });
  const [vals, setVals] = useState({ associate: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const toggle = (k) => setEnabled(e => ({ ...e, [k]: !e[k] }));
  const setVal = (k, v) => setVals(x => ({ ...x, [k]: v }));
  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const save = async () => {
    const updates = {};
    Object.keys(enabled).forEach(k => { if (enabled[k] && String(vals[k]).trim()) updates[k] = vals[k]; });
    if (!Object.keys(updates).length) { toast.error('Fill at least one selected field'); return; }
    setSaving(true);
    try { await onSave(updates); } finally { setSaving(false); }
  };

  const row = (k, label, input) => (
    <div className="ts-be-row">
      <input type="checkbox" checked={enabled[k]} onChange={() => toggle(k)} />
      <span className="ts-be-label">{label}</span>
      {enabled[k] && input}
    </div>
  );

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="ts-modal ts-modal-sm animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group"><div><h3>Bulk Edit Counsellors</h3><p>Updating <strong>{count}</strong> row{count > 1 ? 's' : ''}</p></div></div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}><CloseIcon /></button>
        </div>
        <div className="ts-modal-body">
          {row('associate', 'Associate', <div style={{ flex: 1, minWidth: 220 }}><AssociateSelect value={vals.associate} onChange={v => setVal('associate', v)} placeholder="Select associate…" /></div>)}
          {row('phone', 'Phone no', <input className="ts-be-input" type="text" value={vals.phone} onChange={e => setVal('phone', e.target.value)} />)}
          {row('email', 'Email', <input className="ts-be-input" type="text" value={vals.email} onChange={e => setVal('email', e.target.value)} />)}
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

export default function CounsellorPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, 'counsellorDetails', 'view');
  const canCreate = hasPermission(user, 'counsellorDetails', 'create');
  const canEdit = hasPermission(user, 'counsellorDetails', 'edit');
  const canDelete = hasPermission(user, 'counsellorDetails', 'delete');
  const canImport = hasPermission(user, 'counsellorDetails', 'import');
  const canExportExcel = hasPermission(user, 'counsellorDetails', 'exportExcel');
  const canExportPdf = hasPermission(user, 'counsellorDetails', 'exportPdf');
  const canPrint = hasPermission(user, 'counsellorDetails', 'print');
  const canBulkEdit = hasPermission(user, 'counsellorDetails', 'bulkEdit');

  const associateList = useAssociateOptions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [associateFilter, setAssociateFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [inlineId, setInlineId] = useState('');
  const [inlineForm, setInlineForm] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'associate', dir: 'asc' });
  const debounce = useRef(null);

  const currentParams = useCallback(() => ({
    q: search || undefined,
    associate: associateFilter || undefined,
  }), [search, associateFilter]);

  const fetchRows = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/counsellors', { params });
      setRows(res.data.rows || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load counsellors');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return undefined;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { fetchRows(currentParams()); }, 300);
    return () => clearTimeout(debounce.current);
  }, [canView, currentParams, fetchRows]);

  const refetch = () => fetchRows(currentParams());

  const sortedRows = useMemo(() => {
    const k = sortConfig.key;
    const list = [...rows].sort((a, b) => {
      const av = String(a[k] || '').toLowerCase();
      const bv = String(b[k] || '').toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sortConfig]);

  const toggleSort = (key) => setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selectedIds.size === sortedRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedRows.map(r => r._id)));
  };

  const handleAdd = async (form) => {
    const res = await axios.post('/counsellors', form);
    toast.success('Counsellor added');
    if (res.data.notInAssociateDetails) toast('Associate not present in Associate Details', { icon: '⚠️' });
    setShowForm(false);
    refetch();
  };

  const startInline = (r) => {
    setInlineId(r._id);
    setInlineForm({ associate: r.associate || '', counsellorName: r.counsellorName || '', phone: r.phone || '', email: r.email || '' });
  };

  const setInline = (k, v) => setInlineForm(f => ({ ...f, [k]: v }));

  const saveInline = async () => {
    if (!inlineForm.associate.trim() || !inlineForm.counsellorName.trim()) { toast.error('Associate and counsellor name are required'); return; }
    try {
      const res = await axios.put(`/counsellors/${inlineId}`, inlineForm);
      toast.success('Row updated');
      if (res.data.notInAssociateDetails) toast('Associate not present in Associate Details', { icon: '⚠️' });
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
      await axios.delete(`/counsellors/${id}`);
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
      await axios.delete('/counsellors/bulk-delete', { data: { ids: Array.from(selectedIds) } });
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
      await axios.post('/counsellors/bulk-edit', { ids, updates });
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
      const prepared = importRows.map(r => ({ associate: r.associate || '', counsellorName: r.counsellorName || '', phone: r.phone || '', email: r.email || '' }));
      const res = await axios.post('/counsellors/bulk-import', { rows: prepared });
      const summary = { total: res.data.total ?? importRows.length, created: res.data.created, failed: res.data.failed ?? 0, failures: res.data.failures || [] };
      if (summary.failed > 0) toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      else toast.success(`${summary.created} row${summary.created !== 1 ? 's' : ''} imported`);
      (res.data.warnings || []).forEach(w => toast(w, { icon: '⚠️' }));
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
      ['Associate', 'Counsellor Name', 'Counsellor Phone no', 'Counsellor Email'],
      ['Sample Consultancy', 'Sample Name', '9800000000', 'name@example.com'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Counsellors');
    XLSX.writeFile(wb, 'Counsellor_Details_Template.xlsx');
  };

  const exportSource = () => (selectedIds.size > 0 ? sortedRows.filter(r => selectedIds.has(r._id)) : sortedRows);
  const HEAD = ['SN', 'Associate', 'Counsellor Name', 'Counsellor Phone no', 'Counsellor Email'];
  const bodyOf = (src) => src.map((r, i) => [i + 1, r.associate, r.counsellorName, r.phone || '', r.email || '']);

  const exportExcel = () => {
    const src = exportSource();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ...bodyOf(src)]), 'Counsellors');
    XLSX.writeFile(wb, `Counsellor_Details_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    const src = exportSource();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Counsellor Details', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Rows: ${src.length}`, 14, 22);
    doc.autoTable({
      startY: 26, head: [HEAD], body: bodyOf(src).map(r => r.map(String)),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 10, right: 10 },
    });
    doc.save(`Counsellor_Details_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = () => {
    const src = exportSource();
    const head = HEAD.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const body = bodyOf(src).map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html>
<html><head><title>Counsellor Details</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
p { margin: 0 0 8px; color: #555; font-size: 10px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
</style></head><body>
<h2>Counsellor Details</h2>
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

  const importOptionsByField = useMemo(() => ({ associate: associateList.map(a => a.name) }), [associateList]);

  if (!canView) {
    return <div className="ts-page"><div className="ts-empty-hint">You do not have permission to view Counsellor Details.</div></div>;
  }

  const cols = [
    { key: 'sn', label: 'SN', sortable: false },
    { key: 'associate', label: 'Associate', sortable: true },
    { key: 'counsellorName', label: 'Counsellor Name', sortable: true },
    { key: 'phone', label: 'Counsellor Phone no', sortable: true },
    { key: 'email', label: 'Counsellor Email', sortable: true },
  ];

  return (
    <div className="ts-page">
      <div className="ts-page-header">
        <div>
          <h2>Counsellor Details</h2>
          <p className="ts-page-sub">Counsellors of each associate</p>
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
          <input type="text" placeholder="Search associate, name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="ts-filter-select" value={associateFilter} onChange={e => setAssociateFilter(e.target.value)}>
          <option value="">All associates</option>
          {[...new Set([...associateList.map(a => a.name), ...rows.map(r => r.associate)])].sort((a, b) => a.localeCompare(b)).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
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
        <table className="ts-table">
          <thead>
            <tr>
              <th className="ts-th-check">
                <input type="checkbox" checked={sortedRows.length > 0 && selectedIds.size === sortedRows.length} onChange={toggleAll} />
              </th>
              {cols.map(c => (
                <th
                  key={c.key}
                  className={`${c.sortable ? 'sortable' : ''} ${sortConfig.key === c.key ? 'sorted' : ''}`}
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
            {loading && <tr><td colSpan={7} className="ts-empty-hint">Loading…</td></tr>}
            {!loading && sortedRows.length === 0 && <tr><td colSpan={7} className="ts-empty-hint">No counsellors found.</td></tr>}
            {!loading && sortedRows.map((r, idx) => {
              const editing = inlineId === r._id && inlineForm;
              return (
                <tr key={r._id}>
                  <td><input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                  <td className="cn-sn">{idx + 1}</td>
                  {editing ? (
                    <>
                      <td style={{ minWidth: 220 }}><AssociateSelect value={inlineForm.associate} onChange={v => setInline('associate', v)} clearable={false} /></td>
                      <td><input className="cn-inline" type="text" value={inlineForm.counsellorName} onChange={e => setInline('counsellorName', e.target.value)} /></td>
                      <td><input className="cn-inline" type="text" value={inlineForm.phone} onChange={e => setInline('phone', e.target.value)} /></td>
                      <td><input className="cn-inline" type="text" value={inlineForm.email} onChange={e => setInline('email', e.target.value)} /></td>
                      <td>
                        <div className="cn-actions-cell">
                          <button className="cn-save-sm" onClick={saveInline}>Save</button>
                          <button className="cn-cancel-sm" onClick={() => { setInlineId(''); setInlineForm(null); }}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="ts-td-name">
                        {r.associate}
                        {r.notInAssociateDetails && <span className="cn-warn">Not in Associate Details</span>}
                      </td>
                      <td>{r.counsellorName}</td>
                      <td>{r.phone || '-'}</td>
                      <td>{r.email || '-'}</td>
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

      {showForm && <CounsellorForm onSave={handleAdd} onClose={() => setShowForm(false)} />}
      {showBulkEdit && <CounsellorBulkEdit count={selectedIds.size} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />}
      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import Counsellors"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'counsellorName', label: 'Counsellor Name' }}
          dateFields={[]}
          optionsByField={importOptionsByField}
        />
      )}
    </div>
  );
}
