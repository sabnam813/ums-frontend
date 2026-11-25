import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentFollowUp } from '../../context/StudentFollowUpContext';
import './FollowUpReminderBanner.css';

export default function FollowUpReminderBanner() {
  const { activeReminders, completeReminder, cancelReminder } = useStudentFollowUp();
  const navigate = useNavigate();

  if (!activeReminders || activeReminders.length === 0) return null;

  return (
    <div className="sfu-reminder-banner">
      {activeReminders.map(r => (
        <div key={r.id} className={`sfu-reminder-item ${r.isOverdue ? 'overdue' : ''}`}>
          <span className="sfu-reminder-time">{r.isOverdue ? 'OVERDUE' : 'SOON'}</span>
          <span className="sfu-reminder-meta">
            <b>{r.studentName || 'Student'}</b>{r.countryName ? ` — ${r.countryName}` : ''}
            {r.time ? ` · ${new Date(r.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
          </span>
          <span className="sfu-reminder-actions">
            <button className="sfu-reminder-view" onClick={() => navigate(r.link)}>View</button>
            <button className="sfu-reminder-complete" onClick={() => completeReminder(r.followUpId)}>Complete</button>
            <button className="sfu-reminder-cancel" onClick={() => cancelReminder(r.followUpId)}>Cancel</button>
          </span>
        </div>
      ))}
    </div>
  );
}
