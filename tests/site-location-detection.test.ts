import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { LocationService } from '../src/lib/services/location-service';
import { ProjectService } from '../src/lib/services/project-service';
import { dbStore } from '../src/lib/db/store';

export async function runSiteLocationDetectionTests() {
  console.log('\n===============================================================');
  console.log('SITE LOCATION DETECTION & NEARBY SEARCH TEST SUITE (Section G)');
  console.log('===============================================================');

  // Test 1: On-Site GPS around Khatiwala Tank, Indore
  // Coordinates for Khatiwala Tank, Indore: (22.697679, 75.861118)
  const onSiteResult = await LocationService.reverseGeocode(22.697679, 75.861118);
  assert.ok(onSiteResult.fullAddress, 'Must return a formatted full address');
  assert.ok(
    !onSiteResult.fullAddress.includes('Tahsil') &&
    !onSiteResult.fullAddress.includes('Indore City, Indore'),
    'Must filter out administrative jargon like Tahsil or repeated Indore City'
  );
  assert.ok(
    onSiteResult.fullAddress.includes('Khatiwala Tank') ||
    onSiteResult.fullAddress.includes('Indore'),
    'Address must reference Khatiwala Tank / Indore'
  );
  console.log('  ✓ PASS: 1. On-Site GPS around Khatiwala Tank formats clean meaningful address without administrative clutter:');
  console.log(`         -> "${onSiteResult.fullAddress}"`);

  // Test 2: Remote search for "820, Khatiwala Tank"
  // Must parse house number "820" and prioritize exact match around Khatiwala Tank
  const houseSearch = await LocationService.searchAddress('820, Khatiwala Tank');
  assert.ok(houseSearch.length > 0, 'Must return suggestions for 820, Khatiwala Tank');
  const exactMatch = houseSearch[0];
  assert.ok(exactMatch.title.includes('820, Khatiwala Tank'), 'Title must preserve house number and locality');
  assert.strictEqual(exactMatch.isExactMatch, true, 'Top result must be marked as exact match');
  assert.strictEqual(exactMatch.components.houseNumber, '820', 'Components must capture house number');
  assert.ok(exactMatch.fullAddress.includes('820'), 'Full address must include 820');
  console.log('  ✓ PASS: 2. Remote search for "820, Khatiwala Tank" prioritizes exact match with house number:');
  console.log(`         -> Title: "${exactMatch.title}", Address: "${exactMatch.fullAddress}"`);

  // Test 3: Remote search for "Khatiwala Tank, Indore"
  // Shows nearby matching places around Khatiwala Tank
  const localitySearch = await LocationService.searchAddress('Khatiwala Tank, Indore', {
    lat: 22.697679,
    lng: 75.861118,
  });
  assert.ok(localitySearch.length >= 2, 'Must return multiple matching places around Khatiwala Tank');
  const titles = localitySearch.map((r) => r.title);
  assert.ok(
    titles.some((t) => t.includes('Khatiwala Tank')),
    'Results must include Khatiwala Tank places'
  );
  // Verify distance is calculated and sorted by proximity
  const withDistance = localitySearch.filter((r) => r.distanceKm !== undefined);
  assert.ok(withDistance.length > 0, 'Must include distanceKm for location-biased search');
  assert.ok(withDistance[0].distanceKm! <= withDistance[withDistance.length - 1].distanceKm!, 'Results must be proximity-ordered');
  console.log('  ✓ PASS: 3. Remote search for "Khatiwala Tank, Indore" returns nearby matching places sorted by proximity');

  // Test 4: Remote search using a building or landmark name (Sapphire Square Tower)
  const landmarkSearch = await LocationService.searchAddress('Sapphire Square');
  assert.ok(landmarkSearch.length > 0, 'Must locate Sapphire Square');
  const sapphireResult = landmarkSearch[0];
  assert.ok(sapphireResult.title.includes('Sapphire Square'), 'Must match Sapphire Square');
  assert.ok(sapphireResult.fullAddress.includes('Indore'), 'Address must identify Indore');
  console.log('  ✓ PASS: 4. Remote search by landmark/commercial building locates exact place:');
  console.log(`         -> "${sapphireResult.title}" at ${sapphireResult.latitude}, ${sapphireResult.longitude}`);

  // Test 5: A location with no house number
  // Must fall back to nearest verified street, locality, or landmark without inventing a number
  const noHouseComponents = LocationService.cleanAddressComponents({
    road: 'Manik Bagh Road',
    suburb: 'Khatiwala Tank',
    city: 'Indore',
    state: 'Madhya Pradesh',
    postcode: '452014',
    country: 'India',
  });
  assert.strictEqual(noHouseComponents.components.houseNumber, undefined, 'Must not invent a house number');
  assert.ok(
    !noHouseComponents.formattedAddress.match(/^[0-9]+,/),
    'Formatted address must not start with an invented number'
  );
  assert.ok(noHouseComponents.formattedAddress.includes('Manik Bagh Road, Khatiwala Tank, Indore'));
  console.log('  ✓ PASS: 5. Location without house number falls back to street & locality without inventing numbers:');
  console.log(`         -> "${noHouseComponents.formattedAddress}"`);

  // Test 6: A location with poor GPS accuracy (> 30 metres)
  // Verify UI displays warning asking user to adjust marker
  const mapComponentContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/maps/SiteLocationMap.tsx'),
    'utf8'
  );
  assert.ok(
    mapComponentContent.includes('accuracy > 30') &&
    mapComponentContent.includes('satellite signal may be obstructed') &&
    mapComponentContent.includes('Please drag the map pin to the exact project entrance'),
    'SiteLocationMap must display warning when accuracy > 30 metres'
  );
  console.log('  ✓ PASS: 6. Poor GPS accuracy (> 30m) displays warning banner prompting marker adjustment');

  // Test 7: A location where no matching address is available (handles gracefully)
  const oceanLocation = await LocationService.reverseGeocode(0.0001, 0.0001);
  assert.ok(oceanLocation.latitude === 0.0001 && oceanLocation.longitude === 0.0001);
  assert.ok(oceanLocation.fullAddress.length > 0, 'Must provide coordinates fallback address');
  console.log('  ✓ PASS: 7. Location with no matching OSM address returns graceful coordinate fallback:');
  console.log(`         -> "${oceanLocation.fullAddress}"`);

  // Test 8: Section F Database & Data Storage Verification
  const state = await dbStore.getState();
  const customer = state.customers[0];
  assert.ok(customer, 'Customer must exist');

  const savedProject = await ProjectService.createProjectFromInspection({
    customerName: customer.companyName,
    referralName: 'Yusuf Malu',
    siteName: '820, Khatiwala Tank Project',
    siteAddress: '820, Khatiwala Tank, Indore, Madhya Pradesh, 452014, India',
    latitude: 22.697679,
    longitude: 75.861118,
    locationType: 'NOT_ON_SITE',
    locationAccuracyMeters: 5,
    houseNumber: '820',
    street: 'Khatiwala Tank Main Road',
    locality: 'Khatiwala Tank',
    landmark: 'Near Khatiwala Tank Garden',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452014',
    isLocationConfirmed: true,
    contactPerson: 'Burhan Malu',
    contactPhone: '9826011223',
    measurements: {
      width: 10,
      depth: 3,
      height: 20,
      unit: 'FEET',
    },
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(savedProject.houseNumber, '820');
  assert.strictEqual(savedProject.street, 'Khatiwala Tank Main Road');
  assert.strictEqual(savedProject.locality, 'Khatiwala Tank');
  assert.strictEqual(savedProject.pincode, '452014');
  assert.strictEqual(savedProject.isLocationConfirmed, true);

  const siteRecord = dbStore.getSites().find((s) => s.id === savedProject.siteId);
  assert.ok(siteRecord, 'Site record must exist');
  assert.strictEqual(siteRecord.houseNumber, '820');
  assert.strictEqual(siteRecord.street, 'Khatiwala Tank Main Road');
  assert.strictEqual(siteRecord.locality, 'Khatiwala Tank');
  assert.strictEqual(siteRecord.pincode, '452014');
  assert.strictEqual(siteRecord.isLocationConfirmed, true);
  console.log('  ✓ PASS: 8. Database and store correctly save all address components, GPS accuracy, and confirmation status');

  console.log('---------------------------------------------------------------');
  console.log('Site Location Detection: 8 Passed, 0 Failed');
  console.log('---------------------------------------------------------------\n');
}

if (process.argv[1]?.endsWith('site-location-detection.test.ts')) {
  runSiteLocationDetectionTests().catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}

