import React, { useState } from 'react';
import './Portal.css';

export default function PortalBulkEditModal({ count, departments, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ status: false, category: false, departments: false });
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [allDepartments, setAllDepartments] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));
  const toggleDept = (name) => {
    setSelectedDepts(prev => prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]);
  };

  const handleSave = async () => {
    const updates = {};
    if (enabled.status) updates.status = status;
    if (enabled.category) updates.category = category;
    if (enabled.departments) {
      updates.allDepartments = allDepartments;
      updates.departments = allDepartments ? [] : selectedDepts;
    }
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    try {
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="pt-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="pt-modal pt-modal-sm animate-fade">
        <div className="pt-modal-header">
          <div className="pt-title-group">
            <div className="pt-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h3>Bulk Edit Portals</h3>
              <p>Updating <strong>{count}</strong> portal{count > 1 ? 's' : ''}. Credentials are never changed here.</p>
            </div>
          </div>
          <button type="button" className="pt-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="pt-modal-body">
          <label className="pt-be-row">
            <input type="checkbox" checked={enabled.status} onChange={() => toggle('status')} />
            <span className="pt-be-label">Status</span>
            {enabled.status && (
              <div className="pt-status-toggle" style={{ marginLeft: 'auto' }}>
                <button type="button" className={`pt-status-opt ${status === 'active' ? 'active' : ''}`} onClick={() => setStatus('active')}>Active</button>
                <button type="button" className={`pt-status-opt ${status === 'inactive' ? 'active' : ''}`} onClick={() => setStatus('inactive')}>Inactive</button>
              </div>
            )}
          </label>

          <label className="pt-be-row">
            <input type="checkbox" checked={enabled.category} onChange={() => toggle('category')} />
            <span className="pt-be-label">Category</span>
            {enabled.category && (
              <input type="text" className="pt-be-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. University Portal" maxLength={100} />
            )}
          </label>

          <label className="pt-be-row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={enabled.departments} onChange={() => toggle('departments')} />
            <span className="pt-be-label">Department visibility</span>
          </label>
          {enabled.departments && (
            <div className="pt-be-dept-panel">
              <label className="pt-all-dept-toggle">
                <input type="checkbox" checked={allDepartments} onChange={e => setAllDepartments(e.target.checked)} />
                All Departments
              </label>
              {!allDepartments && (
                <div className="pt-dept-list">
                  {departments.map(d => (
                    <label key={d._id} className={`pt-dept-chip ${selectedDepts.includes(d.name) ? 'checked' : ''}`}>
                      <input type="checkbox" checked={selectedDepts.includes(d.name)} onChange={() => toggleDept(d.name)} />
                      {d.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-modal-footer">
          <span className="pt-be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="pt-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="pt-btn-save" onClick={handleSave} disabled={saving || enabledCount === 0}>
              {saving ? 'Applying…' : `Apply to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
