import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ReminderService } from '../src/lib/services/reminder-service';
import { ChallanService } from '../src/lib/services/challan-service';
import { ProjectService } from '../src/lib/services/project-service';

async function runVerificationTests() {
  console.log('\n===============================================================');
  console.log('NOTIFICATIONS & CHALLAN RETURN ENTRY VERIFICATION SUITE');
  console.log('===============================================================');

  // 1. Installation Reminder: 1 Dec 2026 -> fires on 30 Nov 2026 IST, no duplicates, date change, status change
  const proj = await ProjectService.createDirectProject({
    customerName: 'Notification Test Client',
    siteName: 'Test Site 1',
    siteAddress: 'Indore',
    assignedSupervisorId: 'usr-sup-01',
    status: 'SCHEDULED',
    installationDate: '2026-12-01',
    totalAmount: 20000,
    paymentReceived: 5000,
    actorId: 'usr-admin-01',
    actorName: 'Admin',
  });

  // 29 Nov 2026 IST (2 days before) -> should NOT fire
  const nov29 = new Date('2026-11-29T04:00:00Z'); // 09:30 IST
  await ReminderService.processDueInstallationReminders(nov29);
  let state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === proj.id && n.title === 'Installation Reminder').length,
    0,
    'Should not fire 2 days before installation'
  );

  // 30 Nov 2026 IST (1 day before) -> MUST fire
  const nov30 = new Date('2026-11-30T04:00:00Z'); // 09:30 IST
  await ReminderService.processDueInstallationReminders(nov30);
  state = dbStore.getState();
  const instNotifs = state.notifications.filter(
    n => n.entityId === proj.id && n.title === 'Installation Reminder'
  );
  assert.strictEqual(instNotifs.length, 1, 'Should fire exactly 1 installation reminder 1 day before');
  assert(
    instNotifs[0].message.includes(`Installation Reminder: Project ${proj.projectCode} is scheduled for installation tomorrow.`),
    'Installation reminder message must match required format'
  );

  // Duplicate check on same day
  await ReminderService.processDueInstallationReminders(nov30);
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === proj.id && n.title === 'Installation Reminder').length,
    1,
    'Duplicate installation reminder must be prevented'
  );

  // Change installation date to 2026-12-05 -> schedules for 2026-12-04
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === proj.id)!;
    p.installationDate = '2026-12-05';
    p.plannedInstallationDate = '2026-12-05';
    ReminderService.syncProjectReminderInState(s, p, nov30);
  });
  await ReminderService.processDueInstallationReminders(new Date('2026-12-03T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === proj.id && n.title === 'Installation Reminder' && n.installationDate === '2026-12-05').length,
    0,
    'Updated installation date should not fire early'
  );

  // Change status away from SCHEDULED -> cancels reminder before 2026-12-04
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === proj.id)!;
    p.status = 'NOT_INSTALLED';
    ReminderService.syncProjectReminderInState(s, p, new Date('2026-12-03T04:00:00Z'));
  });
  await ReminderService.processDueInstallationReminders(new Date('2026-12-04T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === proj.id && n.title === 'Installation Reminder' && n.installationDate === '2026-12-05').length,
    0,
    'Cancelled/non-SCHEDULED project must not send installation reminder'
  );
  console.log('  ✓ PASS: 1. Installation Reminder (1 day before, no duplicates, date change, status change)');

  // 2. Rental Expiry Reminder: daily for 7, 6, 5, 4, 3, 2, 1, 0 days; 1 per day; stops on CLOSED
  const rentalProj = await ProjectService.createDirectProject({
    customerName: 'Rental Reminder Client',
    siteName: 'Rental Site',
    siteAddress: 'Indore',
    assignedSupervisorId: 'usr-sup-01',
    status: 'ACTIVE_RENTAL',
    installationDate: '2026-11-01',
    removalDate: '2026-12-10',
    totalAmount: 40000,
    paymentReceived: 10000,
    actorId: 'usr-admin-01',
    actorName: 'Admin',
  });

  // Check days 7 down to 0 (2026-12-03 .. 2026-12-10 IST)
  for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
    const dayNum = 10 - dayOffset; // Dec 3..10
    const dt = new Date(`2026-12-${String(dayNum).padStart(2, '0')}T04:00:00Z`);
    await ReminderService.processDueRentalExpiryReminders(dt);
    // Run a second time on same day -> must NOT duplicate
    await ReminderService.processDueRentalExpiryReminders(dt);
  }
  state = dbStore.getState();
  const rentalNotifs = state.notifications.filter(
    n => n.entityId === rentalProj.id && n.title === 'Rental Expiry Alert'
  );
  assert.strictEqual(rentalNotifs.length, 8, 'Must generate exactly 8 daily notifications (7..0 days)');
  assert(
    rentalNotifs.some(n => n.message.includes('has only 7 days remaining')),
    '7-day alert message verified'
  );
  assert(
    rentalNotifs.some(n => n.message.includes('has only 1 day remaining')),
    '1-day alert message verified'
  );
  assert(
    rentalNotifs.some(n => n.message.includes('has only 0 days remaining')),
    '0-day alert message verified'
  );

  // Move to CLOSED -> stops generating notifications
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === rentalProj.id)!;
    p.status = 'CLOSED';
  });
  await ReminderService.processDueRentalExpiryReminders(new Date('2026-12-11T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === rentalProj.id).length,
    8,
    'Closed project must stop generating rental expiry notifications'
  );
  console.log('  ✓ PASS: 2. Rental Expiry Alerts (daily 7..0, 1/day guard, stops on CLOSED)');

  // 3. Challan Add Return Entry preserves existing Challan ID, Output Material, and previous returns
  state = dbStore.getState();
  const mat = state.materials[0];
  const cust = state.customers[0];
  const createdChallan = await ChallanService.createChallan({
    customerId: cust.id,
    size: '10 x 10 x 15 FT',
    outputEntries: [{ date: '2026-11-28', materialId: mat.id, quantity: 10, remarks: 'Initial issue' }],
    inputEntries: [{ date: '2026-11-28', materialId: mat.id, quantity: 3, remarks: 'First partial return' }],
    actorId: 'usr-admin-01',
    actorName: 'Admin',
  });

  const updatedChallan = await ChallanService.addReturnEntries(
    createdChallan.id,
    [{ date: '2026-11-29', materialId: mat.id, quantity: 4, remarks: 'Second return entry' }],
    'usr-admin-01',
    'Admin'
  );
  assert.strictEqual(updatedChallan.id, createdChallan.id, 'Challan ID must remain unchanged');
  assert.strictEqual(updatedChallan.challanNumber, createdChallan.challanNumber, 'Challan Number must remain unchanged');
  assert.strictEqual(updatedChallan.outputEntries.length, 1, 'Output entries must not be duplicated');
  assert.strictEqual(updatedChallan.inputEntries.length, 2, 'Previous return entry must be preserved');
  assert.strictEqual(updatedChallan.totalReturnedQuantity, 7, 'Total returned updated to 3 + 4 = 7');
  assert.strictEqual(updatedChallan.remainingAtSiteQuantity, 3, 'Remaining at site updated to 10 - 7 = 3');
  console.log('  ✓ PASS: 3. Challan Add Return Entry preserves ID, Output, and prior returns');

  // 4. Expected Payment Date Notifications (due date, overdue daily, date change, paid stops)
  const payProj = await ProjectService.createDirectProject({
    customerName: 'Payment Reminder Client',
    siteName: 'Payment Site',
    siteAddress: 'Indore',
    assignedSupervisorId: 'usr-sup-01',
    status: 'CLOSED',
    totalAmount: 10000,
    paymentReceived: 5000,
    actorId: 'usr-admin-01',
    actorName: 'Admin',
  });
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === payProj.id)!;
    p.expectedPaymentDate = '2026-12-01';
  });

  // Before due date -> 0
  await ReminderService.processDuePaymentReminders(new Date('2026-11-30T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === payProj.id && n.title === 'Payment Reminder').length,
    0,
    'Payment reminder must not fire before expectedPaymentDate'
  );

  // On exact due date -> 1
  await ReminderService.processDuePaymentReminders(new Date('2026-12-01T04:00:00Z'));
  await ReminderService.processDuePaymentReminders(new Date('2026-12-01T09:00:00Z')); // duplicate check
  state = dbStore.getState();
  const dueNotifs = state.notifications.filter(n => n.entityId === payProj.id && n.title === 'Payment Reminder');
  assert.strictEqual(dueNotifs.length, 1, 'Exactly 1 payment reminder on expectedPaymentDate');
  assert(
    dueNotifs[0].message.includes(`Payment Reminder: The expected outstanding balance payment for Project ${payProj.projectCode} is due today. Outstanding Amount: ₹5,000.`),
    'Payment reminder message matches exact specification'
  );

  // Overdue next day -> daily reminder
  await ReminderService.processDuePaymentReminders(new Date('2026-12-02T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === payProj.id && n.title === 'Payment Reminder').length,
    2,
    'Daily overdue payment reminder generated'
  );

  // Change expectedPaymentDate to future -> stops until new date
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === payProj.id)!;
    p.expectedPaymentDate = '2026-12-10';
  });
  await ReminderService.processDuePaymentReminders(new Date('2026-12-03T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === payProj.id && n.title === 'Payment Reminder').length,
    2,
    'Rescheduled expectedPaymentDate pauses reminders until new date'
  );

  // Full payment received -> stops permanently
  await dbStore.transaction((s) => {
    const p = s.projects.find(item => item.id === payProj.id)!;
    p.paymentReceived = 10000;
    p.balanceAmount = 0;
  });
  await ReminderService.processDuePaymentReminders(new Date('2026-12-10T04:00:00Z'));
  state = dbStore.getState();
  assert.strictEqual(
    state.notifications.filter(n => n.entityId === payProj.id && n.title === 'Payment Reminder').length,
    2,
    'Settled project stops generating payment reminders'
  );
  console.log('  ✓ PASS: 4. Expected Payment Date Reminders (exact date, overdue daily, reschedule, paid stop)');

  // 5. Challan multi-row same material aggregation & inventory accuracy
  state = dbStore.getState();
  const mat2 = state.materials[1];
  const beforeAvail = mat2.usableWarehouseQty;
  const multiChallan = await ChallanService.createChallan({
    customerId: cust.id,
    size: '12 x 12 x 15 FT',
    outputEntries: [
      { date: '2026-11-28', materialId: mat2.id, quantity: 10, remarks: 'Batch 1' },
      { date: '2026-11-28', materialId: mat2.id, quantity: 5, remarks: 'Batch 2' },
    ],
    actorId: 'usr-admin-01',
    actorName: 'Admin',
  });
  assert.strictEqual(multiChallan.totalOutputQuantity, 15, 'Same material in 2 Output rows aggregates to 15');
  assert.strictEqual(
    dbStore.getState().materials.find(m => m.id === mat2.id)!.usableWarehouseQty,
    beforeAvail - 15,
    'Warehouse stock deducted by exact aggregated 15'
  );

  const multiRet = await ChallanService.addReturnEntries(
    multiChallan.id,
    [
      { date: '2026-11-29', materialId: mat2.id, quantity: 3, remarks: 'Return A' },
      { date: '2026-11-30', materialId: mat2.id, quantity: 5, remarks: 'Return B' },
    ],
    'usr-admin-01',
    'Admin'
  );
  assert.strictEqual(multiRet.totalReturnedQuantity, 8, 'Same material in 2 Return rows aggregates to 8');
  assert.strictEqual(multiRet.remainingAtSiteQuantity, 7, 'Remaining at site = 15 - 8 = 7');
  assert.strictEqual(
    dbStore.getState().materials.find(m => m.id === mat2.id)!.usableWarehouseQty,
    beforeAvail - 7,
    'Warehouse stock restored by exact aggregated 8'
  );
  console.log('  ✓ PASS: 5. Multi-row same-material Challan Output & Return aggregation + inventory conservation');

  console.log('---------------------------------------------------------------');
  console.log('All Notification & Challan Return Verification Tests Passed 100%');
  console.log('---------------------------------------------------------------\n');
}

runVerificationTests().catch((err) => {
  console.error('Verification test failed:', err);
  process.exit(1);
});
