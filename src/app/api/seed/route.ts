import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Demonstration seed reset is disabled. The system operates on real database records only.' 
    }, 
    { status: 403 }
  );
}
