import React, { useState } from 'react';
import './Diary.css';

export default function DiaryBulkEditModal({ count, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ post: false, remarks: false });
  const [post, setPost] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async () => {
    const updates = {};
    if (enabled.post) updates.post = post;
    if (enabled.remarks) updates.remarks = remarks;
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
    <div className="dy-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="dy-modal dy-modal-sm animate-fade">
        <div className="dy-modal-header">
          <div className="dy-title-group">
            <div className="dy-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h3>Bulk Edit Diary Entries</h3>
              <p>Updating <strong>{count}</strong> entr{count > 1 ? 'ies' : 'y'}. Name &amp; mobile are left untouched here.</p>
            </div>
          </div>
          <button type="button" className="dy-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="dy-modal-body">
          <label className="dy-be-row">
            <input type="checkbox" checked={enabled.post} onChange={() => toggle('post')} />
            <span className="dy-be-label">Post</span>
            {enabled.post && (
              <input type="text" className="dy-be-input" value={post} onChange={e => setPost(e.target.value)} placeholder="e.g. Marketing Officer" maxLength={150} />
            )}
          </label>

          <label className="dy-be-row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={enabled.remarks} onChange={() => toggle('remarks')} />
            <span className="dy-be-label">Remarks</span>
          </label>
          {enabled.remarks && (
            <textarea
              rows={4}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Replace remarks for all selected entries…"
              maxLength={2000}
              style={{ marginLeft: 26, border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
            />
          )}
        </div>

        <div className="dy-modal-footer">
          <span className="dy-be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="dy-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="dy-btn-save" onClick={handleSave} disabled={saving || enabledCount === 0}>
              {saving ? 'Applying…' : `Apply to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
