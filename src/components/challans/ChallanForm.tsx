'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  PackageOpen,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Building2,
  MapPin,
  Ruler,
  Loader2,
  Save,
  PlusCircle,
  Camera,
  ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { Challan, ChallanImage, Customer, Material, Project, Site } from '@/lib/schema';
import { extractProjectDimensions, formatDate, isEligibleActiveProjectStatus, toDateOnlyString } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage } from '@/lib/image-utils';

interface FormMaterialRow {
  rowId: string;
  id?: string;
  date: string;
  materialId: string;
  quantity: string;
  remarks?: string;
}

interface FormLostRow {
  rowId: string;
  id?: string;
  date: string;
  materialId: string;
  quantity: string;
  reason: string;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ChallanForm({
  editingChallan,
}: {
  editingChallan?: Challan | null;
}) {
  const router = useRouter();
  const { currentUser, can } = useAuth();
  const isEdit = Boolean(editingChallan);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [customerId, setCustomerId] = useState(editingChallan?.customerId || '');
  const [siteId, setSiteId] = useState(editingChallan?.siteId || '');
  const [siteNameFallback, setSiteNameFallback] = useState(editingChallan?.siteName || '');
  const [projectId, setProjectId] = useState(editingChallan?.projectId || '');
  const [size, setSize] = useState(editingChallan?.size || '');
  const [notes, setNotes] = useState(editingChallan?.notes || '');

  const [outputRows, setOutputRows] = useState<FormMaterialRow[]>(() =>
    editingChallan?.outputEntries?.length
      ? editingChallan.outputEntries.map((e, i) => ({
          rowId: `out-${i}-${Date.now()}`,
          id: e.id,
          date: toDateOnlyString(e.date) || getTodayDateString(),
          materialId: e.materialId,
          quantity: String(e.quantity),
          remarks: e.remarks || '',
        }))
      : [{ rowId: `out-init-${Date.now()}`, date: getTodayDateString(), materialId: '', quantity: '1', remarks: '' }]
  );

  const [inputRows, setInputRows] = useState<FormMaterialRow[]>(() =>
    editingChallan?.inputEntries?.length
      ? editingChallan.inputEntries.map((e, i) => ({
          rowId: `in-${i}-${Date.now()}`,
          id: e.id,
          date: toDateOnlyString(e.date) || getTodayDateString(),
          materialId: e.materialId,
          quantity: String(e.quantity),
          remarks: e.remarks || '',
        }))
      : []
  );

  const [lostRows, setLostRows] = useState<FormLostRow[]>(() =>
    editingChallan?.lostEntries?.length
      ? editingChallan.lostEntries.map((e, i) => ({
          rowId: `lost-${i}-${Date.now()}`,
          id: e.id,
          date: toDateOnlyString(e.date) || getTodayDateString(),
          materialId: e.materialId,
          quantity: String(e.quantity),
          reason: e.reason || '',
        }))
      : []
  );

  const [lossApproved, setLossApproved] = useState<boolean>(Boolean(editingChallan?.lossApproved));
  const [challanImages, setChallanImages] = useState<ChallanImage[]>(editingChallan?.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [failedImageFiles, setFailedImageFiles] = useState<{ file: File; source: 'CAMERA' | 'GALLERY' }[]>([]);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState<string>(() => `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    Promise.all([
      fetch('/api/customers?eligibleForChallan=true').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
      fetch('/api/projects?eligibleForChallan=true').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ])
      .then(([custJson, siteJson, projJson, invJson]) => {
        if (custJson.success) setCustomers(custJson.data || []);
        if (siteJson.success) setSites(siteJson.data || []);
        if (projJson.success) setProjects(projJson.data || []);
        if (invJson.success) setMaterials(invJson.data?.materials || []);
      })
      .finally(() => setLoadingRefs(false));
  }, []);

  const eligibleCustomers = useMemo(() => {
    const eligibleIds = new Set(
      projects
        .filter((p) => p.status !== 'CANCELLED' && isEligibleActiveProjectStatus(p.status))
        .map((p) => p.customerId)
    );
    return customers.filter(
      (c) => eligibleIds.has(c.id) || (isEdit && c.id === editingChallan?.customerId)
    );
  }, [customers, projects, isEdit, editingChallan?.customerId]);

  const selectedCustomer = useMemo(
    () => eligibleCustomers.find(c => c.id === customerId) || customers.find(c => c.id === customerId) || null,
    [eligibleCustomers, customers, customerId]
  );

  const customerSites = useMemo(
    () => sites.filter(s => s.customerId === customerId),
    [sites, customerId]
  );

  // Only eligible active projects can be used for Delivery Challans
  const customerProjects = useMemo(
    () =>
      projects.filter(
        p =>
          p.customerId === customerId &&
          p.status !== 'CANCELLED' &&
          isEligibleActiveProjectStatus(p.status)
      ),
    [projects, customerId]
  );

  const availableDimensionOptions = useMemo(() => {
    const relevant = siteId
      ? customerProjects.filter(p => p.siteId === siteId || p.siteName === sites.find(s => s.id === siteId)?.siteName)
      : customerProjects;
    const seen = new Set<string>();
    const options: { projectId: string; label: string; sizeText: string }[] = [];
    for (const p of relevant) {
      const dims = extractProjectDimensions(p);
      if (dims.width > 0 && dims.height > 0) {
        const sizeText = `${dims.formattedDimensions} (${dims.formattedArea})`;
        if (!seen.has(sizeText)) {
          seen.add(sizeText);
          options.push({
            projectId: p.id,
            label: `${p.projectCode}: ${sizeText}`,
            sizeText,
          });
        }
      }
    }
    return options;
  }, [customerProjects, siteId, sites]);

  const handleCustomerChange = (nextCustId: string) => {
    setCustomerId(nextCustId);
    setProjectId('');
    const matchingSites = sites.filter(s => s.customerId === nextCustId);
    if (matchingSites.length === 1) {
      setSiteId(matchingSites[0].id);
      setSiteNameFallback(matchingSites[0].siteName);
    } else {
      setSiteId('');
      setSiteNameFallback('');
    }
    setError(null);
  };

  const handleSiteChange = (nextSiteId: string) => {
    setSiteId(nextSiteId);
    const found = sites.find(s => s.id === nextSiteId);
    if (found) {
      setSiteNameFallback(found.siteName);
    }
    setError(null);
  };

  // Map old quantities on Edit so stock availability checks show true remaining allowance
  const originalIssuedByMat = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of editingChallan?.reconciliation || []) {
      map.set(l.materialId, l.issuedQuantity);
    }
    return map;
  }, [editingChallan]);

  // Issued material IDs (restricts Input & Lost dropdowns exclusively to issued materials!)
  const issuedMaterialIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of outputRows) {
      if (r.materialId && Number(r.quantity) > 0) set.add(r.materialId);
    }
    return set;
  }, [outputRows]);

  const issuedMaterialsList = useMemo(
    () => materials.filter(m => issuedMaterialIds.has(m.id)),
    [materials, issuedMaterialIds]
  );

  // Live Reconciliation Computation
  const reconciliationPreview = useMemo(() => {
    const issuedMap = new Map<string, number>();
    const returnedMap = new Map<string, number>();
    const lostMap = new Map<string, number>();
    const order: string[] = [];

    for (const r of outputRows) {
      const qty = Math.max(0, Math.trunc(Number(r.quantity) || 0));
      if (!r.materialId || qty <= 0) continue;
      if (!issuedMap.has(r.materialId)) order.push(r.materialId);
      issuedMap.set(r.materialId, (issuedMap.get(r.materialId) || 0) + qty);
    }

    for (const r of inputRows) {
      const qty = Math.max(0, Math.trunc(Number(r.quantity) || 0));
      if (!r.materialId || qty <= 0) continue;
      returnedMap.set(r.materialId, (returnedMap.get(r.materialId) || 0) + qty);
    }

    for (const r of lostRows) {
      const qty = Math.max(0, Math.trunc(Number(r.quantity) || 0));
      if (!r.materialId || qty <= 0) continue;
      lostMap.set(r.materialId, (lostMap.get(r.materialId) || 0) + qty);
    }

    const lines = order.map(matId => {
      const mat = materials.find(m => m.id === matId);
      const issued = issuedMap.get(matId) || 0;
      const returned = returnedMap.get(matId) || 0;
      const lost = lostMap.get(matId) || 0;
      const pending = Math.max(0, issued - returned);
      const remainingAtSite = Math.max(0, issued - returned - lost);
      const exceedsIssued = returned + lost > issued;
      return {
        materialId: matId,
        materialName: mat?.name || 'Selected Material',
        itemCode: mat?.itemCode || '',
        unit: mat?.unitOfMeasurement || 'NOS',
        issued,
        returned,
        lost,
        pending,
        remainingAtSite,
        exceedsIssued,
      };
    });

    // Also catch any input/lost rows whose materialId is no longer in outputRows
    const orphanErrors: string[] = [];
    for (const [matId] of returnedMap) {
      if (!issuedMap.has(matId)) {
        const mat = materials.find(m => m.id === matId);
        orphanErrors.push(`Return entry references "${mat?.name || matId}", which is not issued in Output Material.`);
      }
    }
    for (const [matId] of lostMap) {
      if (!issuedMap.has(matId)) {
        const mat = materials.find(m => m.id === matId);
        orphanErrors.push(`Lost entry references "${mat?.name || matId}", which is not issued in Output Material.`);
      }
    }

    const totalOutput = lines.reduce((s, l) => s + l.issued, 0);
    const totalReturned = lines.reduce((s, l) => s + l.returned, 0);
    const totalLost = lines.reduce((s, l) => s + l.lost, 0);
    const totalPending = Math.max(0, totalOutput - totalReturned);
    const totalRemainingAtSite = lines.reduce((s, l) => s + l.remainingAtSite, 0);
    const hasExcess = lines.some(l => l.exceedsIssued) || orphanErrors.length > 0;

    const autoStatus: 'CLOSED' | 'UNCLOSED' =
      totalOutput > 0 &&
      totalRemainingAtSite === 0 &&
      !hasExcess &&
      (totalLost === 0 || lossApproved)
        ? 'CLOSED'
        : 'UNCLOSED';

    return {
      lines,
      totalOutput,
      totalReturned,
      totalLost,
      totalPending,
      totalRemainingAtSite,
      hasExcess,
      orphanErrors,
      autoStatus,
    };
  }, [outputRows, inputRows, lostRows, materials, lossApproved]);

  const addOutputRow = () => {
    setOutputRows(prev => [
      ...prev,
      { rowId: `out-${Date.now()}-${Math.random()}`, date: getTodayDateString(), materialId: '', quantity: '1', remarks: '' },
    ]);
  };

  const addInputRow = () => {
    setInputRows(prev => {
      const used = new Set(prev.map(r => r.materialId).filter(Boolean));
      const nextUnselected = issuedMaterialsList.find(m => !used.has(m.id))?.id || '';
      return [
        ...prev,
        { rowId: `in-${Date.now()}-${Math.random()}`, date: getTodayDateString(), materialId: nextUnselected, quantity: '1', remarks: '' },
      ];
    });
  };

  const addLostRow = () => {
    const defaultMat = issuedMaterialsList[0]?.id || '';
    setLostRows(prev => [
      ...prev,
      { rowId: `lost-${Date.now()}-${Math.random()}`, date: getTodayDateString(), materialId: defaultMat, quantity: '1', reason: '' },
    ]);
  };

  const resetForNextChallan = () => {
    setCustomerId('');
    setSiteId('');
    setSiteNameFallback('');
    setProjectId('');
    setSize('');
    setNotes('');
    setOutputRows([
      { rowId: `out-init-${Date.now()}`, date: getTodayDateString(), materialId: '', quantity: '1', remarks: '' },
    ]);
    setInputRows([]);
    setLostRows([]);
    setLossApproved(false);
    setError(null);
    setClientRequestId(`req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  };

  const validateBeforeSubmit = (): string | null => {
    if (!customerId) return 'Please select a Customer.';
    if (!siteId && !siteNameFallback.trim()) return 'Please select a Site for the chosen Customer.';
    if (!size.trim()) return 'Please enter or select the scaffolding Size.';

    const validOutputs = outputRows.filter(r => r.materialId && Number(r.quantity) > 0);
    if (validOutputs.length === 0) {
      return 'Please add at least one Output Material row with a valid material and quantity.';
    }
    const seenOutputMats = new Set<string>();
    for (const r of outputRows) {
      if (!r.materialId) return 'Every Output Material row must have a selected material.';
      if (seenOutputMats.has(r.materialId)) return 'Duplicate materials are not allowed in Output Material.';
      seenOutputMats.add(r.materialId);
      if (!r.date) return 'Every Output Material row must have a valid date.';
      const qty = Number(r.quantity);
      if (!Number.isInteger(qty) || qty < 1) return 'Output quantities must be positive whole numbers.';
    }

    const seenInputMats = new Set<string>();
    for (const r of inputRows) {
      if (!r.materialId) return 'Every Input (Return) row must have a selected material.';
      if (seenInputMats.has(r.materialId)) return 'Duplicate materials are not allowed in Input Material.';
      seenInputMats.add(r.materialId);
      if (!r.date) return 'Every Input (Return) row must have a valid date.';
      const qty = Number(r.quantity);
      if (!Number.isInteger(qty) || qty < 1) return 'Returned quantities must be positive whole numbers.';
    }

    for (const r of lostRows) {
      if (!r.materialId) return 'Every Lost / Missing row must have a selected material.';
      if (!r.date) return 'Every Lost / Missing row must have a valid date.';
      const qty = Number(r.quantity);
      if (!Number.isInteger(qty) || qty < 1) return 'Lost quantities must be positive whole numbers.';
    }

    if (reconciliationPreview.orphanErrors.length > 0) {
      return reconciliationPreview.orphanErrors[0];
    }

    for (const line of reconciliationPreview.lines) {
      if (line.returned > line.issued) {
        return `Returned quantity (${line.returned}) for "${line.materialName}" cannot exceed issued quantity (${line.issued}).`;
      }
      if (line.returned + line.lost > line.issued) {
        return `Returned (${line.returned}) + Lost (${line.lost}) for "${line.materialName}" cannot exceed issued quantity (${line.issued}).`;
      }
    }

    return null;
  };

  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  const uploadChallanFiles = async (files: { file: File; source: 'CAMERA' | 'GALLERY' }[]) => {
    if (files.length === 0) return;
    setUploadingImages(true);
    setImageUploadError(null);
    const failed: { file: File; source: 'CAMERA' | 'GALLERY' }[] = [];
    const uploaded: ChallanImage[] = [];

    for (const item of files) {
      const { file, source } = item;
      if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
        setImageUploadError(`Unsupported format "${file.name}". Please use JPG, JPEG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageUploadError(`"${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      const isDuplicate = challanImages.some((existing) => existing.fileName === file.name);
      if (isDuplicate) {
        continue;
      }
      try {
        const storedUrl = await processAndUploadImage(file);
        if (!storedUrl || storedUrl.startsWith('blob:')) {
          throw new Error('Invalid storage URL returned.');
        }
        uploaded.push({
          id: `chl-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: storedUrl,
          fileName: file.name,
          source,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        failed.push(item);
      }
    }

    if (uploaded.length > 0) {
      setChallanImages((prev) => [...prev, ...uploaded]);
    }
    if (failed.length > 0) {
      setFailedImageFiles(failed);
      setImageUploadError(`Failed to upload ${failed.length} image(s). Click Retry to try again.`);
    } else {
      setFailedImageFiles([]);
    }
    setUploadingImages(false);
  };

  const handleChallanFilesSelected = async (fileList: FileList | null, source: 'CAMERA' | 'GALLERY') => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).map((file) => ({ file, source }));
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    await uploadChallanFiles(files);
  };

  const retryFailedUploads = async () => {
    if (failedImageFiles.length === 0) return;
    await uploadChallanFiles(failedImageFiles);
  };

  const handleSubmit = async (addAnother: boolean) => {
    if (submitting) return;
    setError(null);
    setSuccessBanner(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId,
        siteId: siteId || undefined,
        siteName: siteNameFallback.trim() || undefined,
        projectId: projectId || undefined,
        size: size.trim(),
        outputEntries: outputRows.map(r => ({
          id: r.id,
          date: r.date,
          materialId: r.materialId,
          quantity: Math.trunc(Number(r.quantity)),
          remarks: r.remarks?.trim() || undefined,
        })),
        inputEntries: inputRows.map(r => ({
          id: r.id,
          date: r.date,
          materialId: r.materialId,
          quantity: Math.trunc(Number(r.quantity)),
          remarks: r.remarks?.trim() || undefined,
        })),
        lostEntries: lostRows.map(r => ({
          id: r.id,
          date: r.date,
          materialId: r.materialId,
          quantity: Math.trunc(Number(r.quantity)),
          reason: r.reason.trim() || undefined,
        })),
        lossApproved: lostRows.length > 0 ? lossApproved : undefined,
        notes: notes.trim() || undefined,
        images: challanImages,
        clientRequestId: isEdit ? undefined : clientRequestId,
        actorId: currentUser?.id || 'usr-admin-01',
        actorName: currentUser?.fullName || 'Admin',
      };

      const url = isEdit && editingChallan ? `/api/challans/${editingChallan.id}` : '/api/challans';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save challan');
      }

      const saved: Challan = json.data;

      if (addAnother && !isEdit) {
        // Refresh inventory availability after stock deduction/return
        const invRes = await fetch('/api/inventory').then(r => r.json()).catch(() => null);
        if (invRes?.success) {
          setMaterials(invRes.data?.materials || []);
        }
        resetForNextChallan();
        setSuccessBanner(`✓ Challan ${saved.challanNumber} saved successfully. Ready for next entry.`);
      } else {
        router.push(isEdit ? `/challans/${saved.id}` : '/challans');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the challan.');
    } finally {
      setSubmitting(false);
    }
  };

  const canRecordLoss = can('CHALLAN_RECORD_LOSS');

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Link href="/challans" className="hover:text-[#24160c] flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Challan Directory</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#24160c]">
              {isEdit ? `Edit ${editingChallan?.challanNumber}` : 'New Challan'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#24160c] tracking-tight">
            {isEdit ? `Edit Challan ${editingChallan?.challanNumber}` : 'Create Material Challan'}
          </h1>
          <p className="text-xs text-stone-500">
            Issue scaffolding material from warehouse to site, record returns, and track live material reconciliation.
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 font-medium">Calculated Status:</span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border ${
              reconciliationPreview.autoStatus === 'CLOSED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                reconciliationPreview.autoStatus === 'CLOSED' ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            />
            <span>{reconciliationPreview.autoStatus === 'CLOSED' ? 'Closed' : 'Unclosed'}</span>
          </span>
        </div>
      </div>

      {/* Banners */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <Link href="/challans" className="font-bold underline hover:text-emerald-950">
            View Directory →
          </Link>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-center gap-2 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* SECTION A: CUSTOMER & SITE DETAILS */}
      <section className="bg-white rounded-lg border border-[#e5dac8] p-5 space-y-4 shadow-2xs text-xs">
        <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0e8db]">
          <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-sm text-[#24160c]">A. Customer & Site Details</h2>
        </div>

        {loadingRefs ? (
          <div className="py-4 text-stone-400">Loading customers, sites, and inventory catalog...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Dropdown */}
            <div>
              <label className="block font-semibold text-[#4d301c] mb-1">
                Customer Name <span className="text-rose-600">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:outline-none"
              >
                <option value="">-- Select Customer --</option>
                {eligibleCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.customerCode})
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <p className="mt-1 text-[11px] text-stone-500">
                  Phone: <span className="font-mono">{selectedCustomer.phone}</span>
                  {selectedCustomer.referenceName ? ` · Ref: ${selectedCustomer.referenceName}` : ''}
                </p>
              )}
            </div>

            {/* Site Dropdown */}
            <div>
              <label className="block font-semibold text-[#4d301c] mb-1">
                Site <span className="text-rose-600">*</span>
              </label>
              {customerSites.length > 0 ? (
                <select
                  value={siteId}
                  onChange={(e) => handleSiteChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:outline-none"
                >
                  <option value="">-- Select Customer Site --</option>
                  {customerSites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.siteName} ({s.siteCode})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={siteNameFallback}
                  onChange={(e) => setSiteNameFallback(e.target.value)}
                  placeholder={customerId ? 'Enter site name for this customer' : 'Select a customer first'}
                  disabled={!customerId}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none disabled:opacity-60"
                />
              )}
              {(siteId || selectedCustomer?.billingAddress) && (
                <p className="mt-1 text-[11px] text-stone-500 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-[#8f6541] shrink-0" />
                  <span className="truncate">
                    {sites.find(s => s.id === siteId)?.siteAddress || selectedCustomer?.billingAddress}
                  </span>
                </p>
              )}
            </div>

            {/* Size */}
            <div>
              <label className="block font-semibold text-[#4d301c] mb-1 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-[#8f6541]" />
                <span>Size / Dimensions <span className="text-rose-600">*</span></span>
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 10 (W) × 15 (D) × 20 (H) FEET"
                className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono focus:bg-white focus:border-[#8f6541] focus:outline-none"
              />
              {availableDimensionOptions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {availableDimensionOptions.map(opt => (
                    <button
                      key={opt.projectId}
                      type="button"
                      onClick={() => {
                        setSize(opt.sizeText);
                        setProjectId(opt.projectId);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#f7f2eb] hover:bg-[#ebdcc9] text-[#714f36] border border-[#d6c7b2] transition cursor-pointer"
                      title="Use existing project dimensions"
                    >
                      Use {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* SECTION B: OUTPUT MATERIAL (MATERIAL ISSUED TO SITE) */}
      <section className="bg-white rounded-lg border border-[#e5dac8] p-5 space-y-4 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#f0e8db]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
              <PackageOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#24160c]">B. Output Material (Issued to Site)</h2>
              <p className="text-[11px] text-stone-500">Material dispatched from warehouse to customer site (reduces available warehouse stock)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#fbf7f0] border border-[#ebdcc9] rounded font-mono font-bold text-[#24160c]">
              Total Output: {reconciliationPreview.totalOutput.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-[#e8decb]">
              <tr>
                <th className="px-3 py-2 w-40">Date</th>
                <th className="px-3 py-2">Material (Warehouse Stock)</th>
                <th className="px-3 py-2 w-32">Quantity</th>
                <th className="px-3 py-2 w-44">Remarks</th>
                <th className="px-3 py-2 w-16 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8db]">
              {outputRows.map((row, idx) => {
                const mat = materials.find(m => m.id === row.materialId);
                const previouslyIssued = mat ? (originalIssuedByMat.get(mat.id) || 0) : 0;
                const availForThisChallan = mat
                  ? Math.max(0, mat.usableWarehouseQty - mat.reservedQty + previouslyIssued)
                  : 0;
                return (
                  <tr key={row.rowId} className="hover:bg-[#fcfbf9]">
                    <td className="px-3 py-2.5">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          setOutputRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r))
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded font-mono text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={row.materialId}
                        onChange={(e) =>
                          setOutputRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, materialId: e.target.value } : r))
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:outline-none"
                      >
                        <option value="">-- Select Material --</option>
                        {materials
                          .filter(
                            (m) =>
                              m.id === row.materialId ||
                              !outputRows.some((other, otherIdx) => otherIdx !== idx && other.materialId === m.id)
                          )
                          .map(m => {
                            const avail = Math.max(
                              0,
                              m.usableWarehouseQty - m.reservedQty + (originalIssuedByMat.get(m.id) || 0)
                            );
                            return (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.itemCode}) — Avail: {avail} {m.unitOfMeasurement}
                              </option>
                            );
                          })}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.quantity}
                        onChange={(e) =>
                          setOutputRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded font-mono font-bold text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
                      />
                      {mat && Number(row.quantity) > availForThisChallan && (
                        <span className="text-[10px] text-rose-700 font-semibold block mt-0.5">
                          Exceeds stock ({availForThisChallan})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.remarks || ''}
                        onChange={(e) =>
                          setOutputRows(prev =>
                            prev.map((r, i) => (i === idx ? { ...r, remarks: e.target.value } : r))
                          )
                        }
                        placeholder="Optional note"
                        className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={outputRows.length <= 1}
                        onClick={() => setOutputRows(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-700 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={addOutputRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] rounded-md font-bold transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Material</span>
          </button>
        </div>
      </section>

      {/* SECTION C: INPUT MATERIAL (MATERIAL RETURNED FROM SITE) */}
      <section className="bg-white rounded-lg border border-[#e5dac8] p-5 space-y-4 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#f0e8db]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-emerald-700">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#24160c]">C. Input Material (Returned from Site)</h2>
              <p className="text-[11px] text-stone-500">
                Material received back into warehouse from customer site (only previously issued materials allowed)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded font-mono font-bold text-emerald-900">
              Total Returned: {reconciliationPreview.totalReturned.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {inputRows.length === 0 ? (
          <div className="p-4 bg-[#fbf9f5] border border-dashed border-[#d6c7b2] rounded-md text-center text-stone-500">
            No return entries added yet. Click <strong>+ Add Material</strong> to record returns on any date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-[#e8decb]">
                <tr>
                  <th className="px-3 py-2 w-40">Return Date</th>
                  <th className="px-3 py-2">Issued Material</th>
                  <th className="px-3 py-2 w-32">Quantity</th>
                  <th className="px-3 py-2 w-44">Remarks</th>
                  <th className="px-3 py-2 w-16 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db]">
                {inputRows.map((row, idx) => {
                  const rec = reconciliationPreview.lines.find(l => l.materialId === row.materialId);
                  return (
                    <tr key={row.rowId} className="hover:bg-[#fcfbf9]">
                      <td className="px-3 py-2.5">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            setInputRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r))
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded font-mono text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={row.materialId}
                          onChange={(e) =>
                            setInputRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, materialId: e.target.value } : r))
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:outline-none"
                        >
                          <option value="">-- Select Issued Material --</option>
                          {issuedMaterialsList
                            .filter(
                              (m) =>
                                m.id === row.materialId ||
                                !inputRows.some((other, otherIdx) => otherIdx !== idx && other.materialId === m.id)
                            )
                            .map(m => {
                              const line = reconciliationPreview.lines.find(l => l.materialId === m.id);
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.name} (Issued: {line?.issued || 0} {m.unitOfMeasurement})
                                </option>
                              );
                            })}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantity}
                          onChange={(e) =>
                            setInputRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                            )
                          }
                          className={`w-full px-2.5 py-1.5 rounded font-mono font-bold focus:bg-white focus:outline-none ${
                            rec?.exceedsIssued
                              ? 'bg-rose-50 border-2 border-rose-500 text-rose-900'
                              : 'bg-[#fbf9f5] border border-[#d6c7b2] text-[#24160c]'
                          }`}
                        />
                        {rec && rec.returned > rec.issued && (
                          <span className="text-[10px] text-rose-700 font-semibold block mt-0.5">
                            Exceeds issued ({rec.issued})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={row.remarks || ''}
                          onChange={(e) =>
                            setInputRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, remarks: e.target.value } : r))
                            )
                          }
                          placeholder="Return note"
                          className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setInputRows(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            disabled={issuedMaterialsList.length === 0 || inputRows.length >= issuedMaterialsList.length}
            onClick={addInputRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#fbf7f0] hover:bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] rounded-md font-bold transition disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#8f6541]" />
            <span>Add Material</span>
          </button>
        </div>
      </section>

      {/* SECTION D: LIVE RECONCILIATION, LOST/MISSING & STATUS */}
      <section className="bg-white rounded-lg border border-[#e5dac8] p-5 space-y-4 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#f0e8db]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#24160c]">
                D. Live Material Reconciliation & Challan Status
              </h2>
              <p className="text-[11px] text-stone-500">
                Remaining at Site = Issued − Returned − Lost (Closed only when Remaining at Site = 0 for all materials)
              </p>
            </div>
          </div>

          {canRecordLoss && (
            <button
              type="button"
              disabled={issuedMaterialsList.length === 0}
              onClick={addLostRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-md font-bold transition disabled:opacity-40 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Record Missing / Lost Material</span>
            </button>
          )}
        </div>

        {/* Reconciliation Summary Table */}
        {reconciliationPreview.lines.length > 0 && (
          <div className="overflow-x-auto border border-[#e8decb] rounded-md">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-[#e8decb]">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Output (Issued)</th>
                  <th className="px-3 py-2 text-right">Input (Returned)</th>
                  <th className="px-3 py-2 text-right">Pending (Out − In)</th>
                  <th className="px-3 py-2 text-right">Lost / Missing</th>
                  <th className="px-3 py-2 text-right">Remaining at Site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db] font-mono">
                {reconciliationPreview.lines.map(l => (
                  <tr key={l.materialId} className="hover:bg-[#fcfbf9]">
                    <td className="px-3 py-2 font-sans font-semibold text-[#24160c]">
                      {l.materialName}{' '}
                      <span className="text-[10px] font-mono text-stone-400">({l.itemCode})</span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{l.issued}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-bold">{l.returned}</td>
                    <td className="px-3 py-2 text-right text-amber-800 font-bold">{l.pending}</td>
                    <td className="px-3 py-2 text-right text-rose-700 font-bold">{l.lost}</td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        l.remainingAtSite > 0 ? 'text-amber-800' : 'text-emerald-700'
                      }`}
                    >
                      {l.remainingAtSite}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#f7f2eb] font-mono font-bold text-[#24160c] border-t border-[#d6c7b2]">
                <tr>
                  <td className="px-3 py-2 font-sans">Totals</td>
                  <td className="px-3 py-2 text-right">{reconciliationPreview.totalOutput}</td>
                  <td className="px-3 py-2 text-right text-emerald-800">{reconciliationPreview.totalReturned}</td>
                  <td className="px-3 py-2 text-right text-amber-900">{reconciliationPreview.totalPending}</td>
                  <td className="px-3 py-2 text-right text-rose-800">{reconciliationPreview.totalLost}</td>
                  <td className="px-3 py-2 text-right">{reconciliationPreview.totalRemainingAtSite}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Lost / Missing Material Entries */}
        {lostRows.length > 0 && (
          <div className="p-4 bg-rose-50/60 border border-rose-300 rounded-md space-y-3">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>Missing / Lost Material Tracking (Never added back to warehouse stock)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] font-bold uppercase text-rose-900 border-b border-rose-200">
                  <tr>
                    <th className="px-2 py-1.5 w-36">Date</th>
                    <th className="px-2 py-1.5">Material</th>
                    <th className="px-2 py-1.5 w-28">Lost Qty</th>
                    <th className="px-2 py-1.5">Reason / Note</th>
                    <th className="px-2 py-1.5 w-12 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-200/70">
                  {lostRows.map((row, idx) => (
                    <tr key={row.rowId}>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            setLostRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r))
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-rose-300 rounded font-mono"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.materialId}
                          onChange={(e) =>
                            setLostRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, materialId: e.target.value } : r))
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-rose-300 rounded font-medium"
                        >
                          <option value="">-- Select Material --</option>
                          {issuedMaterialsList.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.itemCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantity}
                          onChange={(e) =>
                            setLostRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-rose-300 rounded font-mono font-bold text-rose-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.reason}
                          onChange={(e) =>
                            setLostRows(prev =>
                              prev.map((r, i) => (i === idx ? { ...r, reason: e.target.value } : r))
                            )
                          }
                          placeholder="e.g. Damaged/lost on site"
                          className="w-full px-2 py-1 bg-white border border-rose-300 rounded"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLostRows(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canRecordLoss && (
              <label className="flex items-center gap-2 text-xs font-semibold text-rose-950 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={lossApproved}
                  onChange={(e) => setLossApproved(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-400 accent-rose-700"
                />
                <span>
                  Admin Approval: Approve recorded lost/missing quantities (allows closing challan once remaining at site = 0)
                </span>
              </label>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block font-semibold text-[#4d301c] mb-1">Challan Notes / Remarks (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Driver name, vehicle number, gate pass reference, or reconciliation remarks..."
            className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
          />
        </div>
      </section>

      {/* SECTION E: CHALLAN IMAGES / MATERIAL EVIDENCE */}
      <section className="bg-white rounded-lg border border-[#e5dac8] p-5 space-y-4 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#f0e8db]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#24160c]">E. Challan Images / Material Evidence</h2>
              <p className="text-[11px] text-stone-500">
                Capture or upload photographs of a Challan (JPG, JPEG, PNG, WEBP).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => handleChallanFilesSelected(e.target.files, 'CAMERA')}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleChallanFilesSelected(e.target.files, 'GALLERY')}
            />

            <button
              type="button"
              disabled={uploadingImages || submitting}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] rounded-md font-bold transition disabled:opacity-50 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Photo</span>
            </button>

            <button
              type="button"
              disabled={uploadingImages || submitting}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fbf7f0] hover:bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] rounded-md font-bold transition disabled:opacity-50 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#8f6541]" />
              <span>Choose from Gallery</span>
            </button>
          </div>
        </div>

        {imageUploadError && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-md text-rose-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{imageUploadError}</span>
            </div>
            {failedImageFiles.length > 0 && (
              <button
                type="button"
                onClick={retryFailedUploads}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-300 rounded text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {uploadingImages && (
          <div className="p-3 bg-[#fbf7f0] border border-[#ebdcc9] rounded-md text-[#714f36] flex items-center gap-2 font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-[#8f6541]" />
            <span>Uploading challan photographs...</span>
          </div>
        )}

        {challanImages.length === 0 ? (
          <div className="p-6 bg-[#fbf9f5] border border-dashed border-[#d6c7b2] rounded-lg text-center text-stone-500 space-y-1">
            <ImageIcon className="w-6 h-6 text-[#c79e7c] mx-auto" />
            <p className="font-semibold text-[#4d301c]">No Challan Images Attached</p>
            <p className="text-[11px]">
              Use <strong>Take Photo</strong> or <strong>Choose from Gallery</strong> to attach material evidence.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {challanImages.map((img) => (
              <div
                key={img.id}
                className="group relative bg-[#fbf9f5] border border-[#d6c7b2] rounded-lg overflow-hidden shadow-2xs"
              >
                <div className="aspect-4/3 bg-stone-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.fileName || 'Challan evidence'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="px-2.5 py-1.5 flex items-center justify-between gap-1.5 border-t border-[#ebdcc9] bg-white">
                  <span className="text-[10px] font-mono text-stone-600 truncate" title={img.fileName}>
                    {img.fileName || 'Challan Photo'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {img.source === 'CAMERA' && (
                      <button
                        type="button"
                        onClick={() => {
                          setChallanImages((prev) => prev.filter((item) => item.id !== img.id));
                          cameraInputRef.current?.click();
                        }}
                        title="Retake photo"
                        className="p-1 text-[#714f36] hover:bg-[#fbf7f0] rounded cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setChallanImages((prev) => prev.filter((item) => item.id !== img.id))}
                      title="Delete image"
                      className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FORM ACTIONS FOOTER */}
      <div className="bg-white rounded-lg border border-[#e5dac8] px-5 py-4 flex flex-wrap items-center justify-end gap-2.5 shadow-2xs">
        <Link
          href={isEdit && editingChallan ? `/challans/${editingChallan.id}` : '/challans'}
          className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition"
        >
          Cancel
        </Link>

        {!isEdit && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#24160c] bg-[#f7f2eb] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded-md transition disabled:opacity-50 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#8f6541]" />
            <span>{submitting ? 'Saving...' : 'Save & Add Another'}</span>
          </button>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] border border-[#19100a] rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{submitting ? 'Saving Challan...' : isEdit ? 'Save Challan Changes' : 'Save Challan'}</span>
        </button>
      </div>
    </div>
  );
}

