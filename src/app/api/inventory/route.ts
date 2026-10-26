import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search')?.toLowerCase();
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    let materials = dbStore.getMaterials().map(m => ({
      ...m,
      availableToAllocate: m.usableWarehouseQty - m.reservedQty,
      isLowStock: (m.usableWarehouseQty - m.reservedQty) <= m.minimumStockThreshold,
    }));

    if (categoryId) {
      materials = materials.filter(m => m.categoryId === categoryId);
    }
    if (lowStockOnly) {
      materials = materials.filter(m => m.isLowStock);
    }
    if (search) {
      materials = materials.filter(m =>
        m.name.toLowerCase().includes(search) ||
        m.itemCode.toLowerCase().includes(search) ||
        (m.categoryName && m.categoryName.toLowerCase().includes(search))
      );
    }

    const warehouses = dbStore.getWarehouses();
    const categories = dbStore.getCategories();
    const transactions = dbStore.getTransactions().slice(0, 50);

    return NextResponse.json({
      success: true,
      data: {
        materials,
        warehouses,
        categories,
        transactions,
        summary: {
          totalOwnedQty: materials.reduce((sum, m) => sum + m.totalOwnedQty, 0),
          usableWarehouseQty: materials.reduce((sum, m) => sum + m.usableWarehouseQty, 0),
          reservedQty: materials.reduce((sum, m) => sum + m.reservedQty, 0),
          siteAllocatedQty: materials.reduce((sum, m) => sum + m.siteAllocatedQty, 0),
          damagedQty: materials.reduce((sum, m) => sum + m.damagedQty, 0),
          missingQty: materials.reduce((sum, m) => sum + m.missingQty, 0),
          lowStockCount: materials.filter(m => m.isLowStock).length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
