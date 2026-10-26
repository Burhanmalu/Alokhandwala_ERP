import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const notifications = dbStore.getNotifications();
    return NextResponse.json({ success: true, count: notifications.length, data: notifications });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, markAllRead } = body;

    await dbStore.transaction((state) => {
      if (markAllRead) {
        state.notifications.forEach(n => { n.isRead = true; });
      } else if (notificationId) {
        const notif = state.notifications.find(n => n.id === notificationId);
        if (notif) notif.isRead = true;
      }
    });

    return NextResponse.json({ success: true, message: 'Notifications updated' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
