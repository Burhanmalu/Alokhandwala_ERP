import { dbStore } from '../src/lib/db/store';
import { ChallanService } from '../src/lib/services/challan-service';

async function clearModules() {
  // 1. Delete all existing challans via ChallanService so stock movements are cleanly reversed
  const existingChallans = dbStore.getChallans();
  for (const ch of existingChallans) {
    await ChallanService.deleteChallan(ch.id, 'usr-admin-01', 'Burhan Malu (Admin)');
  }

  // 2. Atomically clear dependent records, projects, sites, and customers in transaction
  await dbStore.transaction(async (state) => {
    // Reconcile any remaining project-reserved/site-allocated stock back to warehouse pool
    for (const mat of state.materials) {
      if ((mat.reservedQty || 0) > 0 || (mat.siteAllocatedQty || 0) > 0) {
        mat.usableWarehouseQty = (mat.usableWarehouseQty || 0) + (mat.siteAllocatedQty || 0);
        mat.reservedQty = 0;
        mat.siteAllocatedQty = 0;
        mat.availableToAllocate = mat.usableWarehouseQty;
      }
    }

    // Clear Challan & Inventory Transaction records tied to challans/projects
    state.challans = [];
    state.transactions = [];

    // Clear Project-dependent records first
    state.bufferRequests = [];
    state.rentalExtensions = [];
    state.shiftingRequests = [];
    state.removalRequests = [];
    state.quotations = [];
    state.invoices = [];
    state.payments = [];
    state.activityEvents = [];
    state.notifications = (state.notifications || []).filter(
      n => !n.entityType || !['RENTAL', 'PROJECT', 'CHALLAN', 'CUSTOMER'].includes(n.entityType)
    );

    // Clear Projects (active & cancelled), Sites, and Customers
    state.projects = [];
    state.sites = [];
    state.customers = [];

    state.auditLogs.unshift({
      id: 'aud-' + Date.now(),
      actorId: 'usr-admin-01',
      actorEmail: 'Burhan Malu (Admin)',
      action: 'BULK_CLEAR_CUSTOMERS_PROJECTS_CHALLANS',
      entityTable: 'customers,projects,challans',
      entityId: 'system-cleanup',
      newState: {
        customers: 0,
        sites: 0,
        projects: 0,
        challans: 0,
      },
      createdAt: new Date().toISOString(),
    });
  });

  console.log('Transactional clear completed.');
}

clearModules().catch(err => {
  console.error(err);
  process.exit(1);
});

