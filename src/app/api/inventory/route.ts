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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve inventory data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      name, 
      itemCode, 
      categoryId, 
      description, 
      unitOfMeasurement, 
      standardWeightKg, 
      purchaseCost, 
      rentalRatePerMonth, 
      minimumStockThreshold, 
      openingStockQty,
      actorId = 'usr-admin-01',
      actorName = 'Admin'
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Material name is required' }, { status: 400 });
    }
    if (!itemCode?.trim()) {
      return NextResponse.json({ success: false, error: 'Item code / SKU is required' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 });
    }

    const result = await dbStore.transaction((state) => {
      // Check SKU uniqueness
      const normalizedCode = itemCode.trim().toUpperCase();
      if (state.materials.some(m => m.itemCode.toUpperCase() === normalizedCode)) {
        throw new Error(`Item code "${normalizedCode}" already exists.`);
      }

      const category = state.categories.find(c => c.id === categoryId);
      const totalOwned = Math.max(0, Number(openingStockQty) || 0);
      const newMaterialId = `mat-${Date.now()}`;

      const newMat = {
        id: newMaterialId,
        itemCode: normalizedCode,
        name: name.trim(),
        categoryId,
        categoryName: category?.name || 'Scaffolding',
        description: description?.trim() || '',
        unitOfMeasurement: (unitOfMeasurement === 'SETS' || unitOfMeasurement === 'METERS' || unitOfMeasurement === 'KG' ? unitOfMeasurement : 'NOS') as 'NOS' | 'SETS' | 'METERS' | 'KG',
        standardWeightKg: Math.max(0, Number(standardWeightKg) || 0),
        purchaseCost: Math.max(0, Number(purchaseCost) || 0),
        rentalRatePerMonth: Math.max(0, Number(rentalRatePerMonth) || 0),
        minimumStockThreshold: Math.max(0, Number(minimumStockThreshold) || 10),
        isActive: true,
        totalOwnedQty: totalOwned,
        usableWarehouseQty: totalOwned,
        reservedQty: 0,
        siteAllocatedQty: 0,
        inTransitQty: 0,
        damagedQty: 0,
        missingQty: 0,
        underInspectionQty: 0,
        availableToAllocate: totalOwned,
      };

      state.materials.push(newMat);

      // If initial stock was declared, record OPENING_STOCK inventory transaction
      if (totalOwned > 0) {
        const year = new Date().getFullYear();
        const txnNumber = `TXN-${year}-${(state.transactions.length + 1).toString().padStart(6, '0')}`;
        state.transactions.unshift({
          id: `txn-${Date.now()}`,
          transactionNumber: txnNumber,
          movementType: 'OPENING_STOCK',
          sourceLocation: 'Vendor / Opening Fleet',
          destinationLocation: 'Taloja Central Scaffolding Yard',
          actorId,
          actorName,
          remarks: `Opening stock registration for new material ${newMat.name} (${newMat.itemCode})`,
          lines: [
            {
              materialId: newMat.id,
              materialName: newMat.name,
              itemCode: newMat.itemCode,
              quantity: totalOwned,
              condition: 'GOOD',
              remarks: 'Initial stock fleet intake',
            },
          ],
          createdAt: new Date().toISOString(),
        });
      }

      return newMat;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory material';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
