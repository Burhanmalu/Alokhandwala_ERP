'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Building2,
  User,
  Calendar,
  IndianRupee,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  MapPin,
  Phone,
  Mail,
  Bell,
  Check,
  Ruler,
  Clock,
  Receipt,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Customer, Project, ProjectStatus, UserProfile, CompanySettings } from '@/lib/schema';
import { initialCompanySettings } from '@/lib/db/seed-data';
import {
  formatINR,
  formatDate,
  calculateScaffoldingArea,
  calculateRentalDurationBreakdown,
  calculateRemovalDateFromMonths,
  getRemainingDaysInfo,
  getFollowUpStatus,
  getEffectiveRemovalDate,
  getProjectInstallDateStr,
  isDateNotApplicableStatus,
} from '@/lib/formatters';

interface ProjectFormModalProps {
  isOpen: boolean;
  editingProject: Project | null;
  currentUser: UserProfile;
  onClose: () => void;
  onSaved: (project: Project, mode: 'create' | 'edit', addAnother: boolean) => void;
}

const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'NOT_INSTALLED', label: 'Not Installed' },
  { value: 'QUOTATION_DRAFT', label: 'Pending Approval (Draft Quotation)' },
  { value: 'QUOTATION_ACCEPTED', label: 'Quotation Accepted' },
  { value: 'CONFIRMED_PROJECT', label: 'Confirmed (Reserved)' },
  { value: 'SCHEDULED', label: 'Scheduled for Installation' },
  { value: 'ACTIVE_RENTAL', label: 'Active Rental / Installed' },
  { value: 'REMOVAL_PENDING', label: 'Removal Pending' },
  { value: 'CLOSED', label: 'Closed' },
];

const ASSIGNED_SUPERVISOR_OPTIONS = [
  { id: 'sup-ali', fullName: 'ALI' },
  { id: 'sup-abdeali', fullName: 'ABDEALI' },
  { id: 'sup-fakhri-mama', fullName: 'FAKHRI MAMA' },
] as const;

function pickRandomCustomers(allCustomers: Customer[], count = 3): Customer[] {
  if (allCustomers.length <= count) return [...allCustomers];
  const copy = [...allCustomers];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function ProjectFormModal({
  isOpen,
  editingProject,
  currentUser,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  const isEdit = Boolean(editingProject);

  // Master reference lists loaded from live APIs
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(initialCompanySettings);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Section A: Customer & Project Details
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [randomCustomers, setRandomCustomers] = useState<Customer[]>([]);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [assignedSupervisorId, setAssignedSupervisorId] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  // Site Dimensions State
  const [dimWidth, setDimWidth] = useState<string>('');
  const [dimDepth, setDimDepth] = useState<string>('');
  const [dimHeight, setDimHeight] = useState<string>('');
  const [dimUnit, setDimUnit] = useState<'FEET' | 'METERS'>('FEET');

  // Section B: Project Information
  const [status, setStatus] = useState<ProjectStatus>('NOT_INSTALLED');
  const [rentalMode, setRentalMode] = useState<'BY_MONTH' | 'BY_DATE'>('BY_DATE');
  const [rentalMonthsInput, setRentalMonthsInput] = useState<string>('');
  const [installationDate, setInstallationDate] = useState('');
  const [removalDate, setRemovalDate] = useState('');

  // Section C: Financial Details
  const [totalAmountInput, setTotalAmountInput] = useState<string>('0');
  const [paymentReceivedInput, setPaymentReceivedInput] = useState<string>('0');

  // Section D: Additional Information
  const [remark, setRemark] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // GST Details State: Company GST inclusion option
  const [includeCompanyGst, setIncludeCompanyGst] = useState<boolean>(true);

  // Form Submission & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineToast, setInlineToast] = useState<string | null>(null);

  // Load customers, users & company settings
  useEffect(() => {
    if (!isOpen) return;
    setLoadingRefs(true);
    Promise.all([
      fetch('/api/customers').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/users').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/settings').then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([custJson, usersJson, settingsJson]) => {
        if (custJson.success && Array.isArray(custJson.data)) {
          setCustomers(custJson.data);
        }
        if (usersJson.success && Array.isArray(usersJson.data)) {
          setUsers(usersJson.data);
          // Set default supervisor if creating new and none selected yet
          if (!editingProject) {
            const defaultSup =
              usersJson.data.find((u: UserProfile) => u.role === 'SUPERVISOR') ||
              usersJson.data[0];
            if (defaultSup) {
              setAssignedSupervisorId(prev => prev || defaultSup.id);
            }
          }
        }
        if (settingsJson.success && settingsJson.data) {
          setCompanySettings(settingsJson.data);
        }
      })
      .finally(() => setLoadingRefs(false));
  }, [isOpen, editingProject]);

  // Populate or reset form values when editingProject or modal open changes
  const resetForm = (defaultSupId?: string) => {
    setSelectedCustomerId('');
    setCustomerDropdownOpen(false);
    setCustomerSearchQuery('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setSiteName('');
    setSiteAddress('');
    setAssignedSupervisorId(defaultSupId || '');
    setSelectedStaffIds([]);
    setDimWidth('');
    setDimDepth('');
    setDimHeight('');
    setDimUnit('FEET');
    setStatus('NOT_INSTALLED');
    setRentalMode('BY_DATE');
    setRentalMonthsInput('');
    setInstallationDate('');
    setRemovalDate('');
    setTotalAmountInput('0');
    setPaymentReceivedInput('0');
    setRemark('');
    setFollowUpDate('');
    setFollowUpNotes('');
    setIncludeCompanyGst(true);
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    setInlineToast(null);
    setError(null);

    if (editingProject) {
      setSelectedCustomerId(editingProject.customerId || '');
      setCustomerName(editingProject.customerName || '');
      setCustomerPhone(editingProject.customerPhone || '');
      setCustomerEmail(editingProject.customerEmail || '');
      setSiteName(editingProject.siteName || '');
      setSiteAddress(editingProject.siteAddress || '');
      const matchedSup =
        ASSIGNED_SUPERVISOR_OPTIONS.find(
          s =>
            s.id === editingProject.assignedSupervisorId ||
            s.fullName.toUpperCase() === (editingProject.supervisorName || '').trim().toUpperCase()
        );
      setAssignedSupervisorId(matchedSup ? matchedSup.id : (editingProject.assignedSupervisorId || ''));
      setSelectedStaffIds(
        editingProject.staffIds ||
          editingProject.assignedWorkerIds ||
          editingProject.installationWorkers?.map(w => w.id) ||
          []
      );
      const m = editingProject.measurements;
      const sd = editingProject.siteDimensions;
      const wVal = m?.width ?? m?.length ?? sd?.width ?? sd?.length ?? '';
      const dVal = m?.depth ?? '';
      const hVal = m?.height ?? sd?.height ?? '';
      const uVal: 'FEET' | 'METERS' = (m?.unit || sd?.unit) === 'METERS' ? 'METERS' : 'FEET';
      setDimWidth(wVal !== '' ? String(wVal) : '');
      setDimDepth(dVal !== '' ? String(dVal) : '');
      setDimHeight(hVal !== '' ? String(hVal) : '');
      setDimUnit(uVal);

      setStatus(editingProject.status || 'NOT_INSTALLED');
      const initInstall = getProjectInstallDateStr(editingProject);
      const initRemoval = getEffectiveRemovalDate(editingProject);
      setInstallationDate(initInstall);
      setRemovalDate(initRemoval);
      setRentalMode(editingProject.rentalMode || 'BY_DATE');
      if (editingProject.rentalDurationMonths !== undefined && editingProject.rentalDurationMonths !== null) {
        const d = editingProject.rentalDurationDays || 0;
        const dec = d > 0 ? Math.round((editingProject.rentalDurationMonths + d / 30) * 100) / 100 : editingProject.rentalDurationMonths;
        setRentalMonthsInput(dec > 0 ? String(dec) : '');
      } else if (initInstall && initRemoval) {
        const bd = calculateRentalDurationBreakdown(initInstall, initRemoval);
        if (!bd.isInvalid && bd.display) {
          const dec = bd.days > 0 ? Math.round((bd.months + bd.days / 30) * 100) / 100 : bd.months;
          setRentalMonthsInput(dec > 0 ? String(dec) : '');
        } else {
          setRentalMonthsInput('');
        }
      } else {
        setRentalMonthsInput('');
      }
      const tAmt =
        editingProject.totalAmount ??
        editingProject.agreedProjectPrice ??
        editingProject.quotationAmount ??
        0;
      const pRec =
        editingProject.paymentReceived ?? editingProject.advancePaidAmount ?? 0;
      setTotalAmountInput(String(tAmt));
      setPaymentReceivedInput(String(pRec));
      setRemark(editingProject.remark || editingProject.siteRemarks || '');
      setFollowUpDate(editingProject.followUpDate || '');
      setFollowUpNotes(editingProject.followUpNotes || '');
      setIncludeCompanyGst(editingProject.hasCompanyGst !== undefined ? Boolean(editingProject.hasCompanyGst) : true);
    } else {
      resetForm(ASSIGNED_SUPERVISOR_OPTIONS[0].id);
    }
  }, [isOpen, editingProject]);

  // Derived Site Dimensions Elevation Area
  const numericWidth = Math.max(0, Number(dimWidth) || 0);
  const numericDepth = Math.max(0, Number(dimDepth) || 0);
  const numericHeight = Math.max(0, Number(dimHeight) || 0);
  const calculatedAreaSqFt = useMemo(
    () => calculateScaffoldingArea(numericWidth, numericDepth, numericHeight, dimUnit),
    [numericWidth, numericDepth, numericHeight, dimUnit]
  );

  // Derived By-Month Removal Date
  const computedByMonthRemovalDate = useMemo(
    () => calculateRemovalDateFromMonths(installationDate, rentalMonthsInput),
    [installationDate, rentalMonthsInput]
  );

  // Effective Removal Date based on selected rental mode
  const activeRemovalDate = useMemo(
    () => (rentalMode === 'BY_MONTH' ? computedByMonthRemovalDate : removalDate),
    [rentalMode, computedByMonthRemovalDate, removalDate]
  );

  // Derived Rental Duration Calculation: Rental Duration = Date of Removal - Date of Installation
  const rentalDuration = useMemo(
    () => calculateRentalDurationBreakdown(installationDate, activeRemovalDate),
    [installationDate, activeRemovalDate]
  );

  // Derived Remaining Days & Follow-Up Alerts
  const remainingDaysInfo = useMemo(
    () => getRemainingDaysInfo(activeRemovalDate, status),
    [activeRemovalDate, status]
  );
  const followUpStatus = useMemo(
    () => getFollowUpStatus(followUpDate, activeRemovalDate, status),
    [followUpDate, activeRemovalDate, status]
  );

  const handleRentalModeChange = (nextMode: 'BY_MONTH' | 'BY_DATE') => {
    if (nextMode === rentalMode) return;
    if (nextMode === 'BY_MONTH') {
      if (!rentalMonthsInput && installationDate && removalDate) {
        const bd = calculateRentalDurationBreakdown(installationDate, removalDate);
        if (!bd.isInvalid && (bd.months > 0 || bd.days > 0)) {
          const dec = bd.days > 0 ? Math.round((bd.months + bd.days / 30) * 100) / 100 : bd.months;
          setRentalMonthsInput(String(dec));
        }
      }
    } else {
      if (!removalDate && computedByMonthRemovalDate) {
        setRemovalDate(computedByMonthRemovalDate);
      }
    }
    setRentalMode(nextMode);
  };

  // Derived Financial Calculations: Balance Amount = Total Amount - Payment Received
  const totalAmount = Math.max(0, Number(totalAmountInput) || 0);
  const paymentReceived = Math.max(0, Number(paymentReceivedInput) || 0);
  const isOverpaid = paymentReceived > totalAmount;
  const balanceAmount = Math.round((totalAmount - paymentReceived) * 100) / 100;

  // Fixed 3 assigned supervisor options
  const supervisorOptions = ASSIGNED_SUPERVISOR_OPTIONS;

  const handleSelectExistingCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const found = customers.find(c => c.id === custId);
    if (found) {
      setCustomerName(found.companyName);
      setCustomerPhone(found.phone || '');
      setCustomerEmail(found.email || '');
      if (!siteAddress && found.billingAddress) {
        setSiteAddress(found.billingAddress);
      }
      if (!siteName) {
        setSiteName(`${found.companyName} Site`);
      }
    }
  };

  // Initialize random 3 customers when customers list loads
  useEffect(() => {
    if (customers.length > 0 && randomCustomers.length === 0) {
      setRandomCustomers(pickRandomCustomers(customers, 3));
    }
  }, [customers, randomCustomers.length]);

  // Toggle dropdown and randomly rotate 3 displayed customers on each open
  const toggleCustomerDropdown = () => {
    if (loadingRefs || submitting) return;
    const nextOpen = !customerDropdownOpen;
    if (nextOpen) {
      // Pick 3 new random distinct customers from full customer database
      setRandomCustomers(pickRandomCustomers(customers, 3));
      setCustomerSearchQuery('');
      setTimeout(() => {
        customerSearchInputRef.current?.focus();
      }, 50);
    }
    setCustomerDropdownOpen(nextOpen);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setCustomerDropdownOpen(false);
      }
    };
    if (customerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [customerDropdownOpen]);

  // Filtered customers: 3 random when not searching, or matching records across ALL customers in database
  const displayedCustomers = useMemo(() => {
    const query = customerSearchQuery.trim().toLowerCase();
    if (!query) {
      return randomCustomers;
    }
    return customers.filter((c) => {
      const nameMatch = c.companyName?.toLowerCase().includes(query);
      const codeMatch = c.customerCode?.toLowerCase().includes(query);
      const phoneMatch = c.phone?.toLowerCase().includes(query);
      const refMatch = c.referenceName?.toLowerCase().includes(query);
      const contactMatch = c.contactPerson?.toLowerCase().includes(query);
      return Boolean(nameMatch || codeMatch || phoneMatch || refMatch || contactMatch);
    });
  }, [customers, randomCustomers, customerSearchQuery]);

  const handleSelectCustomerOption = (custId: string) => {
    handleSelectExistingCustomer(custId);
    setCustomerDropdownOpen(false);
    setCustomerSearchQuery('');
  };

  // Selected Customer Resolution & Dual GST Identifiers
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      return customers.find(c => c.id === selectedCustomerId) || null;
    }
    if (customerName.trim()) {
      return (
        customers.find(
          c => c.companyName.trim().toLowerCase() === customerName.trim().toLowerCase()
        ) || null
      );
    }
    return null;
  }, [customers, selectedCustomerId, customerName]);

  const clientGstin = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.gstin) return 'Not Available';
    const val = selectedCustomer.gstin.trim();
    if (!val || val.toUpperCase() === 'N/A' || val.toUpperCase() === 'NONE' || val.toUpperCase() === 'NULL') {
      return 'Not Available';
    }
    return val;
  }, [selectedCustomer]);

  const companyGstin = useMemo(() => {
    if (!companySettings || !companySettings.gstin) return 'Not Available';
    const val = companySettings.gstin.trim();
    if (!val || val.toUpperCase() === 'N/A' || val.toUpperCase() === 'NONE' || val.toUpperCase() === 'NULL') {
      return 'Not Available';
    }
    return val;
  }, [companySettings]);

  const isCompanyGstAvailable = companyGstin !== 'Not Available';

  const validateForm = (): string | null => {
    if (!customerName.trim()) {
      return 'Customer Name is required.';
    }
    if (!siteName.trim()) {
      return 'Site Name is required.';
    }
    if (!siteAddress.trim()) {
      return 'Complete Site Address is required.';
    }
    if (!assignedSupervisorId) {
      return 'Please assign a Supervisor to this project.';
    }
    if (Number(dimWidth) < 0 || Number(dimDepth) < 0 || Number(dimHeight) < 0) {
      return 'Site Dimensions (Width, Depth, Height) cannot be negative.';
    }
    if (Number(totalAmountInput) < 0 || Number(paymentReceivedInput) < 0) {
      return 'Total Amount and Payment Received cannot be negative.';
    }
    if (isOverpaid) {
      return `Payment Received (${formatINR(paymentReceived, false)}) cannot exceed Total Amount (${formatINR(totalAmount, false)}).`;
    }
    if (!isDateNotApplicableStatus(status)) {
      if (rentalMode === 'BY_MONTH' && rentalMonthsInput.trim() !== '') {
        const mNum = Number(rentalMonthsInput);
        if (isNaN(mNum) || mNum < 0) {
          return 'Rental Duration (Months) cannot be negative.';
        }
      }
      if (rentalDuration.isInvalid || (installationDate && activeRemovalDate && activeRemovalDate < installationDate)) {
        return 'Date of Removal cannot be earlier than Date of Installation.';
      }
    }
    return null;
  };

  const handleSave = async (addAnother: boolean) => {
    setError(null);
    setInlineToast(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const selectedSup =
        ASSIGNED_SUPERVISOR_OPTIONS.find(s => s.id === assignedSupervisorId) ||
        users.find(u => u.id === assignedSupervisorId);
      const selectedStaffNames = selectedStaffIds.map(
        id => users.find(u => u.id === id)?.fullName || id
      );

      if (isEdit && editingProject) {
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateProjectDetails: true,
            customerId: selectedCustomerId || editingProject.customerId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim(),
            siteName: siteName.trim(),
            siteAddress: siteAddress.trim(),
            assignedSupervisorId,
            supervisorName: selectedSup?.fullName || editingProject.supervisorName,
            staffIds: selectedStaffIds,
            staffNames: selectedStaffNames,
            width: numericWidth,
            depth: numericDepth,
            height: numericHeight,
            unit: dimUnit,
            status,
            rentalMode: isDateNotApplicableStatus(status) ? undefined : rentalMode,
            installationDate: isDateNotApplicableStatus(status) ? undefined : (installationDate || undefined),
            removalDate: isDateNotApplicableStatus(status) ? undefined : (activeRemovalDate || undefined),
            rentalDurationMonths: !isDateNotApplicableStatus(status) && installationDate ? rentalDuration.months : undefined,
            rentalDurationDays: !isDateNotApplicableStatus(status) && installationDate ? rentalDuration.days : undefined,
            rentalDurationDisplay: !isDateNotApplicableStatus(status) && installationDate ? (rentalDuration.display || undefined) : undefined,
            totalAmount,
            paymentReceived,
            balanceAmount,
            remark: remark.trim(),
            followUpDate: followUpDate || undefined,
            followUpNotes: followUpNotes.trim(),
            hasCompanyGst: isCompanyGstAvailable ? includeCompanyGst : false,
            companyGstNumber: isCompanyGstAvailable && includeCompanyGst ? companyGstin : undefined,
            hasClientGst: clientGstin !== 'Not Available',
            clientGstNumber: clientGstin !== 'Not Available' ? clientGstin : undefined,
            actorId: currentUser?.id || 'usr-admin-01',
            actorName: currentUser?.fullName || 'Admin',
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to update project.');
        }

        onSaved(json.data, 'edit', false);
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'DIRECT_PROJECT',
            customerId: selectedCustomerId || undefined,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim(),
            siteName: siteName.trim(),
            siteAddress: siteAddress.trim(),
            assignedSupervisorId,
            supervisorName: selectedSup?.fullName || '',
            staffIds: selectedStaffIds,
            staffNames: selectedStaffNames,
            width: numericWidth,
            depth: numericDepth,
            height: numericHeight,
            unit: dimUnit,
            status,
            rentalMode: isDateNotApplicableStatus(status) ? undefined : rentalMode,
            installationDate: isDateNotApplicableStatus(status) ? undefined : (installationDate || undefined),
            removalDate: isDateNotApplicableStatus(status) ? undefined : (activeRemovalDate || undefined),
            rentalDurationMonths: !isDateNotApplicableStatus(status) && installationDate ? rentalDuration.months : undefined,
            rentalDurationDays: !isDateNotApplicableStatus(status) && installationDate ? rentalDuration.days : undefined,
            rentalDurationDisplay: !isDateNotApplicableStatus(status) && installationDate ? (rentalDuration.display || undefined) : undefined,
            totalAmount,
            paymentReceived,
            balanceAmount,
            remark: remark.trim(),
            followUpDate: followUpDate || undefined,
            followUpNotes: followUpNotes.trim(),
            hasCompanyGst: isCompanyGstAvailable ? includeCompanyGst : false,
            companyGstNumber: isCompanyGstAvailable && includeCompanyGst ? companyGstin : undefined,
            hasClientGst: clientGstin !== 'Not Available',
            clientGstNumber: clientGstin !== 'Not Available' ? clientGstin : undefined,
            actorId: currentUser?.id || 'usr-admin-01',
            actorName: currentUser?.fullName || 'Admin',
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to save project.');
        }

        onSaved(json.data, 'create', addAnother);

        if (addAnother) {
          resetForm(ASSIGNED_SUPERVISOR_OPTIONS[0].id);
          setInlineToast(
            `✓ Project ${json.data.projectCode} saved! Ready for next entry.`
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => !submitting && onClose()}
      />

      <div className="relative z-10 w-full max-w-4xl bg-[#faf6ee] rounded-xl shadow-2xl border border-[#d6c7b2] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#24160c] text-white px-5 py-4 flex items-center justify-between border-b border-[#382315] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#382315] border border-[#523622] flex items-center justify-center text-[#c79e7c]">
              {isEdit ? <Save className="w-4.5 h-4.5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                {isEdit
                  ? `Edit Project: ${editingProject?.projectCode}`
                  : 'Add New Project'}
              </h2>
              <p className="text-[11px] text-[#c79e7c] font-mono">
                {isEdit
                  ? 'Update project lifecycle, schedule, financials & follow-up'
                  : 'Register customer, site assignment, timeline & commercial financials'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1.5 rounded-md text-[#c79e7c] hover:text-white hover:bg-[#382315] transition cursor-pointer"
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Feedback Banners */}
          {inlineToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{inlineToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setInlineToast(null)}
                className="text-emerald-700 hover:text-emerald-950 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-center gap-2 font-medium shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION A: CUSTOMER & PROJECT DETAILS */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0e8db]">
              <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                <User className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-[#24160c]">
                A. Customer & Project Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quick Customer Selector with 3-Random Rotation & Integrated Full Search */}
              <div className="md:col-span-2" ref={customerDropdownRef}>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Select Existing Customer (Optional — or enter new customer below)
                </label>

                <div className="relative">
                  {/* Dropdown Trigger Button */}
                  <button
                    type="button"
                    disabled={loadingRefs || submitting}
                    onClick={toggleCustomerDropdown}
                    className={`w-full px-3 py-2 bg-[#fbf9f5] border rounded-md text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition cursor-pointer select-none ${
                      customerDropdownOpen
                        ? 'bg-white border-[#8f6541] ring-1 ring-[#8f6541]'
                        : 'border-[#d6c7b2] hover:bg-white hover:border-[#8f6541]'
                    } ${(loadingRefs || submitting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title="Choose an existing customer or enter a new one"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#8f6541] shrink-0" />
                      {selectedCustomer ? (
                        <div className="truncate text-[#24160c] font-medium">
                          <span className="font-bold">{selectedCustomer.companyName}</span>
                          <span className="text-[#7d6553] ml-1.5 font-mono text-xs">
                            ({selectedCustomer.customerCode || 'CUST'})
                          </span>
                          {selectedCustomer.phone && (
                            <span className="text-[#9c826e] ml-1.5 font-mono text-xs">
                              — {selectedCustomer.phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#7d6553] truncate font-medium">
                          — New / Custom Customer Entry —
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[#9c826e]">
                      {selectedCustomer && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCustomerOption('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCustomerOption('');
                            }
                          }}
                          className="p-0.5 rounded hover:bg-[#ebdcc9] hover:text-[#24160c] transition cursor-pointer"
                          title="Clear customer selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          customerDropdownOpen ? 'rotate-180 text-[#8f6541]' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Menu Panel */}
                  {customerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-md border border-[#d6c7b2] shadow-xl overflow-hidden flex flex-col max-h-72 animate-in fade-in-50 duration-100 text-xs">
                      {/* Integrated Search Input at Top */}
                      <div className="p-2 border-b border-[#ebdcc9] bg-[#fbf9f5] shrink-0">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            ref={customerSearchInputRef}
                            type="text"
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            placeholder="Search by customer name, code (CUST-0001), phone..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#d8c8b4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8f6541] focus:border-[#8f6541] text-[#24160c] placeholder:text-[#9c826e]"
                          />
                          {customerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerSearchQuery('');
                                customerSearchInputRef.current?.focus();
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              title="Clear search"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Status bar */}
                        <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-[#7d6553]">
                          {customerSearchQuery.trim() ? (
                            <span>
                              {displayedCustomers.length} matching result{displayedCustomers.length === 1 ? '' : 's'} across {customers.length} accounts
                            </span>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="font-semibold text-[#8f6541]">
                                Showing 3 random accounts
                              </span>
                              <span className="text-[#9c826e] italic">
                                Reopen to shuffle
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Options List */}
                      <div className="overflow-y-auto overscroll-contain flex-1 divide-y divide-[#f5efe6] max-h-52">
                        {/* Option 1: New / Custom Customer Entry (Always at Top) */}
                        <button
                          type="button"
                          onClick={() => handleSelectCustomerOption('')}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between transition cursor-pointer ${
                            !selectedCustomerId
                              ? 'bg-[#faf6ee] text-[#8f6541] font-semibold border-l-2 border-[#8f6541]'
                              : 'text-[#4d301c] hover:bg-[#faf6ee]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-[#8f6541]" />
                            <span>— New / Custom Customer Entry —</span>
                          </div>
                          {!selectedCustomerId && (
                            <Check className="w-3.5 h-3.5 text-[#8f6541]" />
                          )}
                        </button>

                        {/* Customer Options List */}
                        {displayedCustomers.length === 0 ? (
                          <div className="p-4 text-center text-[#7d6553] space-y-1">
                            <div className="font-semibold text-[#24160c]">No customers found</div>
                            <div className="text-[11px] text-[#9c826e]">
                              No customer matched &quot;{customerSearchQuery}&quot;. You can use New / Custom Customer Entry above.
                            </div>
                          </div>
                        ) : (
                          displayedCustomers.map((c) => {
                            const isSelected = c.id === selectedCustomerId;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCustomerOption(c.id)}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#faf6ee] text-[#24160c] font-semibold border-l-2 border-[#8f6541]'
                                    : 'text-[#4d301c] hover:bg-[#faf6ee]'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[#24160c] truncate">
                                      {c.companyName}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#f4ebe1] text-[#59371d] border border-[#e5dac8]">
                                      {c.customerCode || 'CUST'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#7d6553] flex items-center gap-2 mt-0.5">
                                    {c.phone && <span className="font-mono">{c.phone}</span>}
                                    {c.city && <span>• {c.city}</span>}
                                  </div>
                                </div>

                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-[#8f6541] shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Customer Name <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rajesh Verma / Apex Infra"
                    className="w-full pl-8 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>

              {/* Contact Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Contact Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full pl-8 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Email (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full pl-8 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Site Name */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Site Name <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. Emerald Commercial Tower"
                    className="w-full pl-8 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>

              {/* Assign Supervisor */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Assign Supervisor <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={assignedSupervisorId}
                  onChange={(e) => setAssignedSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                >
                  <option value="">Select Supervisor...</option>
                  {supervisorOptions.map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Complete Site Address */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Complete Site Address <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    required
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    placeholder="Enter complete site street, landmark, locality, and city..."
                    className="w-full pl-8 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SITE DIMENSIONS SECTION */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#f0e8db]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                  <Ruler className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-sm text-[#24160c]">
                  Site Dimensions
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7d6553] bg-[#faf6ee] px-2 py-0.5 rounded border border-[#ebdcc9]">
                  Unit: {dimUnit === 'METERS' ? 'Meter (m)' : 'Feet (ft)'}
                </span>
                {calculatedAreaSqFt > 0 && (
                  <span className="text-[11px] font-mono font-bold text-[#714f36] bg-[#f7f2eb] px-2.5 py-0.5 rounded border border-[#c79e7c]">
                    Area: {Math.round(calculatedAreaSqFt).toLocaleString('en-IN')} sq. ft.
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Width */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Width ({dimUnit === 'METERS' ? 'm' : 'ft'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={dimWidth}
                  onChange={(e) => setDimWidth(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-semibold text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>

              {/* Depth */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Depth ({dimUnit === 'METERS' ? 'm' : 'ft'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={dimDepth}
                  onChange={(e) => setDimDepth(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-semibold text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Height ({dimUnit === 'METERS' ? 'm' : 'ft'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={dimHeight}
                  onChange={(e) => setDimHeight(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-semibold text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>

              {/* Measurement Unit */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Measurement Unit
                </label>
                <select
                  value={dimUnit}
                  onChange={(e) => setDimUnit(e.target.value as 'FEET' | 'METERS')}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                >
                  <option value="FEET">Feet (ft)</option>
                  <option value="METERS">Meter (m)</option>
                </select>
              </div>
            </div>
          </section>

          {/* SECTION B: PROJECT INFORMATION */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0e8db]">
              <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-[#24160c]">
                B. Project Information
              </h3>
            </div>

            {/* Project Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Project Status <span className="text-rose-600">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-medium focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                >
                  {PROJECT_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Duration Mode (Shown only when dates are applicable) */}
              {!isDateNotApplicableStatus(status) && (
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Rental Duration Mode
                  </label>
                  <div
                    role="group"
                    aria-label="Rental Duration Mode"
                    className="grid grid-cols-2 gap-1 p-1 bg-[#f4ece1] border border-[#d6c7b2] rounded-md"
                  >
                    <button
                      type="button"
                      onClick={() => handleRentalModeChange('BY_MONTH')}
                      className={`py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        rentalMode === 'BY_MONTH'
                          ? 'bg-[#24150c] text-white shadow-xs'
                          : 'text-[#59371d] hover:bg-[#ebdcc9]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>By Month</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRentalModeChange('BY_DATE')}
                      className={`py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        rentalMode === 'BY_DATE'
                          ? 'bg-[#24150c] text-white shadow-xs'
                          : 'text-[#59371d] hover:bg-[#ebdcc9]'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>By Date</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Date & Duration Fields */}
            {isDateNotApplicableStatus(status) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date of Installation: N/A */}
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Date of Installation
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="N/A"
                      aria-label="Date of Installation"
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#714f36] font-mono font-bold cursor-not-allowed select-none focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans font-medium text-[#9c826e] uppercase tracking-wider">
                      Not Applicable
                    </span>
                  </div>
                </div>

                {/* Date of Removal: N/A */}
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Date of Removal
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="N/A"
                      aria-label="Date of Removal"
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#714f36] font-mono font-bold cursor-not-allowed select-none focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans font-medium text-[#9c826e] uppercase tracking-wider">
                      Not Applicable
                    </span>
                  </div>
                </div>
              </div>
            ) : rentalMode === 'BY_MONTH' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Date of Installation */}
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Date of Installation
                    </label>
                    <input
                      type="date"
                      value={installationDate}
                      onChange={(e) => setInstallationDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>

                  {/* Rental Duration (Months) */}
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Rental Duration (Months)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 3 or 1.5"
                      value={rentalMonthsInput}
                      onChange={(e) => setRentalMonthsInput(e.target.value)}
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono font-semibold focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>

                  {/* Date of Removal (Automatically Calculated) */}
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Date of Removal <span className="text-[10px] font-normal text-[#8c5e39]">(Auto)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={computedByMonthRemovalDate ? formatDate(computedByMonthRemovalDate) : '—'}
                        aria-label="Calculated Date of Removal"
                        className="w-full px-3 py-2 bg-[#faf6ee] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono font-bold cursor-default focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans font-semibold text-[#8c5e39] uppercase tracking-wider">
                        {computedByMonthRemovalDate || 'Auto'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary Box for By Month */}
                {installationDate && computedByMonthRemovalDate && !rentalDuration.isInvalid && (
                  <div className="pt-1 space-y-2">
                    <div className="px-3.5 py-2.5 rounded-md border bg-[#fbf9f5] border-[#d6c7b2] text-[#24160c] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono font-bold text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0 bg-[#8f6541]" />
                        <span>{rentalDuration.display}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[#7d6553]">
                        <span>
                          Months: <strong className="text-[#24160c]">{rentalDuration.months}</strong>
                        </span>
                        <span>
                          Remaining Days: <strong className="text-[#24160c]">{rentalDuration.days}</strong>
                        </span>
                        <span className="hidden sm:inline text-[#9c826e]">
                          ({rentalDuration.totalDays} total days)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#faf6ee] border border-[#e5dac8] text-[11px]">
                      <span className="text-[#714f36] font-semibold">
                        Remaining Until Removal Date:
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-bold ${remainingDaysInfo.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${remainingDaysInfo.dotClass}`} />
                        <span>{remainingDaysInfo.label}</span>
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date of Installation */}
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Date of Installation
                    </label>
                    <input
                      type="date"
                      value={installationDate}
                      onChange={(e) => setInstallationDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>

                  {/* Date of Removal */}
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Date of Removal
                    </label>
                    <input
                      type="date"
                      min={installationDate || undefined}
                      value={removalDate}
                      onChange={(e) => setRemovalDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-md font-mono focus:bg-white focus:outline-none ${
                        rentalDuration.isInvalid
                          ? 'bg-rose-50 border-2 border-rose-500 text-rose-900 focus:ring-1 focus:ring-rose-500'
                          : 'bg-[#fbf9f5] border border-[#d6c7b2] text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541]'
                      }`}
                    />
                  </div>
                </div>

                {/* Rental Duration (Auto-Calculated below Installation & Removal Dates) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#4d301c] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8f6541]" />
                      <span>Rental Duration</span>
                      <span className="text-[10px] font-normal text-[#8c5e39]">
                        (Auto: Date of Removal − Date of Installation)
                      </span>
                    </label>
                  </div>
                  <div
                    className={`px-3.5 py-2.5 rounded-md border flex flex-wrap items-center justify-between gap-2 ${
                      rentalDuration.isInvalid
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : rentalDuration.display
                          ? 'bg-[#fbf9f5] border-[#d6c7b2] text-[#24160c]'
                          : 'bg-[#faf6ee]/60 border-[#e5dac8] text-[#9c826e]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono font-bold text-xs">
                      {rentalDuration.isInvalid ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{rentalDuration.display}</span>
                        </>
                      ) : rentalDuration.display ? (
                        <>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              rentalDuration.isOngoing ? 'bg-emerald-600' : 'bg-[#8f6541]'
                            }`}
                          />
                          <span>{rentalDuration.display}</span>
                        </>
                      ) : (
                        <span className="font-sans font-normal italic">
                          Enter Date of Installation to calculate rental duration
                        </span>
                      )}
                    </div>

                    {rentalDuration.display && !rentalDuration.isInvalid && !rentalDuration.isScheduled && (
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[#7d6553]">
                        <span>
                          Months: <strong className="text-[#24160c]">{rentalDuration.months}</strong>
                        </span>
                        <span>
                          Remaining Days: <strong className="text-[#24160c]">{rentalDuration.days}</strong>
                        </span>
                        <span className="hidden sm:inline text-[#9c826e]">
                          ({rentalDuration.totalDays} total days)
                        </span>
                      </div>
                    )}
                  </div>

                  {activeRemovalDate && !rentalDuration.isInvalid && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#faf6ee] border border-[#e5dac8] text-[11px]">
                      <span className="text-[#714f36] font-semibold">
                        Remaining Until Removal Date:
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-bold ${remainingDaysInfo.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${remainingDaysInfo.dotClass}`} />
                        <span>{remainingDaysInfo.label}</span>
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* SECTION C: FINANCIAL DETAILS */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#f0e8db]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-sm text-[#24160c]">
                  C. Financial Details
                </h3>
              </div>
              <span className="text-[11px] text-[#7d6553] font-mono">
                Balance = Total Amount − Payment Received
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Amount */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Total Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-[#8c5e39]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalAmountInput}
                    onChange={(e) => setTotalAmountInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-bold text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Received */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Payment Received (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-emerald-700">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentReceivedInput}
                    onChange={(e) => setPaymentReceivedInput(e.target.value)}
                    className={`w-full pl-7 pr-3 py-2 rounded-md font-mono font-bold focus:bg-white focus:outline-none ${
                      isOverpaid
                        ? 'bg-rose-50 border-2 border-rose-500 text-rose-900 focus:ring-1 focus:ring-rose-500'
                        : 'bg-[#fbf9f5] border border-[#d6c7b2] text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541]'
                    }`}
                  />
                </div>
              </div>

              {/* Auto-Calculated Balance Amount */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Balance Amount (₹) <span className="text-[10px] font-normal text-[#8c5e39]">(Auto)</span>
                </label>
                <div
                  className={`px-3 py-2 rounded-md border font-mono font-bold flex items-center justify-between ${
                    isOverpaid
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : balanceAmount === 0 && totalAmount > 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-[#f7f2eb] border-[#d6c7b2] text-[#24160c]'
                  }`}
                >
                  <span>{formatINR(balanceAmount, balanceAmount % 1 !== 0)}</span>
                  <span className="text-[10px] font-sans uppercase tracking-wider opacity-75">
                    {isOverpaid ? 'Invalid' : balanceAmount === 0 && totalAmount > 0 ? 'Settled' : 'Due'}
                  </span>
                </div>
              </div>
            </div>

            {isOverpaid && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-md text-rose-800 text-[11px] font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Validation Warning: Payment Received ({formatINR(paymentReceived, false)}) exceeds Total Amount ({formatINR(totalAmount, false)}). Please correct the amounts before saving.
                </span>
              </div>
            )}
          </section>

          {/* GST DETAILS SECTION */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#f0e8db]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-sm text-[#24160c]">
                  GST Details
                </h3>
              </div>
              <span className="text-[10px] font-medium text-[#8c5e39] bg-[#faf6ee] px-2 py-0.5 rounded border border-[#ebdcc9]">
                Tax Configuration
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Company GST */}
              <div className="p-3.5 bg-[#faf6ee]/70 border border-[#ebdcc9] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#4d301c] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#8c5e39]" />
                    <span>Company GST</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      !isCompanyGstAvailable
                        ? 'bg-stone-100 text-stone-600 border border-stone-200'
                        : includeCompanyGst
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {!isCompanyGstAvailable
                      ? 'Not Available'
                      : includeCompanyGst
                        ? 'Included in Project'
                        : 'Excluded from Project'}
                  </span>
                </div>

                {/* Inclusion Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e4627] mb-1">
                    Include Company GST in Project?
                  </label>
                  <select
                    value={!isCompanyGstAvailable ? 'NO' : includeCompanyGst ? 'YES' : 'NO'}
                    onChange={(e) => setIncludeCompanyGst(e.target.value === 'YES')}
                    disabled={!isCompanyGstAvailable || submitting}
                    className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-[#24160c] focus:outline-none transition ${
                      !isCompanyGstAvailable
                        ? 'border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed'
                        : 'border-[#d6c7b2] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] cursor-pointer'
                    }`}
                  >
                    {isCompanyGstAvailable ? (
                      <>
                        <option value="YES">Yes – Include Company GST</option>
                        <option value="NO">No – Do Not Include Company GST</option>
                      </>
                    ) : (
                      <option value="NO">Not Available (No GST Registered)</option>
                    )}
                  </select>
                </div>

                {/* Company GSTIN (Read-Only) */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e4627] mb-1">
                    Company GSTIN {isCompanyGstAvailable && includeCompanyGst ? '(Applied)' : '(Excluded)'}
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={
                      !isCompanyGstAvailable
                        ? 'Not Available'
                        : includeCompanyGst
                          ? companyGstin
                          : `${companyGstin} (Excluded from Project)`
                    }
                    className={`w-full px-3 py-2 border rounded-md font-mono text-xs font-bold cursor-default focus:outline-none select-all ${
                      !isCompanyGstAvailable
                        ? 'bg-stone-50 border-stone-200 text-stone-400'
                        : includeCompanyGst
                          ? 'bg-white border-[#d6c7b2] text-[#24160c]'
                          : 'bg-[#f7f2eb]/60 border-[#e5dac8] text-[#8c7360]'
                    }`}
                    aria-label="Company GSTIN"
                  />
                </div>

                <p className="text-[10px] text-[#7d6553]">
                  {!isCompanyGstAvailable
                    ? 'No registered GSTIN in Company Settings (inclusion disabled).'
                    : includeCompanyGst
                      ? `${companySettings?.companyName || 'Alokhandwala'} registered GSTIN will be applied to this project.`
                      : 'Company GST will not be included in this project.'}
                </p>
              </div>

              {/* 2. Client GST */}
              <div className="p-3.5 bg-[#faf6ee]/70 border border-[#ebdcc9] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#4d301c] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#8c5e39]" />
                    <span>Client GST</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      clientGstin !== 'Not Available'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {clientGstin !== 'Not Available' ? 'Registered GSTIN' : 'Not Available'}
                  </span>
                </div>

                {/* Read-Only Status Indicator to balance height */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e4627] mb-1">
                    Client GST Profile Status
                  </label>
                  <div className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#ebdcc9] bg-[#fbf9f5] text-[#574830] flex items-center justify-between">
                    <span>
                      {clientGstin !== 'Not Available' ? 'Active Customer Profile GSTIN' : 'No Customer GSTIN Registered'}
                    </span>
                    <span className="text-[10px] font-semibold text-[#8c5e39] uppercase tracking-wider">
                      Read-Only
                    </span>
                  </div>
                </div>

                {/* Client GSTIN (Read-Only) */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e4627] mb-1">
                    Client GSTIN (Read-Only)
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={clientGstin}
                    className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono text-xs font-bold text-[#24160c] cursor-default focus:outline-none select-all"
                    aria-label="Client GSTIN"
                  />
                </div>

                <p className="text-[10px] text-[#7d6553] truncate">
                  {selectedCustomer
                    ? `${selectedCustomer.companyName} registered GSTIN from Customer Profile`
                    : 'Select a customer to view registered GSTIN'}
                </p>
              </div>
            </div>
          </section>

          {/* SECTION D: ADDITIONAL INFORMATION */}
          <section className="bg-white rounded-lg border border-[#e5dac8] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0e8db]">
              <div className="w-6 h-6 rounded bg-[#f7f2eb] border border-[#d6c7b2] flex items-center justify-center text-[#8f6541]">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-[#24160c]">
                D. Additional Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Remark */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Remark
                </label>
                <textarea
                  rows={3}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter operational remarks, special site notes, scaffolding configuration notes, or payment terms..."
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>

              {/* Follow Up Date */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#8f6541]" />
                  <span>Follow Up Date</span>
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md font-mono focus:bg-white focus:outline-none ${
                    followUpStatus.isOverdue
                      ? 'bg-rose-50 border border-rose-400 text-rose-900 focus:ring-1 focus:ring-rose-500'
                      : 'bg-[#fbf9f5] border border-[#d6c7b2] text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541]'
                  }`}
                />
                {followUpDate ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {followUpStatus.isOverdue && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                        Follow-up Overdue
                      </span>
                    )}
                    {followUpStatus.isDueToday && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                        Follow-up Due Today
                      </span>
                    )}
                    {followUpStatus.isAfterRemoval && removalDate && (
                      <span className="text-amber-700 font-medium">
                        Scheduled after Removal Date ({removalDate}) — consider scheduling before removal
                      </span>
                    )}
                  </div>
                ) : removalDate ? (
                  <p className="mt-1 text-[10px] text-[#8c5e39]">
                    Tip: You can schedule a follow-up reminder before the Removal Date ({removalDate}).
                  </p>
                ) : null}
              </div>

              {/* Follow Up Notes */}
              <div>
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Follow Up Notes (Optional)
                </label>
                <input
                  type="text"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="e.g. Call client for balance milestone payment"
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-white border-t border-[#e5dac8] px-5 py-3.5 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#4d301c] bg-white hover:bg-[#faf6ee] border border-[#d8c8b4] rounded-md transition cursor-pointer"
          >
            Cancel
          </button>

          {!isEdit && (
            <button
              type="button"
              disabled={submitting || isOverpaid || rentalDuration.isInvalid}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#24160c] bg-[#f4ece1] hover:bg-[#ebdcc9] border border-[#c79e7c] rounded-md transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-[#8f6541]" />
              )}
              <span>Save & Add Another</span>
            </button>
          )}

          <button
            type="button"
            disabled={submitting || isOverpaid || rentalDuration.isInvalid}
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c79e7c]" />
            ) : (
              <Save className="w-3.5 h-3.5 text-[#c79e7c]" />
            )}
            <span>{isEdit ? 'Save Changes' : 'Save Project'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

