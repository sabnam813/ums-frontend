import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission } from '../../../utils/rbac';
import HallBookingForm from './HallBookingForm';
import HallBookingBulkEditModal from './HallBookingBulkEditModal';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../../components/shared/SelectColumnsModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import './HallBooking.css';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['visitdate', 'dateofvisit', 'ddmmyyyy'] },
  { key: 'country', label: 'Country', aliases: ['countrycompany', 'country'] },
  { key: 'hall', label: 'Hall / Room', aliases: ['hall', 'room', 'venue'] },
  { key: 'time', label: 'Time', aliases: ['time', 'timeslot'] },
  { key: 'institution', label: 'University / College / Portal', aliases: ['universitycollegenameportal', 'universitycollegename', 'institution', 'university', 'college', 'portal'] },
  { key: 'representativeName', label: 'Representative Name', aliases: ['representativename', 'repname'] },
  { key: 'designation', label: 'Designation', aliases: ['designation', 'title', 'position'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'notes'] },
];

const EXPORT_COLUMNS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'countryName', label: 'Country' },
  { key: 'hall', label: 'Hall / Room' },
  { key: 'time', label: 'Time' },
  { key: 'institution', label: 'University / College / Portal' },
  { key: 'representativeName', label: 'Representative' },
  { key: 'designation', label: 'Designation' },
  { key: 'status', label: 'Status' },
  { key: 'remarks', label: 'Remarks' },
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

function getExportValue(row, key) {
  if (key === 'date') return fmtDate(row.date);
  if (key === 'countryName') return row.country?.name || '';
  if (key === 'status') return (row.status || '').charAt(0).toUpperCase() + (row.status || '').slice(1);
  return row[key] || '';
}

export default function HallBookingPage() {
  const { user } = useAuth();

  const canView = hasPermission(user, 'hallBooking', 'view');
  const canCreate = hasPermission(user, 'hallBooking', 'create');
  const canEdit = hasPermission(user, 'hallBooking', 'edit');
  const canDelete = user?.role === 'super_admin';
  const canImport = hasPermission(user, 'hallBooking', 'import');
  const canExportExcel = hasPermission(user, 'hallBooking', 'exportExcel');
  const canExportPdf = hasPermission(user, 'hallBooking', 'exportPdf');
  const canPrint = hasPermission(user, 'hallBooking', 'print');
  const canBulkEdit = hasPermission(user, 'hallBooking', 'bulkEdit');

  const [bookings, setBookings] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editBooking, setEditBooking] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'desc' });
  const [staffUsers, setStaffUsers] = useState([]);
  const searchDebounce = useRef(null);
  const isSuperAdmin = user?.role === 'super_admin';

  const fetchCountries = useCallback(async () => {
    try {
      const res = await axios.get('/hall-bookings/countries');
      setCountries(res.data.countries || []);
    } catch {
      setCountries([]);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    axios.get('/users').then(res => setStaffUsers(res.data.users || [])).catch(() => setStaffUsers([]));
  }, [isSuperAdmin]);

  const fetchBookings = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/hall-bookings', { params });
      setBookings(res.data.bookings || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load hall bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchBookings({
        q: search || undefined,
        country: countryFilter || undefined,
        status: statusFilter || undefined,
      });
    }, 300);
    return () => clearTimeout(searchDebounce.current);
  }, [search, countryFilter, statusFilter, fetchBookings]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === bookings.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(bookings.map(b => b._id)));
  };

  const toggleSort = (key) => {
    setSortConfig(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return bookings;
    const list = [...bookings].sort((a, b) => {
      let av, bv;
      if (sortConfig.key === 'date') { av = a.date ? new Date(a.date).getTime() : 0; bv = b.date ? new Date(b.date).getTime() : 0; }
      else if (sortConfig.key === 'country') { av = (a.country?.name || '').toLowerCase(); bv = (b.country?.name || '').toLowerCase(); }
      else { av = (a[sortConfig.key] || '').toString().toLowerCase(); bv = (b[sortConfig.key] || '').toString().toLowerCase(); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [bookings, sortConfig]);

  const handleSave = async (form) => {
    if (editBooking && !window.confirm('Save changes to this booking?')) return;
    const payload = { ...form };
    if (editBooking) {
      const res = await axios.put(`/hall-bookings/${editBooking._id}`, payload);
      setBookings(prev => prev.map(b => b._id === editBooking._id ? res.data.booking : b));
      toast.success('Hall booking updated');
    } else {
      const res = await axios.post('/hall-bookings', payload);
      setBookings(prev => [res.data.booking, ...prev]);
      toast.success('Hall booking added');
    }
    setShowForm(false);
    setEditBooking(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this hall booking to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/hall-bookings/${id}`);
      setBookings(prev => prev.filter(b => b._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete hall booking');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected booking${selectedIds.size > 1 ? 's' : ''} to trash?`)) return;
    try {
      await axios.delete('/hall-bookings/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setBookings(prev => prev.filter(b => !selectedIds.has(b._id)));
      setSelectedIds(new Set());
      toast.success('Selected bookings moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      fetchBookings({ q: search || undefined, country: countryFilter || undefined, status: statusFilter || undefined });
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/hall-bookings/bulk-edit', { ids, updates });
      toast.success(`${ids.length} booking${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      fetchBookings({ q: search || undefined, country: countryFilter || undefined, status: statusFilter || undefined });
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
        date: r.date || '',
        country: r.country || '',
        hall: r.hall || '',
        time: r.time || '',
        institution: r.institution || '',
        representativeName: r.representativeName || '',
        designation: r.designation || '',
        status: (r.status || '').toLowerCase(),
        remarks: r.remarks || '',
      }));
      const res = await axios.post('/hall-bookings/bulk-import', { rows: prepared });
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} booking${summary.created !== 1 ? 's' : ''} imported`);
      }
      fetchBookings({ q: search || undefined, country: countryFilter || undefined, status: statusFilter || undefined });
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
    const source = selectedIds.size > 0 ? sortedBookings.filter(b => selectedIds.has(b._id)) : sortedBookings;
    const rows = source.map(b => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(b, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hall Bookings');
    XLSX.writeFile(wb, `Hall_Bookings_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? sortedBookings.filter(b => selectedIds.has(b._id)) : sortedBookings;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Hall Bookings', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${source.length} booking${source.length !== 1 ? 's' : ''}`, 14, 22);
    doc.autoTable({
      startY: 26,
      head: [columns.map(c => c.label)],
      body: source.map(b => columns.map(c => getExportValue(b, c.key) || '—')),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`Hall_Bookings_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? sortedBookings.filter(b => selectedIds.has(b._id)) : sortedBookings;
    const headers = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const rows = source.map(b => {
      const cells = columns.map(c => `<td>${escapeHtml(getExportValue(b, c.key) || '—')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Hall Bookings</title>
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
  <h2>Hall Bookings</h2>
  <p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${source.length} booking${source.length !== 1 ? 's' : ''}</p>
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

  const importOptionsByField = useMemo(() => ({
    country: countries.map(c => c.name),
    status: STATUS_OPTIONS.map(s => s.label),
  }), [countries]);

  if (!canView) {
    return <div className="hb-page"><div className="hb-empty-hint">You do not have permission to view the Hall Booking module.</div></div>;
  }

  return (
    <div className="hb-page">
      <div className="hb-page-header">
        <div>
          <h2>Hall Booking</h2>
          <p className="hb-page-sub">University / college / portal visits </p>
        </div>
        <div className="hb-header-actions">
          {canImport && (
            <button className="hb-btn-outline" onClick={() => setShowBulkImport(true)}>
              <IconFile /> Import
            </button>
          )}
          {canExportExcel && (
            <button className="hb-btn-outline" onClick={() => openColumnPicker('excel')}>
              <IconDownload /> Excel
            </button>
          )}
          {canExportPdf && (
            <button className="hb-btn-outline" onClick={() => openColumnPicker('pdf')}>
              <IconDownload /> PDF
            </button>
          )}
          {canPrint && (
            <button className="hb-btn-outline" onClick={() => openColumnPicker('print')}>
              <IconPrint /> Print
            </button>
          )}
          {canCreate && (
            <button className="hb-btn-primary" onClick={() => { setEditBooking(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              New Booking
            </button>
          )}
        </div>
      </div>

      <div className="hb-toolbar">
        <div className="hb-search-box">
          <IconSearch />
          <input type="text" placeholder="Search hall, institution, representative, remarks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="hb-filter-select" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
          <option value="">All countries</option>
          {countries.map(c => (
            <option key={c._id} value={c._id}>{c.flag ? `${c.flag} ` : ''}{c.name}</option>
          ))}
        </select>
        <select className="hb-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="hb-bulk-bar">
          <span>{selectedIds.size} selected</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
          {canDelete && <button className="hb-danger" onClick={handleBulkDelete}>Delete Selected</button>}
          <button className="hb-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="hb-table-wrap">
        <table className="hb-table">
          <thead>
            <tr>
              <th className="hb-th-check">
                <input type="checkbox" checked={bookings.length > 0 && selectedIds.size === bookings.length} onChange={toggleAll} />
              </th>
              {[
                { key: 'date', label: 'Date' },
                { key: 'country', label: 'Event / Country' },
                { key: 'hall', label: 'Hall / Room' },
                { key: 'time', label: 'Time' },
                { key: 'institution', label: 'University / College / Portal' },
                { key: 'representativeName', label: 'Representative' },
                { key: 'designation', label: 'Designation' },
                { key: 'status', label: 'Status' },
              ].map(col => (
                <th
                  key={col.key}
                  className={`sortable ${sortConfig.key === col.key ? 'sorted' : ''}`}
                  onClick={() => toggleSort(col.key)}
                  title={`Sort by ${col.label}`}
                >
                  <span className="th-content">
                    {col.label}
                    <span className="sort-icon">
                      {sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
              ))}
              <th>Remarks</th>
              {isSuperAdmin && <th>Visibility</th>}
              <th className="hb-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={isSuperAdmin ? 12 : 11} className="hb-empty-hint">Loading…</td></tr>
            )}
            {!loading && bookings.length === 0 && (
              <tr><td colSpan={isSuperAdmin ? 12 : 11} className="hb-empty-hint">No hall bookings found.</td></tr>
            )}
            {!loading && sortedBookings.map(b => (
              <tr key={b._id}>
                <td><input type="checkbox" checked={selectedIds.has(b._id)} onChange={() => toggleSelect(b._id)} /></td>
                <td>{fmtDate(b.date) || <span className="hb-td-empty">—</span>}</td>
                <td className="hb-country-chip">
                  {b.eventType === 'general'
                    ? <span title="General / internal event">📌 {b.eventTitle || 'General event'}</span>
                    : (b.country?.flag ? `${b.country.flag} ` : '') + (b.country?.name || '—')}
                </td>
                <td className="hb-td-name">{b.hall}</td>
                <td>{b.time || <span className="hb-td-empty">—</span>}</td>
                <td>{b.institution || <span className="hb-td-empty">—</span>}</td>
                <td>{b.representativeName || <span className="hb-td-empty">—</span>}</td>
                <td>{b.designation || <span className="hb-td-empty">—</span>}</td>
                <td><span className={`hb-status-badge ${b.status}`}>{STATUS_OPTIONS.find(s => s.value === b.status)?.label || b.status}</span></td>
                <td className="hb-td-remarks">{b.remarks || <span className="hb-td-empty">—</span>}</td>
                {isSuperAdmin && (
                  <td>
                    {(!b.visibility || b.visibility.mode === 'everyone') && <span className="hb-visibility-badge">Everyone</span>}
                    {b.visibility?.mode === 'specific' && (
                      <span className="hb-visibility-badge specific" title={(b.visibility.allowedUsers || []).map(u => u.name || u.username).join(', ')}>
                        {(b.visibility.allowedUsers || []).length} people
                      </span>
                    )}
                    {b.visibility?.mode === 'private' && <span className="hb-visibility-badge private">Private</span>}
                  </td>
                )}
                <td className="hb-td-actions">
                  {canEdit && (
                    <button className="hb-icon-sm" title="Edit" onClick={() => { setEditBooking(b); setShowForm(true); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  )}
                  {canDelete && (
                    <button className="hb-icon-sm hb-danger" title="Delete" onClick={() => handleDelete(b._id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hb-footer">
        <span>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <HallBookingForm
          booking={editBooking}
          countries={countries}
          users={staffUsers.filter(u => u._id !== user?._id)}
          isSuperAdmin={isSuperAdmin}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditBooking(null); }}
        />
      )}

      {showBulkEdit && (
        <HallBookingBulkEditModal
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
          title="Bulk Import Hall Bookings"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'hall', label: 'Hall / Room' }}
          dateFields={['date']}
          optionsByField={importOptionsByField}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Hall Bookings'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
