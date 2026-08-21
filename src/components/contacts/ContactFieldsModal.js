import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
];

export default function ContactFieldsModal({ group, onChange, onClose }) {
  const [fields, setFields] = useState(
    [...(group.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [showAddForm, setShowAddForm] = useState(fields.length === 0);
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setLabel(''); setType('text'); setRequired(false); };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!label.trim()) { toast.error('Field name is required'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`/contact-groups/${group._id}/fields`, {
        label: label.trim(), type, required,
      });
      const updated = res.data.group;
      setFields([...updated.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      onChange(updated);
      toast.success(`"${label.trim()}" field added`);
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add field');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRequired = async (field) => {
    try {
      const res = await axios.put(`/contact-groups/${group._id}/fields/${field._id}`, {
        required: !field.required,
      });
      const updated = res.data.group;
      setFields([...updated.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      onChange(updated);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update field');
    }
  };

  const handleDeleteField = async (field) => {
    if (!window.confirm(`Remove the "${field.label}" field from this group? Contact cards will no longer show it.`)) return;
    try {
      const res = await axios.delete(`/contact-groups/${group._id}/fields/${field._id}`);
      const updated = res.data.group;
      setFields([...updated.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      onChange(updated);
      toast.success(`"${field.label}" field removed`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove field');
    }
  };

  const move = async (index, dir) => {
    const next = [...fields];
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFields(next);
    try {
      await axios.put(`/contact-groups/${group._id}/fields-reorder`, {
        orderedFieldIds: next.map(f => f._id),
      });
    } catch (err) {
      toast.error('Failed to save new order');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div>
              <h3>Manage Fields: {group.name}</h3>
              <p>Define what info each contact card in this group shows</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-form">
          {fields.length > 0 && (
            <div className="cfm-field-list">
              {fields.map((f, idx) => (
                <div className="cfm-field-row" key={f._id}>
                  <div className="cfm-order-btns">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1} title="Move down">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                  <div className="cfm-field-info">
                    <span className="cfm-field-label">{f.label}</span>
                    <span className="cfm-field-meta">
                      {FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}
                      {f.required ? ' · Required' : ''}
                    </span>
                  </div>
                  <label className="cfm-required-toggle" title="Required field">
                    <input type="checkbox" checked={!!f.required} onChange={() => handleToggleRequired(f)} />
                    Required
                  </label>
                  <button type="button" className="ffm-delete-btn" onClick={() => handleDeleteField(f)} title="Remove field">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {fields.length === 0 && !showAddForm && (
            <p className="ffm-empty-hint">No fields yet. Add one below, e.g. Name, Phone, Email.</p>
          )}

          <div className="ffm-section-row" style={{ marginTop: fields.length ? 16 : 0 }}>
            <h4>Add a field</h4>
            <button type="button" className="ffm-toggle-btn" onClick={() => setShowAddForm(v => !v)}>
              {showAddForm ? 'Cancel' : '+ New Field'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddField} className="ffm-custom-form">
              <div className="settings-grid-2">
                <div className="settings-field">
                  <label>Field Name</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="e.g. Phone Number"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="settings-field">
                  <label>Field Type</label>
                  <select className="settings-input" value={type} onChange={e => setType(e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="settings-checkbox-row">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                Required field
              </label>
              <div className="settings-form-actions">
                <button type="submit" className="settings-save-btn" disabled={saving}>
                  {saving ? 'Adding…' : 'Add Field'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-save" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
