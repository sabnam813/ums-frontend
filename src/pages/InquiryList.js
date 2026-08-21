import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import Creatable from 'react-select/creatable';
import { format, parseISO, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import BulkImportModal from '../components/shared/BulkImportModal';
import { toastExcel, toastPDF } from '../utils/exportHelpers';
import { FISCAL_YEARS, getFiscalYearRange } from '../utils/fiscalYear';
import { useFiscalYear } from '../context/FiscalYearContext';
import InquiryBulkEditModal from '../components/shared/InquiryBulkEditModal';
import DuplicateWarningModal from '../components/shared/DuplicateWarningModal';
import SelectColumnsModal from '../components/shared/SelectColumnsModal';
import AssociateSearchModal from '../components/shared/AssociateSearchModal';
import { findPossibleDuplicates, INQUIRY_COMPARE_FIELDS } from '../utils/duplicateDetection';
import { INQUIRY_COLUMNS, DEFAULT_VISIBLE_INQUIRY_COLUMN_KEYS, INQUIRY_COLUMN_SELECTION_STORAGE_KEY } from '../utils/inquiryColumns';
import { loadRememberedColumns, saveRememberedColumns } from '../utils/exportColumnMemory';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import './InquiryList.css';

const STAGE_OPTIONS = ['New', 'Course Suggested', 'Follow Up'];
const LEVEL_OPTIONS = ['UG', 'PG', 'PGD', 'PhD', 'Diploma', 'Research/PhD', 'MRes'];
const MODE_OPTIONS = ['WhatsApp', 'Email', 'Phone'];

const INQUIRY_IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['inquirydate'] },
  { key: 'referredBy', label: 'Referred By', aliases: ['referral', 'referrer'] },
  { key: 'applicantName', label: 'Name of Applicants', aliases: ['name', 'applicant', 'studentname'] },
  { key: 'country', label: 'Country', aliases: [] },
  { key: 'level', label: 'Level', aliases: ['programlevel'] },
  { key: 'stage', label: 'Stage', aliases: ['status'] },
  { key: 'mode', label: 'Mode / Channel', aliases: ['channel', 'mode'] },
  { key: 'respondedBy', label: 'Responded By', aliases: ['respondent'] },
  { key: 'emailType', label: 'Email Type', aliases: [] },
  { key: 'remarks', label: 'Remarks', aliases: ['notes', 'comments'] },
];

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

const stageClass = (stage) => {
  const s = (stage || '').toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'closed' || s === 'lost') return 'closed';
  if (s === 'converted' || s === 'enrolled') return 'converted';
  if (s.includes('follow') || s.includes('suggest') || s.includes('pending')) return 'followup';
  return 'neutral';
};

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  referredBy: '',
  applicantName: '',
  country: [],
  level: '',
  stage: 'New',
  mode: '',
  respondedBy: '',
  emailType: '',
  remarks: '',
};

const toOpts = (arr) => arr.map(v => ({ value: v, label: v }));

function countryArr(val) {
  if (Array.isArray(val)) return val;
  if (val) return [val];
  return [];
}
function countryText(val) {
  return countryArr(val).join(', ');
}

function formatInquiryDate(val) {
  if (!val) return '';
  try {
    const d = typeof val === 'string' ? parseISO(val) : new Date(val);
    if (!isValid(d)) return '';
    return format(d, 'yyyy-MM-dd');
  } catch { return ''; }
}

export default function InquiryList() {
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY, dateFrom: globalFrom, dateTo: globalTo } = useFiscalYear();
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'inquiry', 'create');
  const canEdit = hasPermission(user, 'inquiry', 'edit');
  const canDelete = hasPermission(user, 'inquiry', 'delete');
  const canImport = hasPermission(user, 'inquiry', 'import');
  const canExportExcel = hasPermission(user, 'inquiry', 'exportExcel');
  const canExportPdf = hasPermission(user, 'inquiry', 'exportPdf');
  const canPrint = hasPermission(user, 'inquiry', 'print');
  const canBulkEdit = hasPermission(user, 'inquiry', 'bulkEdit');
  const [allCountries, setAllCountries] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [duplicateState, setDuplicateState] = useState(null);

  const [showFilters, setShowFilters] = useState(false);
  const [showAssociateSearch, setShowAssociateSearch] = useState(false);
  const _initFilters = () => {
    return { fiscalYear: globalFY, stage: [], country: [], level: [], dateFrom: globalFrom, dateTo: globalTo, associate: '' };
  };
  const [filters, setFilters] = useState(_initFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'desc' });
  const [columnPickerFor, setColumnPickerFor] = useState(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inquiries', {
        params: { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
      });
      setInquiries(res.data.inquiries || []);
      setTotalCount(res.data.totalCount ?? (res.data.inquiries || []).length);
    } catch (err) {
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  useEffect(() => {
    axios.get('/countries/names')
      .then(res => setAllCountries(res.data.countries || []))
      .catch(() => setAllCountries([]));
  }, []);

  const countryOptions = useMemo(() => {
    const adminCountries = allCountries.map(c => c.name).filter(Boolean);
    const fromData = inquiries.flatMap(i => countryArr(i.country));
    return toOpts([...new Set([...adminCountries, ...fromData])].sort());
  }, [allCountries, inquiries]);

  const levelOptions = useMemo(() => {
    const fromData = inquiries.map(i => i.level).filter(Boolean);
    return toOpts([...new Set([...LEVEL_OPTIONS, ...fromData])]);
  }, [inquiries]);

  const modeOptions = useMemo(() => {
    const fromData = inquiries.map(i => i.mode).filter(Boolean);
    return toOpts([...new Set([...MODE_OPTIONS, ...fromData])]);
  }, [inquiries]);

  const stageOptions = useMemo(() => {
    const fromData = inquiries.map(i => i.stage).filter(Boolean);
    return toOpts([...new Set([...STAGE_OPTIONS, ...fromData])]);
  }, [inquiries]);

  const activeFilterCount = filters.stage.length + filters.country.length + filters.level.length
    + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0) + (filters.associate ? 1 : 0);

  const associateOptions = useMemo(
    () => [...new Set(inquiries.map(i => i.referredBy).filter(Boolean))],
    [inquiries]
  );

  const filtered = useMemo(() => {
    let d = inquiries;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      d = d.filter(i =>
        (i.applicantName || '').toLowerCase().includes(q) ||
        (i.referredBy || '').toLowerCase().includes(q) ||
        countryText(i.country).toLowerCase().includes(q) ||
        (i.remarks || '').toLowerCase().includes(q)
      );
    }
    if (filters.stage.length) d = d.filter(i => filters.stage.includes(i.stage));
    if (filters.country.length) d = d.filter(i => countryArr(i.country).some(c => filters.country.includes(c)));
    if (filters.level.length) d = d.filter(i => filters.level.includes(i.level));
    if (filters.dateFrom) d = d.filter(i => !i.date || new Date(i.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) d = d.filter(i => !i.date || new Date(i.date) <= new Date(filters.dateTo));
    if (filters.associate) d = d.filter(i => i.referredBy === filters.associate);
    if (sortConfig.key) {
      d = [...d].sort((a, b) => {
        let av = a[sortConfig.key] ?? '', bv = b[sortConfig.key] ?? '';
        if (sortConfig.key === 'date') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
        else if (sortConfig.key === 'country') { av = countryText(av).toLowerCase(); bv = countryText(bv).toLowerCase(); }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        let cmp = av < bv ? -1 : av > bv ? 1 : 0;
        if (cmp === 0) {
          const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = ac < bc ? -1 : ac > bc ? 1 : 0;
        }
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [inquiries, debouncedSearch, filters, sortConfig]);

  const clearFilters = () => setFilters(_initFilters());

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (inquiry) => {
    setEditing(inquiry);
    setForm({
      date: inquiry.date ? inquiry.date.slice(0, 10) : '',
      referredBy: inquiry.referredBy || '',
      applicantName: inquiry.applicantName || '',
      country: Array.isArray(inquiry.country) ? inquiry.country : (inquiry.country ? [inquiry.country] : []),
      level: inquiry.level || '',
      stage: inquiry.stage || 'New',
      mode: inquiry.mode || '',
      respondedBy: inquiry.respondedBy || '',
      emailType: inquiry.emailType || '',
      remarks: inquiry.remarks || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const saveInquiry = async () => {
    setSaving(true);
    try {
      if (editing) {
        const res = await axios.put(`/inquiries/${editing._id}`, form);
        setInquiries(prev => prev.map(i => i._id === editing._id ? res.data.inquiry : i));
        toast.success('Inquiry updated');
      } else {
        const res = await axios.post('/inquiries', form);
        setInquiries(prev => [res.data.inquiry, ...prev]);
        toast.success('Inquiry added');
      }
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save inquiry');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.applicantName.trim()) {
      toast.error('Applicant name is required');
      return;
    }
    const matches = findPossibleDuplicates(form, inquiries, {
      nameKey: 'applicantName',
      excludeId: editing?._id || null,
    });
    if (matches.length > 0) {
      setDuplicateState({ matches });
      return;
    }
    await saveInquiry();
  };

  const confirmSaveDespiteDuplicate = async () => {
    setDuplicateState(null);
    await saveInquiry();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this inquiry to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/inquiries/${id}`);
      setInquiries(prev => prev.filter(i => i._id !== id));
      toast.success('Moved to trash');
    } catch (err) {
      toast.error('Failed to delete inquiry');
    }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setImporting(true);
    try {
      const prepared = rows.map(r => ({
        ...r,
        country: typeof r.country === 'string' ? r.country.split(',').map(c => c.trim()).filter(Boolean) : countryArr(r.country),
      }));
      const res = await axios.post('/inquiries/bulk/create', { inquiries: prepared });
      setInquiries(prev => [...res.data.inquiries, ...prev]);
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} inquir${summary.created !== 1 ? 'ies' : 'y'} imported`);
      }
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i._id)));
  };

  const toggleSort = (key) => {
    setSortConfig(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  const handleBulkSave = async (updates) => {
    try {
      const ids = Array.from(selectedIds);
      await axios.put('/inquiries/bulk/update', { ids, updates });
      setInquiries(prev => prev.map(i =>
        selectedIds.has(i._id) ? { ...i, ...updates } : i
      ));
      toast.success(`${ids.length} inquir${ids.length > 1 ? 'ies' : 'y'} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected inquir${selectedIds.size > 1 ? 'ies' : 'y'} to trash? You can restore them later from the Trash page.`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.delete('/inquiries/bulk/delete', { data: { ids } });
      setInquiries(prev => prev.filter(i => !selectedIds.has(i._id)));
      toast.success(`${ids.length} inquir${ids.length > 1 ? 'ies' : 'y'} moved to trash`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    }
  };

  const inquiryCellValue = (i, key) => {
    if (key === 'date') return formatInquiryDate(i.date);
    if (key === 'country') return countryText(i.country);
    return i[key] ?? '';
  };

  const buildInquiryRows = (columnKeys) => {
    const columns = columnKeys.map(k => INQUIRY_COLUMNS.find(c => c.key === k)).filter(Boolean);
    return filtered.map(i => {
      const row = {};
      columns.forEach(col => { row[col.label] = inquiryCellValue(i, col.key) || ''; });
      return row;
    });
  };

  const exportExcel = (columnKeys) => {
    const rows = buildInquiryRows(columnKeys);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiries');
    XLSX.writeFile(wb, `UMS_Inquiries_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => INQUIRY_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UCA Management System – Inquiries', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${filtered.length} records`, 14, 22);
    const cols = columns.map(c => c.label);
    const rows = filtered.map(i => columns.map(c => inquiryCellValue(i, c.key) || '—'));
    doc.autoTable({
      startY: 26, head: [cols], body: rows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    doc.save(`UMS_Inquiries_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = columnKeys.map(k => INQUIRY_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const headers = columns.map(c => `<th>${c.label}</th>`).join('');
    const rows = filtered.map(i => {
      const cells = columns.map(c => `<td>${inquiryCellValue(i, c.key) || '—'}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Inquiries</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; color: #000; }
    h2 { margin: 0 0 6px; font-size: 14px; }
    p { margin: 0 0 10px; color: #555; font-size: 9px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body>
  <h2>Inquiries</h2>
  <p>Printed ${new Date().toLocaleDateString()} · ${filtered.length} record(s)</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
    win.onafterprint = () => win.close();
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const columnPickerColumns = useMemo(() => INQUIRY_COLUMNS.map(c => ({
    key: c.key, label: c.label, required: !!c.required,
  })), []);

  const columnPickerInitialSelected = useMemo(
    () => loadRememberedColumns(INQUIRY_COLUMN_SELECTION_STORAGE_KEY, DEFAULT_VISIBLE_INQUIRY_COLUMN_KEYS) || DEFAULT_VISIBLE_INQUIRY_COLUMN_KEYS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPickerFor]
  );

  const handleColumnsConfirm = (selectedKeys, remember) => {
    if (remember) saveRememberedColumns(INQUIRY_COLUMN_SELECTION_STORAGE_KEY, selectedKeys);
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(selectedKeys);
    else if (target === 'pdf') exportPDF(selectedKeys);
    else if (target === 'print') handlePrint(selectedKeys);
  };

  const columnPickerTitle = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print Inquiries'
    : '';
  const columnPickerActionLabel = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print'
    : 'Confirm';

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading inquiries…</p></div>
  );

  return (
    <div className="inquiry-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Inquiries</h2>
          <p>Track and respond to incoming applicant inquiries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(canExportExcel || canExportPdf || canPrint) && (
            <div className="export-group">
              {canExportExcel && (
                <button className="export-btn" onClick={() => openColumnPicker('excel')} title="Export to Excel">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Excel
                </button>
              )}
              {canExportPdf && (
                <button className="export-btn" onClick={() => openColumnPicker('pdf')} title="Export to PDF">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  PDF
                </button>
              )}
              {canPrint && (
                <button className="export-btn" onClick={() => openColumnPicker('print')} title="Print">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
              )}
            </div>
          )}
          {canImport && (
            <button
              className="btn-add"
              style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', border: '1.5px solid var(--gray-200)' }}
              onClick={() => setShowBulkImport(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Bulk Import
            </button>
          )}
          {canCreate && (
          <button className="btn-add" onClick={openAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Inquiry
          </button>
          )}
        </div>
      </div>

      <div className="inquiry-stats-bar">
        <div className="inquiry-stat">
          <span className="inquiry-stat-value">{totalCount}</span>
          <span className="inquiry-stat-label">Total Students</span>
        </div>
        {(search.trim() || activeFilterCount > 0) && (
          <div className="inquiry-stat inquiry-stat-filtered">
            <span className="inquiry-stat-value">{filtered.length}</span>
            <span className="inquiry-stat-label">Filtered Results</span>
          </div>
        )}
      </div>

      <div className="inquiry-toolbar">
        <div className="inquiry-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, referrer, country, or remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (canBulkEdit || canDelete) && (
          <div className="bulk-bar">
            <span>{selectedIds.size} selected</span>
            {canBulkEdit && (
              <button className="bulk-btn edit" onClick={() => setShowBulkEdit(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Bulk Edit
              </button>
            )}
            {canDelete && (
              <button className="bulk-btn danger" onClick={handleBulkDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            )}
          </div>
        )}
        <button
          className={`inquiry-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showAssociateSearch && (
        <AssociateSearchModal
          associates={associateOptions}
          value={filters.associate}
          onSelect={(name) => setFilters(f => ({ ...f, associate: name }))}
          onClose={() => setShowAssociateSearch(false)}
        />
      )}

      {showFilters && (
        <div className="inquiry-filter-panel">
          <div className="inquiry-filter-field">
            <label>Associate</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={filters.associate || ''}
                placeholder="Type or search an associate…"
                style={{ flex: 1 }}
                onChange={e => setFilters(f => ({ ...f, associate: e.target.value }))}
              />
              <button
                className={`inquiry-filter-toggle associate-search-btn${filters.associate ? ' active' : ''}`}
                onClick={() => setShowAssociateSearch(true)}
                title="Search and filter by associate"
                style={{ whiteSpace: 'nowrap' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <circle cx="17.5" cy="9.5" r="4.5"/><line x1="20.5" y1="12.5" x2="23" y2="15"/>
                </svg>
                Search
              </button>
              {filters.associate && (
                <button
                  className="inquiry-filter-toggle"
                  onClick={() => setFilters(f => ({ ...f, associate: '' }))}
                  title="Clear associate filter"
                  style={{ padding: '4px 8px' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="inquiry-filter-field">
            <label>Fiscal Year (B.S.)</label>
            <select
              value={filters.fiscalYear}
              onChange={e => {
                const fy = e.target.value;
                const { from, to } = getFiscalYearRange(fy);
                setGlobalFY(fy);
                setFilters(f => ({
                  ...f,
                  fiscalYear: fy,
                  dateFrom: fy !== 'all' ? from : '',
                  dateTo: fy !== 'all' ? to : '',
                }));
              }}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem' }}
            >
              <option value="all">All</option>
              {FISCAL_YEARS.map(fy => (
                <option key={fy.label} value={fy.label}>{fy.label}</option>
              ))}
            </select>
          </div>
          <div className="inquiry-filter-field">
            <label>Stage</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={stageOptions}
              value={stageOptions.filter(o => filters.stage.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, stage: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>Country</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={countryOptions}
              value={countryOptions.filter(o => filters.country.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, country: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>Level</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={levelOptions}
              value={levelOptions.filter(o => filters.level.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, level: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>From</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="inquiry-filter-field">
            <label>To</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
          {activeFilterCount > 0 && (
            <button className="inquiry-clear-filters" onClick={clearFilters}>Clear all</button>
          )}
        </div>
      )}

      <div className="inquiry-table-wrap">
        <table className="inquiry-table">
          <thead>
            <tr>
              <th className="th-check">
                {(canBulkEdit || canDelete) && (
                <input type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} title="Select all" />
                )}
              </th>
              {[
                { key: 'date', label: 'Date' },
                { key: 'referredBy', label: 'Referred By' },
                { key: 'applicantName', label: 'Name of Applicant' },
                { key: 'country', label: 'Country' },
                { key: 'level', label: 'Level' },
                { key: 'stage', label: 'Stage' },
                { key: 'mode', label: 'Mode / Channel' },
                { key: 'respondedBy', label: 'Responded By' },
                { key: 'emailType', label: 'Email Type' },
                { key: 'remarks', label: 'Remarks' },
              ].map(col => (
                <th
                  key={col.key}
                  className={sortConfig.key === col.key ? 'sorted' : ''}
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
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i._id} className={selectedIds.has(i._id) ? 'selected' : ''}>
                <td className="td-check">
                  {(canBulkEdit || canDelete) && (
                  <input type="checkbox" checked={selectedIds.has(i._id)}
                    onChange={() => toggleSelect(i._id)} onClick={e => e.stopPropagation()} />
                  )}
                </td>
                <td>{formatInquiryDate(i.date) || <span className="td-empty">—</span>}</td>
                <td>{i.referredBy || <span className="td-empty">—</span>}</td>
                <td className="td-name">{i.applicantName}</td>
                <td>{countryText(i.country) || <span className="td-empty">—</span>}</td>
                <td>{i.level || <span className="td-empty">—</span>}</td>
                <td>
                  <span className={`stage-badge ${stageClass(i.stage)}`}>{i.stage || 'New'}</span>
                </td>
                <td>{i.mode || <span className="td-empty">—</span>}</td>
                <td>{i.respondedBy || <span className="td-empty">—</span>}</td>
                <td>{i.emailType || <span className="td-empty">—</span>}</td>
                <td className="td-remarks">{i.remarks || <span className="td-empty">—</span>}</td>
                <td className="td-actions">
                  <div className="inquiry-row-actions">
                    {canEdit && (
                    <button className="inquiry-row-btn edit" title="Edit" onClick={() => openEdit(i)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    )}
                    {canDelete && (
                    <button className="inquiry-row-btn delete" title="Delete" onClick={() => handleDelete(i._id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                    )}
                    {!canEdit && !canDelete && <span className="td-empty">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="inquiry-empty">
            <p>{search || activeFilterCount > 0 ? 'No inquiries match your search or filters.' : 'No inquiries yet. Click "New Inquiry" to add one.'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="inquiry-modal-overlay" onClick={closeModal}>
          <div className="inquiry-modal" onClick={e => e.stopPropagation()}>
            <div className="inquiry-modal-header">
              <h3>{editing ? 'Edit Inquiry' : 'New Inquiry'}</h3>
              <button className="inquiry-modal-close" onClick={closeModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="inquiry-modal-body">
              <div className="inquiry-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Referred By</label>
                <input type="text" value={form.referredBy} onChange={e => setField('referredBy', e.target.value)} />
              </div>
              <div className="inquiry-field full">
                <label>Name of Applicant *</label>
                <input type="text" value={form.applicantName} onChange={e => setField('applicantName', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Country <span className="inquiry-field-hint">(select multiple)</span></label>
                <Creatable
                  isMulti
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={countryOptions}
                  value={countryArr(form.country).map(c => ({ value: c, label: c }))}
                  onChange={opts => setField('country', (opts || []).map(o => o.value))}
                  placeholder="Select or type one or more countries…"
                  formatCreateLabel={val => `Use "${val}"`}
                  isClearable
                />
              </div>
              <div className="inquiry-field">
                <label>Level</label>
                <Creatable
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={levelOptions}
                  value={form.level ? { value: form.level, label: form.level } : null}
                  onChange={opt => setField('level', opt?.value || '')}
                  placeholder="Select or type a level…"
                  formatCreateLabel={val => `Use "${val}"`}
                  isClearable
                />
              </div>
              <div className="inquiry-field">
                <label>Stage</label>
                <Creatable
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={stageOptions}
                  value={form.stage ? { value: form.stage, label: form.stage } : null}
                  onChange={opt => setField('stage', opt?.value || '')}
                  placeholder="New, Course suggested, Follow up…"
                  formatCreateLabel={val => `Use "${val}"`}
                  isClearable
                />
              </div>
              <div className="inquiry-field">
                <label>Mode / Channel</label>
                <Creatable
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={modeOptions}
                  value={form.mode ? { value: form.mode, label: form.mode } : null}
                  onChange={opt => setField('mode', opt?.value || '')}
                  placeholder="WhatsApp, Email, Phone…"
                  formatCreateLabel={val => `Use "${val}"`}
                  isClearable
                />
              </div>
              <div className="inquiry-field">
                <label>Responded By</label>
                <input type="text" value={form.respondedBy} onChange={e => setField('respondedBy', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Email Type</label>
                <input type="text" value={form.emailType} onChange={e => setField('emailType', e.target.value)} />
              </div>
              <div className="inquiry-field full">
                <label>Remarks</label>
                <textarea value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
              </div>
            </div>

            <div className="inquiry-modal-footer">
              <button className="inquiry-btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="inquiry-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Inquiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <InquiryBulkEditModal
          count={selectedIds.size}
          stageOptions={stageOptions.map(o => o.value)}
          countryOptions={countryOptions.map(o => o.value)}
          levelOptions={levelOptions.map(o => o.value)}
          onSave={handleBulkSave}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        loading={importing}
        title="Bulk Import Inquiries"
        fields={INQUIRY_IMPORT_FIELDS}
        requiredField={{ key: 'applicantName', label: 'Name of Applicants' }}
        dateFields={['date']}
      />

      {duplicateState && (
        <DuplicateWarningModal
          matches={duplicateState.matches}
          newRow={form}
          nameKey="applicantName"
          compareFields={INQUIRY_COMPARE_FIELDS}
          onKeepBoth={confirmSaveDespiteDuplicate}
          onCancel={() => setDuplicateState(null)}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={columnPickerColumns}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerTitle}
          actionLabel={columnPickerActionLabel}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
