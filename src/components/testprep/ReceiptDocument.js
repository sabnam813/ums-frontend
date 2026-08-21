import React from 'react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './ReceiptDocument.css';

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
    if (!groups[key]) groups[key] = { key, test: r.test, type: r.type, module: r.module, rows: [] };
    groups[key].rows.push(r);
  });
  return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
}

export default function ReceiptDocument({ receipt, dayReceipts = [], daySummary, testTypeName, orgName = 'UniConsultants Alliance', onClose }) {
  const groups = groupDayReceipts(dayReceipts);
  const dayTotals = dayReceipts.reduce((acc, r) => {
    acc.quoted += Number(r.quotedPrice) || 0;
    acc.collected += Number(r.collectedPrice) || 0;
    acc.margin += Number(r.margin) || 0;
    return acc;
  }, { quoted: 0, collected: 0, margin: 0 });

  const printableId = 'receipt-printable';
  const studentFileName = `${testTypeName}_Receipt_${(receipt.candidateName || 'record').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}`;
  const dailyFileName = `${testTypeName}_DailyReceipt_${fmtDate(receipt.examDate).replace(/\s+/g, '_')}`;

  const exportStudentPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 16;
    doc.setFontSize(14);
    doc.text(`${testTypeName} Registration Receipt`, 14, y);
    y += 4;

    doc.autoTable({
      startY: y + 4,
      head: [['Reference No.', 'Passport No.', 'Name', 'Exam Date', 'Test', 'Type', 'Module', 'Place']],
      body: [[
        receipt.referenceNumber || '—', receipt.passportNo || '—', receipt.candidateName || '—',
        fmtDate(receipt.examDate), receipt.test || testTypeName, receipt.type || '—',
        receipt.module || '—', receipt.place || '—',
      ]],
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      margin: { left: 10, right: 10 },
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Quoted Price', 'Collected Price', 'Margin', 'Associates', 'Paid By', 'Remarks', 'Receipt Written Date']],
      body: [[
        fmtMoney(receipt.quotedPrice), fmtMoney(receipt.collectedPrice), fmtMoney(receipt.margin),
        receipt.associates || '—', receipt.paidBy || '—', receipt.remarks || '—', fmtDate(receipt.receiptWrittenDate),
      ]],
      headStyles: { fillColor: [240, 134, 65], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      margin: { left: 10, right: 10 },
    });

    doc.save(`${studentFileName}.pdf`);
    toast.success('Student receipt downloaded as PDF');
  };

  const exportDailyPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`${testTypeName} Daily Receipt — ${fmtDate(receipt.examDate)}`, 14, 16);

    doc.autoTable({
      startY: 22,
      head: [['Test / Type / Module', 'Students', 'Quoted Total', 'Collected Total', 'Difference']],
      body: groups.map(g => {
        const t = g.rows.reduce((a, r) => {
          a.quoted += Number(r.quotedPrice) || 0;
          a.collected += Number(r.collectedPrice) || 0;
          return a;
        }, { quoted: 0, collected: 0 });
        return [g.key, g.rows.length, fmtMoney(t.quoted), fmtMoney(t.collected), fmtMoney(t.collected - t.quoted)];
      }).concat([['Day Total', dayReceipts.length, fmtMoney(dayTotals.quoted), fmtMoney(dayTotals.collected), fmtMoney(dayTotals.margin)]]),
      headStyles: { fillColor: [63, 125, 92], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      margin: { left: 10, right: 10 },
    });

    let fy = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.text(`Paid on Date: ${fmtDate(daySummary?.paidOnDate)}`, 14, fy);
    fy += 6;
    doc.text(`Prepared by: ${daySummary?.preparedBy || '—'}     Checked by: ${daySummary?.checkedBy || '—'}     Approved by: ${daySummary?.approvedBy || '—'}`, 14, fy);

    doc.save(`${dailyFileName}.pdf`);
    toast.success('Daily receipt downloaded as PDF');
  };

  const exportStudentExcel = () => {
    const wb = XLSX.utils.book_new();
    const infoRows = [
      [`${testTypeName} Registration Receipt`],
      [],
      ['Registration Information'],
      ['Reference No.', 'Passport No.', 'Name', 'Exam Date', 'Test', 'Type', 'Module', 'Place'],
      [
        receipt.referenceNumber || '—', receipt.passportNo || '—', receipt.candidateName || '—',
        fmtDate(receipt.examDate), receipt.test || testTypeName, receipt.type || '—',
        receipt.module || '—', receipt.place || '—',
      ],
      [],
      ['Accounting Calculations'],
      ['Quoted Price', 'Collected Price', 'Margin', 'Associates', 'Paid By', 'Remarks', 'Receipt Written Date'],
      [
        Number(receipt.quotedPrice) || 0, Number(receipt.collectedPrice) || 0, Number(receipt.margin) || 0,
        receipt.associates || '—', receipt.paidBy || '—', receipt.remarks || '—', fmtDate(receipt.receiptWrittenDate),
      ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(infoRows);
    ws1['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Receipt');
    XLSX.writeFile(wb, `${studentFileName}.xlsx`);
    toast.success('Student receipt downloaded as Excel');
  };

  const exportDailyExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ['Day Summary', fmtDate(receipt.examDate)],
      [],
      ['Test / Type / Module', 'Students', 'Quoted Total', 'Collected Total', 'Difference'],
      ...groups.map(g => {
        const t = g.rows.reduce((a, r) => {
          a.quoted += Number(r.quotedPrice) || 0;
          a.collected += Number(r.collectedPrice) || 0;
          return a;
        }, { quoted: 0, collected: 0 });
        return [g.key, g.rows.length, t.quoted, t.collected, t.collected - t.quoted];
      }),
      ['Day Total', dayReceipts.length, dayTotals.quoted, dayTotals.collected, dayTotals.margin],
      [],
      ['Paid on Date', fmtDate(daySummary?.paidOnDate)],
      ['Prepared by', daySummary?.preparedBy || '—', 'Checked by', daySummary?.checkedBy || '—', 'Approved by', daySummary?.approvedBy || '—'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Day Summary');

    if (dayReceipts.length > 0) {
      const dayRows = [
        ['All Receipts — ' + fmtDate(receipt.examDate)],
        [],
        ['S.N', 'Name', 'Reference No.', 'Passport No.', 'Test', 'Type', 'Module', 'Place', 'Quoted', 'Collected', 'Margin', 'Associates', 'Paid By', 'Remarks'],
        ...dayReceipts.map((r, i) => [
          i + 1, r.candidateName || '—', r.referenceNumber || '—', r.passportNo || '—',
          r.test || '—', r.type || '—', r.module || '—', r.place || '—',
          Number(r.quotedPrice) || 0, Number(r.collectedPrice) || 0, Number(r.margin) || 0,
          r.associates || '—', r.paidBy || '—', r.remarks || '—',
        ]),
        ['', 'TOTAL', '', '', '', '', '', '', dayTotals.quoted, dayTotals.collected, dayTotals.margin, '', '', ''],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(dayRows);
      ws2['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Day Receipts');
    }

    XLSX.writeFile(wb, `${dailyFileName}.xlsx`);
    toast.success('Daily receipt downloaded as Excel');
  };

  const printStudentReceipt = () => {
    const el = document.getElementById(printableId);
    if (!el) return;
    const clone = el.cloneNode(true);
    const summaryTable = clone.querySelector('.rcpt-table.summary');
    if (summaryTable) summaryTable.remove();
    const signoff = clone.querySelector('.rcpt-signoff');
    if (signoff) signoff.remove();
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${testTypeName} Receipt — ${receipt.candidateName || ''}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; margin: 0; }
        ${document.querySelector('style[data-receipt-print]')?.innerHTML || ''}
      </style></head><body>${clone.outerHTML}</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const printDailyReceipt = () => {
    const el = document.getElementById(printableId);
    if (!el) return;
    const clone = el.cloneNode(true);
    const regTable = clone.querySelector('.rcpt-table:not(.accounting):not(.summary)');
    if (regTable) regTable.remove();
    const accTable = clone.querySelector('.rcpt-table.accounting');
    if (accTable) accTable.remove();
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${testTypeName} Daily Receipt — ${fmtDate(receipt.examDate)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; margin: 0; }
        ${document.querySelector('style[data-receipt-print]')?.innerHTML || ''}
      </style></head><body>${clone.outerHTML}</body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  return (
    <div className="rcpt-overlay" onClick={e => e.target === e.currentTarget && onClose && onClose()}>
      <div className="rcpt-modal animate-fade">
        <div className="rcpt-header">
          <div>
            <h3>{testTypeName} Registration Receipt</h3>
            <p className="rcpt-sub">{receipt.candidateName}</p>
          </div>
          <button className="rcpt-close" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="rcpt-body">
          <div id={printableId} className="rcpt-document">
            <p className="rcpt-doc-title">{testTypeName} Registration from {orgName}</p>

            <table className="rcpt-table">
              <caption>Registration Information</caption>
              <thead>
                <tr>
                  <th>Reference No.</th><th>Passport No.</th><th>Name</th><th>Exam Date</th>
                  <th>Test</th><th>Type</th><th>Module</th><th>Place</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{receipt.referenceNumber || '—'}</td>
                  <td>{receipt.passportNo || '—'}</td>
                  <td>{receipt.candidateName || '—'}</td>
                  <td>{fmtDate(receipt.examDate)}</td>
                  <td>{receipt.test || testTypeName}</td>
                  <td>{receipt.type || '—'}</td>
                  <td>{receipt.module || '—'}</td>
                  <td>{receipt.place || '—'}</td>
                </tr>
              </tbody>
            </table>

            <table className="rcpt-table accounting">
              <caption>Accounting Calculations</caption>
              <thead>
                <tr>
                  <th>Quoted Price</th><th>Collected Price</th><th>Margin</th>
                  <th>Associates</th><th>Paid By</th><th>Remarks</th><th>Receipt Written Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{fmtMoney(receipt.quotedPrice)}</td>
                  <td>{fmtMoney(receipt.collectedPrice)}</td>
                  <td className={receipt.margin >= 0 ? 'positive' : 'negative'}>{fmtMoney(receipt.margin)}</td>
                  <td>{receipt.associates || '—'}</td>
                  <td>{receipt.paidBy || '—'}</td>
                  <td>{receipt.remarks || '—'}</td>
                  <td>{fmtDate(receipt.receiptWrittenDate)}</td>
                </tr>
              </tbody>
            </table>

            <table className="rcpt-table summary">
              <caption>Day Summary: {fmtDate(receipt.examDate)}</caption>
              <thead>
                <tr>
                  <th>Test / Type / Module</th><th>Students</th><th>Quoted Total</th><th>Collected Total</th><th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const t = g.rows.reduce((a, r) => {
                    a.quoted += Number(r.quotedPrice) || 0;
                    a.collected += Number(r.collectedPrice) || 0;
                    return a;
                  }, { quoted: 0, collected: 0 });
                  return (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td>{g.rows.length}</td>
                      <td>{fmtMoney(t.quoted)}</td>
                      <td>{fmtMoney(t.collected)}</td>
                      <td className={t.collected - t.quoted >= 0 ? 'positive' : 'negative'}>{fmtMoney(t.collected - t.quoted)}</td>
                    </tr>
                  );
                })}
                <tr className="rcpt-total-row">
                  <td>Day Total</td>
                  <td>{dayReceipts.length}</td>
                  <td>{fmtMoney(dayTotals.quoted)}</td>
                  <td>{fmtMoney(dayTotals.collected)}</td>
                  <td className={dayTotals.margin >= 0 ? 'positive' : 'negative'}>{fmtMoney(dayTotals.margin)}</td>
                </tr>
              </tbody>
            </table>

            <div className="rcpt-signoff">
              <span>Paid on Date: <strong>{fmtDate(daySummary?.paidOnDate)}</strong></span>
              <span>Prepared by: <strong>{daySummary?.preparedBy || '—'}</strong></span>
              <span>Checked by: <strong>{daySummary?.checkedBy || '—'}</strong></span>
              <span>Approved by: <strong>{daySummary?.approvedBy || '—'}</strong></span>
            </div>
          </div>
        </div>

        <div className="rcpt-footer rcpt-footer-split">
          <div className="rcpt-footer-group">
            <span className="rcpt-footer-label">Student receipt</span>
            <div className="rcpt-footer-buttons">
              <button className="rcpt-btn" onClick={exportStudentExcel} title="Download this student's receipt as Excel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                Excel
              </button>
              <button className="rcpt-btn" onClick={exportStudentPDF} title="Download this student's receipt as PDF">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                PDF
              </button>
              <button className="rcpt-btn primary" onClick={printStudentReceipt} title="Print this student's receipt">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
            </div>
          </div>

          <div className="rcpt-footer-group">
            <span className="rcpt-footer-label">Daily receipt</span>
            <div className="rcpt-footer-buttons">
              <button className="rcpt-btn" onClick={exportDailyExcel} title="Download the full day's receipt as Excel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                Excel
              </button>
              <button className="rcpt-btn" onClick={exportDailyPDF} title="Download the full day's receipt as PDF">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                PDF
              </button>
              <button className="rcpt-btn" onClick={printDailyReceipt} title="Print the full day's receipt">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
