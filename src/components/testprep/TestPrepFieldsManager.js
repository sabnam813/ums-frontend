import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FIELD_LABELS } from '../../hooks/useTestPrepFieldConfig';
import '../admin/FormFieldsManager.css';

const EXTENDABLE_FIELDS = ['paymentStatus', 'module'];

const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
];

export default function TestPrepFieldsManager({ fieldConfig, refetchFields, onClose }) {
  const { optionsByField, customFields } = fieldConfig;

  const [optionField, setOptionField] = useState('paymentStatus');
  const [newOption, setNewOption] = useState('');
  const [addingOption, setAddingOption] = useState(false);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState('');
  const [customOptions, setCustomOptions] = useState('');
  const [customRequired, setCustomRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const resetForm = () => {
    setEditingId(null); setCustomLabel(''); setCustomType('');
    setCustomOptions(''); setCustomRequired(false); setShowCustomForm(false);
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newOption.trim()) return;
    setAddingOption(true);
    try {
      await axios.post('/test-prep-fields/options', { fieldKey: optionField, option: newOption.trim() });
      toast.success(`Added "${newOption.trim()}" to ${FIELD_LABELS[optionField]}`);
      setNewOption('');
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add option');
    } finally {
      setAddingOption(false);
    }
  };

  const handleRemoveOption = async (fieldKey, option) => {
    if (!window.confirm(`Remove "${option}" from ${FIELD_LABELS[fieldKey]}? Existing records keeping this value are not affected.`)) return;
    try {
      await axios.delete('/test-prep-fields/options', { data: { fieldKey, option } });
      toast.success(`"${option}" removed`);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove option');
    }
  };

  const startEdit = (f) => {
    setEditingId(f._id);
    setCustomLabel(f.label);
    setCustomType(CUSTOM_FIELD_TYPES.some(t => t.value === f.type) ? f.type : 'text');
    setCustomOptions((f.options || []).join(', '));
    setCustomRequired(!!f.required);
    setShowCustomForm(true);
  };

  const handleSaveCustomField = async (e) => {
    e.preventDefault();
    if (!customLabel.trim()) { toast.error('Field label is required'); return; }
    if (!customType) { toast.error('Please choose a field type'); return; }
    if (customType === 'dropdown' && !customOptions.trim()) {
      toast.error('Add at least one option for a dropdown field');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: customLabel.trim(),
        type: customType,
        options: customType === 'dropdown' ? customOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
        required: customRequired,
      };
      if (editingId) {
        await axios.put(`/test-prep-fields/custom/${editingId}`, payload);
        toast.success(`"${customLabel.trim()}" updated`);
      } else {
        await axios.post('/test-prep-fields/custom', payload);
        toast.success(`"${customLabel.trim()}" added`);
      }
      resetForm();
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (f) => {
    try {
      await axios.put(`/test-prep-fields/custom/${f._id}`, { active: !f.active });
      toast.success(f.active ? `"${f.label}" hidden` : `"${f.label}" shown`);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update field');
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Remove the "${f.label}" field? It will be moved to trash and can be restored later.`)) return;
    try {
      await axios.delete(`/test-prep-fields/custom/${f._id}`);
      toast.success(`"${f.label}" moved to trash`);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete field');
    }
  };

  const handleMove = async (index, dir) => {
    const next = [...customFields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setReordering(true);
    try {
      await axios.put('/test-prep-fields/custom/reorder/all', { order: next.map(f => f._id) });
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reorder fields');
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-modal animate-slide-right" style={{ maxWidth: 640 }}>
        <div className="af-header">
          <div className="af-header-left">
            <div>
              <h3>Manage Test Preparation Fields</h3>
              <p>Add, edit, hide, or reorder fields. Changes apply instantly.</p>
            </div>
          </div>
          <button className="af-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="af-form" style={{ padding: '0 24px 24px' }}>
          <div className="ffm-section">
            <h4>Dropdown Options</h4>
            <form onSubmit={handleAddOption} className="ffm-inline-form">
              <select className="ffm-select" value={optionField} onChange={e => setOptionField(e.target.value)}>
                {EXTENDABLE_FIELDS.map(k => <option key={k} value={k}>{FIELD_LABELS[k]}</option>)}
              </select>
              <input
                type="text" className="ffm-input" placeholder="New option, e.g. Refunded"
                value={newOption} onChange={e => setNewOption(e.target.value)}
              />
              <button type="submit" className="ffm-add-btn" disabled={addingOption}>
                {addingOption ? 'Adding…' : 'Add Option'}
              </button>
            </form>
            <div className="ffm-options-preview">
              {(optionsByField[optionField] || []).map(opt => (
                <span className="ffm-chip" key={opt}>
                  {opt}
                  <button type="button" onClick={() => handleRemoveOption(optionField, opt)} title="Remove this option">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="ffm-section">
            <div className="ffm-section-row">
              <h4>Custom fields</h4>
              <button type="button" className="ffm-toggle-btn" onClick={() => {
                if (showCustomForm) { resetForm(); } else { resetForm(); setShowCustomForm(true); }
              }}>
                {showCustomForm ? 'Cancel' : '+ New Field'}
              </button>
            </div>

            {customFields.length > 0 && (
              <div className="ffm-custom-list">
                {customFields.map((f, idx) => (
                  <div className="ffm-custom-item" key={f._id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button type="button" className="ffm-toggle-btn" style={{ padding: '0 4px' }}
                        disabled={idx === 0 || reordering} onClick={() => handleMove(idx, -1)} title="Move up">▲</button>
                      <button type="button" className="ffm-toggle-btn" style={{ padding: '0 4px' }}
                        disabled={idx === customFields.length - 1 || reordering} onClick={() => handleMove(idx, 1)} title="Move down">▼</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span className="ffm-custom-label">{f.label}</span>
                      <span className="ffm-custom-meta">
                        {CUSTOM_FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}
                        {f.required ? ' · Required' : ''}
                        {f.active === false ? ' · Hidden' : ''}
                      </span>
                    </div>
                    <button type="button" className="ffm-toggle-btn" onClick={() => startEdit(f)} title="Edit">Edit</button>
                    <button type="button" className="ffm-toggle-btn" onClick={() => handleToggleActive(f)} title="Hide/Show">
                      {f.active === false ? 'Show' : 'Hide'}
                    </button>
                    <button type="button" className="ffm-delete-btn" onClick={() => handleDelete(f)} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showCustomForm && (
              <form onSubmit={handleSaveCustomField} className="ffm-custom-form">
                <div className="settings-grid-2">
                  <div className="settings-field">
                    <label>Field Label</label>
                    <input type="text" className="settings-input" placeholder="e.g. Visa Type"
                      value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
                  </div>
                  <div className="settings-field">
                    <label>Field Type</label>
                    <select className="settings-input" value={customType} disabled={!!editingId}
                      onChange={e => setCustomType(e.target.value)}>
                      <option value="">Select a type…</option>
                      {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {customType === 'dropdown' && (
                  <div className="settings-field">
                    <label>Dropdown Options (comma-separated)</label>
                    <input type="text" className="settings-input" placeholder="e.g. Yes, No, Pending"
                      value={customOptions} onChange={e => setCustomOptions(e.target.value)} />
                  </div>
                )}

                <div className="settings-grid-2">
                  <label className="settings-checkbox-row" style={{ alignSelf: 'center', marginTop: 8 }}>
                    <input type="checkbox" checked={customRequired} onChange={e => setCustomRequired(e.target.checked)} />
                    Required field
                  </label>
                </div>

                <div className="settings-form-actions">
                  <button type="submit" className="settings-save-btn" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Field'}
                  </button>
                </div>
              </form>
            )}

            {!showCustomForm && customFields.length === 0 && (
              <p className="ffm-empty-hint">No custom fields yet. Click "+ New Field" to add one.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
