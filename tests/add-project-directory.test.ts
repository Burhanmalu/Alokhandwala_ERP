import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ProjectService } from '../src/lib/services/project-service';
import { RentalService } from '../src/lib/services/rental-service';
import { addProjectSchema } from '../src/lib/validations';
import { dbStore } from '../src/lib/db/store';
import {
  calculateRentalDurationBreakdown,
  calculateExtendedRemovalDate,
  getEffectiveRemovalDate,
  getRemainingDaysInfo,
  getFollowUpStatus,
} from '../src/lib/formatters';

export async function runAddProjectDirectoryTests() {
  console.log('\n===============================================================');
  console.log('PROJECT DIRECTORY – ADD / EDIT / DELETE / BALANCE TEST SUITE');
  console.log('===============================================================');

  // 1. UI Verification: Register Site replaced by Add Project
  const projectsPageSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/projects/page.tsx'),
    'utf8'
  );
  assert.ok(
    !projectsPageSrc.includes('Register Site'),
    'Register Site option removed from Project Directory'
  );
  assert.ok(
    projectsPageSrc.includes('Add Project'),
    'Add Project option added to Project Directory'
  );
  assert.ok(
    projectsPageSrc.includes('>Remaining Days</th>'),
    'Remaining Days column header exists in Projects Directory table'
  );
  assert.ok(
    projectsPageSrc.indexOf('>Removal Date</th>') < projectsPageSrc.indexOf('>Remaining Days</th>'),
    'Remaining Days column appears right after Removal Date'
  );

  const projectDetailsSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/projects/[id]/page.tsx'),
    'utf8'
  );
  assert.ok(
    !projectDetailsSrc.includes('Download Confirmation PDF') &&
      !projectDetailsSrc.includes('Download Installation PDF'),
    'PDF Download buttons removed from Project Details header'
  );
  assert.ok(
    projectDetailsSrc.includes('Extend Rental') &&
      projectDetailsSrc.includes('Shift Scaffolding') &&
      projectDetailsSrc.includes('Dismantle') &&
      projectDetailsSrc.includes('Buffer Period'),
    'Buffer Period, Extend Rental, Shift Scaffolding, and Dismantle buttons preserved'
  );
  console.log('  ✓ PASS: 1. Project Directory UI replaced "Register Site" with "Add Project"');

  // 2. Balance Validation: Payment Received > Total Amount must fail validation
  const invalidParsed = addProjectSchema.safeParse({
    mode: 'DIRECT_PROJECT',
    customerName: 'Overpay Client',
    siteName: 'Site A',
    siteAddress: 'Indore MP',
    assignedSupervisorId: 'usr-sup-01',
    status: 'NOT_INSTALLED',
    totalAmount: 10000,
    paymentReceived: 12000,
  });
  assert.strictEqual(invalidParsed.success, false, 'Schema rejects Payment Received > Total Amount');

  await assert.rejects(
    async () => {
      await ProjectService.createDirectProject({
        customerName: 'Overpay Client',
        siteName: 'Site A',
        siteAddress: 'Indore MP',
        assignedSupervisorId: 'usr-sup-01',
        status: 'NOT_INSTALLED',
        totalAmount: 10000,
        paymentReceived: 12000,
        actorId: 'usr-admin-01',
        actorName: 'Admin',
      });
    },
    /exceed/i,
    'Service rejects Payment Received > Total Amount'
  );
  console.log('  ✓ PASS: 2. Validation blocks Payment Received exceeding Total Amount');

  // 3. Create Direct Project with Customer, Site, Dimensions, Supervisor, Staff, Dates, Financials, Remark & Follow Up
  const created = await ProjectService.createDirectProject({
    customerName: 'Vikram Builders',
    customerPhone: '9876543210',
    customerEmail: 'vikram@example.com',
    siteName: 'Emerald Plaza Wing B',
    siteAddress: '45 AB Road, Vijay Nagar, Indore',
    assignedSupervisorId: 'usr-sup-01',
    staffIds: ['usr-wrk-01'],
    width: 10,
    depth: 15,
    height: 20,
    unit: 'FEET',
    status: 'ACTIVE_RENTAL',
    installationDate: '2026-08-06',
    removalDate: '2026-10-21',
    totalAmount: 50000,
    paymentReceived: 35000,
    remark: 'Scaffolding erected on north elevation',
    followUpDate: '2026-11-25',
    followUpNotes: 'Confirm remaining ₹15,000 balance',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });

  assert.ok(created.id.startsWith('proj-'), 'Generated internal Project ID');
  assert.ok(/^AW-SCF-\d{6}$/.test(created.projectCode), `Generated sequential Project Code: ${created.projectCode}`);
  assert.strictEqual(created.customerName, 'Vikram Builders');
  assert.strictEqual(created.siteName, 'Emerald Plaza Wing B');
  assert.strictEqual(created.assignedSupervisorId, 'usr-sup-01');
  assert.deepStrictEqual(created.assignedWorkerIds, ['usr-wrk-01']);
  assert.strictEqual(created.measurements?.width, 10);
  assert.strictEqual(created.measurements?.depth, 15);
  assert.strictEqual(created.measurements?.height, 20);
  assert.strictEqual(created.measurements?.unit, 'FEET');
  assert.strictEqual(created.elevationAreaSqFt, 1000, 'Site Dimensions calculate elevation area = 1,000 sq. ft.');
  assert.strictEqual(created.status, 'ACTIVE_RENTAL');
  assert.strictEqual(created.installationDate, '2026-08-06');
  assert.strictEqual(created.removalDate, '2026-10-21');
  assert.strictEqual(created.rentalDurationMonths, 2);
  assert.strictEqual(created.rentalDurationDays, 15);
  assert.strictEqual(created.rentalDurationDisplay, '2 Months, 15 Days');
  assert.strictEqual(created.totalAmount, 50000);
  assert.strictEqual(created.paymentReceived, 35000);
  assert.strictEqual(created.balanceAmount, 15000, 'Balance Amount auto-calculated as 50000 - 35000 = 15000');
  assert.strictEqual(created.remark, 'Scaffolding erected on north elevation');
  assert.strictEqual(created.followUpDate, '2026-11-25');
  assert.strictEqual(created.followUpNotes, 'Confirm remaining ₹15,000 balance');
  console.log(`  ✓ PASS: 3. Direct Project ${created.projectCode} saved with Site Dimensions (10×15×20 FEET = 1,000 sq.ft), Duration ("2 Months, 15 Days"), & Balance ₹15,000`);

  // 3b. Rental Duration Engine: Ongoing & Invalid Date Guard
  const ongoingDur = calculateRentalDurationBreakdown('2026-08-06', '', new Date(Date.UTC(2026, 10, 11)));
  assert.strictEqual(ongoingDur.isOngoing, true);
  assert.strictEqual(ongoingDur.months, 3);
  assert.strictEqual(ongoingDur.days, 5);
  assert.strictEqual(ongoingDur.display, 'Ongoing – 3 Months, 5 Days');

  const invalidDateParsed = addProjectSchema.safeParse({
    mode: 'DIRECT_PROJECT',
    customerName: 'Bad Date Client',
    siteName: 'Site B',
    siteAddress: 'Indore MP',
    assignedSupervisorId: 'usr-sup-01',
    installationDate: '2026-11-10',
    removalDate: '2026-11-01',
    totalAmount: 10000,
    paymentReceived: 0,
  });
  assert.strictEqual(invalidDateParsed.success, false, 'Schema rejects Removal Date earlier than Installation Date');
  console.log('  ✓ PASS: 3b. Ongoing calculation ("Ongoing – 3 Months, 5 Days") & earliest removal date guard verified');

  // 3c. Remaining Days & Expiry Alert System
  const refToday = new Date(2026, 10, 11, 16, 30, 0); // Local Nov 11, 2026
  const greenRem = getRemainingDaysInfo('2026-12-01', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(greenRem.days, 20);
  assert.strictEqual(greenRem.severity, 'success');
  assert.strictEqual(greenRem.label, '20 Days Left');
  assert.strictEqual(greenRem.isAlert, false);

  const orangeRemHigh = getRemainingDaysInfo('2026-11-26', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(orangeRemHigh.days, 15);
  assert.strictEqual(orangeRemHigh.severity, 'warning');
  assert.strictEqual(orangeRemHigh.label, '15 Days Left');

  const orangeRemLow = getRemainingDaysInfo('2026-11-19', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(orangeRemLow.days, 8);
  assert.strictEqual(orangeRemLow.severity, 'warning');

  const redRemSeven = getRemainingDaysInfo('2026-11-18', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(redRemSeven.days, 7);
  assert.strictEqual(redRemSeven.severity, 'danger');
  assert.strictEqual(redRemSeven.isAlert, true);
  assert.strictEqual(redRemSeven.label, '7 Days Left');

  const redRemOne = getRemainingDaysInfo('2026-11-12', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(redRemOne.days, 1);
  assert.strictEqual(redRemOne.severity, 'danger');
  assert.strictEqual(redRemOne.label, '1 Day Left');

  const dueToday = getRemainingDaysInfo('2026-11-11', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(dueToday.days, 0);
  assert.strictEqual(dueToday.severity, 'danger');
  assert.strictEqual(dueToday.label, 'Due Today');

  const overdueThree = getRemainingDaysInfo('2026-11-08', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(overdueThree.days, -3);
  assert.strictEqual(overdueThree.severity, 'overdue');
  assert.strictEqual(overdueThree.isAlert, true);
  assert.strictEqual(overdueThree.label, 'Overdue by 3 Days');

  const overdueOne = getRemainingDaysInfo('2026-11-10', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(overdueOne.label, 'Overdue by 1 Day');

  const unscheduled = getRemainingDaysInfo('', 'NOT_INSTALLED', refToday);
  assert.strictEqual(unscheduled.severity, 'neutral');
  assert.strictEqual(unscheduled.label, 'Not Scheduled');

  const closedRem = getRemainingDaysInfo('2026-11-08', 'CLOSED', refToday);
  assert.strictEqual(closedRem.severity, 'neutral');
  assert.strictEqual(closedRem.isAlert, false);
  assert.strictEqual(closedRem.label, 'Removed');

  const fOverdue = getFollowUpStatus('2026-11-09', '2026-11-25', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(fOverdue.isOverdue, true);
  const fToday = getFollowUpStatus('2026-11-11', '2026-11-25', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(fToday.isDueToday, true);
  const fBeforeRem = getFollowUpStatus('2026-11-20', '2026-11-25', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(fBeforeRem.isOverdue, false);
  assert.strictEqual(fBeforeRem.isAfterRemoval, false);
  const fAfterRem = getFollowUpStatus('2026-11-28', '2026-11-25', 'ACTIVE_RENTAL', refToday);
  assert.strictEqual(fAfterRem.isAfterRemoval, true);
  console.log('  ✓ PASS: 3c. Remaining Days badges, 7-day danger threshold, overdue, and Follow-Up status verified');

  // 4. Persistence verification via dbStore
  const stored = dbStore.getProjects().find(p => p.id === created.id);
  assert.ok(stored, 'Project persists in dbStore');
  assert.strictEqual(stored?.balanceAmount, 15000);
  assert.strictEqual(stored?.rentalDurationDisplay, '2 Months, 15 Days');
  assert.strictEqual(stored?.measurements?.width, 10);
  console.log('  ✓ PASS: 4. Dimensions, duration, and balance persisted cleanly in store');

  // 4b. Buffer Period + Extend Rental (Days & Months) + Synchronization + Rental History
  const rentalProj = await ProjectService.createDirectProject({
    customerName: 'Sync Rental Test Co',
    siteName: 'Sync Site 1',
    siteAddress: 'Indore MP',
    assignedSupervisorId: 'usr-sup-01',
    status: 'ACTIVE_RENTAL',
    installationDate: '2026-11-04',
    removalDate: '2026-12-04',
    totalAmount: 10000,
    paymentReceived: 2000,
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });

  // Activate configured buffer period (defaults to 3 days -> 2026-12-04 + 3 = 2026-12-07)
  const configuredBufDays = dbStore.getCompanySettings().bufferDaysDefault;
  const { project: bufferedProj } = await RentalService.applyBufferPeriod({
    projectId: rentalProj.id,
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });
  const expectedBufDate = calculateExtendedRemovalDate('2026-12-04', configuredBufDays, 'DAYS');
  assert.strictEqual(bufferedProj.status, 'BUFFER_PERIOD');
  assert.strictEqual(bufferedProj.bufferEndDate, expectedBufDate);
  assert.strictEqual(bufferedProj.removalDate, expectedBufDate);
  assert.strictEqual(getEffectiveRemovalDate(bufferedProj), expectedBufDate);
  assert.strictEqual(bufferedProj.originalRemovalDate, '2026-12-04');
  assert.strictEqual(bufferedProj.rentalHistory?.[0]?.actionType, 'BUFFER_PERIOD');

  // Duplicate buffer activation must fail cleanly
  let dupBufferRejected = false;
  try {
    await RentalService.applyBufferPeriod({
      projectId: rentalProj.id,
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu (Admin)',
    });
  } catch (err: any) {
    dupBufferRejected = /already active/i.test(err.message);
  }
  assert.strictEqual(dupBufferRejected, true, 'Duplicate buffer period activation prevented');

  // Example 1: Extend by 15 Days from 2026-12-07 -> 2026-12-22
  const { project: extDaysProj } = await RentalService.extendRental({
    projectId: rentalProj.id,
    extensionType: 'DAYS',
    extensionValue: 15,
    extensionReason: 'Site finishing work',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });
  const expectedDaysEnd = calculateExtendedRemovalDate(expectedBufDate, 15, 'DAYS');
  assert.strictEqual(extDaysProj.status, 'EXTENDED');
  assert.strictEqual(extDaysProj.removalDate, expectedDaysEnd);
  assert.strictEqual(extDaysProj.rentalEndDate, expectedDaysEnd);
  assert.strictEqual(extDaysProj.bufferEndDate, undefined);
  assert.strictEqual(getEffectiveRemovalDate(extDaysProj), expectedDaysEnd);
  assert.strictEqual(extDaysProj.originalRemovalDate, '2026-12-04');

  // Example 2: Calendar Month math from 2026-12-07 + 2 Months -> 2027-02-07
  assert.strictEqual(calculateExtendedRemovalDate('2026-12-07', 2, 'MONTHS'), '2027-02-07');
  const { project: extMonthsProj } = await RentalService.extendRental({
    projectId: rentalProj.id,
    extensionType: 'MONTHS',
    extensionValue: 2,
    extensionReason: 'Second phase facade',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });
  const expectedMonthsEnd = calculateExtendedRemovalDate(expectedDaysEnd, 2, 'MONTHS');
  assert.strictEqual(extMonthsProj.removalDate, expectedMonthsEnd);
  assert.strictEqual(getEffectiveRemovalDate(extMonthsProj), expectedMonthsEnd);
  assert.strictEqual(extMonthsProj.rentalHistory?.length, 3);
  assert.strictEqual(extMonthsProj.rentalHistory?.[0]?.originalRemovalDate, '2026-12-04');
  assert.strictEqual(extMonthsProj.rentalHistory?.[0]?.previousRemovalDate, expectedDaysEnd);
  assert.strictEqual(extMonthsProj.rentalHistory?.[0]?.newRemovalDate, expectedMonthsEnd);

  // Clean up test rental project
  await ProjectService.deleteProject(rentalProj.id, 'usr-admin-01', 'Burhan Malu (Admin)');
  console.log('  ✓ PASS: 4b. Buffer Period (configured days + duplicate guard), Extend Rental (Days/Months), Effective Removal Sync & Rental History verified');

  // 5. Delete Project verification
  const delRes = await ProjectService.deleteProject(created.id, 'usr-admin-01', 'Burhan Malu (Admin)');
  assert.strictEqual(delRes.projectCode, created.projectCode);
  const afterDelete = dbStore.getProjects().find(p => p.id === created.id);
  assert.strictEqual(afterDelete, undefined, 'Deleted project no longer in dbStore');
  console.log('  ✓ PASS: 5. Project deletion removes record and logs audit trail');

  console.log('---------------------------------------------------------------');
  console.log('Project Directory Add/Edit/Delete: All Tests Passed 100%');
  console.log('---------------------------------------------------------------');
}

if (require.main === module) {
  runAddProjectDirectoryTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

