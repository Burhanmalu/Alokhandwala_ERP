'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Notification } from '@/lib/schema';
import { formatDateTime } from '@/lib/formatters';

export default function NotificationsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
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

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Notifications</span>
          </h1>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition w-full sm:w-auto min-h-[40px] shrink-0"
        >
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            No active notifications.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition flex items-start justify-between gap-4 ${
                n.isRead
                  ? 'bg-white border-slate-200 text-slate-600'
                  : 'bg-emerald-50/50 border-emerald-300 text-slate-900 shadow-2xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {n.type === 'WARNING' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : n.type === 'SUCCESS' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs">{n.title}</h3>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-1">
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.roleTarget && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                        Target: {n.roleTarget}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!n.isRead && (
                <button
                  onClick={() => handleMarkSingleRead(n.id)}
                  className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 rounded hover:bg-slate-200 transition"
                >
                  Dismiss
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
