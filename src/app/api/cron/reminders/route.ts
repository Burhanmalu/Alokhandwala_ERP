import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ReminderService } from '@/lib/services/reminder-service';

export const dynamic = 'force-dynamic';

async function runRemindersCron(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    await dbStore.ensureSynced();
    await ReminderService.syncAllAndProcessDueReminders();

    return NextResponse.json({
      success: true,
      ranAtIst: ReminderService.getIstParts(),
      message: 'Automated project reminders processed successfully.',
    });
  } catch (error: any) {
    console.error('[Cron /api/cron/reminders] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process reminders' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runRemindersCron(req);
}

export async function POST(req: NextRequest) {
  return runRemindersCron(req);
}

