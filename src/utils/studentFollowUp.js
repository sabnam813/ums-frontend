import { format } from 'date-fns';

export const METHOD_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In person' },
  { value: 'sms', label: 'SMS' },
  { value: 'other', label: 'Other' },
];

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_response', label: 'No response' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const OUTCOME_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'no_response', label: 'No response' },
  { value: 'cancelled', label: 'Closed / not continuing' },
];

const METHOD_MAP = METHOD_OPTIONS.reduce((acc, m) => { acc[m.value] = m.label; return acc; }, {});
const STATUS_MAP = STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = s.label; return acc; }, {});

export function methodLabel(value) {
  return METHOD_MAP[value] || '—';
}

export function statusLabel(value) {
  return STATUS_MAP[value] || '—';
}

export function toDateTimeLocal(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy, h:mm a');
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy');
}

export function isOverdue(row) {
  if (!row || row.status !== 'pending' || !row.scheduledAt) return false;
  return new Date(row.scheduledAt) < new Date();
}

export function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function isDueTodayPending(row) {
  if (!row || row.status !== 'pending' || !row.scheduledAt) return false;
  return isToday(row.scheduledAt) && !isOverdue(row);
}
