import React from 'react';

export default function AssociateComboInput({ id, value, onChange, options = [], placeholder = 'All associates…' }) {
  const listId = `${id}-associate-list`;
  return (
    <>
      <input
        type="text"
        className="reports-associate-input"
        list={listId}
        value={value || ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map(name => <option key={name} value={name} />)}
      </datalist>
    </>
  );
}
