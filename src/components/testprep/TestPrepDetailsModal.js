import React from 'react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { toastExcel, toastPDF } from '../../utils/exportHelpers';
import './TestPrepDetailsModal.css';
import '../shared/ApplicationForm.css';

function displayDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
}

function Item({ label, value, wide }) {
  return (
    <div className={`tpd-item ${wide ? 'tpd-remarks' : ''}`}>
      <label>{label}</label>
      {value ? <span>{value}</span> : <span className="tpd-empty">—</span>}
    </div>
  );
}

function money(v) {
  return (v || 0).toLocaleString();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildPairs(row, customFieldDefs, fields = []) {
  const pairs = fields.map(f => {
    const raw = row[f.key];
    if (f.type === 'date') return [f.label, displayDate(raw)];
    if (f.type === 'currency') return [f.label, money(raw)];
    return [f.label, raw];
  });
  if (row.remarks && !fields.some(f => f.key === 'remarks')) pairs.push(['Remarks', row.remarks]);
  customFieldDefs.forEach(def => {
    const raw = (row.customFields || {})[def.key];
    pairs.push([def.label, def.type === 'date' ? displayDate(raw) : raw]);
  });
  return pairs.map(([k, v]) => [k, v === undefined || v === null || v === '' ? '' : String(v)]);
}

export default function TestPrepDetailsModal({ row, testTypeName, fields = [], customFieldDefs = [], onClose, onEdit }) {
  const { user } = useAuth();
  if (!row) return null;

  const canExcel = hasPermission(user, 'testPreparation', 'exportExcel');
  const canPdf = hasPermission(user, 'testPreparation', 'exportPdf');
  const canPrint = hasPermission(user, 'testPreparation', 'print');
  const baseName = `Booking_${String(row.candidateName || 'record').replace(/[^a-z0-9]+/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}`;
  const heading = `Booking Details: ${row.candidateName || ''} (${testTypeName || ''})`;

  const exportExcel = () => {
    const pairs = buildPairs(row, customFieldDefs, fields);
    const ws = XLSX.utils.aoa_to_sheet([[heading], [], ['Field', 'Value'], ...pairs]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Booking');
    XLSX.writeFile(wb, `${baseName}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    const pairs = buildPairs(row, customFieldDefs, fields);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(heading, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 22);
    doc.autoTable({
      startY: 27,
      head: [['Field', 'Value']],
      body: pairs.map(([k, v]) => [k, v || '-']),
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
    });
    doc.save(`${baseName}.pdf`);
    toastPDF();
  };

  const printRecord = () => {
    const pairs = buildPairs(row, customFieldDefs, fields);
    const rows = pairs.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v || '-')}</td></tr>`).join('');
    const html = `<!DOCTYPE html>
<html><head><title>${escapeHtml(heading)}</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 16px; }
p { margin: 0 0 10px; color: #555; font-size: 10px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f0f0f0; width: 35%; }
td { white-space: pre-wrap; }
tr { page-break-inside: avoid; }
</style></head><body>
<h2>${escapeHtml(heading)}</h2>
<p>Printed ${escapeHtml(new Date().toLocaleDateString())}</p>
<table><tbody>${rows}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-modal animate-slide-right">
        <div className="af-header">
          <div className="af-header-left">
            <div className="af-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div>
              <h3>Booking Details</h3>
              <p>{row.candidateName} &middot; {testTypeName}</p>
            </div>
          </div>
          <button className="af-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="af-form">
          <div className="af-section">
            <div className="tpd-section-body">
              {fields.map(f => {
                const raw = row[f.key];
                const display = f.type === 'date' ? displayDate(raw) : f.type === 'currency' ? money(raw) : raw;
                return <Item key={f.key} label={f.label} value={display} />;
              })}
              {row.remarks && !fields.some(f => f.key === 'remarks') && <Item label="Remarks" value={row.remarks} wide />}
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <div className="af-section">
              <div className="af-section-title"><span className="af-section-num">6</span>Additional Fields</div>
              <div className="tpd-section-body">
                {customFieldDefs.map(def => {
                  const raw = (row.customFields || {})[def.key];
                  const display = def.type === 'date' ? displayDate(raw) : raw;
                  return <Item key={def.key} label={def.label} value={display} />;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="af-footer">
          {canExcel && <button type="button" className="af-cancel" onClick={exportExcel}>Excel</button>}
          {canPdf && <button type="button" className="af-cancel" onClick={exportPDF}>PDF</button>}
          {canPrint && <button type="button" className="af-cancel" onClick={printRecord}>Print</button>}
          <button type="button" className="af-cancel" onClick={onClose}>Close</button>
          <button type="button" className="af-submit" onClick={onEdit}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
