import { NextRequest, NextResponse } from 'next/server';
import { ScaffoldingCalculatorService, ScaffoldingCalculationInput } from '@/lib/services/scaffolding-calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const length = Number(body.length);
    const width = Number(body.width);
    const height = Number(body.height);
    const unit = (body.unit === 'METERS' ? 'METERS' : 'FEET');

    if (isNaN(length) || length <= 0) {
      return NextResponse.json({ success: false, error: 'Valid site length is required (> 0)' }, { status: 400 });
    }
    if (isNaN(width) || width <= 0) {
      return NextResponse.json({ success: false, error: 'Valid site width is required (> 0)' }, { status: 400 });
    }
    if (isNaN(height) || height <= 0) {
      return NextResponse.json({ success: false, error: 'Valid site height is required (> 0)' }, { status: 400 });
    }

    const input: ScaffoldingCalculationInput = {
      length,
      width,
      height,
      unit,
      configurationType: body.configurationType || 'PERIMETER_FACADE',
      facadeFaces: body.facadeFaces || '4_SIDES_PERIMETER',
      deckLevels: body.deckLevels || 'TOP_DECK_ONLY',
      baySpacingPreference: body.baySpacingPreference ? Number(body.baySpacingPreference) : 8,
      jaliPreference: body.jaliPreference === 'BASS' ? 'BASS' : 'MS',
    };

    const result = await ScaffoldingCalculatorService.generatePlans(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error calculating scaffolding plans:', error);
    return NextResponse.json({ success: false, error: error.message || 'Calculation failed' }, { status: 500 });
  }
}
