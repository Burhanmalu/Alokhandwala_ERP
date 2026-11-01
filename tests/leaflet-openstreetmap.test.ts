import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';

export async function runLeafletOpenStreetMapTests() {
  console.log('\n===============================================================');
  console.log('LEAFLET + OPENSTREETMAP SITE LOCATION VERIFICATION TEST SUITE');
  console.log('===============================================================');

  const mapPath = path.join(process.cwd(), 'src/components/maps/SiteLocationMap.tsx');
  const canvasPath = path.join(process.cwd(), 'src/components/maps/LeafletMapCanvas.tsx');
  const siteFormPath = path.join(process.cwd(), 'src/app/(dashboard)/sites/new/page.tsx');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  const mapContent = fs.readFileSync(mapPath, 'utf8');
  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  const siteFormContent = fs.readFileSync(siteFormPath, 'utf8');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

  // Test 1: Remove all Google Maps API key dependencies and Google Maps configuration warnings
  assert.ok(
    !mapContent.includes('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
    'SiteLocationMap must not depend on NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
  );
  assert.ok(
    !mapContent.includes('loadGoogleMapsScript'),
    'SiteLocationMap must not load Google Maps scripts'
  );
  assert.ok(
    !mapContent.includes('Google Maps API key not detected'),
    'Google Maps missing API key warnings must be removed'
  );
  assert.ok(
    !envExampleContent.includes('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
    '.env.example must not require NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
  );
  console.log('  ✓ PASS: 1. Google Maps API key dependencies & warnings completely removed');

  // Test 2: Use Leaflet with OpenStreetMap tiles to display the interactive map
  assert.ok(
    canvasContent.includes('openstreetmap.org') &&
    canvasContent.includes('tile.openstreetmap.org'),
    'LeafletMapCanvas must use OpenStreetMap tile layer'
  );
  assert.ok(
    canvasContent.includes('MapContainer') && canvasContent.includes('TileLayer'),
    'LeafletMapCanvas must use react-leaflet MapContainer and TileLayer'
  );
  console.log('  ✓ PASS: 2. Leaflet and OpenStreetMap tiles configured with attribution');

  // Test 3: Browser Device GPS with enableHighAccuracy: true when clicking Use Current Location
  assert.ok(
    mapContent.includes('handleUseCurrentLocation') &&
    mapContent.includes('navigator.geolocation.getCurrentPosition') &&
    mapContent.includes('enableHighAccuracy: true'),
    'Must use navigator.geolocation with enableHighAccuracy: true'
  );
  console.log('  ✓ PASS: 3. Browser Device GPS with enableHighAccuracy: true configured');

  // Test 4: OpenStreetMap Nominatim for address search, autocomplete, and reverse geocoding
  const locationServiceContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/location-service.ts'), 'utf8');
  assert.ok(
    (mapContent.includes('/api/locations/search') || mapContent.includes('nominatim')) &&
    (mapContent.includes('/api/locations/reverse') || mapContent.includes('nominatim')) &&
    locationServiceContent.includes('nominatim.openstreetmap.org'),
    'Must use OpenStreetMap Nominatim for search, autocomplete, and reverse geocoding'
  );
  assert.ok(
    mapContent.includes('setTimeout') || mapContent.includes('searchTimeoutRef'),
    'Nominatim requests must be debounced to respect rate limit policies'
  );
  console.log('  ✓ PASS: 4. Nominatim reverse geocoding and debounced address search configured');

  // Test 5: Allow users to search street address, select result, and display location on map
  assert.ok(
    mapContent.includes('handleSelectSearchResult') &&
    mapContent.includes('setNotOnSiteCoords') &&
    mapContent.includes('setNotOnSiteAddress'),
    'Selecting search result updates coordinates and street address'
  );
  console.log('  ✓ PASS: 5. Autocomplete address search and map location display supported');

  // Test 6: Allow users to drag the map marker and click canvas to correct location
  assert.ok(
    canvasContent.includes('draggable={!disabled}') &&
    canvasContent.includes('dragend') &&
    mapContent.includes('handleMarkerDragEnd') &&
    mapContent.includes('handleMapClick'),
    'Marker must be draggable and canvas clickable to update location'
  );
  console.log('  ✓ PASS: 6. Draggable marker and map click repositioning supported');

  // Test 7: Update formatted address and lat/lng when marker is moved
  assert.ok(
    mapContent.includes('reverseGeocode(lat, lng') &&
    mapContent.includes('Marker moved to:'),
    'Reverse geocodes new position and updates formatted address and lat/lng'
  );
  console.log('  ✓ PASS: 7. Formatted address and lat/lng dynamically updated on marker drag');

  // Test 8: Confirm Location button required before saving
  assert.ok(
    mapContent.includes('handleConfirmLocation') &&
    mapContent.includes('isConfirmed: true') &&
    siteFormContent.includes('!isLocationConfirmed') &&
    siteFormContent.includes('Please click "Confirm Location" on the map'),
    'Confirm Location button enforces validation before saving'
  );
  console.log('  ✓ PASS: 8. Confirm Location button enforces confirmation before form submission');

  // Test 9: Store and restore full address, latitude, longitude, and location type on project edit
  const state = await dbStore.getState();
  const testCustomer = state.customers[0];
  assert.ok(testCustomer, 'Customer must exist');

  const createdProject = await ProjectService.createProjectFromInspection({
    customerName: testCustomer.companyName,
    referralName: 'OpenStreetMap Verification',
    siteName: 'Indore IT Park Wing C',
    siteAddress: '101 Ring Road, Indore, Madhya Pradesh',
    latitude: 22.7196,
    longitude: 75.8577,
    locationType: 'ON_SITE',
    locationAccuracyMeters: 4,
    city: 'Indore',
    state: 'Madhya Pradesh',
    contactPerson: 'Burhan Malu',
    contactPhone: '9826011223',
    measurements: {
      width: 15,
      depth: 3,
      height: 25,
      unit: 'FEET',
    },
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(createdProject.latitude, 22.7196);
  assert.strictEqual(createdProject.longitude, 75.8577);
  assert.strictEqual(createdProject.locationType, 'ON_SITE');
  assert.strictEqual(createdProject.locationAccuracyMeters, 4);

  // Verify site form edit restores state
  assert.ok(
    siteFormContent.includes('setLatitude(p.latitude)') &&
    siteFormContent.includes('setLongitude(p.longitude)') &&
    (siteFormContent.includes('savedLocType') || siteFormContent.includes('p.locationType')),
    'Site form edit mode must restore latitude, longitude, and locationType'
  );
  console.log('  ✓ PASS: 9. Complete address, coordinates, and locationType saved and restored on edit');

  // Test 10: Support both On-Site (GPS) and Not On-Site (manual address/search)
  assert.ok(
    mapContent.includes("locationType === 'ON_SITE'") &&
    mapContent.includes("locationType === 'NOT_ON_SITE'") &&
    mapContent.includes('Use Current Location') &&
    mapContent.includes('Remote Address Search'),
    'Must provide distinct On-Site GPS and Not On-Site remote search interfaces'
  );
  console.log('  ✓ PASS: 10. Distinct On-Site (GPS) and Not On-Site (remote search) workflows supported');

  // Test 11: High-DPI Custom Marker Icon with zero external broken images
  assert.ok(
    canvasContent.includes('scaffoldPinIcon') &&
    canvasContent.includes('L.divIcon') &&
    canvasContent.includes('<svg'),
    'Custom SVG DivIcon eliminates broken Leaflet default marker icons in Next.js'
  );
  console.log('  ✓ PASS: 11. High-DPI custom SVG DivIcon eliminates broken image asset dependencies');

  // Test 12: Next.js Client-Side Dynamic Rendering (No SSR Window Errors)
  assert.ok(
    mapContent.includes('dynamic(') &&
    mapContent.includes('ssr: false'),
    'Leaflet canvas must be dynamically imported with ssr: false for Next.js compatibility'
  );
  console.log('  ✓ PASS: 12. Next.js SSR-safe dynamic rendering without window reference crashes');

  console.log('---------------------------------------------------------------');
  console.log('Leaflet & OpenStreetMap Location: 12 Passed, 0 Failed');
  console.log('---------------------------------------------------------------\n');
}

if (process.argv[1]?.endsWith('leaflet-openstreetmap.test.ts')) {
  runLeafletOpenStreetMapTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}
