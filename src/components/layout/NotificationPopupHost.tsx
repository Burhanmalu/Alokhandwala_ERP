'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Notification } from '@/lib/schema';
import { useAuth } from '@/lib/auth/auth-context';

const DISMISSED_STORAGE_KEY = 'alokhandwala_dismissed_notif_popups';
const AUTO_DISMISS_MS = 10_000;
const POLL_INTERVAL_MS = 20_000;

function readDismissedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissedSet(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    // Keep at most the latest 200 dismissed IDs to avoid unbounded growth
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage quota errors
  }
}

export function NotificationPopupHost() {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAuth();
  const [popups, setPopups] = useState<Notification[]>([]);
  const shownInSessionRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissPopup = useCallback((id: string, rememberPermanent = true) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    if (rememberPermanent) {
      const dismissed = readDismissedSet();
      dismissed.add(id);
      persistDismissedSet(dismissed);
    }
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const scheduleAutoHide = useCallback(
    (id: string) => {
      if (timersRef.current.has(id)) return;
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    []
  );

  const pollNotifications = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id) return;
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERVISOR') return;

    try {
      const params = new URLSearchParams({
        role: currentUser.role,
        userId: currentUser.id,
      });
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const dismissed = readDismissedSet();
      const unseenUnread: Notification[] = [];

      for (const n of json.data as Notification[]) {
        if (n.isRead) continue;
        if (dismissed.has(n.id)) continue;
        if (shownInSessionRef.current.has(n.id)) continue;
        unseenUnread.push(n);
      }

      if (unseenUnread.length > 0) {
        const batch = unseenUnread.slice(0, 4);
        batch.forEach((n) => {
          shownInSessionRef.current.add(n.id);
          scheduleAutoHide(n.id);
        });
        setPopups((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = batch.filter((n) => !existingIds.has(n.id));
          return [...fresh, ...prev].slice(0, 5);
        });
      }
    } catch {
      // Ignore transient polling failures
    }
  }, [isAuthenticated, currentUser?.id, currentUser?.role, scheduleAutoHide]);

  useEffect(() => {
    if (!isAuthenticated) return;
    pollNotifications();
    const interval = setInterval(pollNotifications, POLL_INTERVAL_MS);
    const onFocus = () => pollNotifications();
    const onUpdated = () => pollNotifications();
    window.addEventListener('focus', onFocus);
    window.addEventListener('notifications-updated', onUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('notifications-updated', onUpdated);
    };
  }, [isAuthenticated, pollNotifications]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const handleViewNotification = async (notif: Notification) => {
    dismissPopup(notif.id, true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notif.id,
          role: currentUser?.role,
          userId: currentUser?.id,
        }),
      });
      window.dispatchEvent(new Event('notifications-updated'));
    } catch {
      // Non-blocking
    }

    if (notif.entityType === 'PROJECT' && notif.entityId) {
      router.push(`/projects/${notif.entityId}`);
    } else {
      router.push('/notifications');
    }
  };

  if (popups.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      aria-live="polite"
    >
      {popups.map((notif) => {
        const isUrgent = notif.type === 'URGENT';
        const isWarning = notif.type === 'WARNING';
        return (
          <div
            key={notif.id}
            onMouseEnter={() => {
              const t = timersRef.current.get(notif.id);
              if (t) {
                clearTimeout(t);
                timersRef.current.delete(notif.id);
              }
            }}
            onMouseLeave={() => scheduleAutoHide(notif.id)}
            className="pointer-events-auto bg-white rounded-xl border border-[#d6c7b2] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-200"
          >
            <div
              className={`px-3.5 py-2 flex items-center justify-between gap-2 text-xs ${
                isUrgent
                  ? 'bg-[#5c1622] text-white'
                  : 'bg-[#24160c] text-[#f7f2eb]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isUrgent || isWarning ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#c79e7c] shrink-0" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-[#c79e7c] shrink-0" />
                )}
                <span className="font-bold truncate">{notif.title}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissPopup(notif.id, true)}
                aria-label="Dismiss notification"
                className="p-0.5 rounded text-stone-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 bg-[#fbf9f5] space-y-2.5 text-xs">
              {notif.projectCode && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-[#e5dac8] font-mono font-bold text-[11px] text-[#4d301c]">
                  <span>Project {notif.projectCode}</span>
                </div>
              )}
              <p className="text-[#24160c] leading-relaxed">{notif.message}</p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => dismissPopup(notif.id, true)}
                  className="px-3 py-1.5 rounded-md border border-[#d6c7b2] bg-white hover:bg-[#f7f2eb] text-[#4d301c] font-semibold text-[11px] transition cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => handleViewNotification(notif)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] font-bold text-[11px] transition cursor-pointer"
                >
                  <span>{notif.entityType === 'PROJECT' && notif.entityId ? 'View Project' : 'View'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

