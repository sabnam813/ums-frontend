import React from 'react';
import { diffFields } from '../../utils/duplicateDetection';
import './DuplicateWarningModal.css';

export default function DuplicateWarningModal({
  matches,
  newRow,
  nameKey = 'name',
  compareFields,
  onKeepBoth,
  onCancel,
}) {
  if (!matches || matches.length === 0) return null;

  return (
    <div className="dup-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="dup-modal animate-slide-right">
        <div className="dup-header">
          <div className="dup-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3>Possible Duplicate{matches.length > 1 ? 's' : ''} Found</h3>
            <p>
              {matches.length === 1
                ? 'An existing record with a very similar name already exists.'
                : `${matches.length} existing records with a very similar name already exist.`}
              {' '}Review the details below before deciding.
            </p>
          </div>
        </div>

        <div className="dup-body">
          {matches.map(({ row, score }) => {
            const diffs = diffFields(row, newRow, compareFields);
            return (
              <div className="dup-match" key={row._id}>
                <div className="dup-match-header">
                  <span className="dup-match-name">{row[nameKey]}</span>
                  <span className="dup-match-score">{Math.round(score * 100)}% name match</span>
                </div>
                <table className="dup-diff-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Existing Record</th>
                      <th>New Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map(d => (
                      <tr key={d.key} className={d.differs ? 'differs' : ''}>
                        <td className="dup-field-label">{d.label}</td>
                        <td>{d.existingValue || <span className="dup-empty">—</span>}</td>
                        <td>{d.newValue || <span className="dup-empty">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="dup-footer">
          <button className="dup-btn-cancel" onClick={onCancel}>
            Cancel, Don't Add
          </button>
          <button className="dup-btn-keep" onClick={onKeepBoth}>
            Keep Both, Add Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
