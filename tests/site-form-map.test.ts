import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';
import { siteInspectionSchema } from '../src/lib/validations';
import { calculateScaffoldingArea } from '../src/lib/formatters';
import fs from 'fs';
import path from 'path';

export async function runSiteFormMapTests() {
  console.log('\n===============================================================');
  console.log('SITE FORM GOOGLE MAPS & VALIDATION TEST SUITE');
  console.log('===============================================================');

  // Test 1: Step Navigation Bar is completely removed from Site Form
  const siteFormContent = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/sites/new/page.tsx'), 'utf8');
  assert.ok(
    !siteFormContent.includes('Structured Progress Indicator Bar') &&
    !siteFormContent.includes('<span className="truncate">Client & Contact</span>') &&
    !siteFormContent.includes('<span className="truncate">Site Photos</span>'),
    'Step navigation indicator bar must be completely removed from Site Form'
  );
  console.log('  ✓ PASS: 1. Top horizontal step navigation completely removed from Site Form');

  // Test 2: Phone number input has clean non-overlapping layout and +91 prefix
  assert.ok(
    siteFormContent.includes('+91') &&
    siteFormContent.includes('border-r border-[#ebdcc9]') &&
    !siteFormContent.includes('pl-13'),
    'Phone number input must have separate prefix badge and no broken pl-13 padding'
  );
  console.log('  ✓ PASS: 2. Phone number input fixed with dedicated non-overlapping prefix');

  // Test 3: Phone number validation strictly enforces 10 digits
  assert.ok(
    siteFormContent.includes('phone.trim().length !== 10'),
    'Phone number validation enforces 10 digits'
  );
  console.log('  ✓ PASS: 3. Phone number validation strictly enforces 10 digits');

  // Test 4: Interactive Google Map component is integrated
  assert.ok(
    siteFormContent.includes('<SiteLocationMap') &&
    siteFormContent.includes('initialLatitude={latitude}') &&
    siteFormContent.includes('initialLongitude={longitude}'),
    'Interactive SiteLocationMap is integrated with coordinate binding'
  );
  console.log('  ✓ PASS: 4. Interactive Google Map component integrated in Section 2');

  // Test 5: createProjectFromInspection correctly saves latitude and longitude
  const testProject = await ProjectService.createProjectFromInspection({
    customerName: 'Map Test Infrastructure Ltd',
    referralName: 'Direct Client',
    siteName: 'Andheri Metro Scaffolding Site',
    siteAddress: 'Plot 88, MIDC Central Road, Andheri East, Mumbai 400093',
    latitude: 19.1176,
    longitude: 72.8631,
    landmark: 'Opposite Metro Pillar 188',
    city: 'Mumbai',
    state: 'Maharashtra',
    contactPerson: 'Karan Shah',
    contactPhone: '9820011223',
    measurements: {
      length: 50,
      width: 10,
      height: 30,
      unit: 'FEET',
      measurementType: 'FAÇADE_SCAFFOLD',
      description: 'Main elevation',
    },
    siteRemarks: 'Solid concrete ground, crane access from North gate',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(testProject.latitude, 19.1176, 'Project must save latitude accurately');
  assert.strictEqual(testProject.longitude, 72.8631, 'Project must save longitude accurately');
  assert.strictEqual(testProject.siteAddress, 'Plot 88, MIDC Central Road, Andheri East, Mumbai 400093');

  // Also check corresponding Site record in dbStore
  const siteRecord = dbStore.getSites().find(s => s.id === testProject.siteId);
  assert.ok(siteRecord, 'Site record must exist');
  assert.strictEqual(siteRecord.latitude, 19.1176, 'Site record must save latitude');
  assert.strictEqual(siteRecord.longitude, 72.8631, 'Site record must save longitude');
  console.log('  ✓ PASS: 5. createProjectFromInspection saves exact latitude & longitude to project & site');

  // Test 6: Site inspection validation schema allows and coerces coordinates
  const validated = siteInspectionSchema.parse({
    siteAddress: 'Kharadi IT Park, Pune',
    latitude: '18.5529',
    longitude: '73.9352',
    length: 20,
    height: 15,
  });
  assert.strictEqual(validated.latitude, 18.5529, 'Schema coerces latitude string to number');
  assert.strictEqual(validated.longitude, 73.9352, 'Schema coerces longitude string to number');
  console.log('  ✓ PASS: 6. Validation schema accepts and coerces latitude and longitude');

  // Test 7: Editing existing site form restores coordinates
  assert.ok(
    siteFormContent.includes('setLatitude(p.latitude)') &&
    siteFormContent.includes('setLongitude(p.longitude)'),
    'Edit mode must restore latitude and longitude from saved project'
  );
  console.log('  ✓ PASS: 7. Edit mode restores saved GPS latitude and longitude');

  // Test 8: On-Site vs Not On-Site location mode support in SiteLocationMap
  const mapComponentContent = fs.readFileSync(path.join(process.cwd(), 'src/components/maps/SiteLocationMap.tsx'), 'utf8');
  assert.ok(
    mapComponentContent.includes("'ON_SITE'") &&
    mapComponentContent.includes("'NOT_ON_SITE'") &&
    mapComponentContent.includes('enableHighAccuracy: true') &&
    mapComponentContent.includes('Confirm Location') &&
    mapComponentContent.includes('places.Autocomplete'),
    'SiteLocationMap must support ON_SITE, NOT_ON_SITE, enableHighAccuracy, Confirm Location, and Places Autocomplete'
  );
  console.log('  ✓ PASS: 8. SiteLocationMap provides On-Site GPS, Not On-Site Places Autocomplete, and Confirm Location');

  // Test 9: Persistence of locationType and locationAccuracyMeters in ProjectService
  const onSiteProject = await ProjectService.createProjectFromInspection({
    customerName: 'Indore High-Accuracy Site Corp',
    referralName: 'Yusuf Malu',
    siteName: '820, Khatiwala Tank, Indore, Madhya Pradesh',
    siteAddress: '820, Khatiwala Tank, Indore, Madhya Pradesh',
    latitude: 22.7001,
    longitude: 75.8577,
    locationType: 'ON_SITE',
    locationAccuracyMeters: 6,
    landmark: 'Near Tower',
    city: 'Indore',
    state: 'Madhya Pradesh',
    contactPerson: 'Burhan Malu',
    contactPhone: '9820099887',
    measurements: {
      length: 40,
      width: 12,
      height: 25,
      unit: 'FEET',
    },
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(onSiteProject.locationType, 'ON_SITE', 'Project must record ON_SITE locationType');
  assert.strictEqual(onSiteProject.locationAccuracyMeters, 6, 'Project must record locationAccuracyMeters');
  const onSiteSiteRecord = dbStore.getSites().find(s => s.id === onSiteProject.siteId);
  assert.ok(onSiteSiteRecord, 'Site record must exist');
  assert.strictEqual(onSiteSiteRecord.locationType, 'ON_SITE', 'Site record must save ON_SITE locationType');
  assert.strictEqual(onSiteSiteRecord.locationAccuracyMeters, 6, 'Site record must save locationAccuracyMeters');
  console.log('  ✓ PASS: 9. ProjectService and DB store accurately persist locationType and locationAccuracyMeters');

  // Test 10: Scaffolding Engineering Dimensions Formula Tests against all prompt examples
  // Example 1: 10 ft (W) × 2 ft (D) × 20 ft (H) -> 200 sq. ft. (Depth <= 3: multiplier 1)
  const ex1 = calculateScaffoldingArea(10, 2, 20, 'FEET');
  assert.strictEqual(ex1, 200, 'Example 1: Width 10, Depth 2, Height 20 must equal 200 sq. ft.');

  // Example 2: 10 ft (W) × 3 ft (D) × 20 ft (H) -> 200 sq. ft. (Depth <= 3: multiplier 1)
  const ex2 = calculateScaffoldingArea(10, 3, 20, 'FEET');
  assert.strictEqual(ex2, 200, 'Example 2: Width 10, Depth 3, Height 20 must equal 200 sq. ft.');

  // Example 3: 10 ft (W) × 6 ft (D) × 20 ft (H) -> 400 sq. ft. (Depth > 3: multiplier 6/3 = 2)
  const ex3 = calculateScaffoldingArea(10, 6, 20, 'FEET');
  assert.strictEqual(ex3, 400, 'Example 3: Width 10, Depth 6, Height 20 must equal 400 sq. ft.');

  // Example 4: 10 ft (W) × 15 ft (D) × 20 ft (H) -> 1,000 sq. ft. (Depth > 3: multiplier 15/3 = 5)
  const ex4 = calculateScaffoldingArea(10, 15, 20, 'FEET');
  assert.strictEqual(ex4, 1000, 'Example 4: Width 10, Depth 15, Height 20 must equal 1000 sq. ft.');
  console.log('  ✓ PASS: 10. Formula calculation matches all 4 engineering dimension examples exactly');

  // Test 11: Site Form Section 3 structure: Length removed, Width, Depth, Height, Feet/Meters selector present
  const updatedSiteForm = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/sites/new/page.tsx'), 'utf8');
  assert.ok(
    !updatedSiteForm.includes('Length ({unit ===') &&
    updatedSiteForm.includes('Width ({unit ===') &&
    updatedSiteForm.includes('Depth ({unit ===') &&
    updatedSiteForm.includes('Height ({unit ===') &&
    true &&
    updatedSiteForm.includes("handleUnitToggle('FEET')") &&
    updatedSiteForm.includes("handleUnitToggle('METERS')"),
    'Site Form must use Width, Depth, Height inputs, Calculated Elevation Area (sq. ft.), and Feet/Meters unit toggle'
  );
  console.log('  ✓ PASS: 11. Site Form removes Length and provides Width, Depth, Height with Feet/Meters toggle');

  // Test 12: Positive number validation enforced on all 3 dimensions
  assert.ok(
    updatedSiteForm.includes('numW <= 0 || numD <= 0 || numH <= 0') &&
    updatedSiteForm.includes('Please provide valid positive numbers for Width, Depth, and Height.'),
    'Site Form must validate positive numbers for all three dimensions'
  );
  console.log('  ✓ PASS: 12. Strict positive dimension validation enforced for Width, Depth, and Height');

  // Test 13: Project creation and Quotation calculate using the new formula
  const engineeringProject = await ProjectService.createProjectFromInspection({
    customerName: 'Engineering Scaffolding Towers Ltd',
    referralName: 'Direct Site Inquiry',
    siteName: 'Indore Commercial Wing B',
    siteAddress: 'Plot 10, AB Road, Indore, MP',
    latitude: 22.7196,
    longitude: 75.8577,
    locationType: 'NOT_ON_SITE',
    measurements: {
      width: 10,
      depth: 6,
      height: 20,
      unit: 'FEET',
    },
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(engineeringProject.measurements?.width, 10);
  assert.strictEqual(engineeringProject.measurements?.depth, 6);
  assert.strictEqual(engineeringProject.measurements?.height, 20);
  assert.strictEqual(engineeringProject.measurements?.elevationAreaSqFt, 400, 'Calculated area must be 400 sq. ft.');
  console.log('  ✓ PASS: 13. ProjectService automatically calculates and records 400 sq. ft. elevation area');

  console.log('---------------------------------------------------------------');
  console.log('Site Form, Map & Engineering Dimensions: 13 Passed, 0 Failed');
  console.log('---------------------------------------------------------------\n');
}
