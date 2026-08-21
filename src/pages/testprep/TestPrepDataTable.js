import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import ReceiptDocument from '../../components/testprep/ReceiptDocument';
import BulkImportModal from '../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../components/shared/SelectColumnsModal';
import AssociateSearchModal from '../../components/shared/AssociateSearchModal';
import { isPaidStatus } from '../../utils/paymentStatusHelper';
import { useTestPrepFieldConfig } from '../../hooks/useTestPrepFieldConfig';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import {
  DEFAULT_VISIBLE_COLUMN_KEYS, getAllColumns,
  loadRememberedColumns, saveRememberedColumns,
} from '../../utils/testPrepColumns';
import '../country/DataTable.css';
import './TestPrepDataTable.css';

const TEST_PREP_IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['recorddate', 'entrydate', 'dateofrecord'] },
  { key: 'candidateName', label: 'Candidate Name', aliases: ['name', 'candidate', 'studentname', 'fullname'] },
  { key: 'associates', label: 'Associates', aliases: ['associate', 'agent', 'referredby'] },
  { key: 'bookingDate', label: 'Booking Date', aliases: ['booking', 'dateofbooking'] },
  { key: 'examDate', label: 'Exam Date', aliases: ['exam', 'testdate', 'dateofexam'] },
  { key: 'module', label: 'Module', aliases: ['type', 'examtype', 'mode'] },
  { key: 'place', label: 'Place', aliases: ['center', 'centre', 'location', 'city', 'venue'] },
  { key: 'paymentStatus', label: 'Payment Status', aliases: ['payment', 'paid'] },
  { key: 'paymentMadeBy', label: 'Payment Made By', aliases: ['paidby', 'paymentby'] },
  { key: 'paymentDate', label: 'Payment Date', aliases: ['dateofpayment'] },
  { key: 'paymentAmount', label: 'Payment Amount', aliases: ['amount', 'fee', 'examfee'] },
  { key: 'margin', label: 'Margin', aliases: ['profit', 'commission'] },
  { key: 'paymentDateToBC', label: 'Payment Date to BC', aliases: ['bcpaymentdate', 'datetobc'] },
  { key: 'paidAmountToBC', label: 'Paid Amount to BC', aliases: ['amounttobc', 'paidtobc'] },
  { key: 'remarks', label: 'Remarks', aliases: ['notes', 'comment', 'comments'] },
  { key: 'referenceNumber', label: 'Reference Number', aliases: ['reference', 'refno', 'refnumber'] },
  { key: 'receivedAmount', label: 'Received Amount', aliases: ['received', 'amountreceived'] },
  { key: 'cost', label: 'Cost', aliases: ['examcost', 'totalcost'] },
  { key: 'voucher', label: 'Voucher', aliases: ['vouchercode', 'coupon'] },
  { key: 'duolingoVoucher', label: 'Duolingo Voucher', aliases: ['duolingovoucher', 'duolingocoupon', 'duolingovouchercode'] },
  { key: 'expiryDate', label: 'Expiry Date', aliases: ['expiry', 'expirydate', 'validuntil'] },
];

const PAGE_SIZES = [10, 25, 50, 100];

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
  return {
    ...r,
    date: toDateInputValue(r.date),
    bookingDate: toDateInputValue(r.bookingDate),
    examDate: toDateInputValue(r.examDate),
    paymentDate: toDateInputValue(r.paymentDate),
    paymentDateToBC: toDateInputValue(r.paymentDateToBC),
    expiryDate: toDateInputValue(r.expiryDate),
  };
}

const emptyFilters = (fy = '2083/84') => {
  const { from, to } = getFiscalYearRange(fy);
  return {
    fiscalYear: fy,
    studentName: '', paymentStatus: [],
    dateFrom: from, dateTo: to,
    bookingDateFrom: '', bookingDateTo: '',
    examDateFrom: '', examDateTo: '',
    paymentDateFrom: '', paymentDateTo: '',
    paymentDateToBCFrom: '', paymentDateToBCTo: '',
    associate: '',
    voucher: [], duolingoVoucher: [], remarksSearch: '',
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

function renderCellContent(col, row, testTypeName) {
  if (col.key === 'testTypeName') return testTypeName;
  const val = getFieldValue(row, col);
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
  if (col.key === 'candidateName') return 'td-name';
  if (col.type === 'currency' || col.type === 'number') return 'td-currency';
  return '';
}

function buildExportRow(row, columns, index, testTypeName) {
  const out = { 'S.N': index + 1 };
  columns.forEach(col => {
    const val = getFieldValue(row, col);
    let display;
    if (col.key === 'testTypeName') display = testTypeName;
    else if (col.type === 'date') display = displayDate(val);
    else if (col.type === 'currency' || col.type === 'number') display = Number(val) || 0;
    else display = val || '';
    out[col.label] = display;
  });
  return out;
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

  const [testType, setTestType] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [receiptStatus, setReceiptStatus] = useState({});
  const [viewReceipt, setViewReceipt] = useState(null);
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
  const [sortConfig, setSortConfig] = useState({ key: 'examDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnPickerFor, setColumnPickerFor] = useState(null);

  const fieldConfig = useTestPrepFieldConfig();

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
    voucher: mergeExtraValues(['Voucher', 'Bonus Voucher'], data.map(r => r.voucher)),
    duolingoVoucher: mergeExtraValues([], data.map(r => r.duolingoVoucher)),
  }), [fieldConfig.optionsByField, data, mergeExtraValues]);

  const effectiveCustomFieldDefs = useMemo(() => fieldConfig.customFields.map(def => {
    if (def.type !== 'dropdown') return def;
    const actual = data.map(r => (r.customFields || {})[def.key]);
    return { ...def, options: mergeExtraValues(def.options, actual) };
  }), [fieldConfig.customFields, data, mergeExtraValues]);

  const testTypeName = testType?.name || '…';
  const isIelts = /ielts/i.test(testTypeName);
  const isDuolingo = /^duolingo$/i.test(testTypeName.trim());

  const allColumns = useMemo(() => {
    const cols = getAllColumns(effectiveCustomFieldDefs);
    return cols.filter(c => {
      if (c.key === 'voucher' && isDuolingo) return false;
      if (c.key === 'duolingoVoucher' && !isDuolingo) return false;
      return true;
    });
  }, [effectiveCustomFieldDefs, isDuolingo]);
  const allDefaultVisibleKeys = useMemo(
    () => [...DEFAULT_VISIBLE_COLUMN_KEYS, ...fieldConfig.customFields.map(f => `custom:${f.key}`)],
    [fieldConfig.customFields]
  );

  useEffect(() => {
    if (!isIelts) { setReceiptStatus({}); return; }
    axios.get(`/ielts-receipts/status/${slug}`)
      .then(res => setReceiptStatus(res.data || {}))
      .catch(() => setReceiptStatus({}));
  }, [isIelts, slug, data]);

  const openReceipt = useCallback(async (row) => {
    const receiptId = receiptStatus[row._id];
    if (!receiptId) {
      navigate(`/test-prep/${slug}/daily-receipts`, { state: { studentId: row._id, examDate: row.examDate } });
      return;
    }
    try {
      const [receiptRes, dayRes] = await Promise.all([
        axios.get(`/ielts-receipts/student/${row._id}`),
        axios.get(`/ielts-receipts/by-date/${slug}`, { params: { examDate: row.examDate } }),
      ]);
      setViewReceipt({
        receipt: receiptRes.data,
        dayReceipts: Object.values(dayRes.data.receipts || {}),
        daySummary: dayRes.data.summary,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load receipt');
    }
  }, [receiptStatus, slug, navigate]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/test-prep/${slug}`);
      setTestType(res.data.testType || null);
      setData((res.data.records || []).map(normalizeRow));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load records');
      setData([]);
    } finally {
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
    d = d.filter(r => matchesMulti(r.paymentStatus, filters.paymentStatus));
    d = d.filter(r => matchesMulti(r.voucher, filters.voucher));
    d = d.filter(r => matchesMulti(r.duolingoVoucher, filters.duolingoVoucher));

    if (filters.remarksSearch) {
      const q = filters.remarksSearch.toLowerCase().trim();
      d = d.filter(r => (r.remarks || '').toLowerCase().includes(q));
    }

    if (filters.dateFrom) d = d.filter(r => r.date && r.date >= filters.dateFrom);
    if (filters.dateTo) d = d.filter(r => r.date && r.date <= filters.dateTo);
    if (filters.bookingDateFrom) d = d.filter(r => r.bookingDate && r.bookingDate >= filters.bookingDateFrom);
    if (filters.bookingDateTo) d = d.filter(r => r.bookingDate && r.bookingDate <= filters.bookingDateTo);
    if (filters.examDateFrom) d = d.filter(r => r.examDate && r.examDate >= filters.examDateFrom);
    if (filters.examDateTo) d = d.filter(r => r.examDate && r.examDate <= filters.examDateTo);
    if (filters.paymentDateFrom) d = d.filter(r => r.paymentDate && r.paymentDate >= filters.paymentDateFrom);
    if (filters.paymentDateTo) d = d.filter(r => r.paymentDate && r.paymentDate <= filters.paymentDateTo);
    if (filters.paymentDateToBCFrom) d = d.filter(r => r.paymentDateToBC && r.paymentDateToBC >= filters.paymentDateToBCFrom);
    if (filters.paymentDateToBCTo) d = d.filter(r => r.paymentDateToBC && r.paymentDateToBC <= filters.paymentDateToBCTo);
    if (filters.associate) d = d.filter(r => r.associates === filters.associate);

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
  }, [data, filters, sortConfig]);

  const totals = useMemo(() => ({
    records: filteredData.length,
    paymentAmount: filteredData.reduce((s, r) => s + (Number(r.paymentAmount) || 0), 0),
    margin: filteredData.reduce((s, r) => s + (Number(r.margin) || 0), 0),
    paidToBC: filteredData.reduce((s, r) => s + (Number(r.paidAmountToBC) || 0), 0),
    receivedAmount: filteredData.reduce((s, r) => s + (Number(r.receivedAmount) || 0), 0),
    cost: filteredData.reduce((s, r) => s + (Number(r.cost) || 0), 0),
  }), [filteredData]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.studentName) c++;
    if (filters.paymentStatus.length) c++;
    if (filters.voucher.length) c++;
    if (filters.duolingoVoucher.length) c++;
    if (filters.remarksSearch) c++;
    if (filters.dateFrom || filters.dateTo) c++;
    if (filters.bookingDateFrom || filters.bookingDateTo) c++;
    if (filters.examDateFrom || filters.examDateTo) c++;
    if (filters.paymentDateFrom || filters.paymentDateTo) c++;
    if (filters.paymentDateToBCFrom || filters.paymentDateToBCTo) c++;
    if (filters.associate) c++;
    return c;
  }, [filters]);

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
      const res = await axios.post(`/test-prep/${slug}/bulk/create`, { records: rows });
      setData(prev => [...res.data.records.map(normalizeRow), ...prev]);
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${summary.created} record${summary.created !== 1 ? 's' : ''} imported`);
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

  const buildRowsForColumns = useCallback((columnKeys) => {
    const columns = columnKeys.map(k => allColumns.find(c => c.key === k)).filter(Boolean);
    return filteredData.map((r, i) => buildExportRow(r, columns, i, testTypeName));
  }, [filteredData, testTypeName, allColumns]);

  const exportExcel = (columnKeys) => {
    const rows = buildRowsForColumns(columnKeys);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, testTypeName);
    XLSX.writeFile(wb, `UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => allColumns.find(c => c.key === k)).filter(Boolean);
    const rows = buildRowsForColumns(columnKeys);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`UCA Management System ${testTypeName} Bookings`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  Total: ${filteredData.length} records`, 14, 22);
    const cols = ['S.N', ...columns.map(c => c.label)];
    const body = rows.map(r => cols.map(c => r[c]));
    doc.autoTable({
      startY: 26, head: [cols], body,
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
      tableWidth: 'auto',
    });
    doc.save(`UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toastPDF();
  };

  const exportCSV = () => {
    const rows = buildRowsForColumns(allColumns.map(c => c.key));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `UMS_${testTypeName}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const copyToClipboard = async () => {
    const rows = buildRowsForColumns(allColumns.map(c => c.key));
    if (!rows.length) { toast.error('Nothing to copy'); return; }
    const headers = Object.keys(rows[0]);
    const text = [headers.join('\t'), ...rows.map(r => headers.map(h => r[h]).join('\t'))].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy, try Export instead');
    }
  };

  const runPrint = (columnKeys) => {
    const columns = columnKeys.map(k => allColumns.find(c => c.key === k)).filter(Boolean);
    const headers = ['S.N', ...columns.map(c => c.label)].map(h => `<th>${h}</th>`).join('');
    const rowsHtml = filteredData.map((r, i) => {
      const rowObj = buildExportRow(r, columns, i, testTypeName);
      const cells = ['S.N', ...columns.map(c => c.label)].map(label => `<td>${rowObj[label]}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html><html><head><title>${testTypeName} Bookings</title>
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
<h2>${testTypeName} Exam Bookings</h2>
<p>Printed ${new Date().toLocaleDateString()} &middot; ${filteredData.length} record(s)</p>
<table><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`;

    const win = window.open('', '_blank');
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
    () => loadRememberedColumns(allColumns) || allDefaultVisibleKeys,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPickerFor, allColumns, allDefaultVisibleKeys]
  );

  const handleColumnsConfirm = (selectedKeys, remember) => {
    if (remember) saveRememberedColumns(selectedKeys);
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

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading {testTypeName} bookings…</p></div>
  );

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
          {}
          <div className="export-group">
            {isIelts && canExportExcel && (
              <button className="export-btn" onClick={() => openColumnPicker('excel')} title="Export to Excel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Excel
              </button>
            )}
            {isIelts && canExportPdf && (
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
            <button className="export-btn" onClick={copyToClipboard} title="Copy to clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            {isIelts && canPrint && (
              <button className="export-btn" onClick={() => openColumnPicker('print')} title="Print">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
            )}
          </div>
          {isIelts && (
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
            <div className="filter-field">
              <label>Payment Status</label>
              <Select
                isMulti
                className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                options={withNotSet(effectiveOptionsByField.paymentStatus)}
                value={withNotSet(effectiveOptionsByField.paymentStatus).filter(o => filters.paymentStatus.includes(o.value))}
                onChange={opts => setFilters(f => ({ ...f, paymentStatus: (opts || []).map(o => o.value) }))}
                placeholder="All…"
              />
            </div>
            {!isDuolingo && (
              <div className="filter-field">
                <label>Voucher</label>
                <Select
                  isMulti
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={withNotSet(effectiveOptionsByField.voucher)}
                  value={withNotSet(effectiveOptionsByField.voucher).filter(o => filters.voucher.includes(o.value))}
                  onChange={opts => setFilters(f => ({ ...f, voucher: (opts || []).map(o => o.value) }))}
                  placeholder="All…"
                />
              </div>
            )}
            {isDuolingo && (
              <div className="filter-field">
                <label>Duolingo Voucher</label>
                <Select
                  isMulti
                  className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
                  options={withNotSet(effectiveOptionsByField.duolingoVoucher)}
                  value={withNotSet(effectiveOptionsByField.duolingoVoucher).filter(o => filters.duolingoVoucher.includes(o.value))}
                  onChange={opts => setFilters(f => ({ ...f, duolingoVoucher: (opts || []).map(o => o.value) }))}
                  placeholder="All…"
                />
              </div>
            )}
            <div className="filter-field">
              <label>Remarks</label>
              <div className="filter-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search remarks…"
                  value={filters.remarksSearch} onChange={e => setFilters(f => ({ ...f, remarksSearch: e.target.value }))} />
              </div>
            </div>
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
            <div className="filter-field">
              <label>Date From</label>
              <input type="date" className="filter-text-input" value={filters.dateFrom}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Date To</label>
              <input type="date" className="filter-text-input" value={filters.dateTo}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Booking Date From</label>
              <input type="date" className="filter-text-input" value={filters.bookingDateFrom}
                onChange={e => setFilters(f => ({ ...f, bookingDateFrom: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Booking Date To</label>
              <input type="date" className="filter-text-input" value={filters.bookingDateTo}
                onChange={e => setFilters(f => ({ ...f, bookingDateTo: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Exam Date From</label>
              <input type="date" className="filter-text-input" value={filters.examDateFrom}
                onChange={e => setFilters(f => ({ ...f, examDateFrom: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Exam Date To</label>
              <input type="date" className="filter-text-input" value={filters.examDateTo}
                onChange={e => setFilters(f => ({ ...f, examDateTo: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Payment Date From</label>
              <input type="date" className="filter-text-input" value={filters.paymentDateFrom}
                onChange={e => setFilters(f => ({ ...f, paymentDateFrom: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Payment Date To</label>
              <input type="date" className="filter-text-input" value={filters.paymentDateTo}
                onChange={e => setFilters(f => ({ ...f, paymentDateTo: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Payment Date to BC From</label>
              <input type="date" className="filter-text-input" value={filters.paymentDateToBCFrom}
                onChange={e => setFilters(f => ({ ...f, paymentDateToBCFrom: e.target.value }))} />
            </div>
            <div className="filter-field">
              <label>Payment Date to BC To</label>
              <input type="date" className="filter-text-input" value={filters.paymentDateToBCTo}
                onChange={e => setFilters(f => ({ ...f, paymentDateToBCTo: e.target.value }))} />
            </div>
            <div className="filter-field tp-filter-search-btn-wrap">
              <label>&nbsp;</label>
              <button type="button" className="add-record-btn" onClick={() => setPage(1)}>Search</button>
            </div>
          </div>
        </div>
      )}

      <div className="tp-totals-bar">
        <div className="tp-total-chip"><span>Total Records</span><strong>{totals.records}</strong></div>
        <div className="tp-total-chip"><span>Total Payment</span><strong>{totals.paymentAmount.toLocaleString()}</strong></div>
        <div className="tp-total-chip"><span>Total Margin</span><strong>{totals.margin.toLocaleString()}</strong></div>
        <div className="tp-total-chip"><span>Total Paid to BC</span><strong>{totals.paidToBC.toLocaleString()}</strong></div>
        <div className="tp-total-chip"><span>Total Received</span><strong>{totals.receivedAmount.toLocaleString()}</strong></div>
        <div className="tp-total-chip"><span>Total Cost</span><strong>{totals.cost.toLocaleString()}</strong></div>
      </div>

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
                  className={sortConfig.key === col.key ? 'sorted' : ''}
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
                  <td key={col.key} className={cellClassName(col)}>{renderCellContent(col, row, testTypeName)}</td>
                ))}
                <td className="td-row-actions">
                  {isIelts && (
                    <button
                      className={`row-btn receipt-dot ${receiptStatus[row._id] ? 'has-receipt' : 'no-receipt'}`}
                      onClick={() => openReceipt(row)}
                      title={receiptStatus[row._id] ? 'View saved receipt' : 'Add receipt'}
                    >
                      <span className="receipt-dot-marker" />
                    </button>
                  )}
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
          suggestions={suggestions}
          customFieldDefs={effectiveCustomFieldDefs}
          paymentStatusOptions={effectiveOptionsByField.paymentStatus}
          moduleOptions={effectiveOptionsByField.module}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditRow(null); }}
        />
      )}

      {viewRow && (
        <TestPrepDetailsModal
          row={viewRow}
          testTypeName={testTypeName}
          customFieldDefs={effectiveCustomFieldDefs}
          onClose={() => setViewRow(null)}
          onEdit={() => { setEditRow(viewRow); setViewRow(null); setShowForm(true); }}
        />
      )}

      {viewReceipt && (
        <ReceiptDocument
          receipt={viewReceipt.receipt}
          dayReceipts={viewReceipt.dayReceipts}
          daySummary={viewReceipt.daySummary}
          testTypeName={testTypeName}
          onClose={() => setViewReceipt(null)}
        />
      )}

      {showBulkEdit && (
        <TestPrepBulkEditModal
          count={selectedIds.size}
          testTypeName={testTypeName}
          suggestions={suggestions}
          customFieldDefs={effectiveCustomFieldDefs}
          paymentStatusOptions={effectiveOptionsByField.paymentStatus}
          moduleOptions={effectiveOptionsByField.module}
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
          fields={TEST_PREP_IMPORT_FIELDS}
          customFields={effectiveCustomFieldDefs}
          requiredField={{ key: 'candidateName', label: 'Candidate Name' }}
          dateFields={['date', 'bookingDate', 'examDate', 'paymentDate', 'paymentDateToBC', 'expiryDate']}
          optionsByField={{
            paymentStatus: effectiveOptionsByField.paymentStatus,
            module: effectiveOptionsByField.module,
            voucher: effectiveOptionsByField.voucher,
            duolingoVoucher: effectiveOptionsByField.duolingoVoucher,
          }}
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
