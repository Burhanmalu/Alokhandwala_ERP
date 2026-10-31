import { NextRequest, NextResponse } from 'next/server';
import { WorkerReportService } from '@/lib/services/worker-report-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || undefined;
    const month = searchParams.get('month') || undefined;
    const role = (searchParams.get('role') as any) || undefined;
    const employeeName = searchParams.get('employeeName') || undefined;
    const compareA = searchParams.get('compareA');
    const compareB = searchParams.get('compareB');

    // If cross-month comparison requested
    if (compareA && compareB) {
      const comparison = WorkerReportService.compareMonths(compareA, compareB);
      return NextResponse.json({
        success: true,
        data: comparison,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const report = WorkerReportService.generatePerformanceReport({
      year,
      month,
      role,
      employeeName,
    });

    return NextResponse.json({
      success: true,
      data: report,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate performance report' },
      { status: 500 }
    );
  }
}

