import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const projects = dbStore.getProjects();
    const customers = dbStore.getCustomers();
    const materials = dbStore.getMaterials();
    const invoices = dbStore.getInvoices();
    const payments = dbStore.getPayments();
    const categories = dbStore.getCategories();
    const shiftings = dbStore.getShiftingRequests();
    const removals = dbStore.getRemovalRequests();
    const extensions = dbStore.getRentalExtensions();
    const buffers = dbStore.getBufferRequests();

    const now = new Date();

    // Summary Calculations
    const totalCustomers = customers.length;
    const totalProjects = projects.length;
    const notInstalledCount = projects.filter(p => p.status === 'NOT_INSTALLED').length;
    const confirmedCount = projects.filter(p => p.status === 'CONFIRMED_PROJECT').length;
    const scheduledCount = projects.filter(p => p.status === 'SCHEDULED').length;
    const activeRentalCount = projects.filter(p => p.status === 'ACTIVE_RENTAL' || p.status === 'INSTALLED' || p.status === 'EXTENDED').length;
    const bufferCount = projects.filter(p => p.status === 'BUFFER_PERIOD').length;
    const extensionRequestedCount = projects.filter(p => p.status === 'EXTENSION_REQUESTED').length;
    const shiftingCount = projects.filter(p => p.status === 'SHIFTING_PENDING' || p.status === 'SHIFTING_IN_PROGRESS').length;
    const removalCount = projects.filter(p => p.status === 'REMOVAL_PENDING').length;

    // Overdue removals: buffer end date passed or rental end date passed while in removal pending
    const overdueRemovalsCount = projects.filter(p => {
      if (p.status === 'BUFFER_PERIOD' && p.bufferEndDate) {
        return new Date(p.bufferEndDate) < now;
      }
      if (p.status === 'REMOVAL_PENDING' && p.rentalEndDate) {
        return new Date(p.rentalEndDate) < now;
      }
      return false;
    }).length;

    // Inventory metrics
    const usableWarehouseQty = materials.reduce((sum, m) => sum + m.usableWarehouseQty, 0);
    const reservedQty = materials.reduce((sum, m) => sum + m.reservedQty, 0);
    const siteAllocatedQty = materials.reduce((sum, m) => sum + m.siteAllocatedQty, 0);
    const damagedQty = materials.reduce((sum, m) => sum + m.damagedQty, 0);
    const missingQty = materials.reduce((sum, m) => sum + m.missingQty, 0);
    const lowStockCount = materials.filter(m => (m.usableWarehouseQty - m.reservedQty) <= m.minimumStockThreshold).length;

    // Financial metrics
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingReceivables = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);
    const monthlyRentalRunRate = projects
      .filter(p => ['ACTIVE_RENTAL', 'INSTALLED', 'EXTENDED'].includes(p.status))
      .reduce((sum, p) => sum + p.monthlyRentalRate, 0);

    // Chart Data: Projects by Status
    const statusCounts: Record<string, number> = {};
    for (const p of projects) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }
    const projectsByStatusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      status,
      count,
    }));

    // Chart Data: Material Allocation by Category
    const categoryAllocationData = categories.map(cat => {
      const catMaterials = materials.filter(m => m.categoryId === cat.id);
      return {
        category: cat.name.split('/')[0].trim(),
        warehouse: catMaterials.reduce((sum, m) => sum + m.usableWarehouseQty, 0),
        onSite: catMaterials.reduce((sum, m) => sum + m.siteAllocatedQty, 0),
        reserved: catMaterials.reduce((sum, m) => sum + m.reservedQty, 0),
      };
    });

    // Upcoming Deadlines
    const upcomingDeadlines = projects
      .filter(p => p.rentalEndDate || p.bufferEndDate)
      .map(p => {
        const targetDate = p.bufferEndDate || p.rentalEndDate || '';
        const daysLeft = Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          projectCode: p.projectCode,
          customerName: p.customerName,
          siteName: p.siteName,
          status: p.status,
          targetDate,
          daysLeft,
          type: p.bufferEndDate ? 'BUFFER_DEADLINE' : 'RENTAL_EXPIRY',
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        cards: {
          totalCustomers,
          totalProjects,
          notInstalledCount,
          confirmedCount,
          scheduledCount,
          activeRentalCount,
          bufferCount,
          extensionRequestedCount,
          shiftingCount,
          removalCount,
          overdueRemovalsCount,
          usableWarehouseQty,
          reservedQty,
          siteAllocatedQty,
          damagedQty,
          missingQty,
          lowStockCount,
          totalInvoiced,
          totalCollected,
          outstandingReceivables,
          monthlyRentalRunRate,
        },
        charts: {
          projectsByStatus: projectsByStatusData,
          categoryAllocation: categoryAllocationData,
        },
        upcomingDeadlines,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
