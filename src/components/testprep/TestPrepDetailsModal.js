import React from 'react';
import { format } from 'date-fns';
import './TestPrepDetailsModal.css';

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

export default function TestPrepDetailsModal({ row, testTypeName, customFieldDefs = [], onClose, onEdit }) {
  if (!row) return null;

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
            <div className="af-section-title"><span className="af-section-num">1</span>Candidate</div>
            <div className="tpd-section-body">
              <Item label="Date" value={displayDate(row.date)} />
              <Item label="Candidate Name" value={row.candidateName} />
              <Item label="Associates" value={row.associates} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">2</span>Booking &amp; Exam</div>
            <div className="tpd-section-body">
              <Item label="Booking Date" value={displayDate(row.bookingDate)} />
              <Item label="Exam Date" value={displayDate(row.examDate)} />
              <Item label="Module" value={row.module} />
              <Item label="Place" value={row.place} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">3</span>Payment</div>
            <div className="tpd-section-body">
              <Item label="Payment Status" value={row.paymentStatus} />
              <Item label="Payment Made By" value={row.paymentMadeBy} />
              <Item label="Payment Date" value={displayDate(row.paymentDate)} />
              <Item label="Payment Amount" value={(row.paymentAmount || 0).toLocaleString()} />
              <Item label="Margin" value={(row.margin || 0).toLocaleString()} />
              <Item label="Payment Date to BC" value={displayDate(row.paymentDateToBC)} />
              <Item label="Paid Amount to BC" value={(row.paidAmountToBC || 0).toLocaleString()} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">4</span>Reference &amp; Voucher</div>
            <div className="tpd-section-body">
              <Item label="Reference Number" value={row.referenceNumber} />
              <Item label="Received Amount" value={(row.receivedAmount || 0).toLocaleString()} />
              <Item label="Cost" value={(row.cost || 0).toLocaleString()} />
              <Item label="Voucher" value={row.voucher} />
              <Item label="Expiry Date" value={displayDate(row.expiryDate)} />
            </div>
          </div>

          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">5</span>Remarks</div>
            <div className="tpd-section-body">
              <Item label="Remarks" value={row.remarks} wide />
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
