import { NextRequest, NextResponse } from 'next/server';
import { LocationService } from '@/lib/services/location-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    let searchCenter: { lat: number; lng: number } | undefined;
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        searchCenter = { lat, lng };
      }
    }

    const suggestions = await LocationService.searchAddress(query, searchCenter);
    return NextResponse.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Location search failed' },
      { status: 500 }
    );
  }
}

