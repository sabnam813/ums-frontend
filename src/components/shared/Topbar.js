import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import './Topbar.css';

export default function Topbar({ title, breadcrumb, onMobileMenuToggle, mobileOpen }) {
  const {
    visibleNotifications, hasMore, unreadCount,
    markAllRead, markRead, removeNotification,
    loadMore, resetVisible,
  } = useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        resetVisible();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [resetVisible]);

  return (
    <header className="topbar">
      <div className="topbar-left">
                <button
          className={`mobile-menu-btn ${mobileOpen ? 'open' : ''}`}
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {mobileOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>

        {breadcrumb ? (
          <nav className="breadcrumb" aria-label="breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i} className="breadcrumb-item">
                {i < breadcrumb.length - 1 ? (
                  <>
                    <span className="crumb-link">{b}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </>
                ) : (
                  <span className="crumb-current">{b}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="topbar-title">{title}</h1>
        )}
      </div>

      <div className="topbar-right">
                <div className="topbar-date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>

                <div className="notif-wrap" ref={ref}>
          <button
            className={`notif-btn ${open ? 'open' : ''}`}
            onClick={() => setOpen(v => !v)}
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {open && (
            <div className="notif-panel animate-fade">
              <div className="notif-header">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {visibleNotifications.length === 0 ? (
                  <div className="notif-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <p>No notifications</p>
                  </div>
                ) : visibleNotifications.map(n => (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.read ? 'unread' : ''} notif-${n.type || 'info'}`}
                    onClick={() => markRead(n.id)}
                  >
                    <div className="notif-dot" />
                    <div className="notif-content">
                      <p className="notif-msg">{n.message}</p>
                      {n.addedBy && n.addedBy !== '—' && (
                        <span className="notif-meta">Added by {n.addedBy}</span>
                      )}
                      <span className="notif-time">
                        {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      className="notif-remove"
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      aria-label="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}

                {hasMore && (
                  <button className="notif-view-more" onClick={loadMore}>
                    View more notifications
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

                <div className="topbar-user">
          <div className="topbar-avatar">
            {(user?.name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{user?.name || user?.username}</span>
            <span className={`topbar-user-role ${user?.role}`}>{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
