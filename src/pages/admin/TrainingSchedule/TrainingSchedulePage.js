import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { useConfigList } from '../../../context/ConfigContext';
import { hasPermission } from '../../../utils/rbac';
import TrainingScheduleForm from './TrainingScheduleForm';
import TrainingScheduleBulkEditModal from './TrainingScheduleBulkEditModal';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../../components/shared/SelectColumnsModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import './TrainingSchedule.css';

const DEFAULT_TYPES = ['Meeting', 'Training', 'Workshop', 'Orientation', 'Other'];

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MODE_OPTIONS = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
];

const IMPORT_FIELDS = [
  { key: 'title', label: 'Title', aliases: ['title', 'name', 'topic', 'meeting', 'meetingname', 'training', 'trainingname', 'subject'] },
  { key: 'department', label: 'Department', aliases: ['department', 'dept', 'team'] },
  { key: 'type', label: 'Type', aliases: ['type', 'kind', 'category'] },
  { key: 'date', label: 'Date', aliases: ['date', 'meetingdate', 'trainingdate', 'scheduledate'] },
  { key: 'startTime', label: 'Start Time', aliases: ['starttime', 'start', 'from', 'timefrom', 'time'] },
  { key: 'endTime', label: 'End Time', aliases: ['endtime', 'end', 'to', 'timeto'] },
  { key: 'venue', label: 'Venue', aliases: ['venue', 'place', 'location', 'room', 'hall'] },
  { key: 'host', label: 'Host / Trainer', aliases: ['host', 'trainer', 'conductor', 'conductedby', 'speaker', 'facilitator'] },
  { key: 'participants', label: 'Participants', aliases: ['participants', 'attendees', 'audience'] },
  { key: 'mode', label: 'Mode', aliases: ['mode', 'format'] },
  { key: 'meetingLink', label: 'Meeting Link', aliases: ['meetinglink', 'link', 'url', 'zoom', 'meet'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'agenda', label: 'Agenda / Notes', aliases: ['agenda', 'notes', 'remarks', 'description'] },
];

const EXPORT_COLUMNS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'time', label: 'Time' },
  { key: 'title', label: 'Title' },
  { key: 'departmentName', label: 'Department' },
  { key: 'type', label: 'Type' },
  { key: 'venue', label: 'Venue' },
  { key: 'host', label: 'Host / Trainer' },
  { key: 'participants', label: 'Participants' },
  { key: 'mode', label: 'Mode' },
  { key: 'meetingLink', label: 'Meeting Link' },
  { key: 'status', label: 'Status' },
  { key: 'agenda', label: 'Agenda / Notes' },
];

const QUICK_RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
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

function weekday(d) {
  const key = dateKey(d);
  if (!key) return '';
  return format(new Date(`${key}T00:00:00`), 'EEE');
}

function to12h(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

function timeLabel(row) {
  if (row.startTime && row.endTime) return `${to12h(row.startTime)} - ${to12h(row.endTime)}`;
  if (row.startTime) return to12h(row.startTime);
  return '';
}

function cap(s) {
  const v = String(s || '');
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getExportValue(row, key) {
  if (key === 'date') return dateKey(row.date);
  if (key === 'time') return timeLabel(row);
  if (key === 'departmentName') return row.department?.name || 'All departments';
  if (key === 'status' || key === 'mode') return cap(row[key]);
  return row[key] || '';
}

function rangeFor(key) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (key === 'today') return { from: today, to: today };
  if (key === 'week') {
    return {
      from: format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    };
  }
  if (key === 'upcoming') return { from: today, to: '' };
  return { from: '', to: '' };
}

export default function TrainingSchedulePage() {
  const { user } = useAuth();
  const typeList = useConfigList('trainingType', DEFAULT_TYPES);

  const canView = hasPermission(user, 'trainingSchedule', 'view');
  const canCreate = hasPermission(user, 'trainingSchedule', 'create');
  const canEdit = hasPermission(user, 'trainingSchedule', 'edit');
  const canDelete = user?.role === 'super_admin';
  const canImport = hasPermission(user, 'trainingSchedule', 'import');
  const canExportExcel = hasPermission(user, 'trainingSchedule', 'exportExcel');
  const canExportPdf = hasPermission(user, 'trainingSchedule', 'exportPdf');
  const canPrint = hasPermission(user, 'trainingSchedule', 'print');
  const canBulkEdit = hasPermission(user, 'trainingSchedule', 'bulkEdit');

  const [schedules, setSchedules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [quick, setQuick] = useState('upcoming');
  const [dateFrom, setDateFrom] = useState(() => rangeFor('upcoming').from);
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'asc' });
  const debounce = useRef(null);

  const currentParams = useCallback(() => ({
    q: search || undefined,
    department: departmentFilter || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    mode: modeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [search, departmentFilter, typeFilter, statusFilter, modeFilter, dateFrom, dateTo]);

  const fetchSchedules = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/training-schedules', { params });
      setSchedules(res.data.schedules || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load training schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    axios.get('/training-schedules/departments')
      .then(res => setDepartments(res.data.departments || []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { fetchSchedules(currentParams()); }, 300);
    return () => clearTimeout(debounce.current);
  }, [currentParams, fetchSchedules]);

  const refetch = () => fetchSchedules(currentParams());

  const applyQuick = (key) => {
    const r = rangeFor(key);
    setQuick(key);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const onDateFrom = (v) => { setDateFrom(v); setQuick(''); };
  const onDateTo = (v) => { setDateTo(v); setQuick(''); };

  const allTypes = useMemo(() => {
    const set = new Set(typeList);
    schedules.forEach(s => { if (s.type) set.add(s.type); });
    return Array.from(set);
  }, [typeList, schedules]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSort = (key) => {
    setSortConfig(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  const sortedSchedules = useMemo(() => {
    const list = [...schedules].sort((a, b) => {
      let av;
      let bv;
      if (sortConfig.key === 'date') {
        av = `${dateKey(a.date)} ${a.startTime || ''}`;
        bv = `${dateKey(b.date)} ${b.startTime || ''}`;
      } else if (sortConfig.key === 'department') {
        av = (a.department?.name || '').toLowerCase();
        bv = (b.department?.name || '').toLowerCase();
      } else {
        av = (a[sortConfig.key] || '').toString().toLowerCase();
        bv = (b[sortConfig.key] || '').toString().toLowerCase();
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [schedules, sortConfig]);

  const toggleAll = () => {
    if (selectedIds.size === sortedSchedules.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedSchedules.map(s => s._id)));
  };

  const handleSave = async (form) => {
    if (editSchedule && !window.confirm('Save changes to this schedule?')) return;
    const payload = { ...form };
    let res;
    if (editSchedule) {
      res = await axios.put(`/training-schedules/${editSchedule._id}`, payload);
      toast.success('Training schedule updated');
    } else {
      res = await axios.post('/training-schedules', payload);
      toast.success('Training schedule added');
    }
    if (res.data.clashes && res.data.clashes.length) {
      toast(`Overlaps with: ${res.data.clashes.join(', ')}`, { icon: '⚠️', duration: 6000 });
    }
    setShowForm(false);
    setEditSchedule(null);
    refetch();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this schedule to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/training-schedules/${id}`);
      setSchedules(prev => prev.filter(s => s._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected schedule${selectedIds.size > 1 ? 's' : ''} to trash?`)) return;
    try {
      await axios.delete('/training-schedules/bulk-delete', { data: { ids: Array.from(selectedIds) } });
      setSchedules(prev => prev.filter(s => !selectedIds.has(s._id)));
      setSelectedIds(new Set());
      toast.success('Selected schedules moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      refetch();
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/training-schedules/bulk-edit', { ids, updates });
      toast.success(`${ids.length} schedule${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      refetch();
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
        title: r.title || '',
        department: r.department || '',
        type: r.type || '',
        date: r.date || '',
        startTime: r.startTime ?? '',
        endTime: r.endTime ?? '',
        venue: r.venue || '',
        host: r.host || '',
        participants: r.participants || '',
        mode: (r.mode || '').toString().toLowerCase(),
        meetingLink: r.meetingLink || '',
        status: (r.status || '').toString().toLowerCase(),
        agenda: r.agenda || '',
      }));
      const res = await axios.post('/training-schedules/bulk-import', { rows: prepared });
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} schedule${summary.created !== 1 ? 's' : ''} imported`);
      }
      refetch();
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const handleColumnsConfirm = (columnKeys) => {
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(columnKeys);
    else if (target === 'pdf') exportPDF(columnKeys);
    else if (target === 'print') handlePrint(columnKeys);
  };

  const exportSource = () => (selectedIds.size > 0 ? sortedSchedules.filter(s => selectedIds.has(s._id)) : sortedSchedules);
  const exportColumns = (keys) => keys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);

  const exportExcel = (columnKeys) => {
    const columns = exportColumns(columnKeys);
    const rows = exportSource().map(s => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(s, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Training Schedule');
    XLSX.writeFile(wb, `Training_Schedule_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = exportColumns(columnKeys);
    const source = exportSource();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Training Schedule', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${source.length} schedule${source.length !== 1 ? 's' : ''}`, 14, 22);
    doc.autoTable({
      startY: 26,
      head: [columns.map(c => c.label)],
      body: source.map(s => columns.map(c => getExportValue(s, c.key) || '-')),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`Training_Schedule_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = exportColumns(columnKeys);
    const source = exportSource();
    const headers = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const rows = source.map(s => {
      const cells = columns.map(c => `<td>${escapeHtml(getExportValue(s, c.key) || '-')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Training Schedule</title>
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
  <h2>Training Schedule</h2>
  <p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${source.length} schedule${source.length !== 1 ? 's' : ''}</p>
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
    department: departments.map(d => d.name),
    type: allTypes,
    mode: MODE_OPTIONS.map(m => m.label),
    status: STATUS_OPTIONS.map(s => s.label),
  }), [departments, allTypes]);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  if (!canView) {
    return <div className="ts-page"><div className="ts-empty-hint">You do not have permission to view the Training Schedule module.</div></div>;
  }

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'startTime', label: 'Time' },
    { key: 'title', label: 'Title' },
    { key: 'department', label: 'Department' },
    { key: 'type', label: 'Type' },
    { key: 'venue', label: 'Venue' },
    { key: 'host', label: 'Host / Trainer' },
    { key: 'mode', label: 'Mode' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="ts-page">
      <div className="ts-page-header">
        <div>
          <h2>Training Schedule</h2>
          <p className="ts-page-sub">Department meetings and trainings</p>
        </div>
        <div className="ts-header-actions">
          {canImport && (
            <button className="ts-btn-outline" onClick={() => setShowBulkImport(true)}>
              <IconFile /> Import
            </button>
          )}
          {canExportExcel && (
            <button className="ts-btn-outline" onClick={() => setColumnPickerFor('excel')}>
              <IconDownload /> Excel
            </button>
          )}
          {canExportPdf && (
            <button className="ts-btn-outline" onClick={() => setColumnPickerFor('pdf')}>
              <IconDownload /> PDF
            </button>
          )}
          {canPrint && (
            <button className="ts-btn-outline" onClick={() => setColumnPickerFor('print')}>
              <IconPrint /> Print
            </button>
          )}
          {canCreate && (
            <button className="ts-btn-primary" onClick={() => { setEditSchedule(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              New Schedule
            </button>
          )}
        </div>
      </div>

      <div className="ts-toolbar">
        <div className="ts-search-box">
          <IconSearch />
          <input type="text" placeholder="Search title, department, venue, host, agenda…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="ts-filter-select" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
          <option value="">All departments</option>
          <option value="all">General (all departments)</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select className="ts-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="ts-filter-select" value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
          <option value="">All modes</option>
          {MODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="ts-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="ts-toolbar">
        <div className="ts-chip-row">
          {QUICK_RANGES.map(q => (
            <button key={q.key} type="button" className={`ts-chip ${quick === q.key ? 'active' : ''}`} onClick={() => applyQuick(q.key)}>
              {q.label}
            </button>
          ))}
        </div>
        <div className="ts-date-filter">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={e => onDateFrom(e.target.value)} />
          <span>To</span>
          <input type="date" value={dateTo} onChange={e => onDateTo(e.target.value)} />
        </div>
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
                <input type="checkbox" checked={sortedSchedules.length > 0 && selectedIds.size === sortedSchedules.length} onChange={toggleAll} />
              </th>
              {columns.map(col => (
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
              <th>Agenda / Notes</th>
              <th className="ts-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={12} className="ts-empty-hint">Loading…</td></tr>
            )}
            {!loading && sortedSchedules.length === 0 && (
              <tr><td colSpan={12} className="ts-empty-hint">No training schedules found.</td></tr>
            )}
            {!loading && sortedSchedules.map(s => (
              <tr key={s._id} className={dateKey(s.date) === todayKey ? 'ts-row-today' : ''}>
                <td><input type="checkbox" checked={selectedIds.has(s._id)} onChange={() => toggleSelect(s._id)} /></td>
                <td className="ts-date-cell">
                  {dateKey(s.date)}
                  <small>{weekday(s.date)}</small>
                </td>
                <td className="ts-time-cell">{timeLabel(s) || <span className="ts-td-empty">—</span>}</td>
                <td className="ts-td-name">{s.title}</td>
                <td>
                  {s.department?.name
                    ? <span className="ts-dept-chip">{s.department.name}</span>
                    : <span className="ts-dept-chip all">All departments</span>}
                </td>
                <td>{s.type || <span className="ts-td-empty">—</span>}</td>
                <td>
                  {s.venue || <span className="ts-td-empty">—</span>}
                  {s.meetingLink && (
                    <div><a className="ts-link" href={/^https?:\/\//i.test(s.meetingLink) ? s.meetingLink : `https://${s.meetingLink}`} target="_blank" rel="noopener noreferrer">Join link</a></div>
                  )}
                </td>
                <td>{s.host || <span className="ts-td-empty">—</span>}</td>
                <td><span className={`ts-mode-badge ${s.mode}`}>{cap(s.mode)}</span></td>
                <td><span className={`ts-status-badge ${s.status}`}>{STATUS_OPTIONS.find(o => o.value === s.status)?.label || s.status}</span></td>
                <td className="ts-td-wrap">{s.agenda || <span className="ts-td-empty">—</span>}</td>
                <td className="ts-td-actions">
                  {canEdit && (
                    <button className="ts-icon-sm" title="Edit" onClick={() => { setEditSchedule(s); setShowForm(true); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  )}
                  {canDelete && (
                    <button className="ts-icon-sm ts-danger" title="Delete" onClick={() => handleDelete(s._id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ts-footer">
        <span>{sortedSchedules.length} schedule{sortedSchedules.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <TrainingScheduleForm
          schedule={editSchedule}
          departments={departments}
          types={allTypes}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditSchedule(null); }}
        />
      )}

      {showBulkEdit && (
        <TrainingScheduleBulkEditModal
          count={selectedIds.size}
          departments={departments}
          types={allTypes}
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
          title="Bulk Import Training Schedule"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'title', label: 'Title' }}
          dateFields={['date']}
          optionsByField={importOptionsByField}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Training Schedule'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
