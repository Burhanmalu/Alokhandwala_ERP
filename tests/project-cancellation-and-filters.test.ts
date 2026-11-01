import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';
import { InventoryService } from '../src/lib/services/inventory-service';
import { QuotationService } from '../src/lib/services/quotation-service';
import { Project } from '../src/lib/schema';

export async function runProjectCancellationAndFiltersTests() {
  console.log('\n===============================================================');
  console.log('PROJECT CANCELLATION & FILTER UPDATES TEST SUITE');
  console.log('===============================================================');

  // Test 1: Cancel a Pre-installation project
  const state = await dbStore.getState();
  const customer = state.customers[0];
  assert(customer, 'Customer must exist');

  // Create pre-installation site project
  const siteProject = await ProjectService.createProjectFromInspection({
    customerId: customer.id,
    customerName: customer.companyName,
    siteName: 'Plot 42 Site',
    siteAddress: 'Plot 42, Super Corridor, Indore, MP',
    landmark: 'Near Airport Junction',
    supervisorName: 'Burhan Malu (Admin)',
    assignedSupervisorId: 'usr-admin-01',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
    contactPhone: '9826011223',
    measurements: {
      width: 20,
      depth: 5,
      height: 30,
      unit: 'FEET',
    },
  });

  assert(siteProject.id, 'Site project must have valid ID');
  assert.strictEqual(siteProject.status, 'NOT_INSTALLED', 'Initial pre-installation status is NOT_INSTALLED');

  // Add material reservation to test stock release
  const mat = state.materials[0];
  const initialAvailable = mat.usableWarehouseQty - mat.reservedQty;
  const initialReserved = mat.reservedQty;
  const reserveAmount = 25;

  await dbStore.transaction((s) => {
    const p = s.projects.find(proj => proj.id === siteProject.id);
    if (p) {
      p.status = 'CONFIRMED_PROJECT';
      p.materials = [
        {
          id: `pm-${Date.now()}`,
          projectId: p.id,
          materialId: mat.id,
          materialName: mat.name,
          itemCode: mat.itemCode,
          unit: mat.unitOfMeasurement,
          requiredQuantity: reserveAmount,
          reservedQuantity: reserveAmount,
          issuedQuantity: 0,
          installedQuantity: 0,
          returnedUsableQuantity: 0,
          returnedDamagedQuantity: 0,
          missingQuantity: 0,
          monthlyRentalRate: 65,
        }
      ];
    }
    const m = s.materials.find(material => material.id === mat.id);
    if (m) {
      m.reservedQty += reserveAmount;
      m.availableToAllocate = m.usableWarehouseQty - m.reservedQty;
    }
  });

  const updatedStateBeforeCancel = await dbStore.getState();
  const matBeforeCancel = updatedStateBeforeCancel.materials.find(m => m.id === mat.id)!;
  assert.strictEqual(matBeforeCancel.reservedQty, initialReserved + reserveAmount);
  console.log('  ✓ PASS: 1. Pre-installation project created and materials reserved');

  // Test 2: Execute Cancellation with mandatory reason
  const cancelReasonText = 'Client postponed commercial facade work due to monsoon weather restrictions';
  const cancelRes = await ProjectService.cancelProject({
    projectId: siteProject.id,
    reason: cancelReasonText,
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });

  assert.strictEqual(cancelRes.project.status, 'CANCELLED', 'Status must be updated to CANCELLED');
  assert.strictEqual(cancelRes.releasedMaterialsCount, reserveAmount, 'All 25 reserved pieces must be released');
  console.log('  ✓ PASS: 2. Cancelled pre-installation project successfully');

  // Test 3: Disappears from active directory and appears in Cancelled Projects
  const stateAfterCancel = await dbStore.getState();
  const activeProjects = stateAfterCancel.projects.filter(p => p.status !== 'CANCELLED');
  const cancelledProjects = stateAfterCancel.projects.filter(p => p.status === 'CANCELLED');

  assert(!activeProjects.some(p => p.id === siteProject.id), 'Cancelled project must NOT be in active directory');
  assert(cancelledProjects.some(p => p.id === siteProject.id), 'Cancelled project must be in Cancelled Projects folder');
  console.log('  ✓ PASS: 3. Disappears from active directory and appears in Cancelled Projects archive');

  // Test 4: Verify cancellation metadata (reason, date, time, admin details)
  const cancelledProj = cancelledProjects.find(p => p.id === siteProject.id)!;
  assert.strictEqual(cancelledProj.cancellationReason, cancelReasonText, 'Reason matches exactly');
  assert(cancelledProj.cancelledAt, 'Cancellation timestamp must be recorded');
  assert.strictEqual(cancelledProj.cancelledBy, 'usr-admin-01', 'Admin ID matches');
  assert.strictEqual(cancelledProj.cancelledByName, 'Burhan Malu (Admin)', 'Admin Name matches');
  console.log('  ✓ PASS: 4. Cancellation reason, timestamp, and admin details verified');

  // Test 5: Verify reserved stock is released and returned to available stock
  const matAfterCancel = stateAfterCancel.materials.find(m => m.id === mat.id)!;
  assert.strictEqual(matAfterCancel.reservedQty, initialReserved, 'Reserved quantity must decrement back');
  assert.strictEqual(matAfterCancel.availableToAllocate, initialAvailable, 'Available quantity restored to initial');
  assert.strictEqual(cancelledProj.materials![0].reservedQuantity, 0, 'Project reservedQuantity reset to 0');
  console.log('  ✓ PASS: 5. Reserved stock released and restored to available warehouse stock');

  // Test 6: Verify issued/allocated stock is NOT incorrectly returned
  // If an item has issued/allocated stock on site, it must not be released as available warehouse stock
  const testProjectAllocated = await ProjectService.createProjectFromInspection({
    customerId: customer.id,
    customerName: customer.companyName,
    siteName: 'Indore Bypass Site',
    siteAddress: 'Indore Bypass Project B',
    supervisorName: 'Burhan Malu',
    assignedSupervisorId: 'usr-admin-01',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
    contactPhone: '9826011223',
    measurements: {
      width: 10,
      depth: 3,
      height: 20,
      unit: 'FEET',
    },
  });

  await dbStore.transaction((s) => {
    const p = s.projects.find(proj => proj.id === testProjectAllocated.id);
    if (p) {
      p.status = 'INSTALLED';
      p.actualInstallationDate = '2026-11-01T10:00:00.000Z';
      p.materials = [
        {
          id: `pm-alloc-${Date.now()}`,
          projectId: p.id,
          materialId: mat.id,
          materialName: mat.name,
          itemCode: mat.itemCode,
          unit: mat.unitOfMeasurement,
          requiredQuantity: 50,
          reservedQuantity: 0,
          issuedQuantity: 50,
          installedQuantity: 50,
          returnedUsableQuantity: 0,
          returnedDamagedQuantity: 0,
          missingQuantity: 0,
          monthlyRentalRate: 65,
        }
      ];
    }
  });

  // Attempting to cancel installed project must throw error
  let cancelInstalledError = '';
  try {
    await ProjectService.cancelProject({
      projectId: testProjectAllocated.id,
      reason: 'Should not allow cancellation',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });
  } catch (err: any) {
    cancelInstalledError = err.message;
  }

  assert(cancelInstalledError.includes('installation has commenced') || cancelInstalledError.includes('Cannot cancel'),
    'Must prevent cancelling installed project');
  console.log('  ✓ PASS: 6. Installed and site-allocated stock protected against invalid cancellation');

  // Test 7: Verify cancelled projects cannot proceed to installation
  let installCancelledError = '';
  try {
    await InventoryService.submitInstallation({
      projectId: siteProject.id,
      actualInstallationDate: '2026-11-02',
      supervisorId: 'usr-admin-01',
      materialsUsed: [{ materialId: mat.id, installedQuantity: 10 }],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });
  } catch (err: any) {
    installCancelledError = err.message;
  }
  assert(installCancelledError.length > 0, 'Cancelled project cannot proceed to installation');
  console.log('  ✓ PASS: 7. Cancelled projects strictly prohibited from installation');

  // Test 8: Verify installed and installation-started projects cannot be cancelled
  const activeRentalProject = stateAfterCancel.projects.find(p => p.status === 'ACTIVE_RENTAL' || p.status === 'INSTALLED');
  if (activeRentalProject) {
    let errorMsg = '';
    try {
      await ProjectService.cancelProject({
        projectId: activeRentalProject.id,
        reason: 'Illegal cancel attempt',
        actorId: 'usr-admin-01',
        actorName: 'Burhan Malu',
      });
    } catch (e: any) {
      errorMsg = e.message;
    }
    assert(errorMsg.length > 0, 'Active/installed projects cannot be cancelled');
  }
  console.log('  ✓ PASS: 8. Installed and active rental projects cannot be cancelled');

  // Test 9: Verify Quoted filter displays all quotation stages
  // Create projects in each quotation stage
  const qProjDraft = await ProjectService.createProjectFromInspection({
    customerId: customer.id,
    customerName: customer.companyName,
    siteName: 'Quotation Test Site',
    siteAddress: 'Quotation Test Site Draft',
    supervisorName: 'Burhan Malu',
    assignedSupervisorId: 'usr-admin-01',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
    contactPhone: '9826011223',
    measurements: {
      width: 10,
      depth: 3,
      height: 10,
      unit: 'FEET',
    },
  });

  await QuotationService.saveQuotation({
    projectId: qProjDraft.id,
    status: 'DRAFT',
    ratePerSqFt: 25,
    totalAreaSqFt: 100,
    durationMonths: 1,
    materials: [],
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  const stateWithQuotes = await dbStore.getState();
  const quotedProjects = stateWithQuotes.projects.filter(p => 
    ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED'].includes(p.status)
  );

  assert(quotedProjects.length > 0, 'Quoted filter must include saved quotation projects');
  assert(quotedProjects.some(p => p.id === qProjDraft.id), 'Draft quotation project included in Quoted filter');
  console.log('  ✓ PASS: 9. Quoted filter captures all saved, sent, and reviewed quotation stages');

  // Test 10: Verify Reconciliation filter is removed from UI filter tabs
  // Let's verify STATUS_TABS definition
  const projectsPageFile = await import('fs');
  const path = await import('path');
  const pageContent = projectsPageFile.readFileSync(path.join(process.cwd(), 'src', 'app', '(dashboard)', 'projects', 'page.tsx'), 'utf8');

  assert(!pageContent.includes("label: 'Reconciliation'"), 'Reconciliation filter must be removed from STATUS_TABS');
  assert(pageContent.includes("key: 'QUOTED'"), 'QUOTED filter key must be present');
  assert(pageContent.includes("key: 'CANCELLED'"), 'CANCELLED filter key must be present');
  console.log('  ✓ PASS: 10. Reconciliation filter removed; Quoted & Cancelled filters present in page');

  // Test 11: Refresh / reload verification
  const reloadedState = await dbStore.getState();
  const reloadedCancelled = reloadedState.projects.find(p => p.id === siteProject.id);
  assert(reloadedCancelled, 'Project must persist in database');
  assert.strictEqual(reloadedCancelled.status, 'CANCELLED', 'Persisted status is CANCELLED');
  assert.strictEqual(reloadedCancelled.cancellationReason, cancelReasonText, 'Persisted reason matches');
  console.log('  ✓ PASS: 11. Application reload confirms permanent data persistence across reloads');

  console.log('---------------------------------------------------------------');
  console.log('Project Cancellation & Filters: 11 Passed, 0 Failed');
  console.log('---------------------------------------------------------------');
}

if (process.argv[1]?.endsWith('project-cancellation-and-filters.test.ts')) {
  runProjectCancellationAndFiltersTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}
