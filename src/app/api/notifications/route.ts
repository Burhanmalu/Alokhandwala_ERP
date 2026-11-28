import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ReminderService } from '@/lib/services/reminder-service';
import { Notification } from '@/lib/schema';

export const dynamic = 'force-dynamic';

function filterNotificationsForViewer(
  notifications: Notification[],
  role?: string | null,
  userId?: string | null
): Notification[] {
  return notifications.filter((n) => {
    if (n.userId && userId && n.userId !== userId) {
      return false;
    }
    if (role && role !== 'ADMIN' && n.roleTarget && n.roleTarget !== role) {
      return false;
    }
    return true;
  });
}

export async function GET(req: NextRequest) {
  try {
    await dbStore.ensureSynced();
    await ReminderService.processDueInstallationReminders();
    await ReminderService.processDueRentalExpiryReminders();
    await ReminderService.processDuePaymentReminders();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const userId = searchParams.get('userId');

    const allNotifications = dbStore.getNotifications();
    const notifications = filterNotificationsForViewer(allNotifications, role, userId);
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, markAllRead, role, userId } = body;

    await dbStore.transaction((state) => {
      if (markAllRead) {
        const visibleIds = new Set(
          filterNotificationsForViewer(state.notifications, role, userId).map((n) => n.id)
        );
        state.notifications.forEach((n) => {
          if (visibleIds.has(n.id)) {
            n.isRead = true;
          }
        });
      } else if (notificationId) {
        const notif = state.notifications.find((n) => n.id === notificationId);
        if (notif) notif.isRead = true;
      }
    });

    const visible = filterNotificationsForViewer(dbStore.getNotifications(), role, userId);
    const unreadCount = visible.filter((n) => !n.isRead).length;
    return NextResponse.json({ success: true, unreadCount, message: 'Notifications updated' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const notificationId = body.notificationId || searchParams.get('id');
    const role = body.role || searchParams.get('role');
    const userId = body.userId || searchParams.get('userId');

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    await dbStore.transaction((state) => {
      state.notifications = state.notifications.filter((n) => n.id !== notificationId);
    });

    const visible = filterNotificationsForViewer(dbStore.getNotifications(), role, userId);
    const unreadCount = visible.filter((n) => !n.isRead).length;
    return NextResponse.json({ success: true, unreadCount, message: 'Notification deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
