import React from 'react';
import { ASSOCIATE_TYPES } from '../../utils/associateStatus';
import './AssociateTypeFilter.css';

export default function AssociateTypeFilter({ value, onChange, label = 'Associate Type', wrap = true }) {
  const select = (
    <select className="atf-select" value={value || 'All'} onChange={e => onChange(e.target.value)}>
      {ASSOCIATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
  if (!wrap) return select;
  return (
    <div className="filter-field">
      <label>{label}</label>
      {select}
    </div>
  );
}
