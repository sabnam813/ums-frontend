import React from 'react';
import { useAssociateStatus } from '../../hooks/useAssociateOptions';
import { statusColor } from '../../utils/associateStatus';

export default function AssociateName({ name, empty = null }) {
  const statusOf = useAssociateStatus();
  const v = String(name || '').trim();
  if (!v) return empty;
  const color = statusColor(statusOf(v));
  return <span style={color ? { color, fontWeight: 600 } : undefined}>{v}</span>;
}
