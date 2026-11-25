import React, { useState, useMemo } from 'react';
import Select from 'react-select';
import AssociateSelect from './AssociateSelect';
import './ApplicationForm.css';
import { useFieldConfig, toSelectOptions } from '../../hooks/useFieldConfig';
import { FIELD_DEFS, FORM_FIELD_KEYS, mapCustomFieldsForLayout } from '../../utils/countryLayouts';
import {
  menuPortalProps,
  IntakePicker,
  CustomFieldInput,
  blankUniversity,
  UniversityCourseTable,
  InlineCustomFields,
} from './ApplicationForm';

const PAIRABLE = ['select', 'date', 'intake'];
const FIXED_KEYS = ['date', 'referredBy', 'name', 'level', 'course', 'providerName'];

function Pick({ label, field, form, set, options, loading }) {
  return (
    <div className="af-field" key={field}>
      <label>{label}</label>
      <Select
        className="custom-select"
        classNamePrefix="react-select"
        {...menuPortalProps}
        options={toSelectOptions(options || [])}
        value={form[field] ? { value: form[field], label: form[field] } : null}
        onChange={opt => set(field, opt?.value || '')}
        isLoading={loading}
        isClearable
        placeholder="Select…"
      />
    </div>
  );
}

export default function ProfileApplicationForm({ row, layout, onSave, onClose }) {
  const isEdit = !!row?._id;
  const today = new Date().toISOString().split('T')[0];
  const { customFieldsBySection: rawCustom, loading } = useFieldConfig();
  const customFieldsBySection = useMemo(() => mapCustomFieldsForLayout(rawCustom, layout), [rawCustom, layout]);

  const initialUniversities = (row?.universities && row.universities.length > 0)
    ? row.universities.map(u => ({ level: u.level || '', course: u.course || '', providerName: u.providerName || '' }))
    : [{ level: row?.level || '', course: row?.course || '', providerName: row?.providerName || '' }];

  const [form, setForm] = useState(() => {
    const base = {};
    FORM_FIELD_KEYS.filter(k => !FIXED_KEYS.includes(k)).forEach(k => { base[k] = row?.[k] || ''; });
    return { ...base, date: row?.date || today, referredBy: row?.referredBy || '', name: row?.name || '' };
  });
  const [universities, setUniversities] = useState(initialUniversities);
  const [customValues, setCustomValues] = useState({ ...(row?.customFields || {}) });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setCustom = (key, val) => setCustomValues(v => ({ ...v, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Applicant name is required';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const cleaned = universities.filter((u, idx) => idx === 0 || u.level || u.course || u.providerName);
    const primary = cleaned[0] || blankUniversity();
    onSave({
      ...row,
      ...form,
      level: primary.level,
      course: primary.course,
      providerName: primary.providerName,
      universities: cleaned,
      customFields: customValues,
    });
  };

  const titles = layout.sections.map(s => s.title);
  const customSections = Object.entries(customFieldsBySection)
    .filter(([name]) => name !== 'Basic Information' && !titles.includes(name));

  const ic = (sectionName, position) => (
    <InlineCustomFields
      key={`${sectionName}-${position}`}
      sectionName={sectionName}
      position={position}
      customFieldsBySection={customFieldsBySection}
      customValues={customValues}
      setCustom={setCustom}
    />
  );

  const renderField = (key) => {
    const def = FIELD_DEFS[key] || {};
    const label = layout.labelOf(key, 'form');
    switch (def.kind) {
      case 'select':
        return <Pick key={key} label={label} field={key} form={form} set={set} options={layout.optionsFor(key)} loading={loading} />;
      case 'date':
        return (
          <div className="af-field" key={key}>
            <label>{label}</label>
            <input type="date" className="af-input" value={form[key] || ''} onChange={e => set(key, e.target.value)} />
          </div>
        );
      case 'intake':
        return (
          <div className="af-field" key={key}>
            <label>{label}</label>
            <IntakePicker value={form[key]} onChange={v => set(key, v)} placeholder={def.placeholder} />
          </div>
        );
      case 'textarea':
        return (
          <div className="af-field" key={key}>
            <label>{label}</label>
            <textarea className="af-textarea" placeholder={def.placeholder} value={form[key] || ''} onChange={e => set(key, e.target.value)} rows={3} />
          </div>
        );
      default:
        return (
          <div className="af-field" key={key}>
            <label>{label}</label>
            <input type="text" className="af-input" placeholder={def.placeholder} value={form[key] || ''} onChange={e => set(key, e.target.value)} />
          </div>
        );
    }
  };

  const renderSection = (sec) => {
    const out = [ic(sec.title, 'first')];
    let pending = [];
    const flush = () => {
      if (!pending.length) return;
      out.push(
        <div className="af-grid-2" key={`grid-${pending.join('-')}`}>
          {pending.map(renderField)}
        </div>
      );
      pending.forEach(k => out.push(ic(sec.title, k)));
      pending = [];
    };
    sec.keys.forEach(key => {
      if (layout.isHidden(key)) {
        flush();
        out.push(ic(sec.title, key));
        return;
      }
      const def = FIELD_DEFS[key] || {};
      if (PAIRABLE.includes(def.kind)) {
        pending.push(key);
        if (pending.length === 2) flush();
      } else {
        flush();
        out.push(renderField(key));
        out.push(ic(sec.title, key));
      }
    });
    flush();
    out.push(ic(sec.title, 'last'));
    return out;
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-modal animate-slide-right">
        <div className="af-header">
          <div className="af-header-left">
            <div className="af-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Application' : 'New Application'}</h3>
              <p>{isEdit ? `Editing: ${row.name}` : 'Fill in the applicant details below'}</p>
            </div>
          </div>
          <button className="af-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="af-form">
          <div className="af-section">
            <div className="af-section-title"><span className="af-section-num">1</span>Basic Information</div>
            {ic('Basic Information', 'first')}
            <div className="af-grid-2">
              <div className={`af-field ${errors.date ? 'has-error' : ''}`}>
                <label>Date *</label>
                <input type="date" className="af-input" value={form.date} onChange={e => set('date', e.target.value)} />
                {errors.date && <span className="af-error">{errors.date}</span>}
              </div>
              <div className="af-field">
                <label>Referred By</label>
                <AssociateSelect value={form.referredBy} onChange={v => set('referredBy', v)} placeholder="Select associate…" />
              </div>
            </div>
            {ic('Basic Information', 'referredBy')}
            <div className={`af-field ${errors.name ? 'has-error' : ''}`}>
              <label>Applicant Name *</label>
              <input type="text" className="af-input" placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
              {errors.name && <span className="af-error">{errors.name}</span>}
            </div>
            {ic('Basic Information', 'name')}
            <div className="af-field">
              <label>Universities &amp; Courses</label>
              <UniversityCourseTable universities={universities} onChange={setUniversities} options={layout.optionsFor('level')} fieldsLoading={loading} />
            </div>
            {ic('Basic Information', 'course')}
            {ic('Basic Information', 'last')}
          </div>

          {layout.sections.map((sec, idx) => (
            <div className="af-section" key={sec.title}>
              <div className="af-section-title"><span className="af-section-num">{idx + 2}</span>{sec.title}</div>
              {renderSection(sec)}
            </div>
          ))}

          {customSections.map(([sectionName, fields], idx) => (
            <div className="af-section" key={sectionName}>
              <div className="af-section-title"><span className="af-section-num">{layout.sections.length + 2 + idx}</span>{sectionName}</div>
              {fields.map(field => (
                <div className="af-field" key={field._id}>
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                  <CustomFieldInput field={field} value={customValues[field.key] || ''} onChange={v => setCustom(field.key, v)} />
                </div>
              ))}
            </div>
          ))}

          <div className="af-footer">
            <button type="button" className="af-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="af-submit">
              {isEdit ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
