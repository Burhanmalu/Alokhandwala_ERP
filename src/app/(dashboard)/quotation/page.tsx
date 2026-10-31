'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Save, 
  Send, 
  XCircle, 
  Check, 
  RotateCcw, 
  Layers, 
  Boxes, 
  Calculator, 
  ReceiptIndianRupee, 
  ArrowRight, 
  Calendar, 
  User, 
  MapPin, 
  Phone, 
  Sparkles, 
  Plus, 
  Trash2, 
  Eye, 
  ShieldAlert, 
  CheckSquare, 
  Info,
  Clock,
  ExternalLink
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ImageUploaderWithLightbox } from '@/components/ui/ImageUploaderWithLightbox';
import { useAuth } from '@/lib/auth/auth-context';
import { Project, Customer, Material, Quotation, QuotationMaterialItem, QuotationStatus } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { OFFICIAL_TERMS_AND_CONDITIONS } from '@/lib/constants/terms-and-conditions';
import { generateQuotationPdf } from '@/lib/pdf/project-pdf';

export default function QuotationPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs font-semibold text-[#7d6553]">Loading Quotation Engine...</p>
      </div>
    }>
      <QuotationContent />
    </Suspense>
  );
}

function QuotationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId') || '';

  const { currentUser } = useAuth();

  // Data Loading State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Entities Master State
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);

  // Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(preselectedProjectId);
  const [existingQuotation, setExistingQuotation] = useState<Quotation | null>(null);

  // Form Fields - Section A: Details
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [quotationStatus, setQuotationStatus] = useState<QuotationStatus>('DRAFT');

  // Form Fields - Section B: Materials Table
  const [materialItems, setMaterialItems] = useState<QuotationMaterialItem[]>([]);

  // Form Fields - Section C: Pricing & Calculations
  const [ratePerSqFt, setRatePerSqFt] = useState<number>(22);
  const [totalAreaSqFt, setTotalAreaSqFt] = useState<number>(500);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [extraJaliQuantity, setExtraJaliQuantity] = useState<number>(0);
  const [extraJaliRate, setExtraJaliRate] = useState<number>(200);
  const [transportCharges, setTransportCharges] = useState<number>(4500);
  const [shiftingCharges, setShiftingCharges] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [notes, setNotes] = useState('');

  // Selected Project Object
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Selected Customer Object
  const selectedCustomer = useMemo(() => {
    if (selectedProject) {
      return customers.find(c => c.id === selectedProject.customerId) || null;
    }
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedProject, selectedCustomerId]);

  // Filter projects by customer if customer is selected
  const availableProjects = useMemo(() => {
    let list = projects;
    if (selectedCustomerId) {
      list = list.filter(p => p.customerId === selectedCustomerId);
    }
    return list;
  }, [projects, selectedCustomerId]);

  // Fetch initial master data
  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/quotations').then(r => r.json()),
    ]).then(([projRes, custRes, invRes, qtnRes]) => {
      if (projRes.success) setProjects(projRes.data);
      if (custRes.success) setCustomers(custRes.data);
      if (invRes.success) setMaterialsCatalog(invRes.data.materials || []);

      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      }
    }).catch(err => {
      setErrorMessage(err.message || 'Failed to load initial data');
    }).finally(() => {
      setLoading(false);
    });
  }, [preselectedProjectId]);

  // When selectedProjectId changes, load its quotation or auto-populate from Site Form
  useEffect(() => {
    if (!selectedProjectId) {
      setExistingQuotation(null);
      return;
    }

    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;

    if (proj.customerId && !selectedCustomerId) {
      setSelectedCustomerId(proj.customerId);
    }

    // Check if quotation exists for this project
    fetch(`/api/quotations?projectId=${selectedProjectId}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data && json.data.length > 0) {
          const q: Quotation = json.data[0];
          setExistingQuotation(q);
          setQuotationNumber(q.quotationNumber);
          setQuotationDate(q.quotationDate || new Date().toISOString().slice(0, 10));
          setQuotationStatus(q.status);
          setMaterialItems(q.materials || []);
          setRatePerSqFt(q.ratePerSqFt || 22);
          setTotalAreaSqFt(q.totalAreaSqFt || 500);
          setDurationMonths(q.durationMonths || 1);
          setExtraJaliQuantity(q.extraJaliQuantity || 0);
          setExtraJaliRate(q.extraJaliRate || 200);
          setTransportCharges(q.transportCharges || 4500);
          setShiftingCharges(q.shiftingCharges || 0);
          setOtherCharges(q.otherCharges || 0);
          setGstPercentage(q.gstPercentage !== undefined ? q.gstPercentage : 18);
          setNotes(q.notes || '');
        } else {
          // Initialize fresh quotation from Site Form data
          setExistingQuotation(null);
          setQuotationNumber(`QTN-${proj.projectCode.replace(/^AW-SCF-/, '') || Date.now().toString().slice(-6)}`);
          setQuotationDate(new Date().toISOString().slice(0, 10));
          setQuotationStatus('DRAFT');

          // Compute area
          let area = 500;
          if (proj.measurements?.length && proj.measurements?.height) {
            let l = proj.measurements.length;
            let h = proj.measurements.height;
            if (proj.measurements.unit === 'METERS') {
              l = Math.round(l * 3.28084);
              h = Math.round(h * 3.28084);
            }
            area = l * h;
          }
          setTotalAreaSqFt(area);

          // Auto-suggest scaffolding material requirements
          suggestMaterials(proj);
        }
      });
  }, [selectedProjectId, projects]);

  // Suggest scaffolding materials using calculator
  const suggestMaterials = (proj: Project) => {
    const meas = proj.measurements;
    let length = meas?.length || 20;
    let width = meas?.width || 5;
    let height = meas?.height || 20;
    const unit = meas?.unit || 'FEET';

    if (unit === 'METERS') {
      length = Math.round(length * 3.28084);
      width = Math.round(width * 3.28084);
      height = Math.round(height * 3.28084);
    }

    // Default standard scaffolding items based on dimensions
    const baysLength = Math.max(1, Math.ceil(length / 8));
    const liftsHeight = Math.max(1, Math.ceil(height / 6.5));
    const standardsCount = (baysLength + 1) * 2;
    const verticalsCount = standardsCount * liftsHeight;
    const ledgersLongCount = baysLength * 2 * (liftsHeight + 1);
    const transomsCount = (baysLength + 1) * 2 * (liftsHeight + 1);
    const jaliCount = baysLength * 2;

    const items: QuotationMaterialItem[] = [
      {
        itemCode: 'V-10FT-3M',
        materialName: 'VERTICAL 10FT/3MTR (Standard Pipe)',
        unit: 'NOS',
        quantity: verticalsCount,
        monthlyRentalRate: 45,
        totalMonthlyRent: verticalsCount * 45,
      },
      {
        itemCode: 'L-8FT-2.5M',
        materialName: 'LEDGER 8FT/2.5MTR (Horizontal Pipe)',
        unit: 'NOS',
        quantity: ledgersLongCount,
        monthlyRentalRate: 35,
        totalMonthlyRent: ledgersLongCount * 35,
      },
      {
        itemCode: 'L-4FT-1.25M',
        materialName: 'LEDGER 4FT/1.25MTR (Cross Transom Pipe)',
        unit: 'NOS',
        quantity: transomsCount,
        monthlyRentalRate: 25,
        totalMonthlyRent: transomsCount * 25,
      },
      {
        itemCode: 'JACK-BASE',
        materialName: 'BASE JACK / ADJUSTABLE JACK',
        unit: 'NOS',
        quantity: standardsCount,
        monthlyRentalRate: 20,
        totalMonthlyRent: standardsCount * 20,
      },
      {
        itemCode: 'JALI-8FT-MS',
        materialName: 'WALKWAY JALI 8FT MS (Steel Deck Platform)',
        unit: 'NOS',
        quantity: jaliCount,
        monthlyRentalRate: 65,
        totalMonthlyRent: jaliCount * 65,
      },
    ];

    setMaterialItems(items);
  };

  // Pricing calculations
  const calculations = useMemo(() => {
    const area = Math.max(0, totalAreaSqFt);
    const rate = Math.max(0, ratePerSqFt);
    const months = Math.max(1, durationMonths);
    const monthlyRent = Math.round(area * rate * months * 100) / 100;

    const extraJali = Math.max(0, extraJaliQuantity) * extraJaliRate;
    const transport = Math.max(0, transportCharges);
    const shifting = Math.max(0, shiftingCharges);
    const other = Math.max(0, otherCharges);

    const subtotal = Math.round((monthlyRent + extraJali + transport + shifting + other) * 100) / 100;
    const gstAmount = Math.round((subtotal * (gstPercentage / 100)) * 100) / 100;
    const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;
    const advance75 = Math.round((grandTotal * 0.75) * 100) / 100;
    const balance25 = Math.round((grandTotal - advance75) * 100) / 100;

    return {
      monthlyRent,
      extraJali,
      transport,
      shifting,
      other,
      subtotal,
      gstAmount,
      grandTotal,
      advance75,
      balance25,
    };
  }, [totalAreaSqFt, ratePerSqFt, durationMonths, extraJaliQuantity, extraJaliRate, transportCharges, shiftingCharges, otherCharges, gstPercentage]);

  // Material item manipulation
  const handleQuantityChange = (index: number, newQty: number) => {
    setMaterialItems(prev => {
      const updated = [...prev];
      const qty = Math.max(0, newQty);
      const rate = updated[index].monthlyRentalRate || 0;
      updated[index] = {
        ...updated[index],
        quantity: qty,
        totalMonthlyRent: Math.round(qty * rate * 100) / 100,
      };
      return updated;
    });
  };

  const handleRateChange = (index: number, newRate: number) => {
    setMaterialItems(prev => {
      const updated = [...prev];
      const rate = Math.max(0, newRate);
      const qty = updated[index].quantity || 0;
      updated[index] = {
        ...updated[index],
        monthlyRentalRate: rate,
        totalMonthlyRent: Math.round(qty * rate * 100) / 100,
      };
      return updated;
    });
  };

  const handleAddMaterialRow = () => {
    const newItem: QuotationMaterialItem = {
      itemCode: 'CUSTOM-ITEM',
      materialName: 'Additional Scaffold Component',
      unit: 'NOS',
      quantity: 10,
      monthlyRentalRate: 30,
      totalMonthlyRent: 300,
    };
    setMaterialItems([...materialItems, newItem]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    setMaterialItems(materialItems.filter((_, idx) => idx !== index));
  };

  // Save Quotation Handler
  const handleSaveQuotation = async (targetStatus: QuotationStatus = quotationStatus) => {
    if (!selectedProjectId) {
      setErrorMessage('Please select a site project first.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingQuotation?.id,
          projectId: selectedProjectId,
          status: targetStatus,
          quotationDate,
          ratePerSqFt,
          totalAreaSqFt,
          durationMonths,
          rentalDurationDays: durationMonths * 28,
          extraJaliQuantity,
          extraJaliRate,
          transportCharges,
          shiftingCharges,
          otherCharges,
          gstPercentage,
          materials: materialItems,
          notes,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save quotation');
      }

      setExistingQuotation(json.data.quotation);
      setQuotationStatus(json.data.quotation.status);
      setSuccessMessage(`Quotation ${json.data.quotation.quotationNumber} saved as ${targetStatus}.`);

      // Update project in local state
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? json.data.project : p));
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the quotation.');
    } finally {
      setSaving(false);
    }
  };

  // Status Change Handler (Mark as Sent, Accepted, Rejected)
  const handleUpdateStatus = async (status: QuotationStatus) => {
    if (!existingQuotation?.id) {
      await handleSaveQuotation(status);
      return;
    }

    let reason: string | undefined = undefined;
    if (status === 'REJECTED') {
      const promptRes = window.prompt('Please enter customer rejection reason (optional):');
      if (promptRes === null) return;
      reason = promptRes;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/quotations/${existingQuotation.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reason,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update quotation status');
      }

      setExistingQuotation(json.data.quotation);
      setQuotationStatus(json.data.quotation.status);
      setSuccessMessage(`Quotation marked as ${status} successfully.`);

      setProjects(prev => prev.map(p => p.id === selectedProjectId ? json.data.project : p));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // PDF Generation Handler
  const handleDownloadPdf = async () => {
    if (!selectedProject) return;
    setGeneratingPdf(true);
    try {
      await generateQuotationPdf(
        {
          ...selectedProject,
          customer: selectedCustomer || undefined,
          site: selectedProject.siteName ? {
            id: selectedProject.siteId,
            siteCode: 'SITE-0001',
            customerId: selectedProject.customerId,
            customerName: selectedProject.customerName,
            siteName: selectedProject.siteName,
            siteAddress: selectedProject.siteAddress,
            city: 'Mumbai',
            state: 'Maharashtra',
            status: 'ACTIVE',
            createdAt: selectedProject.createdAt,
          } : undefined,
        },
        existingQuotation || {
          id: 'qtn-temp',
          quotationNumber,
          projectId: selectedProject.id,
          projectCode: selectedProject.projectCode,
          customerId: selectedProject.customerId,
          customerName: selectedProject.customerName,
          siteId: selectedProject.siteId,
          siteName: selectedProject.siteName,
          siteAddress: selectedProject.siteAddress,
          quotationDate,
          status: quotationStatus,
          materials: materialItems,
          ratePerSqFt,
          totalAreaSqFt,
          rentalDurationDays: durationMonths * 28,
          durationMonths,
          monthlyRentalAmount: calculations.monthlyRent,
          walkwayJaliIncludedQuantity: 0,
          extraJaliQuantity,
          extraJaliRate,
          extraJaliCharges: calculations.extraJali,
          transportCharges: calculations.transport,
          shiftingCharges: calculations.shifting,
          otherCharges: calculations.other,
          subtotal: calculations.subtotal,
          gstPercentage,
          gstAmount: calculations.gstAmount,
          grandTotal: calculations.grandTotal,
          advancePercentage: 75,
          advanceAmount: calculations.advance75,
          remainingAmount: calculations.balance25,
          notes,
          createdBy: currentUser?.id || 'usr-admin-01',
          createdByName: currentUser?.fullName || 'Burhan Malu',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate PDF document');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs font-semibold text-[#7d6553]">Loading Commercial Quotation System...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e5dac8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#9c826e]">
            <span>Commercial Workflow</span>
          </div>
          <h1 className="text-xl font-bold text-[#24160c] mt-0.5 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#8c5e39]" />
            <span>Commercial Quotation</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!selectedProjectId || generatingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4d301c] bg-white border border-[#d8c8b4] rounded-md hover:bg-[#faf6ee] transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>{generatingPdf ? 'Generating PDF...' : 'Quotation PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveQuotation(quotationStatus)}
            disabled={!selectedProjectId || saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-md shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>{saving ? 'Saving...' : 'Save Quotation'}</span>
          </button>
        </div>
      </div>

      {/* Workflow Sequence Stepper Indicator */}
      <div className="bg-[#fbf9f5] border border-[#ebdcc9] rounded-lg p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#7d6553]">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 border border-emerald-300">
              ✓
            </div>
            <div>
              <div className="font-bold text-[#24160c] text-[11px]">1. Site Form</div>
              <div className="text-[10px] text-[#9c826e]">Inspection & Photos</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#24160c] bg-white p-1.5 rounded-md border border-[#c79e7c] shadow-2xs">
            <div className="w-5 h-5 rounded-full bg-[#24160c] text-white font-bold flex items-center justify-center text-[10px] shrink-0">
              2
            </div>
            <div>
              <div className="font-bold text-[#24160c] text-[11px]">2. Quotation Form</div>
              <div className="text-[10px] text-[#8c5e39] font-medium">Pricing & Approval</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#7d6553]">
            <div className="w-5 h-5 rounded-full bg-[#faf6ee] text-[#7d6553] font-bold flex items-center justify-center text-[10px] shrink-0 border border-[#ebdcc9]">
              3
            </div>
            <div>
              <div className="font-bold text-[#7d6553] text-[11px]">3. Project Confirmation</div>
              <div className="text-[10px] text-[#9c826e]">Stock Reservation</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#7d6553]">
            <div className="w-5 h-5 rounded-full bg-[#faf6ee] text-[#7d6553] font-bold flex items-center justify-center text-[10px] shrink-0 border border-[#ebdcc9]">
              4
            </div>
            <div>
              <div className="font-bold text-[#7d6553] text-[11px]">4. Field Installation</div>
              <div className="text-[10px] text-[#9c826e]">Handover & Commission</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* If Quotation is Approved / Accepted Banner */}
      {quotationStatus === 'ACCEPTED' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950 text-sm">Quotation Accepted by Client!</h4>
              <p className="text-emerald-800">
                This project has completed Step 2 and is now officially eligible for Project Confirmation and Material Reservation.
              </p>
            </div>
          </div>

          <Link
            href={`/projects/${selectedProjectId}/confirm`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-semibold text-xs shadow-sm transition whitespace-nowrap self-start sm:self-auto"
          >
            <span>Proceed to Project Confirmation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* If Quotation is Rejected Banner */}
      {quotationStatus === 'REJECTED' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold">Quotation Status: Rejected.</span> Under company policy, rejected quotations cannot proceed to confirmation or installation until revised and accepted.
          </div>
        </div>
      )}

      {/* SECTION A: CUSTOMER & PROJECT DETAILS */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs relative">
        <div className="bg-[#fbf9f5] px-4 py-2.5 border-b border-[#ebdcc9] flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#24160c] flex items-center gap-2 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Section A: Customer & Site Inspection Details</span>
          </h2>
          <span className="text-[10px] font-mono text-[#8c5e39] font-bold bg-[#faf6ee] px-2 py-0.5 rounded border border-[#ebdcc9]">
            {quotationNumber || 'AUTOGEN-NUMBER'}
          </span>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Dual Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Customer Select */}
            <div>
              <label className="block text-[#4d301c] font-semibold mb-1 flex items-center justify-between">
                <span>Select Existing Customer (Optional Filter)</span>
                {selectedCustomerId && (
                  <span className="text-[10px] text-[#8c5e39] font-mono font-medium">Customer Selected</span>
                )}
              </label>
              <SearchableSelect
                value={selectedCustomerId}
                onChange={(val) => {
                  setSelectedCustomerId(val);
                  // If current project does not belong to this customer, clear project
                  if (selectedProject && selectedProject.customerId !== val) {
                    setSelectedProjectId('');
                  }
                }}
                options={customers}
                getOptionValue={(c) => c.id}
                getOptionLabel={(c) => `${c.companyName} (${c.customerCode})`}
                placeholder="-- Search by customer name, code, contact... --"
                searchPlaceholder="Search customer by name, code, contact person, phone..."
                filterOption={(c, q) =>
                  Boolean(
                    c.companyName?.toLowerCase().includes(q) ||
                    c.customerCode?.toLowerCase().includes(q) ||
                    c.contactPerson?.toLowerCase().includes(q) ||
                    c.phone?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.city?.toLowerCase().includes(q)
                  )
                }
                renderSelected={(c) => (
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                    <span className="font-bold text-[#24160c] truncate">{c.companyName}</span>
                    <span className="text-[10px] font-mono font-semibold text-[#8c5e39] bg-[#faf6ee] px-1.5 py-0.5 rounded border border-[#ebdcc9] shrink-0">
                      {c.customerCode}
                    </span>
                    {c.phone && <span className="text-[10px] text-[#8c7360] font-mono hidden sm:inline">• {c.phone}</span>}
                  </div>
                )}
                renderOption={(c, isSelected) => (
                  <div className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#24160c]">{c.companyName}</span>
                      <span className="text-[10px] font-mono text-[#8c5e39] font-semibold bg-[#faf6ee] px-1.5 py-0.5 rounded border border-[#ebdcc9]">
                        {c.customerCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#7d6553] mt-0.5 flex-wrap">
                      <span>{c.contactPerson}</span>
                      {c.phone && <span>• {c.phone}</span>}
                      {c.city && <span>• {c.city}</span>}
                    </div>
                  </div>
                )}
                noResultsMessage="No matching customer found in database."
              />
            </div>

            {/* 2. Site Project Select */}
            <div>
              <label className="block text-[#4d301c] font-semibold mb-1 flex items-center justify-between">
                <span>Select Site Form / Inspected Project <span className="text-rose-600">*</span></span>
                <span className="text-[10px] text-[#7d6553] font-mono">
                  {availableProjects.length} project{availableProjects.length === 1 ? '' : 's'} available
                </span>
              </label>
              <SearchableSelect
                value={selectedProjectId}
                onChange={(val) => setSelectedProjectId(val)}
                options={availableProjects}
                getOptionValue={(p) => p.id}
                getOptionLabel={(p) => `${p.projectCode} • ${p.customerName} - ${p.siteName} (${p.status})`}
                placeholder="-- Select inspected site project to quote --"
                searchPlaceholder="Search by Project ID (e.g. AW-SCF-000001), site, customer..."
                filterOption={(p, q) =>
                  Boolean(
                    p.projectCode?.toLowerCase().includes(q) ||
                    p.customerName?.toLowerCase().includes(q) ||
                    p.siteName?.toLowerCase().includes(q) ||
                    p.siteAddress?.toLowerCase().includes(q) ||
                    p.supervisorName?.toLowerCase().includes(q) ||
                    p.quotationNumber?.toLowerCase().includes(q) ||
                    p.status?.toLowerCase().includes(q)
                  )
                }
                renderSelected={(p) => (
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                    <span className="font-mono font-bold text-[#24160c] shrink-0">{p.projectCode}</span>
                    <span className="text-stone-300">•</span>
                    <span className="font-semibold text-[#24160c] truncate">{p.customerName}</span>
                    <span className="text-stone-300">|</span>
                    <span className="text-xs text-[#7d6553] truncate">{p.siteName}</span>
                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#faf6ee] text-[#8c5e39] border border-[#ebdcc9] shrink-0">
                      {p.status}
                    </span>
                  </div>
                )}
                renderOption={(p, isSelected) => (
                  <div className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#59371d]">{p.projectCode}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#faf6ee] text-[#7d6553] border border-[#ebdcc9]">
                        {p.status}
                      </span>
                    </div>
                    <div className="font-semibold text-[#24160c] mt-0.5 truncate">{p.customerName} - {p.siteName}</div>
                    <div className="text-[10px] text-[#7d6553] truncate">{p.siteAddress}</div>
                  </div>
                )}
                noResultsMessage="No eligible projects found. Please register a Site Form first."
              />
            </div>
          </div>

          {/* Project Details Auto-populated Card */}
          {selectedProject && (
            <div className="p-3 bg-[#faf6ee]/60 border border-[#ebdcc9] rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Client Name</span>
                <span className="font-bold text-[#24160c]">{selectedProject.customerName}</span>
                <div className="text-[10px] text-[#7d6553]">{selectedCustomer?.phone || 'No phone recorded'}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Site Address</span>
                <span className="font-medium text-[#24160c] truncate block">{selectedProject.siteName}</span>
                <div className="text-[10px] text-[#7d6553] truncate">{selectedProject.siteAddress}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Site Dimensions</span>
                <span className="font-bold text-[#24160c]">
                  {selectedProject.measurements 
                    ? `${selectedProject.measurements.length} × ${selectedProject.measurements.width} × ${selectedProject.measurements.height} ${selectedProject.measurements.unit}`
                    : '20 × 5 × 20 FT'}
                </span>
                <div className="text-[10px] text-[#8c5e39] font-medium font-mono">
                  Area: {totalAreaSqFt} Sq. Ft.
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Current Workflow Status</span>
                <span className="inline-block mt-0.5 font-bold font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-[#d8c8b4] text-[#4d301c]">
                  {selectedProject.status}
                </span>
              </div>
            </div>
          )}

          {/* Quotation Meta Fields Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">Quotation Number</label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="w-full p-2.5 bg-[#faf6ee]/50 border border-[#d8c8b4] rounded-md font-mono text-xs font-bold text-[#24160c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">Quotation Date</label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#d8c8b4] rounded-md text-xs font-medium text-[#24160c] focus:outline-none"
              />
            </div>
          </div>

          {/* Site Inspection Photos Preview */}
          {selectedProject?.photos && selectedProject.photos.length > 0 && (
            <div className="pt-2 border-t border-[#f2eadf]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#7d6553] uppercase tracking-wider">
                  Site Inspection Images ({selectedProject.photos.length})
                </span>
                <span className="text-[10px] text-[#9c826e]">Click image to inspect full lightbox</span>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {selectedProject.photos.map((p, idx) => (
                  <div key={idx} className="w-20 h-16 rounded-md overflow-hidden border border-[#d8c8b4] shrink-0 bg-[#fbf9f5] relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.fileUrl} alt={`Site inspection ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION B: SCAFFOLDING MATERIAL REQUIREMENTS */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="bg-[#fbf9f5] px-4 py-2.5 border-b border-[#ebdcc9] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xs font-bold text-[#24160c] flex items-center gap-2 uppercase tracking-wider">
              <Boxes className="w-3.5 h-3.5 text-[#8c5e39]" />
              <span>Section B: Scaffolding Material Requirements</span>
            </h2>
            <p className="text-[10px] text-[#7d6553]">
              Required components suggested automatically based on site dimensions. Authorized users can edit quantities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedProject && (
              <button
                type="button"
                onClick={() => suggestMaterials(selectedProject)}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#8c5e39] bg-[#faf6ee] hover:bg-[#ebdcc9] border border-[#d8c8b4] rounded transition flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#c79e7c]" />
                <span>Auto-Calculate from Site</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#24160c] hover:bg-[#382315] rounded transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-[#c79e7c]" />
              <span>Add Component Row</span>
            </button>
          </div>
        </div>

        {/* Material Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase tracking-wider text-[10px] font-semibold border-b border-[#ebdcc9]">
              <tr>
                <th className="px-3 py-2 w-8 text-center">#</th>
                <th className="px-3 py-2">Item Code</th>
                <th className="px-3 py-2">Component Description</th>
                <th className="px-3 py-2 text-center">Unit</th>
                <th className="px-3 py-2 text-center w-28">Required Qty</th>
                <th className="px-3 py-2 text-right w-28">Monthly Rate (₹)</th>
                <th className="px-3 py-2 text-right w-28">Total Monthly (₹)</th>
                <th className="px-3 py-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eadf]">
              {materialItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[#9c826e] text-xs">
                    No material requirements specified. Click &ldquo;Auto-Calculate from Site&rdquo; or &ldquo;Add Component Row&rdquo;.
                  </td>
                </tr>
              ) : (
                materialItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#faf6ee]/50 transition-colors">
                    <td className="px-3 py-2 text-center text-stone-400 font-mono text-[10px]">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-[#59371d]">
                      <input
                        type="text"
                        value={item.itemCode}
                        onChange={(e) => {
                          const updated = [...materialItems];
                          updated[idx].itemCode = e.target.value;
                          setMaterialItems(updated);
                        }}
                        className="bg-transparent border-b border-transparent hover:border-[#ebdcc9] focus:border-[#8c5e39] focus:outline-none w-full font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.materialName}
                        onChange={(e) => {
                          const updated = [...materialItems];
                          updated[idx].materialName = e.target.value;
                          setMaterialItems(updated);
                        }}
                        className="bg-transparent border-b border-transparent hover:border-[#ebdcc9] focus:border-[#8c5e39] focus:outline-none w-full text-xs font-semibold text-[#24160c]"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-stone-600 font-mono text-[11px]">
                      {item.unit || 'NOS'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                        className="w-20 p-1 text-center font-mono font-bold bg-[#faf6ee] border border-[#d8c8b4] rounded text-xs focus:bg-white focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.monthlyRentalRate || 0}
                        onChange={(e) => handleRateChange(idx, Number(e.target.value))}
                        className="w-20 p-1 text-right font-mono bg-white border border-[#d8c8b4] rounded text-xs focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-[#24160c]">
                      {formatINR(item.totalMonthlyRent || 0)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterialRow(idx)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                        title="Delete component"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: PRICING & COST CALCULATION */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="bg-[#fbf9f5] px-4 py-2.5 border-b border-[#ebdcc9] flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#24160c] flex items-center gap-2 uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Section C: Commercial Pricing & Payment Terms</span>
          </h2>
          <span className="text-[10px] text-[#7d6553] font-medium font-sans">
            Strict 28 Calendar Days Billing Cycle • 75% Advance / 25% Balance
          </span>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Rate and Area Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#faf6ee]/50 p-3 rounded-lg border border-[#ebdcc9]">
            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Rental Rate / Sq. Ft. (₹) *
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={ratePerSqFt}
                onChange={(e) => setRatePerSqFt(Number(e.target.value))}
                className="w-full p-2 font-mono font-bold text-sm bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-[#24160c]"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">Standard monthly scaffolding rate</span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Applicable Total Area (Sq. Ft.) *
              </label>
              <input
                type="number"
                min="1"
                value={totalAreaSqFt}
                onChange={(e) => setTotalAreaSqFt(Number(e.target.value))}
                className="w-full p-2 font-mono font-bold text-sm bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-[#24160c]"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">Façade elevation / platform surface</span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Rental Duration (Months) *
              </label>
              <input
                type="number"
                min="1"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full p-2 font-mono font-bold text-sm bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-[#24160c]"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">
                {durationMonths * 28} Days Total Rental Period
              </span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Monthly Scaffolding Rental
              </label>
              <div className="w-full p-2 font-mono font-bold text-sm bg-[#faf6ee] border border-[#d8c8b4] rounded-md text-[#24160c]">
                {formatINR(calculations.monthlyRent)}
              </div>
              <span className="text-[10px] text-[#8c5e39] font-medium mt-0.5 block">Area × Rate × Months</span>
            </div>
          </div>

          {/* Ancillary Charges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Extra Walkway Jali Qty (₹200/pc)
              </label>
              <input
                type="number"
                min="0"
                value={extraJaliQuantity}
                onChange={(e) => setExtraJaliQuantity(Number(e.target.value))}
                className="w-full p-2 font-mono bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-xs"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">
                Charges: {formatINR(calculations.extraJali)}
              </span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Two-Way Transport Charges (₹)
              </label>
              <input
                type="number"
                min="0"
                value={transportCharges}
                onChange={(e) => setTransportCharges(Number(e.target.value))}
                className="w-full p-2 font-mono bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-xs"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">Includes delivery and return trip</span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Shifting Charges (₹)
              </label>
              <input
                type="number"
                min="0"
                value={shiftingCharges}
                onChange={(e) => setShiftingCharges(Number(e.target.value))}
                className="w-full p-2 font-mono bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-xs"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">On-site crane/movement tariff</span>
            </div>

            <div>
              <label className="block text-[#4d301c] font-semibold mb-1">
                Applicable GST Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="28"
                value={gstPercentage}
                onChange={(e) => setGstPercentage(Number(e.target.value))}
                className="w-full p-2 font-mono bg-white border border-[#d8c8b4] rounded-md focus:outline-none text-xs"
              />
              <span className="text-[10px] text-[#9c826e] mt-0.5 block">GST Amount: {formatINR(calculations.gstAmount)}</span>
            </div>
          </div>

          {/* Pricing Ledger & Payment Schedule Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Left: Financial Ledger Box */}
            <div className="bg-[#fbf9f5] p-3.5 rounded-lg border border-[#ebdcc9] space-y-2">
              <h3 className="font-bold text-[#59371d] text-xs uppercase tracking-wider flex items-center justify-between border-b border-[#ebdcc9] pb-1.5">
                <span>Quotation Financial Breakdown</span>
                <ReceiptIndianRupee className="w-3.5 h-3.5" />
              </h3>

              <div className="space-y-1.5 text-xs text-[#574830]">
                <div className="flex justify-between">
                  <span>Scaffolding Base Rental:</span>
                  <span className="font-mono font-medium">{formatINR(calculations.monthlyRent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extra Walkway Jali Tariff:</span>
                  <span className="font-mono font-medium">{formatINR(calculations.extraJali)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Two-Way Transport Tariff:</span>
                  <span className="font-mono font-medium">{formatINR(calculations.transport)}</span>
                </div>
                {calculations.shifting > 0 && (
                  <div className="flex justify-between">
                    <span>Shifting Charges:</span>
                    <span className="font-mono font-medium">{formatINR(calculations.shifting)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-[#ebdcc9]">
                  <span className="font-semibold text-[#24160c]">Subtotal (Excl. Taxes):</span>
                  <span className="font-mono font-bold text-[#24160c]">{formatINR(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Applicable GST ({gstPercentage}%):</span>
                  <span className="font-mono font-medium text-stone-700">{formatINR(calculations.gstAmount)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#ebdcc9] text-sm">
                  <span className="font-bold text-[#24160c]">Grand Total Quotation:</span>
                  <span className="font-mono font-bold text-[#8c5e39] text-base">{formatINR(calculations.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Right: Payment Schedule Policy Box */}
            <div className="bg-[#faf6ee] p-3.5 rounded-lg border border-[#ebdcc9] space-y-2.5">
              <h3 className="font-bold text-[#59371d] text-xs uppercase tracking-wider flex items-center justify-between border-b border-[#ebdcc9] pb-1.5">
                <span>Mandatory Payment Schedule</span>
                <Calendar className="w-3.5 h-3.5" />
              </h3>

              <div className="space-y-3 pt-1 text-xs">
                {/* 75% Advance */}
                <div className="bg-white p-2.5 rounded-md border border-[#ebdcc9] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#24160c] block">75% Advance Payment</span>
                    <span className="text-[10px] text-[#7d6553]">Payable prior to yard dispatch & transport</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[#8c5e39] text-sm block">
                      {formatINR(calculations.advance75)}
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Required for Dispatch
                    </span>
                  </div>
                </div>

                {/* 25% Completion Balance */}
                <div className="bg-white p-2.5 rounded-md border border-[#ebdcc9] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#24160c] block">25% Balance on Site Handover</span>
                    <span className="text-[10px] text-[#7d6553]">Payable upon completion of physical installation</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[#24160c] text-sm block">
                      {formatINR(calculations.balance25)}
                    </span>
                    <span className="text-[9px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                      Handover Balance
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: TERMS & CONDITIONS */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="bg-[#fbf9f5] px-4 py-2.5 border-b border-[#ebdcc9]">
          <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Section D: Company Business Terms & Conditions (11 Clauses)</span>
          </h2>
        </div>

        <div className="p-4 space-y-2 text-xs">
          <p className="text-[11px] text-[#7d6553] mb-2">
            The following standard legal clauses are attached to this quotation and bind the commercial agreement upon client acceptance:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {OFFICIAL_TERMS_AND_CONDITIONS.map((t) => (
              <div key={t.id} className="p-2 bg-[#fbf9f5] border border-[#ebdcc9] rounded-md">
                <span className="font-bold text-[#4d301c] block">{t.title}</span>
                <span className="text-[#574830] text-[10px] line-clamp-2 mt-0.5">{t.fullText}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <label className="block text-[#4d301c] font-semibold mb-1">Additional Quotation Remarks / Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter special site instructions, structural constraints, or client agreed notes..."
              className="w-full p-2 text-xs bg-white border border-[#d8c8b4] rounded-md focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION E: QUOTATION ACTIONS & WORKFLOW TRANSITIONS */}
      <div className="bg-white rounded-lg border border-[#e8decb] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#7d6553] font-semibold">Workflow Actions:</span>

          <button
            type="button"
            onClick={() => handleUpdateStatus('DRAFT')}
            disabled={saving}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition cursor-pointer ${
              quotationStatus === 'DRAFT'
                ? 'bg-[#24150c] text-white border-[#24150c]'
                : 'bg-white text-[#4d301c] border-[#d8c8b4] hover:bg-[#faf6ee]'
            }`}
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => handleUpdateStatus('SENT')}
            disabled={saving}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition flex items-center gap-1 cursor-pointer ${
              quotationStatus === 'SENT'
                ? 'bg-blue-800 text-white border-blue-900'
                : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Send className="w-3 h-3" />
            <span>Mark as Sent</span>
          </button>

          <button
            type="button"
            onClick={() => handleUpdateStatus('ACCEPTED')}
            disabled={saving}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md border transition flex items-center gap-1 cursor-pointer ${
              quotationStatus === 'ACCEPTED'
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark as Accepted</span>
          </button>

          <button
            type="button"
            onClick={() => handleUpdateStatus('REJECTED')}
            disabled={saving}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition flex items-center gap-1 cursor-pointer ${
              quotationStatus === 'REJECTED'
                ? 'bg-rose-800 text-white border-rose-900'
                : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Mark as Rejected</span>
          </button>
        </div>

        {quotationStatus === 'ACCEPTED' && selectedProjectId && (
          <Link
            href={`/projects/${selectedProjectId}/confirm`}
            className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white font-bold text-xs rounded-md shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Proceed to Confirmation & Material Plan</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#c79e7c]" />
          </Link>
        )}
      </div>
    </div>
  );
}
