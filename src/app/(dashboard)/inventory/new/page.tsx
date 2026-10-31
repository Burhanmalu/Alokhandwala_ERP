'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Boxes, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Scale, 
  ReceiptIndianRupee, 
  Building2,
  PackagePlus,
  Info
} from 'lucide-react';
import { MaterialCategory } from '@/lib/schema';
import { useAuth } from '@/lib/auth/auth-context';

export default function AddMaterialPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasurement, setUnitOfMeasurement] = useState<'NOS' | 'SETS' | 'METERS' | 'KG'>('NOS');
  const [standardWeightKg, setStandardWeightKg] = useState<number | ''>('');
  const [purchaseCost, setPurchaseCost] = useState<number | ''>('');
  const [rentalRatePerMonth, setRentalRatePerMonth] = useState<number | ''>('');
  const [minimumStockThreshold, setMinimumStockThreshold] = useState<number | ''>(20);
  const [openingStockQty, setOpeningStockQty] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data.categories) {
          setCategories(json.data.categories);
          if (json.data.categories.length > 0) {
            setCategoryId(json.data.categories[0].id);
          }
        }
      })
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a material name / description.');
      return;
    }
    if (!itemCode.trim()) {
      setError('Please provide an Item Code / SKU identifier.');
      return;
    }
    if (!categoryId) {
      setError('Please select a material category.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          itemCode: itemCode.trim().toUpperCase(),
          categoryId,
          description: description.trim(),
          unitOfMeasurement,
          standardWeightKg: standardWeightKg === '' ? 0 : Number(standardWeightKg),
          purchaseCost: purchaseCost === '' ? 0 : Number(purchaseCost),
          rentalRatePerMonth: rentalRatePerMonth === '' ? 0 : Number(rentalRatePerMonth),
          minimumStockThreshold: minimumStockThreshold === '' ? 10 : Number(minimumStockThreshold),
          openingStockQty: openingStockQty === '' ? 0 : Number(openingStockQty),
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to register material');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/inventory/catalogue');
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while creating material';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Inventory Overview</span>
        </Link>
        <span>/</span>
        <Link href="/inventory/catalogue" className="hover:text-[#24160c] transition">
          <span>Catalogue</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-stone-800">Add New Material</span>
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-mono tracking-widest text-[#c79e7c] uppercase">Master Inventory Registration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <PackagePlus className="w-6 h-6 text-[#c79e7c]" />
            <span>Add New Inventory Material</span>
          </h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">Material successfully registered! Redirecting to catalogue...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Classification & Identification */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h2 className="text-base font-bold text-[#24160c] uppercase tracking-wider">
                Material Identification & SKU
              </h2>
            </div>
            <span className="text-xs font-mono text-[#7d6553] bg-[#fbf9f5] px-3 py-1 rounded-md border border-[#ebdcc9]">
              Specification
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Material Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loadingCategories}
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Code */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Item Code / SKU <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                placeholder="e.g. SCF-L-10FT-3M"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">
                Unique identifier used across delivery challans and reservations
              </span>
            </div>

            {/* Material Name */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Material Name / Label <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cuplock Ledger 10ft (3.0m)"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Technical Specification & Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Galvanized steel horizontal member with forged wedge blades. Compatible with standard IS 4014 cup lock systems."
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Weight, Tariff & Stock Parameters */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h2 className="text-base font-bold text-[#24160c] uppercase tracking-wider">
                Engineering Weight, Financial Tariffs & Initial Balance
              </h2>
            </div>
            <span className="text-xs font-mono text-[#7d6553] bg-[#fbf9f5] px-3 py-1 rounded-md border border-[#ebdcc9]">
              Commercial Terms
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {/* Unit */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Unit of Measurement <span className="text-rose-600">*</span>
              </label>
              <select
                value={unitOfMeasurement}
                onChange={(e) => setUnitOfMeasurement(e.target.value as any)}
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              >
                <option value="NOS">Pieces / Numbers (NOS)</option>
                <option value="SETS">Equipment Sets (SETS)</option>
                <option value="METERS">Running Meters (METERS)</option>
                <option value="KG">Weight in Kilograms (KG)</option>
              </select>
            </div>

            {/* Standard Weight */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Standard Unit Weight (kg)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={standardWeightKg}
                onChange={(e) => setStandardWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 10.5"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">Used for transport load and tare weight calculation</span>
            </div>

            {/* Purchase Cost */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Purchase / Asset Replacement Cost (₹)
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 1450"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">Charged to client in case of site loss or damage</span>
            </div>

            {/* Rental Rate Per Month */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Monthly Rental Tariff (₹ / month) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step="0.5"
                value={rentalRatePerMonth}
                onChange={(e) => setRentalRatePerMonth(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 45"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">Base tariff for 28-day commercial rental cycle</span>
            </div>

            {/* Minimum Stock Threshold */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                min={0}
                value={minimumStockThreshold}
                onChange={(e) => setMinimumStockThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 50"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">Triggers low stock warnings on the dashboard</span>
            </div>

            {/* Initial Opening Stock Qty */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Opening Yard Stock Intake (Qty)
              </label>
              <input
                type="number"
                min={0}
                value={openingStockQty}
                onChange={(e) => setOpeningStockQty(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 500"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
              <span className="text-2xs text-[#8c7360] mt-1 block">Will record an initial OPENING_STOCK movement transaction</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-sm text-[#7d6553] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#8c5e39] shrink-0" />
            <span>This material will immediately become available for smart scaffolding calculations and site reservations.</span>
          </div>

          <div className="flex items-center gap-3 justify-end shrink-0">
            <Link
              href="/inventory/catalogue"
              className="px-6 py-3 rounded-lg border border-[#d6c7b2] text-[#24160c] hover:bg-[#fbf9f5] text-sm font-semibold transition text-center min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || success}
              className="flex items-center justify-center gap-2 px-7 py-3 bg-[#24160c] hover:bg-[#382315] disabled:bg-[#d6c7b2] text-[#fbf9f5] text-sm font-bold rounded-lg shadow-sm transition cursor-pointer min-h-[44px]"
            >
              {submitting ? (
                <span>Registering Material...</span>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#c79e7c]" />
                  <span>Material Created!</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4 text-[#c79e7c]" />
                  <span>Save Material to Inventory</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
