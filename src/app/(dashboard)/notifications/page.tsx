'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Check,
  MapPin,
  Calendar,
  UserCheck,
  ArrowUpRight,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Notification } from '@/lib/schema';
import { formatDate, formatDateTime } from '@/lib/formatters';

export default function NotificationsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  useEffect(() => {
    fetchNotifications();
  }, [currentUser?.id, currentUser?.role]);

  const fetchNotifications = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentUser?.role) params.set('role', currentUser.role);
      if (currentUser?.id) params.set('userId', currentUser.id);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load notifications');
      }
      setNotifications(json.data || []);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (e: any) {
      setError(e.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markAllRead: true,
        role: currentUser?.role,
        userId: currentUser?.id,
      }),
    });
    fetchNotifications();
  };

  const handleMarkSingleRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    fetchNotifications();
  };

  const handleDeleteNotification = async (id: string) => {
    setError(null);
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: id,
          role: currentUser?.role,
          userId: currentUser?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete notification');
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (e: any) {
      setError(e.message || 'Unable to delete notification');
    }
  };

  const handleOpenNotification = async (n: Notification) => {
    if (!n.isRead) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: n.id }),
      }).catch(() => {});
      window.dispatchEvent(new Event('notifications-updated'));
    }
    if (n.entityType === 'PROJECT' && n.entityId) {
      router.push(`/projects/${n.entityId}`);
    } else {
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-5">
      <div className="bg-[#24160c] text-white px-5 py-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#3a2517]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#c79e7c] font-semibold">
            Alerts & Scheduled Reminders
          </p>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mt-0.5">
            <Bell className="w-5 h-5 text-[#c79e7c] shrink-0" />
            <span>Notification Center</span>
            {unreadCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#c79e7c] text-[#24160c]">
                {unreadCount} Unread
              </span>
            )}
          </h1>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#24160c] bg-[#fbf9f5] border border-[#d6c7b2] rounded-lg hover:bg-[#f3ebe1] transition w-full sm:w-auto min-h-[38px] shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4 text-[#8f6541]" />
          <span>Mark All as Read</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#7d6553]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 bg-white rounded-xl border border-[#e5dac8] text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-[#fbf7f0] border border-[#ebdcc9] flex items-center justify-center mx-auto">
              <Bell className="w-5 h-5 text-[#8f6541]" />
            </div>
            <h2 className="text-sm font-bold text-[#24160c]">No Notifications Yet</h2>
            <p className="text-xs text-[#7d6553] max-w-sm mx-auto">
              You&apos;re all caught up! New notifications will appear here when an activity occurs.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const isProjectLink = n.entityType === 'PROJECT' && Boolean(n.entityId);

            return (
              <div
                key={n.id}
                onClick={() => isProjectLink && handleOpenNotification(n)}
                className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  isProjectLink ? 'cursor-pointer hover:border-[#8f6541]' : ''
                } ${
                  n.isRead
                    ? 'bg-white border-[#e5dac8] text-[#574830]'
                    : 'bg-[#fbf7f0] border-[#c79e7c] text-[#24160c] shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'WARNING' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : n.type === 'SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Info className="w-5 h-5 text-[#8f6541]" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-xs text-[#24160c]">{n.title}</h3>
                      {!n.isRead && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#24160c] text-[#c79e7c] text-[9px] font-bold uppercase tracking-wider">
                          New
                        </span>
                      )}
                      {n.projectCode && (
                        <span className="px-2 py-0.5 rounded bg-white border border-[#d6c7b2] font-mono text-[10px] font-bold text-[#24160c]">
                          {n.projectCode}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#4d301c] leading-relaxed">{n.message}</p>

                    {(n.siteAddress || n.installationDate || n.removalDate || n.remainingDays !== undefined || n.supervisorName) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#7d6553] pt-0.5">
                        {n.installationDate && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#24160c]">
                            <Calendar className="w-3 h-3 text-[#8f6541]" />
                            Install: {formatDate(n.installationDate)}
                          </span>
                        )}
                        {n.removalDate && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#24160c]">
                            <Calendar className="w-3 h-3 text-[#8f6541]" />
                            Removal: {formatDate(n.removalDate)}
                          </span>
                        )}
                        {n.remainingDays !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                              n.remainingDays < 0
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : n.remainingDays <= 1
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {n.remainingDays < 0
                              ? `${Math.abs(n.remainingDays)}d Overdue`
                              : n.remainingDays === 0
                              ? 'Expires Today'
                              : `${n.remainingDays}d Remaining`}
                          </span>
                        )}
                        {n.siteAddress && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#8f6541]" />
                            {n.siteAddress}
                          </span>
                        )}
                        {n.supervisorName && (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-[#8f6541]" />
                            Supervisor: {n.supervisorName}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-[#9c826e] font-mono">
                      <span>{formatDateTime(n.createdAt)}</span>
                      {n.roleTarget && (
                        <span className="px-1.5 py-0.2 rounded bg-[#f7f2eb] text-[#714f36] border border-[#ebdcc9] uppercase">
                          Target: {n.roleTarget}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                  {isProjectLink && (
                    <Link
                      href={`/projects/${n.entityId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.isRead) {
                          handleMarkSingleRead(n.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] rounded-md transition"
                    >
                      <span>Open Project</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkSingleRead(n.id);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-[#574830] hover:text-[#24160c] bg-white border border-[#d6c7b2] rounded-md hover:bg-[#faf6ee] transition cursor-pointer"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(n.id);
                    }}
                    title="Delete notification"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-700" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
