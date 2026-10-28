import React, { useState } from 'react';

export default function TestTypeModal({ testType, onSave, onClose }) {
  const isEdit = !!testType;
  const [name, setName] = useState(testType?.name || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Test name is required'); return; }
    onSave({ name: name.trim() });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Test Type' : 'Add New Test Type'}</h3>
              <p>Appears as a new tab under Test Preparation</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-section">
            <div className={`field ${error ? 'has-error' : ''}`}>
              <label>Test Name *</label>
              <input
                type="text"
                placeholder="e.g. OET, CELPIP, Pearson Academic"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
              />
              {error && <span className="field-error">{error}</span>}
            </div>
            <p className="section-hint" style={{ marginTop: 8 }}>
              You'll be able to add students, record their test bookings, and track progress here.
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {isEdit
                  ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                  : <><path d="M12 5v14M5 12h14"/></>
                }
              </svg>
              {isEdit ? 'Save Changes' : 'Add Test Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
