import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { hasPermission } from '../utils/rbac';

const StudentFollowUpContext = createContext(null);

const STATS_POLL_MS = 60000;
const EMPTY_STATS = { overdue: 0, today: 0, upcoming: 0, pending: 0, completed: 0, total: 0 };

export function StudentFollowUpProvider({ children }) {
  const { user } = useAuth();
  const chat = useChat();
  const socket = chat?.socket || null;

  const [stats, setStats] = useState(EMPTY_STATS);
  const [reminders, setReminders] = useState([]);
  const [activeReminders, setActiveReminders] = useState([]);
  const seenRef = useRef(new Set());

  const canView = !!user && hasPermission(user, 'studentFollowUp', 'view');
  const canBanner = canView && user.role !== 'super_admin';

  const refreshStats = useCallback(async () => {
    if (!canView) { setStats(EMPTY_STATS); return; }
    try {
      const res = await axios.get('/student-follow-ups/stats');
      setStats({ ...EMPTY_STATS, ...(res.data.stats || {}) });
    } catch {
    }
  }, [canView]);

  useEffect(() => {
    if (!canView) { setStats(EMPTY_STATS); return undefined; }
    refreshStats();
    const id = setInterval(refreshStats, STATS_POLL_MS);
    return () => clearInterval(id);
  }, [canView, refreshStats]);

  const refreshActiveReminders = useCallback(async () => {
    if (!canBanner) { setActiveReminders([]); return; }
    try {
      const res = await axios.get('/student-follow-ups/notifications');
      setActiveReminders(res.data.notifications || []);
    } catch {
    }
  }, [canBanner]);

  useEffect(() => {
    if (!canBanner) { setActiveReminders([]); return undefined; }
    refreshActiveReminders();
    const id = setInterval(refreshActiveReminders, STATS_POLL_MS);
    return () => clearInterval(id);
  }, [canBanner, refreshActiveReminders]);

  const completeReminder = useCallback(async (followUpId) => {
    setActiveReminders(prev => prev.filter(r => r.followUpId !== followUpId));
    try {
      await axios.post(`/student-follow-ups/${followUpId}/complete`, { outcome: 'completed' });
      toast.success('Follow-up marked complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      refreshStats();
      refreshActiveReminders();
    }
  }, [refreshStats, refreshActiveReminders]);

  const cancelReminder = useCallback(async (followUpId) => {
    setActiveReminders(prev => prev.filter(r => r.followUpId !== followUpId));
    try {
      await axios.post(`/student-follow-ups/${followUpId}/cancel`, {});
      toast.success('Follow-up cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel follow-up');
    } finally {
      refreshStats();
      refreshActiveReminders();
    }
  }, [refreshStats, refreshActiveReminders]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (window.Notification.permission === 'granted') return true;
    if (window.Notification.permission === 'denied') return false;
    try {
      const result = await window.Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!canBanner) return;
    const alreadyAsked = localStorage.getItem('sfu_notif_asked');
    if (alreadyAsked) return;
    localStorage.setItem('sfu_notif_asked', '1');
    requestBrowserPermission();
  }, [canBanner, requestBrowserPermission]);

  useEffect(() => {
    if (!socket || !canView) return undefined;

    const handler = (payload) => {
      if (!payload?.id || seenRef.current.has(payload.id)) return;
      seenRef.current.add(payload.id);

      if (canBanner) {
        const when = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
        const timeStr = when
          ? when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        const body = `${payload.studentName || 'Student'}${payload.country ? ` — ${payload.country}` : ''}${timeStr ? ` at ${timeStr}` : ''}`;

        setReminders(prev => [{ ...payload, receivedAt: new Date() }, ...prev].slice(0, 25));
        toast(`Follow-up due soon: ${body}`, { icon: '⏰', duration: 8000 });

        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          try {
            const n = new window.Notification('Follow-up starting soon', { body, tag: payload.id });
            n.onclick = () => { window.focus(); n.close(); };
          } catch {
          }
        }
      }

      refreshStats();
      refreshActiveReminders();
    };

    socket.on('studentFollowUp:reminder', handler);
    return () => { socket.off('studentFollowUp:reminder', handler); };
  }, [socket, canView, canBanner, refreshStats, refreshActiveReminders]);

  const dismissReminder = useCallback((id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <StudentFollowUpContext.Provider
      value={{
        stats,
        refreshStats,
        reminders,
        dismissReminder,
        requestBrowserPermission,
        activeReminders,
        refreshActiveReminders,
        completeReminder,
        cancelReminder,
      }}
    >
      {children}
    </StudentFollowUpContext.Provider>
  );
}

export function useStudentFollowUp() {
  return useContext(StudentFollowUpContext) || {
    stats: EMPTY_STATS,
    refreshStats: () => {},
    reminders: [],
    dismissReminder: () => {},
    requestBrowserPermission: async () => false,
    activeReminders: [],
    refreshActiveReminders: () => {},
    completeReminder: async () => {},
    cancelReminder: async () => {},
  };
}
