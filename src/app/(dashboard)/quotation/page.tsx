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
  Check, 
  RotateCcw, 
  Layers,  
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
  ExternalLink,
  Loader2,
  XCircle,
  X
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ImageUploaderWithLightbox } from '@/components/ui/ImageUploaderWithLightbox';
import { useAuth } from '@/lib/auth/auth-context';
import { Project, Customer, Material, Quotation, QuotationMaterialItem, QuotationStatus } from '@/lib/schema';
import { formatINR, formatDate, calculateScaffoldingArea, extractProjectDimensions } from '@/lib/formatters';
import { calculateCommercialPricing } from '@/lib/services/pricing-service';
import { isValidGSTIN } from '@/lib/validations';
import { OFFICIAL_TERMS_AND_CONDITIONS } from '@/lib/constants/terms-and-conditions';
import { generateQuotationPdf, buildQuotationPdfDoc } from '@/lib/pdf/project-pdf';

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

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
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  // Quotation Approval Modal States (Section 4 & 5)
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Company GST Details (Independent of Client GST)
  const [hasCompanyGst, setHasCompanyGst] = useState(true);
  const [companyGstNumber, setCompanyGstNumber] = useState('23AABCA1234F1Z5');
  const [companyGstError, setCompanyGstError] = useState<string | null>(null);

  const validateCompanyGst = (val: string) => {
    if (!val || !val.trim()) {
      setCompanyGstError('Company GSTIN is required when GST Number is selected');
      return false;
    }
    if (!isValidGSTIN(val)) {
      setCompanyGstError('Invalid 15-character GSTIN format (e.g. 23AABCA1234F1Z5)');
      return false;
    }
    setCompanyGstError(null);
    return true;
  };

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

  // Filter projects by customer and eligible status (unconfirmed projects in site or quotation stage)
  const availableProjects = useMemo(() => {
    let list = projects.filter(p =>
      p.status === 'SITE_CREATED' ||
      p.status === 'NOT_INSTALLED' ||
      p.status === 'QUOTATION_DRAFT' ||
      p.status === 'QUOTATION_SENT' ||
      p.status === 'QUOTATION_ACCEPTED' ||
      p.status === 'QUOTATION_REJECTED'
    );
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
        const projDims = extractProjectDimensions(proj);
        if (json.success && json.data && json.data.length > 0) {
          const q: Quotation = json.data[0];
          setExistingQuotation(q);
          setQuotationNumber(q.quotationNumber);
          setQuotationDate(q.quotationDate || new Date().toISOString().slice(0, 10));
          setQuotationStatus(q.status);
          setMaterialItems(q.materials || []);
          setRatePerSqFt(q.ratePerSqFt || 22);

          // Synchronize Façade Elevation Area: Prioritize project inspection dimensions as single source of truth
          const effectiveArea = projDims.elevationAreaSqFt > 0
            ? projDims.elevationAreaSqFt
            : (q.totalAreaSqFt || 1000);
          setTotalAreaSqFt(effectiveArea);

          setDurationMonths(q.durationMonths || 1);
          setExtraJaliQuantity(q.extraJaliQuantity !== undefined ? q.extraJaliQuantity : (q.dimensions ? 14 : 0));
          setExtraJaliRate(q.extraJaliRate || 200);
          setTransportCharges(q.transportCharges !== undefined && q.transportCharges > 0 ? q.transportCharges : (proj.transportCharges || 4500));
          setShiftingCharges(q.shiftingCharges || 0);
          setOtherCharges(q.otherCharges || 0);
          setGstPercentage(q.gstPercentage !== undefined ? q.gstPercentage : 18);
          setNotes(q.notes || '');

          const restoredHasCompGst = q.hasCompanyGst !== undefined 
            ? q.hasCompanyGst 
            : (q.companyGstNumber ? q.companyGstNumber !== 'N/A' : true);
          setHasCompanyGst(Boolean(restoredHasCompGst));
          setCompanyGstNumber(restoredHasCompGst 
            ? (q.companyGstNumber && q.companyGstNumber !== 'N/A' ? q.companyGstNumber : '23AABCA1234F1Z5') 
            : '');
          setCompanyGstError(null);
        } else {
          // Initialize fresh quotation from Site Form data
          setExistingQuotation(null);
          setQuotationNumber(`QTN-${proj.projectCode.replace(/^AW-SCF-/, '') || Date.now().toString().slice(-6)}`);
          setQuotationDate(new Date().toISOString().slice(0, 10));
          setQuotationStatus('DRAFT');
          setHasCompanyGst(true);
          setCompanyGstNumber('23AABCA1234F1Z5');
          setCompanyGstError(null);
          setRatePerSqFt(22);
          setTransportCharges(proj.transportCharges || 4500);

          // Compute elevation area using Scaffolding Engineering Dimensions Formula
          const area = projDims.elevationAreaSqFt || 1000;
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

  // Pricing calculations using shared pricing service
  const calculations = useMemo(() => {
    return calculateCommercialPricing({
      totalAreaSqFt,
      ratePerSqFt,
      durationMonths,
      extraJaliQuantity,
      extraJaliRate,
      transportCharges,
      shiftingCharges,
      otherCharges,
      gstPercentage,
    });
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
  const handleSaveQuotation = async (targetStatus?: QuotationStatus): Promise<Quotation | null> => {
    const finalStatus: QuotationStatus = targetStatus || quotationStatus || 'DRAFT';

    if (!selectedProjectId) {
      setErrorMessage('Please select an inspected site project first.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }

    if (hasCompanyGst) {
      if (!companyGstNumber || !companyGstNumber.trim()) {
        setCompanyGstError('Company GSTIN is required when GST Number is selected');
        setErrorMessage('Please enter our Company GST Number or uncheck the GST Number option.');
        return null;
      }
      if (!isValidGSTIN(companyGstNumber)) {
        setCompanyGstError('Invalid 15-character GSTIN format (e.g. 23AABCA1234F1Z5)');
        setErrorMessage('Please enter a valid 15-character Indian GSTIN for company (e.g. 23AABCA1234F1Z5) or uncheck the GST Number option.');
        return null;
      }
    }

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const clientGstVal = selectedProject?.hasClientGst !== undefined 
        ? (selectedProject.hasClientGst ? (selectedProject.clientGstNumber || selectedCustomer?.gstin || 'N/A') : 'N/A')
        : (selectedProject?.clientGstNumber || selectedCustomer?.gstin || 'N/A');

      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingQuotation?.id,
          projectId: selectedProjectId,
          status: finalStatus,
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
          hasCompanyGst,
          companyGstNumber: hasCompanyGst && companyGstNumber.trim() ? companyGstNumber.trim().toUpperCase() : 'N/A',
          hasClientGst: selectedProject?.hasClientGst !== undefined ? selectedProject.hasClientGst : (clientGstVal !== 'N/A'),
          clientGstNumber: clientGstVal,
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
      setQuotationNumber(json.data.quotation.quotationNumber);
      setSuccessMessage(`Quotation ${json.data.quotation.quotationNumber} saved successfully in database.`);
      setSaveSuccess(true);

      // Auto dismiss temporary success button state after 4 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);

      // Update project in local state
      if (json.data.project) {
        setProjects(prev => prev.map(p => p.id === selectedProjectId ? json.data.project : p));
      }
      return json.data.quotation;
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the quotation.');
      setSaveSuccess(false);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Accept Quotation Action
  const handleAcceptQuotation = async () => {
    if (!existingQuotation && !selectedProjectId) return;
    const targetId = existingQuotation?.id || selectedProjectId;
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/quotations/${targetId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ACCEPTED',
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to accept quotation');

      setQuotationStatus('ACCEPTED');
      setExistingQuotation(json.data.quotation);
      setSuccessMessage(`Quotation ${json.data.quotation.quotationNumber} has been accepted! Project is now eligible for confirmation.`);
      setShowAcceptModal(false);
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? json.data.project : p));
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to accept quotation');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // Reject Quotation Action
  const handleRejectQuotation = async () => {
    if (!rejectionReasonText.trim()) {
      setApprovalError('Rejection reason is mandatory.');
      return;
    }
    if (!existingQuotation && !selectedProjectId) return;
    const targetId = existingQuotation?.id || selectedProjectId;
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/quotations/${targetId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          reason: rejectionReasonText.trim(),
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to reject quotation');

      setQuotationStatus('REJECTED');
      setExistingQuotation(json.data.quotation);
      setSuccessMessage(`Quotation ${json.data.quotation.quotationNumber} marked as Rejected.`);
      setShowRejectModal(false);
      setRejectionReasonText('');
      setProjects(prev => prev.map(p => p.id === selectedProjectId ? json.data.project : p));
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to reject quotation');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // Proceed to Project Confirmation & Material Reservation Handler
  const handleProceedToConfirmation = () => {
    if (!selectedProjectId) {
      setErrorMessage('Please select an inspected site project from Section A first.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (quotationStatus === 'REJECTED') {
      setErrorMessage('Quotation is Rejected. Under company policy, rejected quotations cannot proceed to Project Confirmation & Material Reservation until revised and accepted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (quotationStatus !== 'ACCEPTED') {
      setErrorMessage('Quotation is Pending Approval. Please review and accept the quotation before proceeding to Project Confirmation & Material Reservation.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const qId = existingQuotation?.id || quotationNumber || '';
    router.push(`/confirmation?projectId=${encodeURIComponent(selectedProjectId)}${qId ? `&quotationId=${encodeURIComponent(qId)}` : ''}`);
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
            city: 'Indore',
            state: 'Madhya Pradesh',
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
          hasCompanyGst,
          companyGstNumber: hasCompanyGst && companyGstNumber.trim() ? companyGstNumber.trim().toUpperCase() : 'N/A',
          hasClientGst: selectedProject.hasClientGst !== undefined 
            ? selectedProject.hasClientGst 
            : (selectedProject.clientGstNumber ? selectedProject.clientGstNumber !== 'N/A' : Boolean(selectedCustomer?.gstin && selectedCustomer.gstin !== 'N/A')),
          clientGstNumber: selectedProject.clientGstNumber || selectedCustomer?.gstin || 'N/A',
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

  // Send to Customer via WhatsApp Handler (with auto-downloaded PDF and pre-filled message)
  const handleSendToCustomerWhatsApp = async () => {
    if (!selectedProjectId || !selectedProject) {
      setErrorMessage('Please select a site project first.');
      return;
    }

    // 1. Save quotation (if status is DRAFT, advance it to SENT)
    const targetStatus = quotationStatus === 'DRAFT' ? 'SENT' : quotationStatus;
    const savedQuote = await handleSaveQuotation(targetStatus);
    if (!savedQuote) return;

    // 2. Resolve customer phone number
    let rawPhone = selectedCustomer?.phone || (selectedProject as any)?.contactPhone || (selectedProject as any)?.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      const promptPhone = window.prompt("Enter customer's 10-digit mobile number for WhatsApp:", cleanPhone || '');
      if (!promptPhone) return;
      cleanPhone = promptPhone.replace(/\D/g, '');
    }
    const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;

    // 3. Prepare PDF & WhatsApp Message
    setGeneratingPdf(true);
    try {
      const projectData = {
        ...selectedProject,
        customer: selectedCustomer || undefined,
        site: selectedProject.siteName ? {
          id: selectedProject.siteId,
          siteCode: 'SITE-0001',
          customerId: selectedProject.customerId,
          customerName: selectedProject.customerName,
          siteName: selectedProject.siteName,
          siteAddress: selectedProject.siteAddress,
          city: 'Indore',
          state: 'Madhya Pradesh',
          status: 'ACTIVE',
          createdAt: selectedProject.createdAt,
        } : undefined,
      };

      const qNum = savedQuote.quotationNumber || selectedProject.projectCode;
      const clientName = selectedCustomer?.companyName || selectedProject?.customerName || 'Valued Client';
      const siteLocation = selectedProject?.siteAddress || selectedProject?.siteName || 'Indore Site';

      const waMessage = 
`*COMMERCIAL SCAFFOLDING QUOTATION*
*Alokhandwala Scaffolding*
----------------------------------------
*Quotation No:* ${qNum}
*Date:* ${quotationDate}
*Customer:* ${clientName}
*Site / Project:* ${siteLocation}

📋 *Commercial Quotation Summary:*
• Scaffolding Elevation Area: ${totalAreaSqFt.toLocaleString('en-IN')} sq. ft.
• Rental Rate: ₹${ratePerSqFt}/sq. ft. / month
• Monthly Rental: ₹${calculations.monthlyRent.toLocaleString('en-IN')}
• Rental Duration: ${durationMonths} Month(s) (${durationMonths * 28} Days)
• Extra Walkway Jali: ${extraJaliQuantity} Nos (₹${calculations.extraJali.toLocaleString('en-IN')})
• Transport & Shifting: ₹${(calculations.transport + calculations.shifting).toLocaleString('en-IN')}
• Subtotal: ₹${calculations.subtotal.toLocaleString('en-IN')}
• GST (${gstPercentage}%): ₹${calculations.gstAmount.toLocaleString('en-IN')}
• *Total Estimated:* ₹${calculations.grandTotal.toLocaleString('en-IN')}

💰 *Payment Terms (Commercial Milestone):*
• *75% Advance Payable:* ₹${calculations.advance75.toLocaleString('en-IN')}
• *25% Balance on Dismantling:* ₹${calculations.balance25.toLocaleString('en-IN')}

📄 *Note:* The official PDF quotation has been generated. Please find the attached document for full itemized details and terms.
Thank you for partnering with Alokhandwala Scaffolding!`;

      const doc = await buildQuotationPdfDoc(projectData as any, savedQuote as any);
      const filename = `${qNum}-Quotation.pdf`;

      // Always save PDF to user's device
      doc.save(filename);

      // Attempt native Web Share API with PDF file if supported (mobile/tablet browsers)
      let sharedViaWebShare = false;
      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        try {
          const pdfBlob = doc.output('blob');
          const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              title: `Commercial Quotation ${qNum}`,
              text: waMessage,
              files: [pdfFile],
            });
            sharedViaWebShare = true;
          }
        } catch (shareErr) {
          console.log('Web share aborted or unsupported:', shareErr);
        }
      }

      // If not shared via native share sheet, launch WhatsApp Web / WhatsApp App directly
      if (!sharedViaWebShare) {
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waMessage)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      setSuccessMessage(`Quotation ${qNum} saved as ${targetStatus}, PDF generated, and WhatsApp opened for ${clientName}!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process WhatsApp quotation.');
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

        <div className="flex items-center gap-2">
          {/* Top Action: Single Clearly Visible Quotation PDF Button (Section 3) */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!selectedProjectId || generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#24150c] hover:bg-[#382315] border border-[#24150c] rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Generate and preview / download official Commercial Quotation PDF"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-[#c79e7c] animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-[#c79e7c]" />
                <span>Quotation PDF</span>
              </>
            )}
          </button>
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

          <button
            type="button"
            onClick={handleProceedToConfirmation}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-semibold text-xs shadow-sm transition whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <span>Proceed to Confirmation & Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs relative z-20">
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
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Client Name & GST</span>
                <span className="font-bold text-[#24160c]">{selectedProject.customerName}</span>
                <div className="text-[10px] text-[#7d6553]">{selectedCustomer?.phone || 'No phone recorded'}</div>
                <div className="text-[10px] font-mono text-[#59371d] font-semibold mt-0.5">
                  Client GST: {selectedProject.hasClientGst === false 
                    ? 'N/A' 
                    : (selectedProject.clientGstNumber && selectedProject.clientGstNumber !== 'N/A' 
                      ? selectedProject.clientGstNumber 
                      : (selectedCustomer?.gstin || 'N/A'))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Site Address</span>
                <span className="font-medium text-[#24160c] truncate block">{selectedProject.siteName}</span>
                <div className="text-[10px] text-[#7d6553] truncate">{selectedProject.siteAddress}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#9c826e] uppercase tracking-wider block font-semibold">Site Dimensions</span>
                <span className="font-bold text-[#24160c]">
                  {selectedProject ? extractProjectDimensions(selectedProject).formattedDimensions : 'Dimensions Pending'}
                </span>
                <div className="text-[10px] text-[#8c5e39] font-medium font-mono">
                  Calculated Elevation Area: {selectedProject ? extractProjectDimensions(selectedProject).formattedArea : `${totalAreaSqFt} sq. ft.`}
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

          {/* Unselected Initial State Guidance */}
          {!selectedProject && (
            <div className="p-8 border-2 border-dashed border-[#ebdcc9] rounded-xl text-center bg-[#fbf9f5] space-y-2 mt-2">
              <div className="w-10 h-10 rounded-full bg-[#f2eadf] border border-[#d8c8b4] flex items-center justify-center text-[#8c5e39] mx-auto">
                <Calculator className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[#24160c]">
                Select an Inspected Site Project to Configure Quotation
              </h3>
              <p className="text-xs text-[#7d6553] max-w-md mx-auto leading-relaxed">
                Choose an inspected site project from the dropdown above (optionally filter by existing customer) to load client details, calculate elevation area, and open commercial pricing.
              </p>
            </div>
          )}

          {/* Quotation Meta Fields Row */}
          {selectedProject && (
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
          )}

          {/* Company Business Details & GSTIN */}
          {selectedProject && (
            <div className="p-3.5 bg-[#faf6ee]/60 border border-[#ebdcc9] rounded-lg space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasCompanyGst}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasCompanyGst(checked);
                      if (!checked) {
                        setCompanyGstError(null);
                      } else if (companyGstNumber && companyGstNumber !== 'N/A') {
                        validateCompanyGst(companyGstNumber);
                      }
                    }}
                    className="w-4 h-4 rounded border-[#d8c8b4] text-[#8c5e39] focus:ring-[#8c5e39] accent-[#8c5e39]"
                  />
                  <span className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                    GST Number
                  </span>
                  <span className="text-[11px] text-[#7d6553]">(Our Company GSTIN)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#7d6553] uppercase tracking-wider font-semibold">Status:</span>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-[#ebdcc9] text-[#59371d]">
                    {hasCompanyGst ? 'Company GST Active' : 'N/A'}
                  </span>
                </div>
              </div>

              {hasCompanyGst ? (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#4d301c] uppercase tracking-wider">
                    Our Company GSTIN (15-Character Alphanumeric) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={companyGstNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                      setCompanyGstNumber(val);
                      validateCompanyGst(val);
                    }}
                    placeholder="e.g. 23AABCA1234F1Z5"
                    className={`w-full p-2.5 bg-white border rounded-md font-mono text-xs text-[#24160c] uppercase focus:outline-none transition ${
                      companyGstError 
                        ? 'border-rose-400 focus:border-rose-500' 
                        : companyGstNumber && isValidGSTIN(companyGstNumber)
                          ? 'border-emerald-500'
                          : 'border-[#d8c8b4] focus:border-[#8c5e39]'
                    }`}
                  />
                  {companyGstError && (
                    <span className="text-[11px] text-rose-600 font-medium block">
                      {companyGstError}
                    </span>
                  )}
                  {companyGstNumber && isValidGSTIN(companyGstNumber) && (
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid Indian GSTIN format
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-[#7d6553] bg-white p-2.5 rounded border border-[#ebdcc9]">
                  <span className="text-[11px]">Official Company Tax Identification for Quotation:</span>
                  <span className="font-mono font-bold text-[#59371d] bg-[#faf6ee] px-2.5 py-0.5 rounded border border-[#ebdcc9]">
                    N/A
                  </span>
                </div>
              )}
            </div>
          )}

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

      {selectedProject && (
        <>
          {/* SECTION C: PRICING & COST CALCULATION */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs relative z-10 overflow-hidden">
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
                min="0"
                step="any"
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
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs relative z-10 overflow-hidden">
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
      <div className="bg-white rounded-lg border border-[#e8decb] p-4 shadow-2xs space-y-3">
        {/* 1. Quotation Accepted Banner */}
        {quotationStatus === 'ACCEPTED' && (
          <div className="w-full p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <div className="font-bold text-emerald-900 text-sm">
                  Quotation Accepted by Administrator ({existingQuotation?.quotationNumber || quotationNumber})
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  This quotation has been approved. The project is officially eligible for Project Confirmation and Material Reservation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProceedToConfirmation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-md font-bold text-xs shadow-sm transition whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              <span>Proceed to Confirmation & Plan</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#c79e7c]" />
            </button>
          </div>
        )}

        {/* 2. Quotation Pending Approval Banner with Review Actions */}
        {((existingQuotation && (quotationStatus === 'DRAFT' || quotationStatus === 'SENT')) || (saveSuccess && quotationStatus !== 'ACCEPTED' && quotationStatus !== 'REJECTED')) && (
          <div className="w-full p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-amber-950">
                  {saveSuccess ? 'Quotation saved successfully. ' : ''}
                  Quotation Pending Administrator Approval ({existingQuotation?.quotationNumber || quotationNumber})
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Review commercial rates, material schedule, and pricing. Approval is required before proceeding to Project Confirmation & Plan.
                </p>
              </div>
            </div>
            {existingQuotation && (
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs transition cursor-pointer"
                  title="Accept quotation and make project eligible for confirmation"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Accept Quotation</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectionReasonText('');
                    setShowRejectModal(true);
                  }}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-md shadow-xs transition cursor-pointer"
                  title="Reject quotation with mandatory reason"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Quotation</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Quotation Rejected Banner */}
        {quotationStatus === 'REJECTED' && (
          <div className="w-full p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-950 flex items-start gap-2.5 shadow-xs">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-900">Quotation Rejected: </span>
              <span className="text-rose-800">
                {existingQuotation?.rejection_reason || existingQuotation?.rejectionReason || 'Commercial terms or rates require revision.'}
              </span>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Confirmation is blocked. You can edit this quotation and save changes to return it to Pending Approval.
              </p>
            </div>
          </div>
        )}

        {/* Localized Inline Error Banner in Section E */}
        {errorMessage && (
          <div className="w-full p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-950 flex items-center gap-2.5 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold text-rose-900">Unable to Save Quotation: </span>
              <span className="text-rose-800">{errorMessage}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1. Primary Save Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedProjectId) {
                  setErrorMessage('Please select a Customer and Site / Project from Section A first.');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                handleSaveQuotation('DRAFT');
              }}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-md shadow-xs transition cursor-pointer disabled:opacity-50 ${
                saveSuccess
                  ? 'bg-amber-700 hover:bg-amber-800 border border-amber-800'
                  : 'bg-[#24150c] hover:bg-[#382315] border border-[#24150c]'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#c79e7c] animate-spin" />
                  <span>Saving Quotation...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>✓ Quotation Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#c79e7c]" />
                  <span>{existingQuotation ? 'Save Updated Quotation' : 'Submit & Save Quotation'}</span>
                </>
              )}
            </button>

            {/* 2. Send to Customer (WhatsApp & PDF) Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedProjectId) {
                  setErrorMessage('Please select a Customer and Site / Project from Section A first.');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                handleSendToCustomerWhatsApp();
              }}
              disabled={saving || generatingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Save quotation, generate PDF, and send quotation to customer on WhatsApp"
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 text-emerald-100 animate-spin" />
                  <span>Preparing PDF & WhatsApp...</span>
                </>
              ) : (
                <>
                  <WhatsAppIcon className="w-4 h-4 text-white" />
                  <span>Send to Customer (WhatsApp & PDF)</span>
                </>
              )}
            </button>

            {/* 3. Quotation PDF Preview/Download Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedProjectId) {
                  setErrorMessage('Please select a Customer and Site / Project from Section A first.');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                handleDownloadPdf();
              }}
              disabled={saving || generatingPdf}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#4d301c] bg-white border border-[#d8c8b4] rounded-md hover:bg-[#faf6ee] shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Download or preview official Quotation PDF"
            >
              <FileText className="w-4 h-4 text-[#8c5e39]" />
              <span>{generatingPdf ? 'Generating PDF...' : 'Quotation PDF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <span className={`px-2.5 py-1 rounded text-2xs font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
              quotationStatus === 'ACCEPTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : quotationStatus === 'REJECTED'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : existingQuotation
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-[#fbf9f5] text-[#78593a] border-[#e8decb]'
            }`}>
              {quotationStatus === 'ACCEPTED' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>STATUS: QUOTATION ACCEPTED</span>
                </>
              ) : quotationStatus === 'REJECTED' ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>STATUS: QUOTATION REJECTED</span>
                </>
              ) : existingQuotation ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>STATUS: PENDING APPROVAL</span>
                </>
              ) : (
                <span>STATUS: DRAFT</span>
              )}
            </span>

            {selectedProjectId && quotationStatus !== 'ACCEPTED' && (
              <button
                type="button"
                onClick={handleProceedToConfirmation}
                className="px-3.5 py-2 font-bold text-xs rounded-md shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 bg-[#f4efe8] hover:bg-[#e8decb] text-[#5c3e24] border border-[#d6c7b2]"
                title={
                  quotationStatus === 'REJECTED'
                    ? 'Quotation Rejected: cannot proceed to confirmation'
                    : 'Pending Approval: quotation must be approved before proceeding'
                }
              >
                <span>Proceed to Confirmation & Plan</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#c79e7c]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Screen-Wide Toast Alert */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#24150c] text-white px-4 py-3 rounded-lg shadow-2xl border border-[#c79e7c] flex items-center gap-3 animate-bounce-short">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#faf6ee]">
              Quotation {existingQuotation?.quotationNumber || quotationNumber} Saved!
            </div>
            <div className="text-[11px] text-[#d8c8b4]">Status: PENDING APPROVAL (Awaiting Review)</div>
          </div>
        </div>
      )}

      {/* ACCEPT QUOTATION MODAL */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !approvalSubmitting && setShowAcceptModal(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#f0e8db] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#24160c]">
                    Accept Commercial Quotation
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 font-mono">
                    {quotationNumber} • {selectedProject?.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={approvalSubmitting}
                onClick={() => setShowAcceptModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {approvalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-md text-[11px] text-emerald-950 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Info className="w-3.5 h-3.5 text-emerald-700" />
                <span>Approval Rules:</span>
              </div>
              <div>• Status will update to <strong className="text-emerald-900">Quotation Accepted</strong>.</div>
              <div>• Project will become eligible to proceed to <strong className="text-stone-900">Project Confirmation & Plan</strong>.</div>
              <div>• Approval timestamp and administrator details will be recorded in database.</div>
            </div>

            <div className="pt-2 border-t border-[#f0e8db] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={approvalSubmitting}
                onClick={() => setShowAcceptModal(false)}
                className="px-4 py-2 rounded-md border border-[#d6c7b2] text-stone-700 hover:bg-[#fbf9f5] text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approvalSubmitting}
                onClick={handleAcceptQuotation}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {approvalSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Accept</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT QUOTATION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !approvalSubmitting && setShowRejectModal(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#f0e8db] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200">
                  <XCircle className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#24160c]">
                    Reject Commercial Quotation
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 font-mono">
                    {quotationNumber} • {selectedProject?.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={approvalSubmitting}
                onClick={() => setShowRejectModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {approvalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#24160c]">
                Mandatory Rejection Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReasonText}
                onChange={(e) => {
                  setRejectionReasonText(e.target.value);
                  if (approvalError) setApprovalError(null);
                }}
                placeholder="Enter mandatory reason for rejecting this quotation..."
                className="w-full p-2.5 text-xs bg-white border border-[#d6c7b2] rounded-md focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#f0e8db] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={approvalSubmitting}
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-md border border-[#d6c7b2] text-stone-700 hover:bg-[#fbf9f5] text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approvalSubmitting || !rejectionReasonText.trim()}
                onClick={handleRejectQuotation}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 border border-rose-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {approvalSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Quotation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
