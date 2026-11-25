import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Select from 'react-select';
import { format } from 'date-fns';
import { FISCAL_YEARS, getFiscalYearRange } from '../../utils/fiscalYear';
import { toastExcel, toastPDF } from '../../utils/exportHelpers';
import { useFiscalYear } from '../../context/FiscalYearContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import TestPrepForm from '../../components/testprep/TestPrepForm';
import TestPrepBulkEditModal from '../../components/testprep/TestPrepBulkEditModal';
import TestPrepDetailsModal from '../../components/testprep/TestPrepDetailsModal';
import BulkImportModal from '../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../components/shared/SelectColumnsModal';
import AssociateSearchModal from '../../components/shared/AssociateSearchModal';
import { isPaidStatus } from '../../utils/paymentStatusHelper';
import { useTestPrepFieldConfig } from '../../hooks/useTestPrepFieldConfig';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import AssociateName from '../../components/shared/AssociateName';
import { htmlStyleAttr, pdfColorHook, matchesAssociateType } from '../../utils/associateStatus';
import {
  customFieldToColumn, loadRememberedColumns, saveRememberedColumns,
} from '../../utils/testPrepColumns';
import { layoutFor, layoutColumns, layoutFormFields, layoutImportFields, layoutDateKeys } from '../../utils/testPrepLayouts';
import useAssociateOptions, { associateColorSync, useAssociateStatus } from '../../hooks/useAssociateOptions';
import AssociateTypeFilter from '../../components/shared/AssociateTypeFilter';
import '../country/DataTable.css';
import './TestPrepDataTable.css';

const PAGE_SIZES = [10, 25, 50, 100];

const DATE_KEYS = ['date', 'bookingDate', 'examDate', 'paymentDate', 'paymentDateToBC', 'expiryDate', 'accountsDate'];

function toDateInputValue(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function displayDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'yyyy-MM-dd');
}

function normalizeRow(r) {
  const out = { ...r };
  DATE_KEYS.forEach(k => { out[k] = toDateInputValue(r[k]); });
  return out;
}

const emptyFilters = (fy = '2083/84') => {
  const { from, to } = getFiscalYearRange(fy);
  return {
    fiscalYear: fy,
    studentName: '', associate: '', associateType: 'All',
    dateFrom: from, dateTo: to,
    ranges: {}, multi: {},
  };
};

const NOT_SET = '__NOT_SET__';
const NOT_SET_LABEL = 'Not Set';

function isUnsetValue(v) {
  return v === null || v === undefined || v === '';
}

function matchesMulti(fieldValue, selected) {
  if (!selected || !selected.length) return true;
  return selected.some(v => (v === NOT_SET ? isUnsetValue(fieldValue) : v === fieldValue));
}

function toSelectOptions(values) {
  return (values || []).map(v => ({ value: v, label: v }));
}

function withNotSet(values) {
  return [{ value: NOT_SET, label: NOT_SET_LABEL }, ...toSelectOptions(values)];
}

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

function getFieldValue(row, col) {
  if (col.custom) {
    const realKey = col.key.slice('custom:'.length);
    const cf = row.customFields || {};
    return cf[realKey] ?? cf.get?.(realKey);
  }
  return row[col.key];
}

function renderCellContent(col, row) {
  const val = getFieldValue(row, col);
  if (col.key === 'associates') return val ? <AssociateName name={val} /> : <span className="td-empty">-</span>;
  switch (col.type) {
    case 'date':
      return <span className="date-cell">{displayDate(val)}</span>;
    case 'currency':
    case 'number':
      return val === undefined || val === null || val === '' ? <span className="td-empty">-</span> : (Number(val) || 0).toLocaleString();
    case 'badge':
      return val
        ? <span className={`payment-badge ${isPaidStatus(val) ? 'complete' : 'incomplete'}`}>{val}</span>
        : <span className="td-empty">-</span>;
    default:
      return val || <span className="td-empty">-</span>;
  }
}

function cellClassName(col) {
  if (col.key === 'associates') return 'td-left';
  if (col.key === 'candidateName') return 'td-name';
  if (col.type === 'currency' || col.type === 'number') return 'td-currency';
  return '';
}

function exportValue(row, col) {
  const val = getFieldValue(row, col);
  if (col.type === 'date') return displayDate(val);
  if (col.type === 'currency' || col.type === 'number') return Number(val) || 0;
  return val || '';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function RangeFilter({ label, value, onChange }) {
  const v = value || { from: '', to: '' };
  return (
    <>
      <div className="filter-field">
        <label>{label} From</label>
        <input type="date" className="filter-text-input" value={v.from} onChange={e => onChange({ ...v, from: e.target.value })} />
      </div>
      <div className="filter-field">
        <label>{label} To</label>
        <input type="date" className="filter-text-input" value={v.to} onChange={e => onChange({ ...v, to: e.target.value })} />
      </div>
    </>
  );
}

export default function TestPrepDataTable() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY, dateFrom: globalFrom, dateTo: globalTo } = useFiscalYear();
  const canCreate = hasPermission(user, 'testPreparation', 'create');
  const canEdit = hasPermission(user, 'testPreparation', 'edit');
  const canDelete = hasPermission(user, 'testPreparation', 'delete');
  const canImport = hasPermission(user, 'testPreparation', 'import');
  const canExportExcel = hasPermission(user, 'testPreparation', 'exportExcel');
  const canExportPdf = hasPermission(user, 'testPreparation', 'exportPdf');
  const canPrint = hasPermission(user, 'testPreparation', 'print');
  const canBulkEdit = hasPermission(user, 'testPreparation', 'bulkEdit');
  const canReceipts = hasPermission(user, 'dailyReceiptBC', 'view') || hasPermission(user, 'dailyReceiptAccounts', 'view');

  const [testType, setTestType] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedKey = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [filters, setFilters] = useState(() => ({
    ...emptyFilters(globalFY),
    fiscalYear: globalFY,
    dateFrom: globalFrom,
    dateTo: globalTo,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAssociateSearch, setShowAssociateSearch] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'bookingDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnPickerFor, setColumnPickerFor] = useState(null);

  const fieldConfig = useTestPrepFieldConfig();
  const associateList = useAssociateOptions();
  const statusOf = useAssociateStatus();

  const testTypeName = testType?.name || '…';
  const layout = useMemo(() => layoutFor(testTypeName), [testTypeName]);
  const formFields = useMemo(() => layoutFormFields(layout), [layout]);
  const hasField = useCallback((key) => formFields.some(f => f.key === key), [formFields]);
  const layoutDateColumns = useMemo(() => layoutColumns(layout).filter(c => c.type === 'date'), [layout]);

  useEffect(() => {
    setSortConfig(layout.defaultSort || { key: 'bookingDate', dir: 'desc' });
  }, [layout]);

  const mergeExtraValues = useCallback((configured, actualValues) => {
    const configuredList = configured || [];
    const configuredNorm = new Set(configuredList.map(v => String(v).trim().toLowerCase()));
    const seen = new Set();
    const extras = [];
    actualValues.forEach(v => {
      if (v === undefined || v === null || v === '') return;
      const s = String(v).trim();
      const key = s.toLowerCase();
      if (configuredNorm.has(key) || seen.has(key)) return;
      seen.add(key);
      extras.push(s);
    });
    extras.sort((a, b) => a.localeCompare(b));
    return [...configuredList, ...extras];
  }, []);

  const effectiveOptionsByField = useMemo(() => ({
    paymentStatus: mergeExtraValues(fieldConfig.optionsByField.paymentStatus, data.map(r => r.paymentStatus)),
    module: mergeExtraValues(fieldConfig.optionsByField.module, data.map(r => r.module)),
    ieltsModule: mergeExtraValues(fieldConfig.optionsByField.ieltsModule, data.map(r => r.ieltsModule)),
    duolingoVoucher: mergeExtraValues([], data.map(r => r.duolingoVoucher)),
  }), [fieldConfig.optionsByField, data, mergeExtraValues]);

  const effectiveCustomFieldDefs = useMemo(() => fieldConfig.customFields.map(def => {
    if (def.type !== 'dropdown') return def;
    const actual = data.map(r => (r.customFields || {})[def.key]);
    return { ...def, options: mergeExtraValues(def.options, actual) };
  }), [fieldConfig.customFields, data, mergeExtraValues]);

  const allColumns = useMemo(
    () => [...layoutColumns(layout), ...effectiveCustomFieldDefs.map(customFieldToColumn)],
    [layout, effectiveCustomFieldDefs]
  );
  const allDefaultVisibleKeys = useMemo(() => allColumns.map(c => c.key), [allColumns]);

  const fetchRecords = useCallback(async () => {
    if (loadedKey.current !== slug) setLoading(true);
    try {
      const res = await axios.get(`/test-prep/${slug}`);
      setTestType(res.data.testType || null);
      setData((res.data.records || []).map(normalizeRow));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load records');
      setData([]);
    } finally {
      loadedKey.current = slug;
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { setPage(1); setFilters(emptyFilters(globalFY)); setSelectedIds(new Set()); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => ({
    associates: [...new Set(data.map(r => r.associates).filter(Boolean))],
    module: [...new Set(data.map(r => r.module).filter(Boolean))],
    place: [...new Set(data.map(r => r.place).filter(Boolean))],
    paymentMadeBy: [...new Set(data.map(r => r.paymentMadeBy).filter(Boolean))],
  }), [data]);

  const filteredData = useMemo(() => {
    let d = [...data];
    if (filters.studentName) {
      const q = filters.studentName.toLowerCase().trim();
      d = d.filter(r => r.candidateName?.toString().toLowerCase().includes(q));
    }
    Object.entries(filters.multi).forEach(([k, sel]) => {
      if (sel && sel.length) d = d.filter(r => matchesMulti(r[k], sel));
    });
    Object.entries(filters.ranges).forEach(([k, range]) => {
      if (range?.from) d = d.filter(r => r[k] && r[k] >= range.from);
      if (range?.to) d = d.filter(r => r[k] && r[k] <= range.to);
    });
    if (filters.dateFrom) d = d.filter(r => r.date && r.date >= filters.dateFrom);
    if (filters.dateTo) d = d.filter(r => r.date && r.date <= filters.dateTo);
    if (filters.associate) d = d.filter(r => r.associates === filters.associate);
    if (filters.associateType && filters.associateType !== 'All') d = d.filter(r => matchesAssociateType(statusOf(r.associates), filters.associateType));

    if (sortConfig.key) {
      const getSortValue = (row) => {
        if (sortConfig.key.startsWith('custom:')) {
          return (row.customFields || {})[sortConfig.key.slice('custom:'.length)];
        }
        return row[sortConfig.key];
      };
      d.sort((a, b) => {
        let av = getSortValue(a) ?? '', bv = getSortValue(b) ?? '';
        if (typeof av === 'number' || typeof bv === 'number') { av = Number(av) || 0; bv = Number(bv) || 0; }
        let cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [data, filters, sortConfig, statusOf]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.studentName) c++;
    if (filters.associate) c++;
    if (filters.associateType && filters.associateType !== 'All') c++;
    if (filters.dateFrom || filters.dateTo) c++;
    Object.values(filters.multi).forEach(v => { if (v && v.length) c++; });
    Object.values(filters.ranges).forEach(v => { if (v && (v.from || v.to)) c++; });
    return c;
  }, [filters]);

  const setMulti = (key, vals) => setFilters(f => ({ ...f, multi: { ...f.multi, [key]: vals } }));
  const setRange = (key, v) => setFilters(f => ({ ...f, ranges: { ...f.ranges, [key]: v } }));

  const clearFilters = () => {
    const { from, to } = getFiscalYearRange(globalFY);
    setFilters({ ...emptyFilters(), fiscalYear: globalFY, dateFrom: from, dateTo: to });
    setPage(1);
  };

  const handleFiscalYearChange = (fy) => {
    const { from, to } = getFiscalYearRange(fy);
    setGlobalFY(fy);
    setFilters(f => ({ ...f, fiscalYear: fy, dateFrom: from, dateTo: to }));
    setPage(1);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === pagedData.length && pagedData.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagedData.map(r => r._id)));
  };

  const handleSave = async (row) => {
    if (row._id && !window.confirm('Save changes to this record?')) return;
    try {
      if (row._id) {
        const res = await axios.put(`/test-prep/${slug}/${row._id}`, row);
        setData(prev => prev.map(d => d._id === row._id ? normalizeRow(res.data.record) : d));
        toast.success('Booking updated');
      } else {
        const res = await axios.post(`/test-prep/${slug}`, row);
        setData(prev => [normalizeRow(res.data.record), ...prev]);
        toast.success('Booking added');
      }
      setShowForm(false); setEditRow(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save booking');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this record to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/test-prep/${slug}/${id}`);
      setData(prev => prev.filter(d => d._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected record(s) to trash?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.delete(`/test-prep/${slug}/bulk/delete`, { data: { ids } });
      setData(prev => prev.filter(d => !selectedIds.has(d._id)));
      toast.success(`${ids.length} record(s) moved to trash`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.put(`/test-prep/${slug}/bulk/update`, { ids, updates });
      const { customFields: customUpdates, ...flatUpdates } = updates;
      setData(prev => prev.map(d => {
        if (!selectedIds.has(d._id)) return d;
        const merged = { ...d, ...Object.fromEntries(Object.entries(flatUpdates).filter(([, v]) => v !== '' && v !== null && v !== undefined)) };
        if (customUpdates) merged.customFields = { ...(d.customFields || {}), ...customUpdates };
        return merged;
      }));
      toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
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
      const prepared = rows.map(r => ({ ...r, date: r.date || r.bookingDate || undefined }));
      const res = await axios.post(`/test-prep/${slug}/bulk/create`, { records: prepared });
      setData(prev => [...res.data.records.map(normalizeRow), ...prev]);
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      const known = new Set(associateList.flatMap(a => [a.name, ...(a.aliases || [])]).map(n => String(n).toLowerCase().replace(/[\s,.]+/g, ' ').trim()));
      const unknown = new Set(rows.map(r => String(r.associates || '').trim()).filter(n => n && !known.has(n.toLowerCase().replace(/[\s,.]+/g, ' ').trim())));
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} record${summary.created !== 1 ? 's' : ''} imported`);
      }
      if (unknown.size > 0) toast(`${unknown.size} associate name${unknown.size > 1 ? 's' : ''} not present in Associate Details`, { icon: '⚠️' });
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

  const pickColumns = useCallback((columnKeys) => columnKeys.map(k => allColumns.find(c => c.key === k)).filter(Boolean), [allColumns]);

  const buildMatrix = useCallback((columns) => filteredData.map((r, i) => [i + 1, ...columns.map(c => exportValue(r, c))]), [filteredData]);

  const buildRowsForColumns = useCallback((columnKeys) => {
    const columns = pickColumns(columnKeys);
    return filteredData.map((r, i) => {
      const out = { 'S.N': i + 1 };
      columns.forEach(c => { out[c.label] = exportValue(r, c); });
      return out;
    });
  }, [filteredData, pickColumns]);

  const exportExcel = (columnKeys) => {
    const rows = buildRowsForColumns(columnKeys);
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['S.N', ...pickColumns(columnKeys).map(c => c.label)] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, testTypeName);
    XLSX.writeFile(wb, `UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = pickColumns(columnKeys);
    const matrix = buildMatrix(columns);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`UCA Management System ${testTypeName} Bookings`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  Total: ${filteredData.length} records`, 14, 22);
    const cols = ['S.N', ...columns.map(c => c.label)];
    doc.autoTable({
      startY: 26, head: [cols], body: matrix.map(r => r.map(v => String(v))),
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
      tableWidth: 'auto',
      didParseCell: pdfColorHook(['sn', ...columns.map(c => c.key)], ['associates'], (v) => associateColorSync(v)),
    });
    doc.save(`UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toastPDF();
  };

  const exportCSV = () => {
    const rows = buildRowsForColumns(allColumns.map(c => c.key));
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['S.N', ...allColumns.map(c => c.label)] });
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const runPrint = (columnKeys) => {
    const columns = pickColumns(columnKeys);
    const matrix = buildMatrix(columns);
    const headers = ['S.N', ...columns.map(c => c.label)].map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const rowsHtml = matrix.map(r => {
      const cells = r.map((v, i) => {
        const col = i === 0 ? null : columns[i - 1];
        const style = col && col.key === 'associates' ? htmlStyleAttr(associateColorSync(v)) : '';
        return `<td${style}>${escapeHtml(v)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html><html><head><title>${escapeHtml(testTypeName)} Bookings</title>
<style>
@page { size: A3 landscape; margin: 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 13px; }
p { margin: 0 0 8px; color: #555; font-size: 8px; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; word-wrap: break-word; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<h2>${escapeHtml(testTypeName)} Exam Bookings</h2>
<p>Printed ${new Date().toLocaleDateString()} &middot; ${filteredData.length} record(s)</p>
<table><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const columnPickerColumns = useMemo(() => allColumns.map(c => ({
    key: c.key, label: c.label, required: c.key === 'candidateName',
  })), [allColumns]);

  const columnPickerInitialSelected = useMemo(
    () => loadRememberedColumns(allColumns, `_${layout.key}`) || allDefaultVisibleKeys,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPickerFor, allColumns, allDefaultVisibleKeys]
  );

  const handleColumnsConfirm = (selectedKeys, remember) => {
    if (remember) saveRememberedColumns(selectedKeys, `_${layout.key}`);
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(selectedKeys);
    else if (target === 'pdf') exportPDF(selectedKeys);
    else if (target === 'print') runPrint(selectedKeys);
  };

  const columnPickerTitle = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print Bookings'
    : '';
  const columnPickerActionLabel = columnPickerFor === 'excel' ? 'Export to Excel'
    : columnPickerFor === 'pdf' ? 'Export to PDF'
    : columnPickerFor === 'print' ? 'Print'
    : 'Confirm';

  const importOptionsByField = useMemo(() => ({
    paymentStatus: effectiveOptionsByField.paymentStatus,
    module: effectiveOptionsByField.module,
    ieltsModule: effectiveOptionsByField.ieltsModule,
    duolingoVoucher: effectiveOptionsByField.duolingoVoucher,
    associates: associateList.map(a => a.name),
  }), [effectiveOptionsByField, associateList]);

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading {testTypeName} bookings…</p></div>
  );

  const multiLabel = (key) => (formFields.find(f => f.key === key)?.label || key);

  return (
    <div className="dt-root tp-root animate-fade">
      <div className="dt-header">
        <div className="dt-title-row">
          <span className="dt-flag tp-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          <div>
            <h2>{testTypeName}</h2>
            <p>{filteredData.length} of {data.length} bookings{activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)` : ''}</p>
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
            {canExportExcel && (
              <button className="export-btn" onClick={exportCSV} title="Export to CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                CSV
              </button>
            )}
            {canPrint && (
              <button className="export-btn" onClick={() => openColumnPicker('print')} title="Print">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
            )}
          </div>
          {layout.key === 'ielts' && canReceipts && (
            <button className="add-record-btn daily-receipts-btn" onClick={() => navigate(`/test-prep/${slug}/daily-receipts`)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
              Daily Receipts
            </button>
          )}
          <button className={`filter-toggle-btn ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
          {canCreate && (
            <button className="add-record-btn" onClick={() => { setEditRow(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Record
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
            <span>Filter {testTypeName} Bookings</span>
            {activeFilterCount > 0 && <button className="clear-filters" onClick={clearFilters}>Clear all filters</button>}
          </div>
          <div className="filter-grid">
            <div className="filter-field">
              <label>Fiscal Year (B.S.)</label>
              <select
                className="filter-text-input"
                value={filters.fiscalYear}
                onChange={e => handleFiscalYearChange(e.target.value)}
              >
                {FISCAL_YEARS.map(fy => (
                  <option key={fy.label} value={fy.label}>{fy.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label>Student Name</label>
              <div className="filter-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Student / candidate name…"
                  value={filters.studentName} onChange={e => setFilters(f => ({ ...f, studentName: e.target.value }))} />
              </div>
            </div>
            {layout.multiFilters.filter(k => hasField(k)).map(k => (
              <div className="filter-field" key={k}>
                <label>{multiLabel(k)}</label>
                <Select
                  isMulti
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={withNotSet(effectiveOptionsByField[k])}
                  value={withNotSet(effectiveOptionsByField[k]).filter(o => (filters.multi[k] || []).includes(o.value))}
                  onChange={opts => setMulti(k, (opts || []).map(o => o.value))}
                  placeholder="All…"
                />
              </div>
            ))}
            <AssociateTypeFilter value={filters.associateType} onChange={v => setFilters(f => ({ ...f, associateType: v }))} label="Associate Type" />
            <div className="filter-field">
              <label>Associate</label>
              <div className="filter-input-wrap" style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <input
                  type="text"
                  placeholder="Type or search associate…"
                  value={filters.associate || ''}
                  onChange={e => setFilters(f => ({ ...f, associate: e.target.value }))}
                />
                {filters.associate && (
                  <button
                    type="button"
                    onClick={() => setFilters(f => ({ ...f, associate: '' }))}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 14, lineHeight: 1 }}
                    title="Clear"
                  >✕</button>
                )}
              </div>
              <button
                type="button"
                className="filter-toggle-btn associate-search-btn"
                style={{ marginTop: 4, fontSize: '0.75rem' }}
                onClick={() => setShowAssociateSearch(true)}
                title="Browse associates"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Browse Associates
              </button>
            </div>
            {layoutDateColumns.map(c => (
              <RangeFilter key={c.key} label={c.label} value={filters.ranges[c.key]} onChange={v => setRange(c.key, v)} />
            ))}
            <div className="filter-field tp-filter-search-btn-wrap">
              <label>&nbsp;</label>
              <button type="button" className="add-record-btn" onClick={() => setPage(1)}>Search</button>
            </div>
          </div>
        </div>
      )}

      <div className="dt-table-wrap">
        <table className="dt-table">
          <thead>
            <tr>
              <th className="th-check">
                {(canBulkEdit || canDelete) && (
                  <input type="checkbox" checked={selectedIds.size === pagedData.length && pagedData.length > 0}
                    onChange={toggleAll} title="Select all" />
                )}
              </th>
              <th style={{ minWidth: 50 }}>S.N</th>
              {allColumns.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}
                  className={`${sortConfig.key === col.key ? 'sorted' : ''} ${col.key === 'associates' ? 'th-left' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}>
                  <span className="th-content">
                    {col.label}
                    <span className="sort-icon">
                      {sortConfig.key === col.key ? (
                        sortConfig.dir === 'asc' ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                        )
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>
                      )}
                    </span>
                  </span>
                </th>
              ))}
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length + 3} className="empty-row">
                  <div className="dt-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p>No bookings match your filters</p>
                    {activeFilterCount > 0 && <button onClick={clearFilters} className="clear-btn-inline">Clear filters</button>}
                  </div>
                </td>
              </tr>
            ) : pagedData.map((row, idx) => (
              <tr key={row._id} className={`dt-row ${selectedIds.has(row._id) ? 'selected' : ''}`}
                onDoubleClick={() => { if (canEdit) { setEditRow(row); setShowForm(true); } }}>
                <td className="td-check">
                  {(canBulkEdit || canDelete) && (
                    <input type="checkbox" checked={selectedIds.has(row._id)}
                      onChange={() => toggleSelect(row._id)} onClick={e => e.stopPropagation()} />
                  )}
                </td>
                <td>{(page - 1) * pageSize + idx + 1}</td>
                {allColumns.map(col => (
                  <td key={col.key} className={cellClassName(col)}>{renderCellContent(col, row)}</td>
                ))}
                <td className="td-row-actions">
                  <button className="row-btn view" onClick={() => setViewRow(row)} title="View details">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tp-pagination">
        <div className="tp-page-size">
          <label>Rows per page</label>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="tp-page-controls">
          <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>

      {showForm && (
        <TestPrepForm
          row={editRow}
          testTypeName={testTypeName}
          fields={formFields}
          suggestions={suggestions}
          customFieldDefs={effectiveCustomFieldDefs}
          optionsByField={effectiveOptionsByField}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditRow(null); }}
        />
      )}

      {viewRow && (
        <TestPrepDetailsModal
          row={viewRow}
          testTypeName={testTypeName}
          fields={formFields}
          customFieldDefs={effectiveCustomFieldDefs}
          onClose={() => setViewRow(null)}
          onEdit={() => { setEditRow(viewRow); setViewRow(null); setShowForm(true); }}
        />
      )}

      {showBulkEdit && (
        <TestPrepBulkEditModal
          count={selectedIds.size}
          testTypeName={testTypeName}
          fields={formFields}
          suggestions={suggestions}
          customFieldDefs={effectiveCustomFieldDefs}
          optionsByField={effectiveOptionsByField}
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
          title={`Bulk Import ${testTypeName} Bookings`}
          fields={layoutImportFields(layout)}
          customFields={effectiveCustomFieldDefs}
          requiredField={{ key: 'candidateName', label: formFields.find(f => f.key === 'candidateName')?.label || 'Candidate Name' }}
          dateFields={layoutDateKeys(layout)}
          optionsByField={importOptionsByField}
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

      {showAssociateSearch && (
        <AssociateSearchModal
          associates={suggestions.associates}
          value={filters.associate}
          onSelect={(name) => setFilters(f => ({ ...f, associate: name }))}
          onClose={() => setShowAssociateSearch(false)}
        />
      )}
    </div>
  );
}
