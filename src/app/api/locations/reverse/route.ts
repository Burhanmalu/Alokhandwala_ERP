import { NextRequest, NextResponse } from 'next/server';
import { LocationService } from '@/lib/services/location-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude parameters are required' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid latitude or longitude coordinates' },
        { status: 400 }
      );
    }

    const geocoded = await LocationService.reverseGeocode(lat, lng);
    return NextResponse.json({ success: true, data: geocoded });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Reverse geocoding failed' },
      { status: 500 }
    );
  }
}

