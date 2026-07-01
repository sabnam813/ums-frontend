import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30000;
const PAGE_SIZE = 5;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_seen') || '[]')); }
    catch { return new Set(); }
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const seenIdsRef = useRef(seenIds);

  useEffect(() => { seenIdsRef.current = seenIds; }, [seenIds]);

  const persistSeen = useCallback((ids) => {
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem('notif_seen', JSON.stringify(arr));
  }, []);

  const applySeenToNotifs = useCallback((notifs) =>
    notifs.map(n => ({ ...n, read: seenIdsRef.current.has(String(n.id)) }))
  , []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get('/applications/notifications/recent');
      setNotifications(applySeenToNotifs(res.data.notifications || []));
    } catch {
      
    }
  }, [applySeenToNotifs]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [{ id: Date.now(), time: new Date(), read: false, type: 'info', ...notif }, ...prev]);
  }, []);

  const markRead = useCallback((id) => {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(String(id));
      persistSeen(next);
      return next;
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [persistSeen]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = new Set(seenIdsRef.current);
      prev.forEach(n => next.add(String(n.id)));
      persistSeen(next);
      setSeenIds(next);
      return prev.map(n => ({ ...n, read: true }));
    });
  }, [persistSeen]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount(c => c + PAGE_SIZE);
  }, []);

  const resetVisible = useCallback(() => {
    setVisibleCount(PAGE_SIZE);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = notifications.length > visibleCount;

  return (
    <NotificationContext.Provider value={{
      notifications, visibleNotifications, hasMore, unreadCount,
      addNotification, markAllRead, markRead, removeNotification,
      loadMore, resetVisible, refetch: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be within NotificationProvider');
  return ctx;
};
