import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Select from 'react-select';
import { format, parseISO, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ProfileApplicationForm from '../../components/shared/ProfileApplicationForm';
import { MULTI_FILTER_KEYS, SELECT_KEYS, DATE_KEYS } from '../../utils/countryLayouts';
import useCountryLayout from '../../hooks/useCountryLayout';
import { toastExcel, toastPDF } from '../../utils/exportHelpers';
import BulkEditModal from '../../components/shared/BulkEditModal';
import BulkImportModal from '../../components/shared/BulkImportModal';
import CountryFlag from '../../components/shared/CountryFlag';
import DuplicateWarningModal from '../../components/shared/DuplicateWarningModal';
import SelectColumnsModal from '../../components/shared/SelectColumnsModal';
import StudentFollowUpDrawer from '../../components/shared/StudentFollowUpDrawer';
import toast from 'react-hot-toast';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';
import { INTAKE_VALUES, STANDARD_INTAKE, normalizeIntake, sortIntakes } from '../../utils/intakeOptions';
import { FISCAL_YEARS, getFiscalYearRange } from '../../utils/fiscalYear';
import { useFiscalYear } from '../../context/FiscalYearContext';
import { useNotifications } from '../../context/NotificationContext';
import { findPossibleDuplicates, APPLICATION_COMPARE_FIELDS } from '../../utils/duplicateDetection';
import { loadRememberedColumns, saveRememberedColumns } from '../../utils/exportColumnMemory';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import AssociateName from '../../components/shared/AssociateName';
import { associateColorSync, useAssociateStatus } from '../../hooks/useAssociateOptions';
import AssociateTypeFilter from '../../components/shared/AssociateTypeFilter';
import { htmlStyleAttr, pdfColorHook, matchesAssociateType } from '../../utils/associateStatus';
import './DataTable.css';

const APPLICATION_COLUMN_SELECTION_STORAGE_KEY = 'ums_applications_export_columns';

function buildFilters(fy) {
  const { from, to } = getFiscalYearRange(fy);
  const f = {
    search: '', provider: '', course: '', visaFrom: '', visaTo: '', associateType: 'All',
    providerNotSet: false, courseNotSet: false,
    fiscalYear: fy,
    dateFrom: fy !== 'all' ? from : '',
    dateTo: fy !== 'all' ? to : '',
  };
  MULTI_FILTER_KEYS.forEach(k => { f[k] = []; });
  return f;
}

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
  return {
    ...r,
    ...DATE_KEYS.reduce((acc, k) => { acc[k] = toDateInputValue(r[k]); return acc; }, {}),
  };
}

const NOT_SET = '__NOT_SET__';
const NOT_SET_LABEL = 'Not Set';

function withNotSet(values) {
  return [{ value: NOT_SET, label: NOT_SET_LABEL }, ...toSelectOptions(values)];
}

function isUnsetValue(v) {
  return v === null || v === undefined || v === '';
}

function matchesMulti(fieldValue, selected) {
  if (!selected || !selected.length) return true;
  return selected.some(v => (v === NOT_SET ? isUnsetValue(fieldValue) : v === fieldValue));
}

export default function DataTable() {
  const { countryId } = useParams();
  const { countries } = useOutletContext() || { countries: [] };
  const { user } = useAuth();
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY } = useFiscalYear();
  const canCreate = hasPermission(user, 'applications', 'create');
  const canEdit = hasPermission(user, 'applications', 'edit');
  const canDelete = hasPermission(user, 'applications', 'delete');
  const canImport = hasPermission(user, 'applications', 'import');
  const canExportExcel = hasPermission(user, 'applications', 'exportExcel');
  const canExportPdf = hasPermission(user, 'applications', 'exportPdf');
  const canPrint = hasPermission(user, 'applications', 'print');
  const canBulkEdit = hasPermission(user, 'applications', 'bulkEdit');
  const activeCountry = countries.find(c => (c._id || c.code) === countryId);
  const countryName = activeCountry?.name || 'Country';
  const { optionsByField, customFields } = useFieldConfig();
  const layout = useCountryLayout(activeCountry, optionsByField);
  const baseColumns = layout.columns;
  const filterFields = layout.filterFields;
  const columnStorageKey = layout.profileId === 'default'
    ? APPLICATION_COLUMN_SELECTION_STORAGE_KEY
    : `${APPLICATION_COLUMN_SELECTION_STORAGE_KEY}_${layout.profileId}`;
  const profileOptions = useMemo(() => {
    const o = {};
    [...SELECT_KEYS, 'level'].forEach(k => { o[k] = layout.optionsFor(k); });
    return o;
  }, [layout]);
  const { addNotification, refetch: refetchNotifications } = useNotifications();
  const [data, setData] = useState([]);
  const levelFilterOptions = useMemo(() => [...layout.optionsFor('level')], [layout]);
  const [loading, setLoading] = useState(true);
  const loadedKey = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [duplicateState, setDuplicateState] = useState(null);

  const COLUMNS = useMemo(() => [
    ...baseColumns,
    ...customFields.map(f => ({ key: `custom:${f.key}`, label: f.label, width: 130, custom: f })),
  ], [customFields, baseColumns]);

  const EXPORT_COLUMNS = useMemo(() => {
    const providerIdx = baseColumns.findIndex(c => c.key === 'providerName');
    const exportBase = [
      ...baseColumns.slice(0, providerIdx + 1),
      { key: 'additionalUniversities', label: 'Additional Universities/Courses', width: 200 },
      ...baseColumns.slice(providerIdx + 1),
    ];
    return [
      ...exportBase,
      ...customFields.map(f => ({ key: `custom:${f.key}`, label: f.label, width: 130, custom: f })),
    ];
  }, [customFields, baseColumns]);

  const getExportValue = useCallback((row, key) => {
    if (key === 'additionalUniversities') {
      const extraUnis = (row.universities || []).slice(1);
      return extraUnis
        .map(u => `${u.providerName || ''} - ${u.course || ''}${u.level ? ` (${u.level})` : ''}`.trim())
        .join('; ');
    }
    return getColumnValue(row, key);
  }, []);

  const statusOf = useAssociateStatus();
  const [filters, setFilters] = useState(() => buildFilters(globalFY));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', dir: 'desc' });
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [followUpAppId, setFollowUpAppId] = useState(null);
  const [pendingFollowUps, setPendingFollowUps] = useState({});

  const intakeFilterOptions = useMemo(() => {
    const set = new Set(INTAKE_VALUES);
    data.forEach(r => {
      [r.initialIntake, r.deferredIntake].forEach(v => {
        const n = normalizeIntake(v);
        if (STANDARD_INTAKE.test(n)) set.add(n);
      });
    });
    return sortIntakes([...set]);
  }, [data]);

  const fetchApplications = useCallback(async () => {
    if (loadedKey.current !== countryId) setLoading(true);
    try {
      const res = await axios.get(`/applications/${countryId}`, {
        params: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          visaFrom: filters.visaFrom || undefined,
          visaTo: filters.visaTo || undefined,
        },
      });
      setData((res.data.applications || []).map(normalizeRow));
      if (res.data.totalInDB != null && res.data.returned != null && res.data.returned < res.data.totalInDB) {
        toast(`Showing ${res.data.returned} of ${res.data.totalInDB} records — refine your date range to see all.`, { icon: '⚠️', duration: 6000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load applications');
      setData([]);
    } finally { loadedKey.current = countryId;
      setLoading(false); }
  }, [countryId, filters.dateFrom, filters.dateTo, filters.visaFrom, filters.visaTo]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const canUseFollowUp = hasPermission(user, 'studentFollowUp', 'view');

  const fetchPendingFollowUps = useCallback(async () => {
    if (!canUseFollowUp || !countryId) { setPendingFollowUps({}); return; }
    try {
      const res = await axios.get(`/student-follow-ups/pending-map/${countryId}`);
      setPendingFollowUps(res.data.pending || {});
    } catch {
      setPendingFollowUps({});
    }
  }, [canUseFollowUp, countryId]);

  useEffect(() => { fetchPendingFollowUps(); }, [fetchPendingFollowUps]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId || loading) return;
    const match = data.find(d => d._id === highlightId);
    if (match) {
      setEditRow(match);
      setShowForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

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
        if (r.universities?.some(u => u.course?.toLowerCase().includes(q) || u.providerName?.toLowerCase().includes(q))) return true;
        if (r.remarks?.toLowerCase().includes(q)) return true;
        if (r.other?.toLowerCase().includes(q)) return true;
        if (r.through?.toLowerCase().includes(q)) return true;
        if (r.date?.includes(q)) return true;
        return false;
      });
    }
    MULTI_FILTER_KEYS.forEach(k => {
      const isIntake = k === 'initialIntake' || k === 'deferredIntake';
      d = d.filter(r => matchesMulti(isIntake ? normalizeIntake(r[k]) : r[k], filters[k]));
    });

    if (filters.associateType && filters.associateType !== 'All') {
      d = d.filter(r => matchesAssociateType(statusOf(r.referredBy), filters.associateType));
    }
    if (filters.providerNotSet) {
      d = d.filter(r => isUnsetValue(r.providerName));
    } else if (filters.provider) {
      d = d.filter(r => r.providerName?.toLowerCase().includes(filters.provider.toLowerCase()));
    }
    if (filters.courseNotSet) {
      d = d.filter(r => isUnsetValue(r.course));
    } else if (filters.course) {
      d = d.filter(r => r.course?.toLowerCase().includes(filters.course.toLowerCase()));
    }

    if (filters.dateFrom) d = d.filter(r => r.date >= filters.dateFrom);
    if (filters.dateTo) d = d.filter(r => r.date <= filters.dateTo);

    if (sortConfig.key) {
      d.sort((a, b) => {
        let av = getColumnValue(a, sortConfig.key) ?? '', bv = getColumnValue(b, sortConfig.key) ?? '';
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
  }, [data, filters, sortConfig, statusOf]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.search) c++;
    MULTI_FILTER_KEYS.forEach(k => { if (filters[k].length) c++; });
    if (filters.associateType && filters.associateType !== 'All') c++;
    if (filters.provider || filters.providerNotSet) c++;
    if (filters.course || filters.courseNotSet) c++;
    if (filters.dateFrom || filters.dateTo) c++;
    if (filters.visaFrom || filters.visaTo) c++;
    return c;
  }, [filters]);

  const clearFilters = () => setFilters(buildFilters(globalFY));

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(r => r._id)));
  };

  const saveRecord = async (row) => {
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
          message: `New application: ${row.name} (${countryName})`,
        });

        if (refetchNotifications) refetchNotifications();
      }
      setShowForm(false); setEditRow(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save application'); }
  };

  const handleSave = async (row) => {
    if (row._id && data.find(d => d._id === row._id) && !window.confirm('Save changes to this application?')) return;
    const isExisting = row._id && data.find(d => d._id === row._id);
    const matches = findPossibleDuplicates(row, data, { excludeId: isExisting ? row._id : null });
    if (matches.length > 0) {
      setDuplicateState({ matches, row });
      return;
    }
    await saveRecord(row);
  };

  const confirmSaveDespiteDuplicate = async () => {
    if (!duplicateState) return;
    const { row } = duplicateState;
    setDuplicateState(null);
    await saveRecord(row);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this record to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/applications/${countryId}/${id}`);
      setData(prev => prev.filter(d => d._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete record'); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected record(s) to trash? You can restore them later from the Trash page.`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.delete(`/applications/${countryId}/bulk/delete`, { data: { ids } });
      setData(prev => prev.filter(d => !selectedIds.has(d._id)));
      toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} moved to trash`);
      setSelectedIds(new Set());
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk delete failed'); }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.put(`/applications/${countryId}/bulk/update`, { ids, updates });
      setData(prev => prev.map(d =>
        selectedIds.has(d._id)
          ? { ...d, ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)) }
          : d
      ));
      toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set()); setShowBulkEdit(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk update failed'); }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const res = await axios.post(`/applications/${countryId}/bulk/create`, { applications: rows });
      setData(prev => [...res.data.applications.map(normalizeRow), ...prev]);
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} application${summary.created !== 1 ? 's' : ''} imported`);
      }
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const exportExcel = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const rows = filteredData.map(r => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(r, col.key) || ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.label) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, countryName);
    XLSX.writeFile(wb, `UMS_${countryName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`UCA Management System – ${countryName} Applications`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${filteredData.length} records`, 14, 22);
    const cols = columns.map(c => c.label);
    const rows = filteredData.map(r => columns.map(c => getExportValue(r, c.key) || '—'));
    doc.autoTable({
      startY: 26, head: [cols], body: rows,
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
      tableWidth: 'auto',
      didParseCell: pdfColorHook(columns.map(c => c.key), ['referredBy'], (v) => associateColorSync(v)),
    });
    doc.save(`UMS_${countryName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const cols = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const headers = cols.map(c => `<th>${c.label}</th>`).join('');
    const rows = filteredData.map(row => {
      const cells = cols.map(col => {
        const val = getExportValue(row, col.key) || '—';
        return `<td${col.key === 'referredBy' ? htmlStyleAttr(associateColorSync(val)) : ''}>${val}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${countryName} Applications</title>
  <style>
    @page { size: A3 landscape; margin: 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; color: #000; }
    h2 { margin: 0 0 6px; font-size: 13px; }
    p { margin: 0 0 8px; color: #555; font-size: 8px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body>
  <h2>${countryName} Applications</h2>
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
    win.onload = () => {
      win.focus();
      win.print();
    };
    win.onafterprint = () => win.close();
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const columnPickerColumns = useMemo(() => EXPORT_COLUMNS.map(c => ({
    key: c.key, label: c.label, required: c.key === 'name',
  })), [EXPORT_COLUMNS]);

  const exportDefaultColumnKeys = useMemo(() => EXPORT_COLUMNS.map(c => c.key), [EXPORT_COLUMNS]);

  const columnPickerInitialSelected = useMemo(
    () => loadRememberedColumns(columnStorageKey, exportDefaultColumnKeys) || exportDefaultColumnKeys,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPickerFor, exportDefaultColumnKeys, columnStorageKey]
  );

  const handleColumnsConfirm = (selectedKeys, remember) => {
    if (remember) saveRememberedColumns(columnStorageKey, selectedKeys);
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(selectedKeys);
    else if (target === 'pdf') exportPDF(selectedKeys);
    else if (target === 'print') handlePrint(selectedKeys);
  };

  const columnPickerTitle = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print Applications'
    : '';
  const columnPickerActionLabel = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print'
    : 'Confirm';

  const offerClass = (v) => v === 'Received' ? 'offered' : v === 'Rejected' ? 'withdrawn-badge' : 'not-yet';
  const visaClass = (v) => v === 'Grant' ? 'offered' : v === 'Rejected' ? 'incomplete' : v === 'Withdraw' ? 'withdrawn-badge' : v === 'Waiting' ? 'not-yet' : '';
  const savisClass = (v) => v === 'Paid' ? 'complete' : 'incomplete';
  const refundClass = (v) => v === 'Received' ? 'complete' : 'incomplete';
  const gsClass = (v) => v === 'Completed' ? 'offered' : v === 'Ongoing' ? '' : 'not-yet';
  const coeCasClass = (v) => v === 'Received' ? 'complete' : v === 'Requested' ? '' : 'incomplete';
  const olRequestClass = (v) => v === 'Requested' ? 'offered' : 'not-yet';
  const yesNoClass = (v) => v === 'Yes' ? 'withdrawn-badge' : 'complete';

  const empty = <span className="td-empty">—</span>;
  const moreBadge = (row, field) => row.universities?.length > 1 && (
    <span className="td-more-badge" title={row.universities.slice(1).map(u => u[field]).filter(Boolean).join(', ')}>
      +{row.universities.length - 1}
    </span>
  );
  const badgeCell = (key, v, kind, cls) => (
    <td key={key}>{v ? <span className={`${kind}-badge ${cls}`}>{v}</span> : empty}</td>
  );
  const receivedClass = (v) => v === 'Received' ? 'complete' : 'incomplete';
  const renderCell = (row, key) => {
    const v = row[key];
    switch (key) {
      case 'date':
      case 'visaLodgement':
      case 'biometricDate':
      case 'flightDate':
      case 'visaAppointmentDate':
      case 'visaLodgeDate':
        return <td key={key}><span className="date-cell">{v || empty}</span></td>;
      case 'referredBy':
        return <td key={key} className="td-left"><AssociateName name={row.referredBy} empty={empty} /></td>;
      case 'name':
        return <td key={key} className="td-name">{row.name}</td>;
      case 'level':
        return (
          <td key={key}>
            {row.level
              ? <span className={`level-badge level-${row.level.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>{row.level}</span>
              : empty}
            {moreBadge(row, 'level')}
          </td>
        );
      case 'course':
        return <td key={key} className="td-course td-left">{row.course || empty}{moreBadge(row, 'course')}</td>;
      case 'providerName':
        return <td key={key} className="td-provider td-left">{row.providerName || empty}{moreBadge(row, 'providerName')}</td>;
      case 'olRequest': return badgeCell(key, v, 'offer', olRequestClass(v));
      case 'offerLetter': return badgeCell(key, v, 'offer', offerClass(v));
      case 'olType': return badgeCell(key, v, 'offer', v === 'Unconditional' ? 'offered' : 'not-yet');
      case 'withdraw': return badgeCell(key, v, 'payment', yesNoClass(v));
      case 'gsSubmission': return badgeCell(key, v, 'offer', gsClass(v));
      case 'precasDeposit': return badgeCell(key, v, 'payment', v === 'Complete' ? 'complete' : v === 'N/A' ? '' : 'incomplete');
      case 'interview': return badgeCell(key, v, 'offer', v === 'Passed' ? 'offered' : 'withdrawn-badge');
      case 'payment': return badgeCell(key, v, 'payment', v === 'Complete' ? 'complete' : v === 'Ongoing' ? '' : 'incomplete');
      case 'applicationFee': return badgeCell(key, v, 'payment', v === 'Paid' ? 'complete' : 'incomplete');
      case 'visaKit': return badgeCell(key, v, 'payment', receivedClass(v));
      case 'coeCas': return badgeCell(key, v, 'payment', coeCasClass(v));
      case 'financialDocument':
      case 'tbCertificate':
      case 'studentIdCard':
        return badgeCell(key, v, 'payment', receivedClass(v));
      case 'savisFee': return badgeCell(key, v, 'payment', savisClass(v));
      case 'visaOutcome': return badgeCell(key, v, 'offer', visaClass(v));
      case 'visaWithdraw': return badgeCell(key, v, 'payment', yesNoClass(v));
      case 'refund': return badgeCell(key, v, 'payment', refundClass(v));
      case 'eVisa': return badgeCell(key, v, 'payment', v === 'Applied' ? 'complete' : 'incomplete');
      case 'remarks': return <td key={key} className="td-remarks">{v || empty}</td>;
      case 'other': return <td key={key} className="td-other">{v || empty}</td>;
      default: return <td key={key}>{v || empty}</td>;
    }
  };

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
          <button className={`filter-toggle-btn ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
          {canCreate && (
            <button className="add-record-btn" onClick={() => { setEditRow(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Application
            </button>
          )}
          {canImport && (
            <button className="add-record-btn" onClick={() => setShowBulkImport(true)} title="Import from Excel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Bulk Import
            </button>
          )}
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
            <AssociateTypeFilter value={filters.associateType} onChange={v => setFilters(f => ({ ...f, associateType: v }))} label="Referred By Type" />
            <div className="filter-field">
              <label>Level</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={withNotSet(levelFilterOptions)}
                value={withNotSet(levelFilterOptions).filter(o => filters.level.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, level: opts.map(o => o.value) }))} placeholder="All levels…" />
            </div>
            <div className="filter-field">
              <label>Initial Intake</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={withNotSet(intakeFilterOptions)}
                value={withNotSet(intakeFilterOptions).filter(o => filters.initialIntake.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, initialIntake: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            <div className="filter-field">
              <label>Deferred Intake</label>
              <Select isMulti className="custom-select" classNamePrefix="react-select" options={withNotSet(intakeFilterOptions)}
                value={withNotSet(intakeFilterOptions).filter(o => filters.deferredIntake.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, deferredIntake: opts.map(o => o.value) }))} placeholder="All…" />
            </div>
            {filterFields.map(ff => (
              <div className="filter-field" key={ff.key}>
                <label>{ff.label}</label>
                <Select isMulti className="custom-select" classNamePrefix="react-select" options={withNotSet(profileOptions[ff.key] || [])}
                  value={withNotSet(profileOptions[ff.key] || []).filter(o => filters[ff.key].includes(o.value))}
                  onChange={opts => setFilters(f => ({ ...f, [ff.key]: opts.map(o => o.value) }))} placeholder="All…" />
              </div>
            ))}
            <div className="filter-field">
              <label>Provider</label>
              <input type="text" placeholder="Provider name…" value={filters.provider}
                disabled={filters.providerNotSet}
                onChange={e => setFilters(f => ({ ...f, provider: e.target.value }))} className="filter-text-input" />
              <label className="filter-notset-check">
                <input
                  type="checkbox"
                  checked={filters.providerNotSet}
                  onChange={e => setFilters(f => ({ ...f, providerNotSet: e.target.checked, provider: e.target.checked ? '' : f.provider }))}
                />
                Not Set
              </label>
            </div>
            <div className="filter-field">
              <label>Course</label>
              <input type="text" placeholder="Course name…" value={filters.course}
                disabled={filters.courseNotSet}
                onChange={e => setFilters(f => ({ ...f, course: e.target.value }))} className="filter-text-input" />
              <label className="filter-notset-check">
                <input
                  type="checkbox"
                  checked={filters.courseNotSet}
                  onChange={e => setFilters(f => ({ ...f, courseNotSet: e.target.checked, course: e.target.checked ? '' : f.course }))}
                />
                Not Set
              </label>
            </div>
            <div className="filter-field">
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
                className="filter-text-input"
              >
                <option value="all">All</option>
                {FISCAL_YEARS.map(fy => (
                  <option key={fy.label} value={fy.label}>{fy.label}</option>
                ))}
              </select>
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
            <div className="filter-field">
              <label>Visa Granted From Date</label>
              <input
                type="date"
                value={filters.visaFrom}
                onChange={e => setFilters(f => ({ ...f, visaFrom: e.target.value }))}
                className="filter-text-input"
              />
            </div>
            <div className="filter-field">
              <label>Visa Granted To Date</label>
              <input
                type="date"
                value={filters.visaTo}
                onChange={e => setFilters(f => ({ ...f, visaTo: e.target.value }))}
                className="filter-text-input"
              />
            </div>

          </div>
        </div>
      )}

            <div className="dt-quicksearch" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: '12rem' }} title="Referred By Type">
          <AssociateTypeFilter wrap={false} value={filters.associateType} onChange={v => setFilters(f => ({ ...f, associateType: v }))} />
        </div>
        <div className="dt-qs-wrap" style={{ flex: 1, minWidth: '14rem' }}>
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
                  className={`${sortConfig.key === col.key ? 'sorted' : ''} ${col.key === 'name' ? 'th-name-sticky' : ''} ${['referredBy', 'course', 'providerName'].includes(col.key) ? 'th-left' : ''}`}
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
                data-app-row={row._id}
                className={`dt-row ${selectedIds.has(row._id) ? 'selected' : ''}`}
                onDoubleClick={() => { setEditRow(row); setShowForm(true); }}>
                <td className="td-check">
                  <input type="checkbox" checked={selectedIds.has(row._id)}
                    onChange={() => toggleSelect(row._id)} onClick={e => e.stopPropagation()} />
                </td>
                {baseColumns.map(col => renderCell(row, col.key))}
                {customFields.map(f => (
                  <td key={f.key} className="td-custom">
                    {row.customFields?.[f.key] || <span className="td-empty">—</span>}
                  </td>
                ))}
                <td className="td-row-actions">
                  {canEdit && (
                    <button className="row-btn edit" onClick={() => { setEditRow(row); setShowForm(true); }} title="Edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                  {canDelete && (
                    <button className="row-btn delete" onClick={() => handleDelete(row._id)} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  )}
                  {canUseFollowUp && (() => {
                    const pending = pendingFollowUps[row._id];
                    const earliest = pending ? new Date(pending.earliest) : null;
                    const now = new Date();
                    const isPastDue = earliest && earliest < now;
                    const isSameDay = earliest
                      && earliest.getFullYear() === now.getFullYear()
                      && earliest.getMonth() === now.getMonth()
                      && earliest.getDate() === now.getDate();
                    const state = !pending ? '' : isPastDue ? 'overdue' : isSameDay ? 'today' : 'scheduled';
                    return (
                      <button
                        className={`row-btn followup${state ? ` ${state}` : ''}`}
                        onClick={() => setFollowUpAppId(row._id)}
                        title={
                          pending
                            ? `${pending.count} pending — next ${state === 'overdue' ? 'overdue' : state === 'today' ? 'today' : ''}: ${format(earliest, 'dd MMM yyyy, h:mm a')}`
                            : 'Add follow-up'
                        }
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                        </svg>
                        {pending && pending.count > 1 && <span className="row-btn-badge">{pending.count}</span>}
                      </button>
                    );
                  })()}
                  {!canEdit && !canDelete && !canUseFollowUp && <span className="td-empty">—</span>}
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
        <ProfileApplicationForm row={editRow} layout={layout} onSave={handleSave} onClose={() => { setShowForm(false); setEditRow(null); }} />
      )}

      {showBulkEdit && (
        <BulkEditModal count={selectedIds.size} layout={layout} onSave={handleBulkSave} onClose={() => setShowBulkEdit(false)} />
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
          optionsByField={profileOptions}
          fields={layout.importFields}
          dateFields={layout.dateFields}
        />
      )}

      {duplicateState && (
        <DuplicateWarningModal
          matches={duplicateState.matches}
          newRow={duplicateState.row}
          compareFields={APPLICATION_COMPARE_FIELDS}
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

      {followUpAppId && (
        <StudentFollowUpDrawer
          applicationId={followUpAppId}
          onClose={() => setFollowUpAppId(null)}
          onChanged={fetchPendingFollowUps}
        />
      )}
    </div>
  );
}
