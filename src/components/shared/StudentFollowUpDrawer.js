import React from 'react';
import StudentFollowUpEntries from './StudentFollowUpEntries';
import './StudentFollowUpDrawer.css';

export default function StudentFollowUpDrawer({ applicationId, onClose, onChanged }) {
  return (
    <div className="sfu-drawer-overlay" onClick={onClose}>
      <div className="sfu-drawer" onClick={e => e.stopPropagation()}>
        <div className="sfu-drawer-head">
          <h3>Follow-up history</h3>
          <button className="sfu-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sfu-drawer-body">
          <StudentFollowUpEntries applicationId={applicationId} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}
