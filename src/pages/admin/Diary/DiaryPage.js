import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import DiaryForm from './DiaryForm';
import DiaryBulkEditModal from './DiaryBulkEditModal';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../../components/shared/SelectColumnsModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import './Diary.css';

const IMPORT_FIELDS = [
  { key: 'name', label: 'Name', aliases: ['fullname', 'contactname'] },
  { key: 'post', label: 'Post', aliases: ['designation', 'position', 'title'] },
  { key: 'mobile', label: 'Mobile No', aliases: ['mobile', 'phone', 'contact', 'contactnumber', 'phonenumber'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remark', 'notes', 'note'] },
];

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'post', label: 'Post' },
  { key: 'mobile', label: 'Mobile No' },
  { key: 'remarks', label: 'Remarks' },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function getExportValue(row, key) {
  return row[key] || '';
}

export default function DiaryPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const searchDebounce = useRef(null);

  const fetchEntries = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/diary', { params });
      setEntries(res.data.entries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load diary entries');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchEntries({ q: search || undefined });
    }, 300);
    return () => clearTimeout(searchDebounce.current);
  }, [search, fetchEntries]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map(e => e._id)));
  };

  const handleSave = async (payload) => {
    if (editEntry) {
      const res = await axios.put(`/diary/${editEntry._id}`, payload);
      setEntries(prev => prev.map(e => e._id === editEntry._id ? res.data.entry : e));
      toast.success('Diary entry updated');
    } else {
      const res = await axios.post('/diary', payload);
      setEntries(prev => [res.data.entry, ...prev]);
      toast.success('Diary entry added');
    }
    setShowForm(false);
    setEditEntry(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this diary entry to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/diary/${id}`);
      setEntries(prev => prev.filter(e => e._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete diary entry');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected entr${selectedIds.size > 1 ? 'ies' : 'y'} to trash?`)) return;
    try {
      await axios.delete('/diary/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setEntries(prev => prev.filter(e => !selectedIds.has(e._id)));
      setSelectedIds(new Set());
      toast.success('Selected entries moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      fetchEntries({ q: search || undefined });
    }
  };

  const handleBulkSave = async (updates) => {
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/diary/bulk-edit', { ids, updates });
      toast.success(`${ids.length} entr${ids.length > 1 ? 'ies' : 'y'} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      fetchEntries({ q: search || undefined });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const prepared = rows.map(r => ({
        name: r.name || '',
        post: r.post || '',
        mobile: r.mobile || '',
        remarks: r.remarks || '',
      }));
      const res = await axios.post('/diary/bulk-import', { rows: prepared });
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} entr${summary.created !== 1 ? 'ies' : 'y'} imported`);
      }
      fetchEntries({ q: search || undefined });
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const handleColumnsConfirm = (columnKeys) => {
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(columnKeys);
    else if (target === 'pdf') exportPDF(columnKeys);
    else if (target === 'print') handlePrint(columnKeys);
  };

  const exportExcel = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? entries.filter(e => selectedIds.has(e._id)) : entries;
    const rows = source.map(e => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(e, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diary');
    XLSX.writeFile(wb, `Diary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? entries.filter(e => selectedIds.has(e._id)) : entries;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Diary', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${source.length} entr${source.length !== 1 ? 'ies' : 'y'}`, 14, 22);
    doc.autoTable({
      startY: 26,
      head: [columns.map(c => c.label)],
      body: source.map(e => columns.map(c => getExportValue(e, c.key) || '—')),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`Diary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? entries.filter(e => selectedIds.has(e._id)) : entries;
    const headers = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const rows = source.map(e => {
      const cells = columns.map(c => `<td>${escapeHtml(getExportValue(e, c.key) || '—')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Diary</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
    h2 { margin: 0 0 6px; font-size: 15px; }
    p { margin: 0 0 8px; color: #555; font-size: 9px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body>
  <h2>Diary</h2>
  <p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${source.length} entr${source.length !== 1 ? 'ies' : 'y'}</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const columnPickerInitialSelected = useMemo(() => EXPORT_COLUMNS.map(c => c.key), []);

  if (!isSuperAdmin) {
    return <div className="dy-page"><div className="dy-empty-hint">You do not have permission to view the Diary module.</div></div>;
  }

  return (
    <div className="dy-page">
      <div className="dy-page-header">
        <div>
          <h2>Diary</h2>
          <p className="dy-page-sub">Super Admin contact book — name, post, mobile number &amp; remarks.</p>
        </div>
        <div className="dy-header-actions">
          <button className="dy-btn-outline" onClick={() => setShowBulkImport(true)}>
            <IconFile /> Import
          </button>
          <button className="dy-btn-outline" onClick={() => openColumnPicker('excel')}>
            <IconDownload /> Excel
          </button>
          <button className="dy-btn-outline" onClick={() => openColumnPicker('pdf')}>
            <IconDownload /> PDF
          </button>
          <button className="dy-btn-outline" onClick={() => openColumnPicker('print')}>
            <IconPrint /> Print
          </button>
          <button className="dy-btn-primary" onClick={() => { setEditEntry(null); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Entry
          </button>
        </div>
      </div>

      <div className="dy-toolbar">
        <div className="dy-search-box">
          <IconSearch />
          <input type="text" placeholder="Search name, post, mobile, or remarks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="dy-bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>
          <button className="dy-danger" onClick={handleBulkDelete}>Delete Selected</button>
          <button className="dy-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="dy-table-wrap">
        <table className="dy-table">
          <thead>
            <tr>
              <th className="dy-th-check">
                <input type="checkbox" checked={entries.length > 0 && selectedIds.size === entries.length} onChange={toggleAll} />
              </th>
              <th>Name</th>
              <th>Post</th>
              <th>Mobile No</th>
              <th>Remarks</th>
              <th className="dy-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="dy-empty-hint">Loading…</td></tr>
            )}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={6} className="dy-empty-hint">No diary entries found.</td></tr>
            )}
            {!loading && entries.map(e => (
              <tr key={e._id}>
                <td><input type="checkbox" checked={selectedIds.has(e._id)} onChange={() => toggleSelect(e._id)} /></td>
                <td className="dy-td-name">{e.name}</td>
                <td>{e.post || <span className="dy-td-empty">—</span>}</td>
                <td>{e.mobile || <span className="dy-td-empty">—</span>}</td>
                <td className="dy-td-remarks">{e.remarks || <span className="dy-td-empty">—</span>}</td>
                <td className="dy-td-actions">
                  <button className="dy-icon-sm" title="Edit" onClick={() => { setEditEntry(e); setShowForm(true); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="dy-icon-sm dy-danger" title="Delete" onClick={() => handleDelete(e._id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dy-footer">
        <span>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {showForm && (
        <DiaryForm
          entry={editEntry}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEntry(null); }}
        />
      )}

      {showBulkEdit && (
        <DiaryBulkEditModal
          count={selectedIds.size}
          onSave={handleBulkSave}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import Diary"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'name', label: 'Name' }}
          dateFields={[]}
          optionsByField={{}}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Diary'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
