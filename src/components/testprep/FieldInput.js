import React from 'react';
import AssociateSelect from '../shared/AssociateSelect';

export default function FieldInput({ field, value, onChange, optionsByField = {}, suggestions = {}, idPrefix = 'tp', className = 'af-input' }) {
  const v = value ?? '';
  const options = field.optionsKey ? (optionsByField[field.optionsKey] || []) : [];
  switch (field.input) {
    case 'associate':
      return <AssociateSelect value={v} onChange={onChange} placeholder="Select or type associate…" allowCustom />;
    case 'date':
      return <input type="date" className={className} value={v} onChange={e => onChange(e.target.value)} />;
    case 'number':
      return <input type="number" step="0.01" className={className} placeholder="0.00" value={v} onChange={e => onChange(e.target.value)} />;
    case 'textarea':
      return <textarea className={className} rows={3} value={v} onChange={e => onChange(e.target.value)} />;
    case 'select': {
      const list = v && !options.includes(v) ? [v, ...options] : options;
      return (
        <select className={className} value={v} onChange={e => onChange(e.target.value)}>
          <option value="">Select…</option>
          {list.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'suggest': {
      const list = [...new Set([...(options || []), ...(suggestions[field.suggest] || [])])];
      const id = `${idPrefix}-${field.key}`;
      return (
        <>
          <input type="text" className={className} list={id} value={v} onChange={e => onChange(e.target.value)} />
          <datalist id={id}>{list.map(o => <option key={o} value={o} />)}</datalist>
        </>
      );
    }
    default:
      return <input type="text" className={className} value={v} onChange={e => onChange(e.target.value)} />;
  }
}
