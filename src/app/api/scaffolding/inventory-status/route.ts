import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const materials = dbStore.getMaterials().map(m => {
      const available = Math.max(0, m.usableWarehouseQty - m.reservedQty);
      return {
        id: m.id,
        itemCode: m.itemCode,
        name: m.name,
        categoryName: m.categoryName,
        unit: m.unitOfMeasurement,
        totalOwnedQty: m.totalOwnedQty,
        usableWarehouseQty: m.usableWarehouseQty,
        reservedQty: m.reservedQty,
        siteAllocatedQty: m.siteAllocatedQty,
        damagedQty: m.damagedQty,
        missingQty: m.missingQty,
        availableToAllocate: available,
        rentalRatePerMonth: m.rentalRatePerMonth,
        standardWeightKg: m.standardWeightKg,
        isLowStock: available <= m.minimumStockThreshold,
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        materials,
        summary: {
          totalSkus: materials.length,
          totalOwnedQty: materials.reduce((s, m) => s + m.totalOwnedQty, 0),
          usableWarehouseQty: materials.reduce((s, m) => s + m.usableWarehouseQty, 0),
          reservedQty: materials.reduce((s, m) => s + m.reservedQty, 0),
          availableToAllocate: materials.reduce((s, m) => s + m.availableToAllocate, 0),
          siteAllocatedQty: materials.reduce((s, m) => s + m.siteAllocatedQty, 0),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
