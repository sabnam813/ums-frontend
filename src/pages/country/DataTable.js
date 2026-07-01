import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import Select from 'react-select';
import { format, parseISO, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ApplicationForm from '../../components/shared/ApplicationForm';
import BulkEditModal from '../../components/shared/BulkEditModal';
import BulkImportModal from '../../components/shared/BulkImportModal';
import CountryFlag from '../../components/shared/CountryFlag';
import toast from 'react-hot-toast';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';
import { useNotifications } from '../../context/NotificationContext';
import './DataTable.css';

const BASE_COLUMNS = [
  { key: 'date', label: 'Date', width: 110 },
  { key: 'referredBy', label: 'Referred By', width: 100 },
  { key: 'name', label: 'Applicant Name', width: 150 },
  { key: 'level', label: 'Level', width: 80 },
  { key: 'course', label: 'Course', width: 130 },
  { key: 'providerName', label: 'Provider', width: 150 },
  { key: 'initialIntake', label: 'Initial Intake', width: 100 },
  { key: 'deferredIntake', label: 'Deferred', width: 100 },
  { key: 'gsSubmission', label: 'GS Submission', width: 120 },
  { key: 'olRequest', label: 'OL Request', width: 110 },
  { key: 'offerLetter', label: 'OL Received', width: 110 },
  { key: 'withdraw', label: 'Withdraw', width: 100 },
  { key: 'payment', label: 'Payment', width: 110 },
  { key: 'coeCas', label: 'COE/CAS', width: 110 },
  { key: 'savisFee', label: 'Sevis Fee', width: 90 },
  { key: 'refund', label: 'Refund', width: 100 },
  { key: 'visaLodgement', label: 'Visa Date', width: 110 },
  { key: 'visaOutcome', label: 'Visa Outcome', width: 100 },
  { key: 'visaWithdraw', label: 'Visa Withdraw', width: 110 },
  { key: 'remarks', label: 'Remarks', width: 150 },
  { key: 'other', label: 'Other', width: 130 },
  { key: 'through', label: 'Through', width: 120 },
];

function getColumnValue(row, key) {
  if (key.startsWith('custom:')) {
    const fieldKey = key.slice('custom:'.length);
    return row.customFields?.[fieldKey] ?? '';
  }
  return row[key];
}

function toDateInputValue(val) {
  if (!val) return '';
  try {
    const d = typeof val === 'string' ? parseISO(val) : new Date(val);
    if (!isValid(d)) return '';
    return format(d, 'yyyy-MM-dd');
  } catch { return ''; }
}

function normalizeRow(r) {
  return { ...r, date: toDateInputValue(r.date), visaLodgement: toDateInputValue(r.visaLodgement) };
}

function displayDate(adStr) {
  if (!adStr) return '—';
  return adStr;
}

export default function DataTable() {
  const { countryId } = useParams();
  const { countries } = useOutletContext() || { countries: [] };
  const { optionsByField, customFields } = useFieldConfig();
  const { addNotification, refetch: refetchNotifications } = useNotifications();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);

  const COLUMNS = useMemo(() => [
    ...BASE_COLUMNS,
    ...customFields.map(f => ({ key: `custom:${f.key}`, label: f.label, width: 130, custom: f })),
  ], [customFields]);

  const [filters, setFilters] = useState({
    search: '', level: [], gsSubmission: [], olRequest: [], offerLetter: [], withdraw: [],
    payment: [], coeCas: [], savisFee: [], refund: [],
    visaOutcome: [], visaWithdraw: [],
    dateFrom: '', dateTo: '', provider: '', course: '',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'desc' });

  const activeCountry = countries.find(c => (c._id || c.code) === countryId);
  const countryName = activeCountry?.name || 'Country';

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/applications/${countryId}`);
      setData((res.data.applications || []).map(normalizeRow));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load applications');
      setData([]);
    } finally { setLoading(false); }
  }, [countryId]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  
  const tableWrapRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const [trackStyle, setTrackStyle] = useState({ left: 0, width: 0, display: 'none' });

  useEffect(() => {
    const wrap = tableWrapRef.current;
    const track = scrollTrackRef.current;
    if (!wrap || !track) return;

    const syncTrackWidth = () => {
      const inner = track.firstChild;
      if (inner) inner.style.width = wrap.scrollWidth + 'px';
    };

    const syncTrackPosition = () => {
      const rect = wrap.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      // Only show the floating bar while the table is scrollable horizontally
      // and its own bottom edge isn't already visible on screen.
      const needsScroll = wrap.scrollWidth > wrap.clientWidth;
      const bottomVisible = rect.bottom <= viewportH && rect.top < viewportH;
      const tableOnScreen = rect.top < viewportH && rect.bottom > 0;
      setTrackStyle({
        left: rect.left,
        width: rect.width,
        display: needsScroll && tableOnScreen && !bottomVisible ? 'block' : 'none',
      });
    };

    syncTrackWidth();
    syncTrackPosition();

    const ro = new ResizeObserver(() => { syncTrackWidth(); syncTrackPosition(); });
    ro.observe(wrap);

    const onWrapScroll = () => { track.scrollLeft = wrap.scrollLeft; };
    const onTrackScroll = () => { wrap.scrollLeft = track.scrollLeft; };

    wrap.addEventListener('scroll', onWrapScroll, { passive: true });
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    window.addEventListener('scroll', syncTrackPosition, true);
    window.addEventListener('resize', syncTrackPosition);

    return () => {
      wrap.removeEventListener('scroll', onWrapScroll);
      track.removeEventListener('scroll', onTrackScroll);
      window.removeEventListener('scroll', syncTrackPosition, true);
      window.removeEventListener('resize', syncTrackPosition);
      ro.disconnect();
    };
  }, []);
  
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      d = d.filter(r => {
        if (r.name?.toLowerCase().includes(q)) return true;
        if (r.referredBy?.toLowerCase().includes(q)) return true;
        if (r.course?.toLowerCase().includes(q)) return true;
        if (r.providerName?.toLowerCase().includes(q)) return true;
        if (r.remarks?.toLowerCase().includes(q)) return true;
        if (r.other?.toLowerCase().includes(q)) return true;
        if (r.through?.toLowerCase().includes(q)) return true;
        if (r.date?.includes(q)) return true;
        return false;
      });
    }
    if (filters.level.length) d = d.filter(r => filters.level.includes(r.level));
    if (filters.gsSubmission.length) d = d.filter(r => filters.gsSubmission.includes(r.gsSubmission));
    if (filters.olRequest.length) d = d.filter(r => filters.olRequest.includes(r.olRequest));
    if (filters.offerLetter.length) d = d.filter(r => filters.offerLetter.includes(r.offerLetter));
    if (filters.withdraw.length) d = d.filter(r => filters.withdraw.includes(r.withdraw));
    if (filters.payment.length) d = d.filter(r => filters.payment.includes(r.payment));
    if (filters.coeCas.length) d = d.filter(r => filters.coeCas.includes(r.coeCas));
    if (filters.savisFee.length) d = d.filter(r => filters.savisFee.includes(r.savisFee));
    if (filters.refund.length) d = d.filter(r => filters.refund.includes(r.refund));
    if (filters.visaOutcome.length) d = d.filter(r => filters.visaOutcome.includes(r.visaOutcome));
    if (filters.visaWithdraw.length) d = d.filter(r => filters.visaWithdraw.includes(r.visaWithdraw));
    if (filters.provider) d = d.filter(r => r.providerName?.toLowerCase().includes(filters.provider.toLowerCase()));
    if (filters.course) d = d.filter(r => r.course?.toLowerCase().includes(filters.course.toLowerCase()));
    
    if (filters.dateFrom) d = d.filter(r => r.date >= filters.dateFrom);
    if (filters.dateTo) d = d.filter(r => r.date <= filters.dateTo);

    if (sortConfig.key) {
      d.sort((a, b) => {
        let av = getColumnValue(a, sortConfig.key) ?? '', bv = getColumnValue(b, sortConfig.key) ?? '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [data, filters, sortConfig]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.search) c++;
    if (filters.level.length) c++;
    if (filters.gsSubmission.length) c++;
    if (filters.olRequest.length) c++;
    if (filters.offerLetter.length) c++;
    if (filters.withdraw.length) c++;
    if (filters.payment.length) c++;
    if (filters.coeCas.length) c++;
    if (filters.savisFee.length) c++;
    if (filters.refund.length) c++;
    if (filters.visaOutcome.length) c++;
    if (filters.visaWithdraw.length) c++;
    if (filters.provider) c++;
    if (filters.course) c++;
    if (filters.dateFrom || filters.dateTo) c++;
    return c;
  }, [filters]);

  const clearFilters = () => setFilters({
    search: '', level: [], gsSubmission: [], olRequest: [], offerLetter: [], withdraw: [],
    payment: [], coeCas: [], savisFee: [], refund: [],
    visaOutcome: [], visaWithdraw: [],
    dateFrom: '', dateTo: '', provider: '', course: '',
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(r => r._id)));
  };

  const handleSave = async (row) => {
    const isExisting = row._id && data.find(d => d._id === row._id);
    try {
      if (isExisting) {
        const res = await axios.put(`/applications/${countryId}/${row._id}`, row);
        setData(prev => prev.map(d => d._id === row._id ? normalizeRow(res.data.application) : d));
        toast.success('Record updated');
      } else {
        const res = await axios.post(`/applications/${countryId}`, row);
        setData(prev => [normalizeRow(res.data.application), ...prev]);
        toast.success('Application added');
        
        addNotification({
          type: 'new_application',
          message: `New application: ${row.name} — ${countryName}`,
        });
        
        if (refetchNotifications) refetchNotifications();
      }
      setShowForm(false); setEditRow(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save application'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await axios.delete(`/applications/${countryId}/${id}`);
      setData(prev => prev.filter(d => d._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Record deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete record'); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected records?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.delete(`/applications/${countryId}/bulk/delete`, { data: { ids } });
      setData(prev => prev.filter(d => !selectedIds.has(d._id)));
      toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} deleted`);
      setSelectedIds(new Set());
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk delete failed'); }
  };

  const handleBulkSave = async (updates) => {
    try {
      const ids = Array.from(selectedIds);
      await axios.put(`/applications/${countryId}/bulk/update`, { ids, updates });
      setData(prev => prev.map(d =>
        selectedIds.has(d._id)
          ? { ...d, ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== '' && v !== null && v !== undefined)) }
          : d
      ));
      toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set()); setShowBulkEdit(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk update failed'); }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return;
    }
    setBulkImporting(true);
    try {
      const res = await axios.post(`/applications/${countryId}/bulk/create`, { applications: rows });
      setData(prev => [...res.data.applications.map(normalizeRow), ...prev]);
      const msg = res.data.warning
        ? `${res.data.created} imported, ${res.data.skipped} skipped — ${res.data.warning}`
        : `${res.data.created} application${res.data.created !== 1 ? 's' : ''} imported`;
      toast.success(msg);
      setShowBulkImport(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err; // re-throw so BulkImportModal keeps the modal open on failure
    } finally {
      setBulkImporting(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const exportExcel = () => {
    const rows = filteredData.map(r => {
      const base = {
        'Date': r.date,
        'Referred By': r.referredBy, 'Name': r.name, 'Level': r.level,
        'Course': r.course, 'Provider': r.providerName,
        'Initial Intake': r.initialIntake, 'Deferred Intake': r.deferredIntake,
        'GS Submission': r.gsSubmission,
        'OL Request': r.olRequest, 'OL Received': r.offerLetter, 'Withdraw': r.withdraw,
        'Payment': r.payment, 'COE/CAS': r.coeCas, 'Savis Fee': r.savisFee, 'Refund': r.refund,
        'Visa Date': r.visaLodgement, 'Visa Outcome': r.visaOutcome, 'Visa Withdraw': r.visaWithdraw,
        'Remarks': r.remarks, 'Other': r.other, 'Through': r.through,
      };
      customFields.forEach(f => { base[f.label] = r.customFields?.[f.key] || ''; });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, countryName);
    XLSX.writeFile(wb, `UMS_${countryName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exported to Excel');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`UCA Management System – ${countryName} Applications`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${filteredData.length} records`, 14, 22);
    const cols = ['Date', 'Name', 'Level', 'Course', 'Provider', 'GS Submission',
      'OL Request', 'OL Received', 'Withdraw', 'Payment', 'COE/CAS',
      'Visa Date', 'Visa Outcome', 'Visa Withdraw',
      'Savis Fee', 'Refund', 'Other', 'Through', ...customFields.map(f => f.label)];
    const rows = filteredData.map(r => [
      r.date, r.name, r.level, r.course, r.providerName,
      r.gsSubmission || '—',
      r.olRequest || '—', r.offerLetter, r.withdraw || '—', r.payment, r.coeCas || '—',
      r.visaLodgement || '—', r.visaOutcome || '—', r.visaWithdraw || '—',
      r.savisFee, r.refund, r.other || '—', r.through || '—',
      ...customFields.map(f => r.customFields?.[f.key] || '—'),
    ]);
    doc.autoTable({
      startY: 26, head: [cols], body: rows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    doc.save(`UMS_${countryName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Exported to PDF');
  };

  const handlePrint = () => {
    const cols = COLUMNS;
    const headers = cols.map(c => `<th>${c.label}</th>`).join('');
    const rows = filteredData.map(row => {
      const cells = cols.map(col => {
        const val = getColumnValue(row, col.key) || '—';
        return `<td>${val}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${countryName} Applications</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #000; }
    h2 { margin-bottom: 8px; font-size: 14px; }
    p { margin-bottom: 12px; color: #555; font-size: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h2>${countryName} — Applications</h2>
  <p>Printed ${new Date().toLocaleDateString()} · ${filteredData.length} record(s)</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.focus();
    win.print();
    setTimeout(() => win.close(), 1000);
  };

  const offerClass = (v) => v === 'Received' ? 'offered' : v === 'Withdraw' ? 'withdrawn-badge' : 'not-yet';
  const visaClass = (v) => v === 'Grant' ? 'offered' : v === 'Rejected' ? 'incomplete' : v === 'Withdraw' ? 'withdrawn-badge' : '';
  const savisClass = (v) => v === 'Paid' ? 'complete' : 'incomplete';
  const refundClass = (v) => v === 'Refunded' ? 'complete' : 'incomplete';
  const gsClass = (v) => v === 'Submitted' ? 'offered' : v === 'Pending' ? '' : 'not-yet';
  const coeCasClass = (v) => v === 'Received' ? 'complete' : 'incomplete';
  const olRequestClass = (v) => v === 'Requested' ? 'offered' : 'not-yet';
  const yesNoClass = (v) => v === 'Yes' ? 'withdrawn-badge' : 'complete';

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading applications…</p></div>
  );

  return (
    <div className="dt-root animate-fade">
      <div className="dt-header">
        <div className="dt-title-row">
          <span className="dt-flag"><CountryFlag country={activeCountry} size={36} rounded={6} /></span>
          <div>
            <h2>{countryName}</h2>
            <p>{filteredData.length} of {data.length} applications{activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)` : ''}</p>
          </div>
        </div>

        <div className="dt-actions">
          {selectedIds.size > 0 && (
            <div className="bulk-bar">
              <span>{selectedIds.size} selected</span>
              <button className="bulk-btn edit" onClick={() => setShowBulkEdit(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Bulk Edit
              </button>
              <button className="bulk-btn danger" onClick={handleBulkDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            </div>
          )}
          <div className="export-group">
            <button className="export-btn" onClick={exportExcel} title="Export to Excel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Excel
            </button>
            <button className="export-btn" onClick={exportPDF} title="Export to PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF
            </button>
            <button className="export-btn" onClick={handlePrint} title="Print">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>
          <button className={`filter-toggle-btn ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
          <button className="add-record-btn" onClick={() => { setEditRow(null); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Application
          </button>
          <button className="add-record-btn" onClick={() => setShowBulkImport(true)} title="Import from Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Bulk Import
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="filter-panel animate-fade">
          <div className="filter-panel-header">
            <span>Filter Applications</span>
            {activeFilterCount > 0 && <button className="clear-filters" onClick={clearFilters}>Clear all filters</button>}
          </div>
          <div className="filter-grid">
            <div className="filter-field">
              <label>Search</label>
              <div className="filter-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Name, course, provider…"
                  value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
              </div>
            </div>
            <div className="filter-field">
              <label>Level</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.level || [])}
                value={toSelectOptions(optionsByField.level || []).filter(o => filters.level.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, level: opts.map(o => o.value) }))} placeholder="All levels…" />
            </div>
            <div className="filter-field">
              <label>GS Submission</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.gsSubmission || [])}
                value={toSelectOptions(optionsByField.gsSubmission || []).filter(o => filters.gsSubmission.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, gsSubmission: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>OL Request</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.olRequest || [])}
                value={toSelectOptions(optionsByField.olRequest || []).filter(o => filters.olRequest.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, olRequest: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>OL Received</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.offerLetter || [])}
                value={toSelectOptions(optionsByField.offerLetter || []).filter(o => filters.offerLetter.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, offerLetter: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Withdraw</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.withdraw || [])}
                value={toSelectOptions(optionsByField.withdraw || []).filter(o => filters.withdraw.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, withdraw: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Payment</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.payment || [])}
                value={toSelectOptions(optionsByField.payment || []).filter(o => filters.payment.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, payment: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>COE/CAS</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.coeCas || [])}
                value={toSelectOptions(optionsByField.coeCas || []).filter(o => filters.coeCas.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, coeCas: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Sevis Fee</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.savisFee || [])}
                value={toSelectOptions(optionsByField.savisFee || []).filter(o => filters.savisFee.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, savisFee: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Refund</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.refund || [])}
                value={toSelectOptions(optionsByField.refund || []).filter(o => filters.refund.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, refund: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Visa Outcome</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.visaOutcome || [])}
                value={toSelectOptions(optionsByField.visaOutcome || []).filter(o => filters.visaOutcome.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, visaOutcome: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Visa Withdraw</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={toSelectOptions(optionsByField.visaWithdraw || [])}
                value={toSelectOptions(optionsByField.visaWithdraw || []).filter(o => filters.visaWithdraw.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, visaWithdraw: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Provider</label>
              <input type="text" placeholder="Provider name…" value={filters.provider}
                onChange={e => setFilters(f => ({ ...f, provider: e.target.value }))} className="filter-text-input" />
            </div>
            <div className="filter-field">
              <label>Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="filter-text-input"
              />
            </div>
            <div className="filter-field">
              <label>Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="filter-text-input"
              />
            </div>

          </div>
        </div>
      )}

            <div className="dt-quicksearch">
        <div className="dt-qs-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder={`Search in ${countryName} applications…`}
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="dt-qs-input"
          />
          {filters.search && (
            <button className="dt-qs-clear" onClick={() => setFilters(f => ({ ...f, search: '' }))} title="Clear search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <span className="dt-qs-count">
          {filteredData.length} of {data.length} results
        </span>
      </div>

      <div className="dt-table-wrap" ref={tableWrapRef}>
        <table className="dt-table">
          <thead>
            <tr>
              <th className="th-check">
                <input type="checkbox"
                  checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                  onChange={toggleAll} title="Select all" />
              </th>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}
                  className={sortConfig.key === col.key ? 'sorted' : ''}
                  onClick={() => handleSort(col.key)}>
                  <span className="th-content">
                    {col.label}
                    <span className="sort-icon">
                      {sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </span>
                </th>
              ))}
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="empty-row">
                  <div className="dt-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p>No applications match your filters</p>
                    {activeFilterCount > 0 && <button onClick={clearFilters} className="clear-btn-inline">Clear filters</button>}
                  </div>
                </td>
              </tr>
            ) : filteredData.map(row => (
              <tr key={row._id}
                className={`dt-row ${selectedIds.has(row._id) ? 'selected' : ''}`}
                onDoubleClick={() => { setEditRow(row); setShowForm(true); }}>
                <td className="td-check">
                  <input type="checkbox" checked={selectedIds.has(row._id)}
                    onChange={() => toggleSelect(row._id)} onClick={e => e.stopPropagation()} />
                </td>
                <td>
                  <span className="date-cell">
                    {row.date || <span className="td-empty">—</span>}
                  </span>
                </td>
                <td>{row.referredBy || <span className="td-empty">—</span>}</td>
                <td className="td-name">{row.name}</td>
                <td>
                  {row.level
                    ? <span className={`level-badge level-${row.level.toLowerCase()}`}>{row.level}</span>
                    : <span className="td-empty">—</span>}
                </td>
                <td className="td-course">{row.course || <span className="td-empty">—</span>}</td>
                <td className="td-provider">{row.providerName || <span className="td-empty">—</span>}</td>
                <td>{row.initialIntake || <span className="td-empty">—</span>}</td>
                <td>{row.deferredIntake || <span className="td-empty">—</span>}</td>
                <td>
                  {row.gsSubmission
                    ? <span className={`offer-badge ${gsClass(row.gsSubmission)}`}>{row.gsSubmission}</span>
                    : <span className="td-empty">—</span>}
                </td>
                <td>
                  <span className={`offer-badge ${olRequestClass(row.olRequest)}`}>{row.olRequest || 'Not Requested'}</span>
                </td>
                <td>
                  <span className={`offer-badge ${offerClass(row.offerLetter)}`}>
                    {row.offerLetter || 'Not Received'}
                  </span>
                </td>
                <td>
                  <span className={`payment-badge ${yesNoClass(row.withdraw)}`}>{row.withdraw || 'No'}</span>
                </td>
                <td>
                  <span className={`payment-badge ${row.payment === 'Complete' ? 'complete' : 'incomplete'}`}>
                    {row.payment}
                  </span>
                </td>
                <td>
                  <span className={`payment-badge ${coeCasClass(row.coeCas)}`}>{row.coeCas || 'Not Received'}</span>
                </td>
                <td>
                  <span className={`payment-badge ${savisClass(row.savisFee)}`}>{row.savisFee || 'Unpaid'}</span>
                </td>
                <td>
                  <span className={`payment-badge ${refundClass(row.refund)}`}>{row.refund || 'Non-Refunded'}</span>
                </td>
                <td>
                  <span className="date-cell">
                    {row.visaLodgement || <span className="td-empty">—</span>}
                  </span>
                </td>
                <td>
                  {row.visaOutcome
                    ? <span className={`offer-badge ${visaClass(row.visaOutcome)}`}>{row.visaOutcome}</span>
                    : <span className="td-empty">—</span>}
                </td>
                <td>
                  <span className={`payment-badge ${yesNoClass(row.visaWithdraw)}`}>{row.visaWithdraw || 'No'}</span>
                </td>
                <td className="td-remarks">{row.remarks || <span className="td-empty">—</span>}</td>
                <td className="td-other">{row.other || <span className="td-empty">—</span>}</td>
                <td>{row.through || <span className="td-empty">—</span>}</td>
                {customFields.map(f => (
                  <td key={f.key} className="td-custom">
                    {row.customFields?.[f.key] || <span className="td-empty">—</span>}
                  </td>
                ))}
                <td className="td-row-actions">
                  <button className="row-btn edit" onClick={() => { setEditRow(row); setShowForm(true); }} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="row-btn delete" onClick={() => handleDelete(row._id)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

            <div
        className="dt-scroll-track"
        ref={scrollTrackRef}
        style={{ left: trackStyle.left, width: trackStyle.width, display: trackStyle.display }}
      >
        <div className="dt-scroll-track-inner" />
      </div>

      <div className="dt-footer">
        <span>{filteredData.length} record{filteredData.length !== 1 ? 's' : ''}</span>
        <div className="dt-footer-stats">
          <span className="footer-stat offered">
            {filteredData.filter(r => r.offerLetter === 'Received').length} received
          </span>
          <span className="footer-stat complete">
            {filteredData.filter(r => r.payment === 'Complete').length} paid
          </span>
          <span className="footer-stat offered" style={{color:'var(--green)'}}>
            {filteredData.filter(r => r.visaOutcome === 'Grant').length} visa granted
          </span>
        </div>
      </div>

      {showForm && (
        <ApplicationForm row={editRow} onSave={handleSave} onClose={() => { setShowForm(false); setEditRow(null); }} />
      )}

      {showBulkEdit && (
        <BulkEditModal count={selectedIds.size} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />
      )}

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import Applications"
          customFields={customFields}
          requiredField={{ key: 'name', label: 'Name' }}
        />
      )}
    </div>
  );
}
