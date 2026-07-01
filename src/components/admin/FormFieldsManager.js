import React, { useState, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FIELD_LABELS } from '../../hooks/useFieldConfig';
import './FormFieldsManager.css';

const EXTENDABLE_FIELDS = [
  'level', 'gsSubmission',
  'olRequest', 'offerLetter', 'withdraw',
  'payment', 'coeCas', 'savisFee', 'refund',
  'visaOutcome', 'visaWithdraw',
];
const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
];

const VALIDATION_TYPES = [
  { value: 'any', label: 'Any text' },
  { value: 'number_only', label: 'Numbers only (digits)' },
  { value: 'word_only', label: 'Words only (no digits)' },
];

const NEW_GROUP_SENTINEL = '__NEW_GROUP__';

const BUILTIN_SECTIONS = ['Basic Information', 'Intakes', 'Offer', 'Financial', 'Visa', 'Additional Information'];

const BUILTIN_SLOTS = {
  'Basic Information': [
    { id: 'referredBy', label: 'Referred By' },
    { id: 'name', label: 'Applicant Name' },
    { id: 'course', label: 'Level / Course' },
  ],
  'Intakes': [
    { id: 'deferredIntake', label: 'Initial / Deferred Intake' },
  ],
  'Offer': [
    { id: 'offerLetter', label: 'OL Request / OL Received' },
  ],
  'Financial': [
    { id: 'coeCas', label: 'Payment Status / COE-CAS' },
  ],
  'Visa': [
    { id: 'visaOutcome', label: 'Visa Date / Outcome' },
  ],
  'Additional Information': [
    { id: 'other', label: 'Other' },
    { id: 'remarks', label: 'Remarks' },
  ],
};

export default function FormFieldsManager({ fieldConfig, refetchFields }) {
  const { optionsByField, customFields } = fieldConfig;

  const [optionField, setOptionField] = useState('level');
  const [newOption, setNewOption] = useState('');
  const [addingOption, setAddingOption] = useState(false);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState('text');
  const [customOptions, setCustomOptions] = useState('');
  const [customRequired, setCustomRequired] = useState(false);
  
  const [sectionMode, setSectionMode] = useState('existing');
  
  const [sectionSelect, setSectionSelect] = useState('');
  
  const [sectionNewName, setSectionNewName] = useState('');
  const [customValidationType, setCustomValidationType] = useState('any');
  const [savingCustom, setSavingCustom] = useState(false);
  const [fieldPosition, setFieldPosition] = useState('last');
  const [afterFieldId, setAfterFieldId] = useState('');

  const existingSections = useMemo(() => {
    const seen = new Set(BUILTIN_SECTIONS);
    customFields.forEach(f => { if (f.section) seen.add(f.section); });
    if (!seen.has('Additional Information')) seen.add('Additional Information');
    const customOnly = Array.from(seen).filter(s => !BUILTIN_SECTIONS.includes(s)).sort();
    return [...BUILTIN_SECTIONS, ...customOnly];
  }, [customFields]);

  const resolvedSection = () => {
    if (sectionMode === 'new') {
      return sectionNewName.trim() || 'Additional Information';
    }
    if (sectionSelect === NEW_GROUP_SENTINEL || sectionSelect === '') {
      return sectionNewName.trim() || 'Additional Information';
    }
    return sectionSelect;
  };

  const activeSection = resolvedSection();

  const fieldsInSelectedSection = useMemo(() => {
    return customFields.filter(f => (f.section || 'Additional Information') === activeSection);
  }, [customFields, activeSection]);

  const positionOptions = useMemo(() => {
    const builtinSlots = BUILTIN_SLOTS[activeSection] || [];
    const customInSection = fieldsInSelectedSection.map(f => ({ id: f._id, label: f.label }));
    return [...builtinSlots, ...customInSection];
  }, [activeSection, fieldsInSelectedSection]);

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newOption.trim()) return;
    setAddingOption(true);
    try {
      await axios.post('/fields/options', { fieldKey: optionField, option: newOption.trim() });
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
    if (!window.confirm(
      `Remove "${option}" from ${FIELD_LABELS[fieldKey]}?\n\nThis will immediately remove it from the dropdown. Existing records that already have this value are not affected.`
    )) return;
    try {
      await axios.delete('/fields/options', { data: { fieldKey, option } });
      toast.success(`"${option}" removed from ${FIELD_LABELS[fieldKey]}`);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove option');
    }
  };

  const handleCreateCustomField = async (e) => {
    e.preventDefault();
    if (!customLabel.trim()) { toast.error('Field label is required'); return; }
    if (customType === 'dropdown' && !customOptions.trim()) {
      toast.error('Add at least one option for a dropdown field');
      return;
    }
    const section = resolvedSection();
    if (!section) { toast.error('Please choose or enter a group/section name'); return; }

    setSavingCustom(true);
    try {
      await axios.post('/fields/custom', {
        label: customLabel.trim(),
        type: customType,
        options: customType === 'dropdown' ? customOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
        required: customRequired,
        section,
        validationType: (customType === 'text') ? customValidationType : null,
        position: fieldPosition,
        afterFieldId: fieldPosition === 'after' ? afterFieldId : undefined,
      });
      toast.success(`"${customLabel.trim()}" added — it now appears on every application form`);
      setCustomLabel(''); setCustomType('text'); setCustomOptions('');
      setCustomRequired(false); setSectionMode('existing'); setSectionSelect('');
      setSectionNewName(''); setCustomValidationType('any');
      setFieldPosition('last'); setAfterFieldId('');
      setShowCustomForm(false);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create field');
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDeleteCustomField = async (field) => {
    if (!window.confirm(
      `Delete the "${field.label}" field?\n\nThis will permanently remove it from the form and the data table. This cannot be undone.`
    )) return;
    try {
      await axios.delete(`/fields/custom/${field._id}`);
      toast.success(`"${field.label}" field deleted`);
      await refetchFields();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete field');
    }
  };

  const showNewNameInput = sectionMode === 'new' || sectionSelect === NEW_GROUP_SENTINEL;

  return (
    <div className="settings-card ffm-card">
      <div className="settings-card-header">
        <h3>Form Fields</h3>
        <p>Add or remove dropdown options, or create entirely new fields — changes appear instantly on every user's application form</p>
      </div>

      {/* Add option to existing dropdown */}
      <div className="ffm-section">
        <h4>Add an option to an existing dropdown</h4>
        <form onSubmit={handleAddOption} className="ffm-inline-form">
          <select
            className="ffm-select"
            value={optionField}
            onChange={e => setOptionField(e.target.value)}
          >
            {EXTENDABLE_FIELDS.map(k => (
              <option key={k} value={k}>{FIELD_LABELS[k]}</option>
            ))}
          </select>
          <input
            type="text"
            className="ffm-input"
            placeholder="New option, e.g. Conditional Offer"
            value={newOption}
            onChange={e => setNewOption(e.target.value)}
          />
          <button type="submit" className="ffm-add-btn" disabled={addingOption}>
            {addingOption ? 'Adding…' : 'Add Option'}
          </button>
        </form>

        <div className="ffm-options-preview">
          {(optionsByField[optionField] || []).length === 0 && (
            <p className="ffm-empty-hint" style={{ fontSize: 12, margin: '6px 0 0' }}>No options added yet for this field.</p>
          )}
          {(optionsByField[optionField] || []).map(opt => (
            <span className="ffm-chip" key={opt}>
              {opt}
              <button
                type="button"
                onClick={() => handleRemoveOption(optionField, opt)}
                title="Remove this option"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Custom fields */}
      <div className="ffm-section">
        <div className="ffm-section-row">
          <h4>Custom fields</h4>
          <button type="button" className="ffm-toggle-btn" onClick={() => setShowCustomForm(v => !v)}>
            {showCustomForm ? 'Cancel' : '+ New Field'}
          </button>
        </div>

        {customFields.length > 0 && (
          <div className="ffm-custom-list">
            {customFields.map(f => (
              <div className="ffm-custom-item" key={f._id}>
                <div>
                  <span className="ffm-custom-label">{f.label}</span>
                  <span className="ffm-custom-meta">
                    {CUSTOM_FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}
                    {f.validationType && f.validationType !== 'any' && (
                      <> · {VALIDATION_TYPES.find(v => v.value === f.validationType)?.label}</>
                    )}
                    {' · '}{f.section}
                    {f.required ? ' · Required' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="ffm-delete-btn"
                  onClick={() => handleDeleteCustomField(f)}
                  title="Permanently delete this field"
                >
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
          <form onSubmit={handleCreateCustomField} className="ffm-custom-form">
            <div className="settings-grid-2">
              <div className="settings-field">
                <label>Field Label</label>
                <input type="text" className="settings-input" placeholder="e.g. Scholarship Amount"
                  value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
              </div>
              <div className="settings-field">
                <label>Field Type</label>
                <select className="settings-input" value={customType} onChange={e => { setCustomType(e.target.value); setCustomValidationType('any'); }}>
                  {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Validation type — only for text fields */}
            {customType === 'text' && (
              <div className="settings-field">
                <label>Input Validation</label>
                <select className="settings-input" value={customValidationType} onChange={e => setCustomValidationType(e.target.value)}>
                  {VALIDATION_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
                <span className="ffm-hint">
                  {customValidationType === 'number_only' && 'Users can only enter digits (0–9) in this field.'}
                  {customValidationType === 'word_only' && 'Users can only enter letters and spaces — no numbers.'}
                  {customValidationType === 'any' && 'Users can enter any text.'}
                </span>
              </div>
            )}

            {customType === 'dropdown' && (
              <div className="settings-field">
                <label>Dropdown Options (comma-separated)</label>
                <input type="text" className="settings-input" placeholder="e.g. Yes, No, Pending"
                  value={customOptions} onChange={e => setCustomOptions(e.target.value)} />
              </div>
            )}

            {/* Section / Group picker */}
            <div className="settings-field">
              <label>Section (groups the field on the form)</label>
              <div className="ffm-section-toggle">
                <button
                  type="button"
                  className={`ffm-seg-btn ${sectionMode === 'existing' ? 'active' : ''}`}
                  onClick={() => { setSectionMode('existing'); setSectionNewName(''); setFieldPosition('last'); setAfterFieldId(''); }}
                >
                  Add to existing group
                </button>
                <button
                  type="button"
                  className={`ffm-seg-btn ${sectionMode === 'new' ? 'active' : ''}`}
                  onClick={() => { setSectionMode('new'); setSectionSelect(''); setFieldPosition('last'); setAfterFieldId(''); }}
                >
                  Create new group
                </button>
              </div>

              {sectionMode === 'existing' && (
                <div className="ffm-section-row-inputs">
                  <select
                    className="settings-input"
                    value={sectionSelect}
                    onChange={e => {
                      setSectionSelect(e.target.value);
                      if (e.target.value !== NEW_GROUP_SENTINEL) setSectionNewName('');
                      setFieldPosition('last'); setAfterFieldId('');
                    }}
                  >
                    <option value="">— Choose a group —</option>
                    {existingSections.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value={NEW_GROUP_SENTINEL}>＋ New group…</option>
                  </select>
                  {showNewNameInput && (
                    <input
                      type="text"
                      className="settings-input"
                      placeholder="New group name, e.g. Scholarship Details"
                      value={sectionNewName}
                      onChange={e => setSectionNewName(e.target.value)}
                    />
                  )}
                </div>
              )}

              {sectionMode === 'new' && (
                <input
                  type="text"
                  className="settings-input"
                  placeholder="New group name, e.g. Scholarship Details"
                  value={sectionNewName}
                  onChange={e => setSectionNewName(e.target.value)}
                />
              )}
            </div>

            {/* Position picker — where within the chosen group the new field appears */}
            <div className="settings-field">
              <label>Position within group</label>
              <select
                className="settings-input"
                value={fieldPosition === 'after' ? afterFieldId : fieldPosition}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'first' || val === 'last') {
                    setFieldPosition(val);
                    setAfterFieldId('');
                  } else {
                    setFieldPosition('after');
                    setAfterFieldId(val);
                  }
                }}
              >
                <option value="first">First field in group</option>
                {positionOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>After: {opt.label}</option>
                ))}
                <option value="last">Last field in group</option>
              </select>
              <span className="ffm-hint">Controls where this field appears on the application form, and the form layout adjusts automatically.</span>
            </div>

            <div className="settings-grid-2">
              <label className="settings-checkbox-row" style={{ alignSelf: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={customRequired} onChange={e => setCustomRequired(e.target.checked)} />
                Required field
              </label>
            </div>

            <div className="settings-form-actions">
              <button type="submit" className="settings-save-btn" disabled={savingCustom}>
                {savingCustom ? 'Creating…' : 'Create Field'}
              </button>
            </div>
          </form>
        )}

        {!showCustomForm && customFields.length === 0 && (
          <p className="ffm-empty-hint">No custom fields yet. Click "+ New Field" to add one.</p>
        )}
      </div>
    </div>
  );
}
