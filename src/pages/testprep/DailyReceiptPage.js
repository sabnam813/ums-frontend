import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReceiptDocument from '../../components/testprep/ReceiptDocument';
import './DailyReceiptPage.css';

function getCustomField(record, ...candidateKeys) {
  const fields = record?.customFields || {};
  for (const key of candidateKeys) {
    const hit = Object.keys(fields).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === key.toLowerCase().replace(/[^a-z]/g, ''));
    if (hit && fields[hit]) return fields[hit];
  }
  return '';
}

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

function fmtDate(d) {
  if (!d) return '—';
  try { return format(new Date(d), 'd-MMM-yyyy'); } catch { return '—'; }
}

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN');
}

function groupDayReceipts(receipts) {
  const groups = {};
  receipts.forEach(r => {
    const key = `${r.test || '—'} / ${r.type || '—'} / ${r.module || '—'}`;
    if (!groups[key]) groups[key] = { key, rows: [] };
    groups[key].rows.push(r);
  });
  return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
}

function ReceiptForm({ student, testTypeName, existing, onSave, onClose }) {
  const [quotedPrice, setQuotedPrice] = useState(existing?.quotedPrice ?? '');
  const [collectedPrice, setCollectedPrice] = useState(existing?.collectedPrice ?? '');
  const [associates, setAssociates] = useState(existing?.associates ?? student?.associates ?? '');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? '');
  const [remarks, setRemarks] = useState(existing?.remarks ?? student?.remarks ?? '');
  const [saving, setSaving] = useState(false);

  const margin = (Number(collectedPrice) || 0) - (Number(quotedPrice) || 0);

  const passportNo = getCustomField(student, 'passportNumber', 'passportNo', 'passport');
  const type = getCustomField(student, 'type', 'examType', 'moduleType');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        student: student._id,
        testType: student.testType,
        candidateName: student.candidateName,
        referenceNumber: student.referenceNumber,
        passportNo,
        examDate: student.examDate,
        test: testTypeName,
        type,
        module: student.module,
        place: student.place,
        quotedPrice: Number(quotedPrice) || 0,
        collectedPrice: Number(collectedPrice) || 0,
        associates,
        paidBy,
        remarks,
        receiptWrittenDate: new Date().toISOString(),
      };
      const res = await axios.post('/ielts-receipts', payload);
      toast.success('Receipt saved');
      onSave(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drp-form-modal animate-fade">
        <div className="drp-form-header">
          <h3>{existing ? 'Edit Receipt' : 'Add Receipt'}</h3>
          <button className="drp-close" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="drp-form">
          <div className="drp-autofill-panel">
            <div><span>Name</span><strong>{student.candidateName}</strong></div>
            <div><span>Reference No.</span><strong>{student.referenceNumber || '—'}</strong></div>
            <div><span>Passport No.</span><strong>{passportNo || '—'}</strong></div>
            <div><span>Booking Date</span><strong>{fmtDate(student.examDate)}</strong></div>
            <div><span>Test</span><strong>{testTypeName}</strong></div>
            <div><span>Type</span><strong>{type || '—'}</strong></div>
            <div><span>Module</span><strong>{student.module || '—'}</strong></div>
            <div><span>Place</span><strong>{student.place || '—'}</strong></div>
          </div>

          <div className="drp-grid-3">
            <div className="drp-field">
              <label>Quoted Price</label>
              <input type="number" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} placeholder="0" />
            </div>
            <div className="drp-field">
              <label>Collected Price</label>
              <input type="number" value={collectedPrice} onChange={e => setCollectedPrice(e.target.value)} placeholder="0" />
            </div>
            <div className="drp-field">
              <label>Margin</label>
              <input type="text" value={margin.toLocaleString('en-IN')} disabled className={margin >= 0 ? 'positive' : 'negative'} />
            </div>
          </div>

          <div className="drp-grid-2">
            <div className="drp-field">
              <label>Associates</label>
              <input type="text" value={associates} onChange={e => setAssociates(e.target.value)} placeholder="Associate name" />
            </div>
            <div className="drp-field">
              <label>Paid By</label>
              <input type="text" value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Cash / Bank / eSewa…" />
            </div>
          </div>

          <div className="drp-field">
            <label>Remarks</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Optional notes" />
          </div>

          <div className="drp-form-actions">
            <button type="button" className="drp-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="drp-btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DailyReceiptPage() {
  const { slug } = useParams();
  const location = useLocation();
  const preselectStudentId = location.state?.studentId;

  const [bookingDate, setBookingDate] = useState(location.state?.examDate || todayISO());
  const [loading, setLoading] = useState(true);
  const [testType, setTestType] = useState(null);
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState({});
  const [summary, setSummary] = useState(null);
  const [formStudent, setFormStudent] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [summaryDraft, setSummaryDraft] = useState({ paidOnDate: '', preparedBy: '', checkedBy: '', approvedBy: '' });
  const [savingSummary, setSavingSummary] = useState(false);
  const [deletingReceipt, setDeletingReceipt] = useState(null);
  const [deletingSummary, setDeletingSummary] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/ielts-receipts/by-date/${slug}`, { params: { examDate: bookingDate } });
      setTestType(res.data.testType);
      setStudents(res.data.students || []);
      setReceipts(res.data.receipts || {});
      setSummary(res.data.summary);
      setSummaryDraft({
        paidOnDate: res.data.summary?.paidOnDate ? format(new Date(res.data.summary.paidOnDate), 'yyyy-MM-dd') : '',
        preparedBy: res.data.summary?.preparedBy || '',
        checkedBy: res.data.summary?.checkedBy || '',
        approvedBy: res.data.summary?.approvedBy || '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load booking date');
    } finally {
      setLoading(false);
    }
  }, [slug, bookingDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (preselectStudentId && students.length) {
      const s = students.find(st => st._id === preselectStudentId);
      if (s && !receipts[s._id]) setFormStudent(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectStudentId, students]);

  const testTypeName = testType?.name || '…';
  const dayReceiptList = useMemo(() => Object.values(receipts), [receipts]);

  const dayTotals = dayReceiptList.reduce((acc, r) => {
    acc.quoted += Number(r.quotedPrice) || 0;
    acc.collected += Number(r.collectedPrice) || 0;
    acc.margin += Number(r.margin) || 0;
    return acc;
  }, { quoted: 0, collected: 0, margin: 0 });

  const groups = useMemo(() => groupDayReceipts(dayReceiptList), [dayReceiptList]);

  const handleSaveReceipt = (receipt) => {
    setReceipts(prev => ({ ...prev, [receipt.student]: receipt }));
    setFormStudent(null);
  };

  const handleDeleteReceipt = async (studentId) => {
    const receipt = receipts[studentId];
    if (!receipt) return;
    if (!window.confirm('Delete this receipt? This cannot be undone.')) return;
    setDeletingReceipt(studentId);
    try {
      await axios.delete(`/ielts-receipts/${receipt._id}`);
      setReceipts(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      toast.success('Receipt deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete receipt');
    } finally {
      setDeletingReceipt(null);
    }
  };

  const handleDeleteSummary = async () => {
    if (!summary) return;
    if (!window.confirm('Clear the day summary sign-off (Paid on Date, Prepared/Checked/Approved by)? Student receipts are not affected.')) return;
    setDeletingSummary(true);
    try {
      await axios.delete(`/ielts-receipts/day-summary/${slug}`, { data: { examDate: bookingDate } });
      setSummary(null);
      setSummaryDraft({ paidOnDate: '', preparedBy: '', checkedBy: '', approvedBy: '' });
      toast.success('Day summary cleared');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete day summary');
    } finally {
      setDeletingSummary(false);
    }
  };

  const saveSummary = async () => {
    setSavingSummary(true);
    try {
      const res = await axios.put(`/ielts-receipts/day-summary/${slug}`, { examDate: bookingDate, ...summaryDraft });
      setSummary(res.data);
      toast.success('Day summary saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save day summary');
    } finally {
      setSavingSummary(false);
    }
  };

  const dateLabel = fmtDate(bookingDate);
  const fileBase = `${testTypeName}_DailyReceipt_${bookingDate}`;

  const exportDailyPDF = () => {
    if (dayReceiptList.length === 0) { toast.error('No receipts to export'); return; }
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 16;
    doc.setFontSize(14);
    doc.text(`${testTypeName} Daily Receipt — ${dateLabel}`, 14, y);
    doc.setFontSize(9);
    doc.text(`${dayReceiptList.length} receipt(s)  |  Quoted: ${fmtMoney(dayTotals.quoted)}  Collected: ${fmtMoney(dayTotals.collected)}  Difference: ${fmtMoney(dayTotals.margin)}`, 14, y + 7);

    doc.autoTable({
      startY: y + 13,
      head: [['S.N', 'Name', 'Reference No.', 'Passport No.', 'Test', 'Type', 'Module', 'Place', 'Quoted', 'Collected', 'Margin', 'Associates', 'Paid By', 'Remarks']],
      body: dayReceiptList.map((r, i) => [
        i + 1, r.candidateName || '—', r.referenceNumber || '—', r.passportNo || '—',
        r.test || '—', r.type || '—', r.module || '—', r.place || '—',
        fmtMoney(r.quotedPrice), fmtMoney(r.collectedPrice), fmtMoney(r.margin),
        r.associates || '—', r.paidBy || '—', r.remarks || '—',
      ]),
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });

    const groupBody = groups.map(g => {
      const t = g.rows.reduce((a, r) => { a.q += Number(r.quotedPrice) || 0; a.c += Number(r.collectedPrice) || 0; return a; }, { q: 0, c: 0 });
      return [g.key, g.rows.length, fmtMoney(t.q), fmtMoney(t.c), fmtMoney(t.c - t.q)];
    });
    groupBody.push(['Day Total', dayReceiptList.length, fmtMoney(dayTotals.quoted), fmtMoney(dayTotals.collected), fmtMoney(dayTotals.margin)]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Test / Type / Module', 'Students', 'Quoted Total', 'Collected Total', 'Difference']],
      body: groupBody,
      headStyles: { fillColor: [63, 125, 92], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      margin: { left: 8, right: 8 },
    });

    let fy = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.text(`Paid on Date: ${fmtDate(summary?.paidOnDate)}`, 14, fy);
    fy += 6;
    doc.text(`Prepared by: ${summary?.preparedBy || '—'}     Checked by: ${summary?.checkedBy || '—'}     Approved by: ${summary?.approvedBy || '—'}`, 14, fy);

    doc.save(`${fileBase}.pdf`);
    toast.success('PDF downloaded');
  };

  const exportDailyExcel = () => {
    if (dayReceiptList.length === 0) { toast.error('No receipts to export'); return; }
    const wb = XLSX.utils.book_new();
    const rows = [
      [`${testTypeName} Daily Receipt — ${dateLabel}`],
      [],
      ['S.N', 'Name', 'Reference No.', 'Passport No.', 'Test', 'Type', 'Module', 'Place', 'Quoted', 'Collected', 'Margin', 'Associates', 'Paid By', 'Remarks'],
      ...dayReceiptList.map((r, i) => [
        i + 1, r.candidateName || '—', r.referenceNumber || '—', r.passportNo || '—',
        r.test || '—', r.type || '—', r.module || '—', r.place || '—',
        Number(r.quotedPrice) || 0, Number(r.collectedPrice) || 0, Number(r.margin) || 0,
        r.associates || '—', r.paidBy || '—', r.remarks || '—',
      ]),
      ['', 'TOTAL', '', '', '', '', '', '', dayTotals.quoted, dayTotals.collected, dayTotals.margin, '', '', ''],
      [],
      ['Group Summary'],
      ['Test / Type / Module', 'Students', 'Quoted Total', 'Collected Total', 'Difference'],
      ...groups.map(g => {
        const t = g.rows.reduce((a, r) => { a.q += Number(r.quotedPrice) || 0; a.c += Number(r.collectedPrice) || 0; return a; }, { q: 0, c: 0 });
        return [g.key, g.rows.length, t.q, t.c, t.c - t.q];
      }),
      ['Day Total', dayReceiptList.length, dayTotals.quoted, dayTotals.collected, dayTotals.margin],
      [],
      ['Paid on Date', fmtDate(summary?.paidOnDate)],
      ['Prepared by', summary?.preparedBy || '—', 'Checked by', summary?.checkedBy || '—', 'Approved by', summary?.approvedBy || '—'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Receipts');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
    toast.success('Excel downloaded');
  };

  const printDailyReceipt = () => {
    if (dayReceiptList.length === 0) { toast.error('No receipts to print'); return; }
    const groupRows = groups.map(g => {
      const t = g.rows.reduce((a, r) => { a.q += Number(r.quotedPrice) || 0; a.c += Number(r.collectedPrice) || 0; return a; }, { q: 0, c: 0 });
      return `<tr><td>${g.key}</td><td>${g.rows.length}</td><td>${fmtMoney(t.q)}</td><td>${fmtMoney(t.c)}</td><td>${fmtMoney(t.c - t.q)}</td></tr>`;
    }).join('');

    const receiptRows = dayReceiptList.map((r, i) => `
      <tr>
        <td>${i + 1}</td><td>${r.candidateName || '—'}</td><td>${r.referenceNumber || '—'}</td><td>${r.passportNo || '—'}</td>
        <td>${r.test || '—'}</td><td>${r.type || '—'}</td><td>${r.module || '—'}</td><td>${r.place || '—'}</td>
        <td>${fmtMoney(r.quotedPrice)}</td><td>${fmtMoney(r.collectedPrice)}</td><td>${fmtMoney(r.margin)}</td>
        <td>${r.associates || '—'}</td><td>${r.paidBy || '—'}</td><td>${r.remarks || '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>${testTypeName} Daily Receipt ${dateLabel}</title>
<style>
@page { size: A3 landscape; margin: 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; color: #000; }
h2, h3 { margin: 0 0 4px; }
h2 { font-size: 13px; }
h3 { font-size: 10px; margin-top: 10px; }
p { margin: 0 0 6px; color: #555; font-size: 8px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
th, td { border: 1px solid #ccc; padding: 2px 4px; text-align: left; word-wrap: break-word; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
.sign { margin-top: 8px; font-size: 8px; display: flex; gap: 24px; }
</style></head><body>
<h2>${testTypeName} Daily Receipt — ${dateLabel}</h2>
<p>${dayReceiptList.length} receipt(s) &nbsp;|&nbsp; Quoted: ${fmtMoney(dayTotals.quoted)} &nbsp; Collected: ${fmtMoney(dayTotals.collected)} &nbsp; Difference: ${fmtMoney(dayTotals.margin)}</p>
<table>
  <thead><tr><th>S.N</th><th>Name</th><th>Ref No.</th><th>Passport</th><th>Test</th><th>Type</th><th>Module</th><th>Place</th><th>Quoted</th><th>Collected</th><th>Margin</th><th>Associates</th><th>Paid By</th><th>Remarks</th></tr></thead>
  <tbody>${receiptRows}</tbody>
</table>
<h3>Group Summary</h3>
<table>
  <thead><tr><th>Test / Type / Module</th><th>Students</th><th>Quoted Total</th><th>Collected Total</th><th>Difference</th></tr></thead>
  <tbody>${groupRows}<tr><td><strong>Day Total</strong></td><td><strong>${dayReceiptList.length}</strong></td><td><strong>${fmtMoney(dayTotals.quoted)}</strong></td><td><strong>${fmtMoney(dayTotals.collected)}</strong></td><td><strong>${fmtMoney(dayTotals.margin)}</strong></td></tr></tbody>
</table>
<div class="sign">
  <span>Paid on Date: <strong>${fmtDate(summary?.paidOnDate)}</strong></span>
  <span>Prepared by: <strong>${summary?.preparedBy || '—'}</strong></span>
  <span>Checked by: <strong>${summary?.checkedBy || '—'}</strong></span>
  <span>Approved by: <strong>${summary?.approvedBy || '—'}</strong></span>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  return (
    <div className="drp-root">
      <div className="drp-topbar">
        <div>
          <p className="drp-breadcrumb"><Link to={`/test-prep/${slug}`}>{testTypeName}</Link> / Daily Receipts</p>
          <h1>Daily Receipt: {testTypeName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="drp-date-picker">
            <label>Booking Date</label>
            <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
          </div>
          {!loading && dayReceiptList.length > 0 && (
            <div className="drp-export-group">
              <button className="drp-export-btn" onClick={exportDailyExcel} title="Export to Excel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                Excel
              </button>
              <button className="drp-export-btn" onClick={exportDailyPDF} title="Export to PDF">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                PDF
              </button>
              <button className="drp-export-btn" onClick={printDailyReceipt} title="Print">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="drp-loading">Loading…</div>
      ) : (
        <>
          {}
          <div className="drp-card">
            <div className="drp-card-header">
              <h2>Students registered on {format(new Date(bookingDate), 'd MMM yyyy')}</h2>
              <span className="drp-count">{students.length} student{students.length !== 1 ? 's' : ''}</span>
            </div>

            {students.length === 0 ? (
              <div className="drp-empty">No students are registered for this booking date.</div>
            ) : (
              <table className="drp-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Reference No.</th><th>Module</th><th>Place</th><th>Receipt</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const receipt = receipts[s._id];
                    const isDeleting = deletingReceipt === s._id;
                    return (
                      <tr key={s._id}>
                        <td>{s.candidateName}</td>
                        <td>{s.referenceNumber || '—'}</td>
                        <td>{s.module || '—'}</td>
                        <td>{s.place || '—'}</td>
                        <td>
                          <button
                            className={`drp-receipt-dot ${receipt ? 'has-receipt' : ''}`}
                            onClick={() => receipt ? setViewReceipt(receipt) : setFormStudent(s)}
                            title={receipt ? 'View saved receipt' : 'Add receipt'}
                            type="button"
                          >
                            <span className="dot" />
                            {receipt ? 'View' : 'Add Receipt'}
                          </button>
                        </td>
                        <td>
                          {receipt && (
                            <button
                              className="drp-delete-btn"
                              onClick={() => handleDeleteReceipt(s._id)}
                              disabled={isDeleting}
                              title="Delete receipt"
                              type="button"
                            >
                              {isDeleting ? (
                                <span className="drp-btn-spinner" />
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              )}
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {}
          <div className="drp-card">
            <div className="drp-card-header">
              <h2>Day Summary</h2>
              <span className="drp-count">{dayReceiptList.length} receipt{dayReceiptList.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="drp-totals">
              <div><span>Quoted Total</span><strong>{dayTotals.quoted.toLocaleString('en-IN')}</strong></div>
              <div><span>Collected Total</span><strong>{dayTotals.collected.toLocaleString('en-IN')}</strong></div>
              <div><span>Difference</span><strong className={dayTotals.margin >= 0 ? 'positive' : 'negative'}>{dayTotals.margin.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="drp-signoff-grid">
              <div className="drp-field">
                <label>Paid on Date</label>
                <input type="date" value={summaryDraft.paidOnDate} onChange={e => setSummaryDraft(d => ({ ...d, paidOnDate: e.target.value }))} />
              </div>
              <div className="drp-field">
                <label>Prepared by</label>
                <input type="text" value={summaryDraft.preparedBy} onChange={e => setSummaryDraft(d => ({ ...d, preparedBy: e.target.value }))} />
              </div>
              <div className="drp-field">
                <label>Checked by</label>
                <input type="text" value={summaryDraft.checkedBy} onChange={e => setSummaryDraft(d => ({ ...d, checkedBy: e.target.value }))} />
              </div>
              <div className="drp-field">
                <label>Approved by</label>
                <input type="text" value={summaryDraft.approvedBy} onChange={e => setSummaryDraft(d => ({ ...d, approvedBy: e.target.value }))} />
              </div>
            </div>

            <div className="drp-form-actions">
              {summary && (
                <button
                  className="drp-btn danger"
                  onClick={handleDeleteSummary}
                  disabled={deletingSummary}
                >
                  {deletingSummary ? 'Clearing…' : 'Clear Summary'}
                </button>
              )}
              <button className="drp-btn primary" onClick={saveSummary} disabled={savingSummary}>
                {savingSummary ? 'Saving…' : 'Save Day Summary'}
              </button>
            </div>
          </div>
        </>
      )}

      {formStudent && (
        <ReceiptForm
          student={formStudent}
          testTypeName={testTypeName}
          existing={receipts[formStudent._id]}
          onSave={handleSaveReceipt}
          onClose={() => setFormStudent(null)}
        />
      )}

      {viewReceipt && (
        <ReceiptDocument
          receipt={viewReceipt}
          dayReceipts={dayReceiptList}
          daySummary={summary}
          testTypeName={testTypeName}
          onClose={() => setViewReceipt(null)}
        />
      )}
    </div>
  );
}
