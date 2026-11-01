import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/project-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'Cancellation reason is mandatory.' },
        { status: 400 }
      );
    }

    const result = await ProjectService.cancelProject({
      projectId: id,
      reason: body.reason.trim(),
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu (Admin)',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

