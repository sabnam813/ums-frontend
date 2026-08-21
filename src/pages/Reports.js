import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import CountryFlag from '../components/shared/CountryFlag';
import { toastExcel, toastPDF } from '../utils/exportHelpers';
import StickyScrollTrack from '../components/shared/StickyScrollTrack';
import useStickyScroll from '../hooks/useStickyScroll';
import SelectColumnsModal from '../components/shared/SelectColumnsModal';
import { loadRememberedColumns, saveRememberedColumns } from '../utils/exportColumnMemory';
import { FISCAL_YEARS, getFiscalYearRange } from '../utils/fiscalYear';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import '../pages/country/DataTable.css';
import './Reports.css';

const APPLICATION_REPORT_COLUMN_STORAGE_KEY = 'ums_report_application_export_columns';

const REPORT_TYPES = [
  { value: 'application', label: 'Application' },
  { value: 'inquiries', label: 'Inquiries' },
  { value: 'country-inquiry', label: 'Country-wise Inquiry' },
  { value: 'testprep', label: 'Test Preparation' },
];

const REPORT_TYPE_ICONS = {
  application: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  inquiries: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  testprep: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  'country-inquiry': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
};

const APPLICATION_STAT_FIELDS = [
  { key: 'totalProcessed', label: 'Application Processed' },
  { key: 'offerReceived', label: 'Offer Received' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'visaWaiting', label: 'Visa Waiting' },
  { key: 'visaGranted', label: 'Visa Granted' },
  { key: 'visaRejected', label: 'Visa Rejected' },
  { key: 'refundReceived', label: 'Refund Received' },
  { key: 'refundProcessing', label: 'Refund Processing' },
  { key: 'paymentComplete', label: 'Payment Complete' },
  { key: 'paymentIncomplete', label: 'Payment Incomplete' },
];

const APPLICATION_SUMMARY_CARDS = [
  { key: 'totalProcessed', label: 'Total Processed', accent: true },
  { key: 'offerReceived', label: 'Offer Received' },
  { key: 'visaGranted', label: 'Visa Granted', tone: 'positive' },
  { key: 'visaRejected', label: 'Visa Rejected', tone: 'negative' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'paymentComplete', label: 'Payment Complete', tone: 'positive' },
  { key: 'paymentIncomplete', label: 'Payment Incomplete', tone: 'negative' },
];

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

function dateRangeLabel(dateFrom, dateTo) {
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Until ${dateTo}`;
  return 'All time';
}

const EXPORT_TIMESTAMP = () => format(new Date(), 'yyyy-MM-dd');

export default function Reports() {
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY } = useFiscalYear();
  const { user } = useAuth();
  const canExportExcel = hasPermission(user, 'reports', 'exportExcel');
  const canExportPdf = hasPermission(user, 'reports', 'exportPdf');
  const canPrint = hasPermission(user, 'reports', 'print');
  const [reportType, setReportType] = useState('application');

  const [appColumnPickerFor, setAppColumnPickerFor] = useState(null);

  const [appFiscalYear, setAppFiscalYear] = useState(globalFY);
  const [appDateFrom, setAppDateFrom] = useState(() => getFiscalYearRange(globalFY).from);
  const [appDateTo, setAppDateTo] = useState(() => getFiscalYearRange(globalFY).to);
  const [appCountryFilter, setAppCountryFilter] = useState([]);
  const [appIntakeFilter, setAppIntakeFilter] = useState([]);
  const [appPaymentStatus, setAppPaymentStatus] = useState('');
  const [appLoading, setAppLoading] = useState(false);
  const [appReport, setAppReport] = useState(null);
  const [appError, setAppError] = useState('');

  const fetchApplicationReport = useCallback(async () => {
    setAppLoading(true);
    setAppError('');
    try {
      const params = {
        dateFrom: appDateFrom || undefined,
        dateTo: appDateTo || undefined,
      };
      if (appCountryFilter.length) params.country = appCountryFilter.join(',');
      if (appIntakeFilter.length) params.intake = appIntakeFilter.join(',');
      if (appPaymentStatus) params.paymentStatus = appPaymentStatus;
      const res = await axios.get('/reports/applications', { params });
      setAppReport(res.data);
    } catch (err) {
      setAppError(err.response?.data?.message || 'Failed to generate report');
      setAppReport(null);
      toast.error(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setAppLoading(false);
    }
  }, [appDateFrom, appDateTo, appCountryFilter, appIntakeFilter, appPaymentStatus]);

  useEffect(() => {
    if (reportType === 'application') fetchApplicationReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const [inqFiscalYear, setInqFiscalYear] = useState(globalFY);
  const [inqDateFrom, setInqDateFrom] = useState(() => getFiscalYearRange(globalFY).from);
  const [inqDateTo, setInqDateTo] = useState(() => getFiscalYearRange(globalFY).to);
  const [inqCountryFilter] = useState([]);
  const [inqLevelFilter, setInqLevelFilter] = useState([]);
  const [inqLoading, setInqLoading] = useState(false);
  const [inqReport, setInqReport] = useState(null);
  const [inqError, setInqError] = useState('');

  const fetchInquiryReport = useCallback(async () => {
    setInqLoading(true);
    setInqError('');
    try {
      const params = {
        dateFrom: inqDateFrom || undefined,
        dateTo: inqDateTo || undefined,
      };
      if (inqCountryFilter.length) params.country = inqCountryFilter.join(',');
      if (inqLevelFilter.length) params.level = inqLevelFilter.join(',');
      const res = await axios.get('/reports/inquiries', { params });
      setInqReport(res.data);
    } catch (err) {
      setInqError(err.response?.data?.message || 'Failed to generate report');
      setInqReport(null);
      toast.error(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setInqLoading(false);
    }
  }, [inqDateFrom, inqDateTo, inqCountryFilter, inqLevelFilter]);

  useEffect(() => {
    if (reportType === 'inquiries' || reportType === 'country-inquiry') fetchInquiryReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const [tpFiscalYear, setTpFiscalYear] = useState(globalFY);
  const [tpDateFrom, setTpDateFrom] = useState(() => getFiscalYearRange(globalFY).from);
  const [tpDateTo, setTpDateTo] = useState(() => getFiscalYearRange(globalFY).to);
  const [tpExamTypeFilter, setTpExamTypeFilter] = useState([]);
  const [tpLoading, setTpLoading] = useState(false);
  const [tpReport, setTpReport] = useState(null);
  const [tpError, setTpError] = useState('');

  const fetchTestPrepReport = useCallback(async () => {
    setTpLoading(true);
    setTpError('');
    try {
      const params = {
        dateFrom: tpDateFrom || undefined,
        dateTo: tpDateTo || undefined,
      };
      if (tpExamTypeFilter.length) params.examType = tpExamTypeFilter.join(',');
      const res = await axios.get('/reports/test-prep', { params });
      setTpReport(res.data);
    } catch (err) {
      setTpError(err.response?.data?.message || 'Failed to generate report');
      setTpReport(null);
      toast.error(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setTpLoading(false);
    }
  }, [tpDateFrom, tpDateTo, tpExamTypeFilter]);

  useEffect(() => {
    if (reportType === 'testprep') fetchTestPrepReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const handleGenerate = () => {
    if (reportType === 'application') fetchApplicationReport();
    if (reportType === 'inquiries' || reportType === 'country-inquiry') fetchInquiryReport();
    if (reportType === 'testprep') fetchTestPrepReport();
  };

  const appCountryOptions = useMemo(() => (appReport?.filterOptions?.countries || []).map(c => ({
    value: String(c._id), label: c.name, country: c,
  })), [appReport]);

  const appIntakeOptions = useMemo(() => (appReport?.filterOptions?.intakes || []).map(v => ({
    value: v, label: v,
  })), [appReport]);

  const inqLevelOptions = useMemo(() => (inqReport?.filterOptions?.levels || []).map(v => ({
    value: v, label: v,
  })), [inqReport]);

  const tpExamTypeOptions = useMemo(() => (tpReport?.filterOptions?.examTypes || []).map(t => ({
    value: String(t._id), label: t.name,
  })), [tpReport]);

  const appFilterLines = useMemo(() => {
    const filters = appReport?.filters || {};
    const countryNames = appCountryOptions
      .filter(o => (filters.country || []).includes(o.value))
      .map(o => o.label);
    const paymentLabel = filters.paymentStatus === 'complete' ? 'Complete'
      : filters.paymentStatus === 'incomplete' ? 'Incomplete' : 'All';
    return [
      `Date Range: ${dateRangeLabel(filters.dateFrom, filters.dateTo)}`,
      `Country: ${countryNames.length ? countryNames.join(', ') : 'All'}`,
      `Intake: ${(filters.intake || []).length ? filters.intake.join(', ') : 'All'}`,
      `Payment Status: ${paymentLabel}`,
    ];
  }, [appReport, appCountryOptions]);

  const inqFilterLines = useMemo(() => {
    const filters = inqReport?.filters || {};
    return [
      `Date Range: ${dateRangeLabel(filters.dateFrom, filters.dateTo)}`,
      `Country: ${(filters.country || []).length ? filters.country.join(', ') : 'All'}`,
      `Level: ${(filters.level || []).length ? filters.level.join(', ') : 'All'}`,
    ];
  }, [inqReport]);

  const tpFilterLines = useMemo(() => {
    const filters = tpReport?.filters || {};
    const examNames = tpExamTypeOptions
      .filter(o => (filters.examType || []).includes(o.value))
      .map(o => o.label);
    return [
      `Date Range: ${dateRangeLabel(filters.dateFrom, filters.dateTo)}`,
      `Exam Type: ${examNames.length ? examNames.join(', ') : 'All'}`,
    ];
  }, [tpReport, tpExamTypeOptions]);

  const hasAppData = appReport && appReport.countries && appReport.countries.length > 0;
  const hasInqData = !!inqReport;
  const hasTpData = !!tpReport;

  const pteBonusVoucherCount = tpReport?.pteBonusVoucherCount ?? 0;

  const appScroll = useStickyScroll([appReport, appLoading]);
  const countryInqScroll = useStickyScroll([inqReport, inqLoading]);

  const appStatFields = (selectedKeys) =>
    selectedKeys ? APPLICATION_STAT_FIELDS.filter(f => selectedKeys.includes(f.key)) : APPLICATION_STAT_FIELDS;

  const exportApplicationExcel = (selectedKeys) => {
    if (!appReport) return;
    const fields = appStatFields(selectedKeys);
    const header = ['Country', ...fields.map(f => f.label)];
    const dataRows = appReport.countries.map(c => [c.countryName, ...fields.map(f => c[f.key] ?? 0)]);
    const totalsRow = ['Grand Total', ...fields.map(f => appReport.grandTotal?.[f.key] ?? 0)];
    const aoa = [
      ['UCA Management System: Application Report'],
      ...appFilterLines.map(l => [l]),
      [`Generated: ${format(new Date(), 'PPP p')}`],
      [],
      header,
      ...dataRows,
      totalsRow,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Application Report');
    XLSX.writeFile(wb, `UMS_Application_Report_${EXPORT_TIMESTAMP()}.xlsx`);
    toastExcel();
  };

  const exportApplicationPDF = (selectedKeys) => {
    if (!appReport) return;
    const fields = appStatFields(selectedKeys);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Application Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    appFilterLines.forEach(line => { doc.text(line, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    y += 4;
    const cols = ['Country', ...fields.map(f => f.label)];
    const rows = appReport.countries.map(c => [c.countryName, ...fields.map(f => String(c[f.key] ?? 0))]);
    rows.push(['Grand Total', ...fields.map(f => String(appReport.grandTotal?.[f.key] ?? 0))]);
    doc.autoTable({
      startY: y + 3, head: [cols], body: rows,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`UMS_Application_Report_${EXPORT_TIMESTAMP()}.pdf`);
    toastPDF();
  };

  const printApplicationReport = (selectedKeys) => {
    if (!appReport) return;
    const fields = appStatFields(selectedKeys);
    const cols = ['Country', ...fields.map(f => f.label)];
    const headerHtml = cols.map(c => `<th>${c}</th>`).join('');
    const rowsHtml = appReport.countries.map(c => {
      const cells = [c.countryName, ...fields.map(f => c[f.key] ?? 0)]
        .map(v => `<td>${v}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    const totalCells = ['Grand Total', ...fields.map(f => appReport.grandTotal?.[f.key] ?? 0)]
      .map(v => `<td>${v}</td>`).join('');

    const printHtml = `<!DOCTYPE html>
<html><head><title>Application Report</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
table { border-collapse: collapse; width: 100%; margin-top: 10px; }
th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tfoot td { font-weight: 700; background: #eef4ff; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<h2>UCA Management System: Application Report</h2>
${appFilterLines.map(l => `<p>${l}</p>`).join('')}
<p>Generated: ${new Date().toLocaleString()}</p>
<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr>${totalCells}</tr></tfoot></table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const exportInquiryExcel = () => {
    if (!inqReport) return;
    const aoa = [
      ['UCA Management System: Inquiry Report'],
      ...inqFilterLines.map(l => [l]),
      [`Generated: ${format(new Date(), 'PPP p')}`],
      [],
      ['Total Inquiries', inqReport.totalInquiries ?? 0],
      [],
      ['Country', 'Inquiry Count'],
      ...(inqReport.countries || []).map(c => [c.country, c.count]),
      ['Total', inqReport.totalInquiries ?? 0],
      [],
      ['Level', 'Inquiry Count'],
      ...(inqReport.levels || []).map(l => [l.level, l.count]),
      ['Total', inqReport.totalInquiries ?? 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiry Report');
    XLSX.writeFile(wb, `UMS_Inquiry_Report_${EXPORT_TIMESTAMP()}.xlsx`);
    toastExcel();
  };

  const exportInquiryPDF = () => {
    if (!inqReport) return;
    const doc = new jsPDF({ orientation: 'portrait' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Inquiry Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    inqFilterLines.forEach(line => { doc.text(line, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    y += 4;
    doc.setFontSize(11);
    doc.text(`Total Inquiries: ${inqReport.totalInquiries ?? 0}`, 14, y + 4);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Country', 'Inquiry Count']],
      body: [
        ...(inqReport.countries || []).map(c => [c.country, String(c.count)]),
        ['Total', String(inqReport.totalInquiries ?? 0)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    const afterCountryY = doc.lastAutoTable.finalY + 8;
    doc.autoTable({
      startY: afterCountryY,
      head: [['Level', 'Inquiry Count']],
      body: [
        ...(inqReport.levels || []).map(l => [l.level, String(l.count)]),
        ['Total', String(inqReport.totalInquiries ?? 0)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    doc.save(`UMS_Inquiry_Report_${EXPORT_TIMESTAMP()}.pdf`);
    toastPDF();
  };

  const printInquiryReport = () => {
    if (!inqReport) return;
    const countryRows = (inqReport.countries || []).map(c => `<tr><td>${c.country}</td><td>${c.count}</td></tr>`).join('');
    const levelRows = (inqReport.levels || []).map(l => `<tr><td>${l.level}</td><td>${l.count}</td></tr>`).join('');

    const printHtml = `<!DOCTYPE html>
<html><head><title>Inquiry Report</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 16px; }
h3 { margin: 16px 0 6px; font-size: 12px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
.total-card { margin: 10px 0; font-size: 13px; font-weight: 700; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tfoot td { font-weight: 700; background: #eef4ff; }
</style></head><body>
<h2>UCA Management System: Inquiry Report</h2>
${inqFilterLines.map(l => `<p>${l}</p>`).join('')}
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="total-card">Total Inquiries: ${inqReport.totalInquiries ?? 0}</div>
<h3>Country-wise Inquiry Count</h3>
<table><thead><tr><th>Country</th><th>Inquiry Count</th></tr></thead>
<tbody>${countryRows}</tbody>
<tfoot><tr><td>Total</td><td>${inqReport.totalInquiries ?? 0}</td></tr></tfoot></table>
<h3>Level-wise Inquiry Count</h3>
<table><thead><tr><th>Level</th><th>Inquiry Count</th></tr></thead>
<tbody>${levelRows}</tbody>
<tfoot><tr><td>Total</td><td>${inqReport.totalInquiries ?? 0}</td></tr></tfoot></table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const exportCountryInquiryExcel = () => {
    if (!inqReport) return;
    const aoa = [
      ['UCA Management System: Country-wise Inquiry Report'],
      ...inqFilterLines.map(l => [l]),
      [`Generated: ${format(new Date(), 'PPP p')}`],
      [],
      ['Country', 'Inquiry Count'],
      ...(inqReport.countries || []).map(c => [c.country, c.count]),
      ['Total', inqReport.totalInquiries ?? 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Country-wise Inquiry');
    XLSX.writeFile(wb, `UMS_CountryWise_Inquiry_Report_${EXPORT_TIMESTAMP()}.xlsx`);
    toastExcel();
  };

  const exportCountryInquiryPDF = () => {
    if (!inqReport) return;
    const doc = new jsPDF({ orientation: 'portrait' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Country-wise Inquiry Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    inqFilterLines.forEach(line => { doc.text(line, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    y += 4;
    doc.setFontSize(11);
    doc.text(`Total Inquiries: ${inqReport.totalInquiries ?? 0}`, 14, y + 4);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Country', 'Inquiry Count']],
      body: [
        ...(inqReport.countries || []).map(c => [c.country, String(c.count)]),
        ['Total', String(inqReport.totalInquiries ?? 0)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    doc.save(`UMS_CountryWise_Inquiry_Report_${EXPORT_TIMESTAMP()}.pdf`);
    toastPDF();
  };

  const printCountryInquiryReport = () => {
    if (!inqReport) return;
    const countryRows = (inqReport.countries || []).map(c => `<tr><td>${c.country}</td><td>${c.count}</td></tr>`).join('');

    const printHtml = `<!DOCTYPE html>
<html><head><title>Country-wise Inquiry Report</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 16px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
.total-card { margin: 10px 0; font-size: 13px; font-weight: 700; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tfoot td { font-weight: 700; background: #eef4ff; }
</style></head><body>
<h2>UCA Management System: Country-wise Inquiry Report</h2>
${inqFilterLines.map(l => `<p>${l}</p>`).join('')}
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="total-card">Total Inquiries: ${inqReport.totalInquiries ?? 0}</div>
<table><thead><tr><th>Country</th><th>Inquiry Count</th></tr></thead>
<tbody>${countryRows}</tbody>
<tfoot><tr><td>Total</td><td>${inqReport.totalInquiries ?? 0}</td></tr></tfoot></table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const exportTestPrepExcel = () => {
    if (!tpReport) return;
    const aoa = [
      ['UCA Management System: Test Preparation Report'],
      ...tpFilterLines.map(l => [l]),
      [`Generated: ${format(new Date(), 'PPP p')}`],
      [],
      ['Total Bookings', tpReport.totalBookings ?? 0],
      ['PTE Bonus Voucher Count', pteBonusVoucherCount],
      [],
      ['Exam Type', 'Bookings'],
      ...(tpReport.examTypeBreakdown || []).map(r => [r.testTypeName, r.count]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test Preparation Report');
    XLSX.writeFile(wb, `UMS_TestPrep_Report_${EXPORT_TIMESTAMP()}.xlsx`);
    toastExcel();
  };

  const exportTestPrepPDF = () => {
    if (!tpReport) return;
    const doc = new jsPDF({ orientation: 'portrait' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Test Preparation Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    tpFilterLines.forEach(line => { doc.text(line, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    y += 4;
    doc.setFontSize(11);
    doc.text(`Total Bookings: ${tpReport.totalBookings ?? 0}   |   PTE Bonus Voucher: ${pteBonusVoucherCount}`, 14, y + 4);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Exam Type', 'Bookings']],
      body: [
        ...(tpReport.examTypeBreakdown || []).map(r => [r.testTypeName, String(r.count)]),
        ['Total', String(tpReport.totalBookings ?? 0)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    doc.save(`UMS_TestPrep_Report_${EXPORT_TIMESTAMP()}.pdf`);
    toastPDF();
  };

  const printTestPrepReport = () => {
    if (!tpReport) return;
    const examRows = (tpReport.examTypeBreakdown || []).map(r => `<tr><td>${r.testTypeName}</td><td>${r.count}</td></tr>`).join('');

    const printHtml = `<!DOCTYPE html>
<html><head><title>Test Preparation Report</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 16px; }
h3 { margin: 16px 0 6px; font-size: 12px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
.total-card { margin: 10px 0; font-size: 13px; font-weight: 700; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
th { background: #f0f0f0; font-weight: 600; }
tfoot td { font-weight: 700; background: #eef4ff; }
</style></head><body>
<h2>UCA Management System: Test Preparation Report</h2>
${tpFilterLines.map(l => `<p>${l}</p>`).join('')}
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="total-card">Total Bookings: ${tpReport.totalBookings ?? 0} &nbsp;|&nbsp; PTE Bonus Voucher: ${pteBonusVoucherCount}</div>
<h3>Exam Type Breakdown</h3>
<table><thead><tr><th>Exam Type</th><th>Bookings</th></tr></thead>
<tbody>${examRows}</tbody>
<tfoot><tr><td>Total</td><td>${tpReport.totalBookings ?? 0}</td></tr></tfoot></table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const exportGroup = (onExcel, onPDF, onPrint) => {
    if (!canExportExcel && !canExportPdf && !canPrint) return null;
    return (
      <div className="reports-export-group">
        {canExportExcel && (
          <button className="reports-export-btn" onClick={onExcel} title="Export to Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Excel
          </button>
        )}
        {canExportPdf && (
          <button className="reports-export-btn" onClick={onPDF} title="Export to PDF">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            PDF
          </button>
        )}
        {canPrint && (
          <button className="reports-export-btn" onClick={onPrint} title="Print">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Print
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="reports-page animate-fade">
      <div className="reports-header">
        <div className="reports-header-text">
          <h2>Reports</h2>
          <p></p>
        </div>
        <div className="reports-type-tabs" role="tablist" aria-label="Report type">
          {REPORT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={reportType === t.value}
              className={`reports-type-tab${reportType === t.value ? ' reports-type-tab-active' : ''}`}
              onClick={() => setReportType(t.value)}
            >
              <span className="reports-type-tab-icon">{REPORT_TYPE_ICONS[t.value]}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {}
      {reportType === 'application' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-date-field">
              <label>Fiscal Year (B.S.)</label>
              <select
                value={appFiscalYear}
                onChange={e => {
                  const fy = e.target.value;
                  const { from, to } = getFiscalYearRange(fy);
                  setGlobalFY(fy);
                  setAppFiscalYear(fy);
                  if (fy !== 'all') { setAppDateFrom(from); setAppDateTo(to); }
                  else { setAppDateFrom(''); setAppDateTo(''); }
                }}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
              >
                <option value='all'>All</option>
                {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
              </select>
            </div>
            <div className="reports-date-field">
              <label>From Date</label>
              <input type="date" value={appDateFrom} onChange={e => setAppDateFrom(e.target.value)} />
            </div>
            <div className="reports-date-field">
              <label>To Date</label>
              <input type="date" value={appDateTo} onChange={e => setAppDateTo(e.target.value)} />
            </div>
            <div className="reports-select-field">
              <label>Country</label>
              <Select
                isMulti
                className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
                options={appCountryOptions}
                value={appCountryOptions.filter(o => appCountryFilter.includes(o.value))}
                onChange={opts => setAppCountryFilter((opts || []).map(o => o.value))}
                placeholder="All countries…"
              />
            </div>
            <div className="reports-select-field">
              <label>Intake</label>
              <Select
                isMulti
                className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
                options={appIntakeOptions}
                value={appIntakeOptions.filter(o => appIntakeFilter.includes(o.value))}
                onChange={opts => setAppIntakeFilter((opts || []).map(o => o.value))}
                placeholder="All intakes…"
              />
            </div>
            <div className="reports-date-field">
              <label>Payment Status</label>
              <select
                value={appPaymentStatus}
                onChange={e => setAppPaymentStatus(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', width: '100%' }}
              >
                <option value="">All</option>
                <option value="complete">Complete</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>
            <button className="reports-generate-btn" onClick={handleGenerate} disabled={appLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
              </svg>
              {appLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {hasAppData && exportGroup(
              () => setAppColumnPickerFor('excel'),
              () => setAppColumnPickerFor('pdf'),
              () => setAppColumnPickerFor('print'),
            )}
          </div>

          {appLoading ? (
            <div className="reports-loading">
              <div className="reports-spinner" />
              <span>Generating report…</span>
            </div>
          ) : appError ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{appError}</p>
            </div>
          ) : !hasAppData ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No application records found for the selected filters.</p>
              <span>Try widening the date range or clearing filters above.</span>
            </div>
          ) : (
            <>
              <div className="reports-meta-row">
                <span>Showing data for: <strong>{dateRangeLabel(appReport.filters?.dateFrom, appReport.filters?.dateTo)}</strong></span>
                <span>{appReport.countries.length} countr{appReport.countries.length === 1 ? 'y' : 'ies'}</span>
              </div>

              <div className="reports-summary-cards">
                {APPLICATION_SUMMARY_CARDS.map(card => (
                  <div
                    key={card.key}
                    className={`reports-summary-card${card.accent ? ' reports-summary-card-accent' : ''}${card.tone ? ` reports-summary-card-${card.tone}` : ''}`}
                  >
                    <span className="reports-summary-label">{card.label}</span>
                    <span className="reports-summary-value">{appReport.grandTotal?.[card.key] ?? 0}</span>
                  </div>
                ))}
              </div>

              <div className="reports-table-wrap" ref={appScroll.wrapRef}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th className="reports-th-country">Country</th>
                      {APPLICATION_STAT_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {appReport.countries.map(c => (
                      <tr key={c.countryId}>
                        <td className="reports-td-country">
                          <CountryFlag country={c} size={20} rounded={3} />
                          <span>{c.countryName}</span>
                        </td>
                        {APPLICATION_STAT_FIELDS.map(f => (
                          <td key={f.key} className={f.key === 'totalProcessed' ? 'reports-td-strong' : ''}>
                            {c[f.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="reports-grand-total-row">
                      <td className="reports-td-country">Grand Total</td>
                      {APPLICATION_STAT_FIELDS.map(f => (
                        <td key={f.key} className="reports-td-strong">{appReport.grandTotal?.[f.key] ?? 0}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <StickyScrollTrack trackRef={appScroll.trackRef} trackStyle={appScroll.trackStyle} />
            </>
          )}
        </>
      )}

      {}
      {reportType === 'inquiries' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-date-field">
              <label>Fiscal Year (B.S.)</label>
              <select
                value={inqFiscalYear}
                onChange={e => {
                  const fy = e.target.value;
                  const { from, to } = getFiscalYearRange(fy);
                  setGlobalFY(fy);
                  setInqFiscalYear(fy);
                  if (fy !== 'all') { setInqDateFrom(from); setInqDateTo(to); }
                  else { setInqDateFrom(''); setInqDateTo(''); }
                }}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
              >
                <option value='all'>All</option>
                {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
              </select>
            </div>
            <div className="reports-date-field">
              <label>From Date</label>
              <input type="date" value={inqDateFrom} onChange={e => setInqDateFrom(e.target.value)} />
            </div>
            <div className="reports-date-field">
              <label>To Date</label>
              <input type="date" value={inqDateTo} onChange={e => setInqDateTo(e.target.value)} />
            </div>
            <div className="reports-select-field">
              <label>Level</label>
              <Select
                isClearable
                className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
                options={inqLevelOptions}
                value={inqLevelOptions.find(o => inqLevelFilter[0] === o.value) || null}
                onChange={opt => setInqLevelFilter(opt ? [opt.value] : [])}
                placeholder="All levels…"
              />
            </div>
            <button className="reports-generate-btn" onClick={handleGenerate} disabled={inqLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
              </svg>
              {inqLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {hasInqData && exportGroup(exportInquiryExcel, exportInquiryPDF, printInquiryReport)}
          </div>

          {inqLoading ? (
            <div className="reports-loading">
              <div className="reports-spinner" />
              <span>Generating report…</span>
            </div>
          ) : inqError ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{inqError}</p>
            </div>
          ) : !hasInqData ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No inquiry records found.</p>
            </div>
          ) : (
            <>
              <div className="reports-meta-row">
                <span>Showing data for: <strong>{dateRangeLabel(inqReport.filters?.dateFrom, inqReport.filters?.dateTo)}</strong></span>
                <span>{inqReport.totalInquiries} total inquir{inqReport.totalInquiries === 1 ? 'y' : 'ies'}</span>
              </div>

              {}
              <div className="reports-summary-cards">
                <div className="reports-summary-card reports-summary-card-accent">
                  <span className="reports-summary-label">Total Inquiries</span>
                  <span className="reports-summary-value">{inqReport.totalInquiries}</span>
                </div>
              </div>

              {inqReport.countries.length === 0 && inqReport.levels.length === 0 ? (
                <div className="reports-empty-state">
                  <p>No inquiries match the selected filters.</p>
                  <span>Try widening the date range or clearing filters above.</span>
                </div>
              ) : (
                <div className="reports-split-tables">
                  <div>
                    <h3 className="reports-subheading">Country Breakdown</h3>
                    <div className="reports-table-wrap">
                      <table className="reports-table reports-table-simple">
                        <thead>
                          <tr>
                            <th>Country</th>
                            <th>Inquiry Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inqReport.countries.map(c => (
                            <tr key={c.country}>
                              <td style={{ fontWeight: 600 }}>{c.country}</td>
                              <td className="reports-td-strong">{c.count}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="reports-grand-total-row">
                            <td>Total</td>
                            <td className="reports-td-strong">{inqReport.totalInquiries}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="reports-subheading">Level Breakdown</h3>
                    <div className="reports-table-wrap">
                      <table className="reports-table reports-table-simple">
                        <thead>
                          <tr>
                            <th>Level</th>
                            <th>Inquiry Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inqReport.levels.map(l => (
                            <tr key={l.level}>
                              <td style={{ fontWeight: 600 }}>{l.level}</td>
                              <td className="reports-td-strong">{l.count}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="reports-grand-total-row">
                            <td>Total</td>
                            <td className="reports-td-strong">{inqReport.totalInquiries}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {}
      {reportType === 'country-inquiry' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-date-field">
              <label>Fiscal Year (B.S.)</label>
              <select
                value={inqFiscalYear}
                onChange={e => {
                  const fy = e.target.value;
                  const { from, to } = getFiscalYearRange(fy);
                  setGlobalFY(fy);
                  setInqFiscalYear(fy);
                  if (fy !== 'all') { setInqDateFrom(from); setInqDateTo(to); }
                  else { setInqDateFrom(''); setInqDateTo(''); }
                }}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
              >
                <option value='all'>All</option>
                {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
              </select>
            </div>
            <div className="reports-date-field">
              <label>From Date</label>
              <input type="date" value={inqDateFrom} onChange={e => setInqDateFrom(e.target.value)} />
            </div>
            <div className="reports-date-field">
              <label>To Date</label>
              <input type="date" value={inqDateTo} onChange={e => setInqDateTo(e.target.value)} />
            </div>
            <button className="reports-generate-btn" onClick={handleGenerate} disabled={inqLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
              </svg>
              {inqLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {hasInqData && exportGroup(exportCountryInquiryExcel, exportCountryInquiryPDF, printCountryInquiryReport)}
          </div>

          {inqLoading ? (
            <div className="reports-loading">
              <div className="reports-spinner" />
              <span>Generating report…</span>
            </div>
          ) : inqError ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{inqError}</p>
            </div>
          ) : !hasInqData ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No inquiry records found.</p>
            </div>
          ) : (
            <>
              <div className="reports-meta-row">
                <span>Showing data for: <strong>{dateRangeLabel(inqReport.filters?.dateFrom, inqReport.filters?.dateTo)}</strong></span>
                <span>{inqReport.countries.length} countr{inqReport.countries.length === 1 ? 'y' : 'ies'}</span>
              </div>

              <div className="reports-summary-cards">
                <div className="reports-summary-card reports-summary-card-accent">
                  <span className="reports-summary-label">Total Inquiries</span>
                  <span className="reports-summary-value">{inqReport.totalInquiries}</span>
                </div>
              </div>

              {inqReport.countries.length === 0 ? (
                <div className="reports-empty-state">
                  <p>No inquiries match the selected filters.</p>
                  <span>Try widening the date range or clearing filters above.</span>
                </div>
              ) : (
                <>
                  <div className="reports-table-wrap" ref={countryInqScroll.wrapRef}>
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th className="reports-th-country">Country</th>
                          <th>Inquiry Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inqReport.countries.map(c => (
                          <tr key={c.country}>
                            <td className="reports-td-country">{c.country}</td>
                            <td className="reports-td-strong">{c.count}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="reports-grand-total-row">
                          <td className="reports-td-country">Total</td>
                          <td className="reports-td-strong">{inqReport.totalInquiries}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <StickyScrollTrack trackRef={countryInqScroll.trackRef} trackStyle={countryInqScroll.trackStyle} />
                </>
              )}
            </>
          )}
        </>
      )}

      {}
      {reportType === 'testprep' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-date-field">
              <label>Fiscal Year (B.S.)</label>
              <select
                value={tpFiscalYear}
                onChange={e => {
                  const fy = e.target.value;
                  const { from, to } = getFiscalYearRange(fy);
                  setGlobalFY(fy);
                  setTpFiscalYear(fy);
                  if (fy !== 'all') { setTpDateFrom(from); setTpDateTo(to); }
                  else { setTpDateFrom(''); setTpDateTo(''); }
                }}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
              >
                <option value='all'>All</option>
                {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
              </select>
            </div>
            <div className="reports-date-field">
              <label>From Date</label>
              <input type="date" value={tpDateFrom} onChange={e => setTpDateFrom(e.target.value)} />
            </div>
            <div className="reports-date-field">
              <label>To Date</label>
              <input type="date" value={tpDateTo} onChange={e => setTpDateTo(e.target.value)} />
            </div>
            <div className="reports-select-field">
              <label>Exam Type</label>
              <Select
                isMulti
                className="custom-select reports-select" classNamePrefix="react-select" {...menuPortalProps}
                options={tpExamTypeOptions}
                value={tpExamTypeOptions.filter(o => tpExamTypeFilter.includes(o.value))}
                onChange={opts => setTpExamTypeFilter((opts || []).map(o => o.value))}
                placeholder="All exam types…"
              />
            </div>
            <button className="reports-generate-btn" onClick={handleGenerate} disabled={tpLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
              </svg>
              {tpLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {hasTpData && exportGroup(exportTestPrepExcel, exportTestPrepPDF, printTestPrepReport)}
          </div>

          {tpLoading ? (
            <div className="reports-loading">
              <div className="reports-spinner" />
              <span>Generating report…</span>
            </div>
          ) : tpError ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{tpError}</p>
            </div>
          ) : !hasTpData ? (
            <div className="reports-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No test preparation records found.</p>
            </div>
          ) : (
            <>
              <div className="reports-meta-row">
                <span>Showing data for: <strong>{dateRangeLabel(tpReport.filters?.dateFrom, tpReport.filters?.dateTo)}</strong></span>
                <span>{tpReport.totalBookings} total booking{tpReport.totalBookings === 1 ? '' : 's'}</span>
              </div>

              {}
              <div className="reports-summary-cards">
                <div className="reports-summary-card reports-summary-card-accent">
                  <span className="reports-summary-label">Total Bookings</span>
                  <span className="reports-summary-value">{tpReport.totalBookings}</span>
                </div>
                {(tpReport.examTypeBreakdown || []).map(r => (
                  <div className="reports-summary-card" key={String(r.testTypeId)}>
                    <span className="reports-summary-label">{r.testTypeName}</span>
                    <span className="reports-summary-value">{r.count}</span>
                  </div>
                ))}
                <div className="reports-summary-card reports-summary-card-positive">
                  <span className="reports-summary-label">PTE Bonus Voucher Count</span>
                  <span className="reports-summary-value">{pteBonusVoucherCount}</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {appColumnPickerFor && (
        <SelectColumnsModal
          columns={APPLICATION_STAT_FIELDS.map(f => ({ key: f.key, label: f.label }))}
          initialSelected={loadRememberedColumns(APPLICATION_REPORT_COLUMN_STORAGE_KEY, APPLICATION_STAT_FIELDS.map(f => f.key)) || APPLICATION_STAT_FIELDS.map(f => f.key)}
          title={
            appColumnPickerFor === 'excel' ? 'Export to Excel'
              : appColumnPickerFor === 'pdf' ? 'Export to PDF'
              : 'Print Report'
          }
          actionLabel={
            appColumnPickerFor === 'excel' ? 'Export to Excel'
              : appColumnPickerFor === 'pdf' ? 'Export to PDF'
              : 'Print'
          }
          onConfirm={(selectedKeys, remember) => {
            if (remember) saveRememberedColumns(APPLICATION_REPORT_COLUMN_STORAGE_KEY, selectedKeys);
            const target = appColumnPickerFor;
            setAppColumnPickerFor(null);
            if (target === 'excel') exportApplicationExcel(selectedKeys);
            else if (target === 'pdf') exportApplicationPDF(selectedKeys);
            else if (target === 'print') printApplicationReport(selectedKeys);
          }}
          onClose={() => setAppColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
