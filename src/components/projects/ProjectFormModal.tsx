'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  User,
  Users,
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
} from 'lucide-react';
import { Customer, Project, ProjectStatus, UserProfile } from '@/lib/schema';
import {
  formatINR,
  calculateScaffoldingArea,
  calculateRentalDurationBreakdown,
  getRemainingDaysInfo,
  getFollowUpStatus,
  getEffectiveRemovalDate,
  getProjectInstallDateStr,
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
  { value: 'BUFFER_PERIOD', label: 'Buffer Period' },
  { value: 'EXTENDED', label: 'Extended' },
  { value: 'SHIFTING_IN_PROGRESS', label: 'Shifting' },
  { value: 'REMOVAL_PENDING', label: 'Removal Pending' },
  { value: 'CLOSED', label: 'Closed' },
];

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
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Section A: Customer & Project Details
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
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
  const [installationDate, setInstallationDate] = useState('');
  const [removalDate, setRemovalDate] = useState('');

  // Section C: Financial Details
  const [totalAmountInput, setTotalAmountInput] = useState<string>('0');
  const [paymentReceivedInput, setPaymentReceivedInput] = useState<string>('0');

  // Section D: Additional Information
  const [remark, setRemark] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Form Submission & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineToast, setInlineToast] = useState<string | null>(null);

  // Load customers & users
  useEffect(() => {
    if (!isOpen) return;
    setLoadingRefs(true);
    Promise.all([
      fetch('/api/customers').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/users').then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([custJson, usersJson]) => {
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
      })
      .finally(() => setLoadingRefs(false));
  }, [isOpen, editingProject]);

  // Populate or reset form values when editingProject or modal open changes
  const resetForm = (defaultSupId?: string) => {
    setSelectedCustomerId('');
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
    setInstallationDate('');
    setRemovalDate('');
    setTotalAmountInput('0');
    setPaymentReceivedInput('0');
    setRemark('');
    setFollowUpDate('');
    setFollowUpNotes('');
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
      setAssignedSupervisorId(editingProject.assignedSupervisorId || '');
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
      setInstallationDate(getProjectInstallDateStr(editingProject));
      setRemovalDate(getEffectiveRemovalDate(editingProject));
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
    } else {
      const defaultSup =
        users.find(u => u.role === 'SUPERVISOR') || users[0];
      resetForm(defaultSup?.id || currentUser?.id || '');
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

  // Derived Rental Duration Calculation: Rental Duration = Date of Removal - Date of Installation
  const rentalDuration = useMemo(
    () => calculateRentalDurationBreakdown(installationDate, removalDate),
    [installationDate, removalDate]
  );

  // Derived Remaining Days & Follow-Up Alerts
  const remainingDaysInfo = useMemo(
    () => getRemainingDaysInfo(removalDate, status),
    [removalDate, status]
  );
  const followUpStatus = useMemo(
    () => getFollowUpStatus(followUpDate, removalDate, status),
    [followUpDate, removalDate, status]
  );

  // Derived Financial Calculations: Balance Amount = Total Amount - Payment Received
  const totalAmount = Math.max(0, Number(totalAmountInput) || 0);
  const paymentReceived = Math.max(0, Number(paymentReceivedInput) || 0);
  const isOverpaid = paymentReceived > totalAmount;
  const balanceAmount = Math.round((totalAmount - paymentReceived) * 100) / 100;

  // Supervisors & Staff lists from users
  const supervisorOptions = useMemo(() => {
    const filtered = users.filter(
      u => u.isActive && (u.role === 'SUPERVISOR' || u.role === 'ADMIN')
    );
    return filtered.length > 0 ? filtered : users;
  }, [users]);

  const staffOptions = useMemo(() => {
    return users.filter(
      u => u.isActive && (u.role === 'WORKER' || u.role === 'SUPERVISOR')
    );
  }, [users]);

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

  const toggleStaffMember = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

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
    if (rentalDuration.isInvalid || (installationDate && removalDate && removalDate < installationDate)) {
      return 'Date of Removal cannot be earlier than Date of Installation.';
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
      const selectedSup = users.find(u => u.id === assignedSupervisorId);
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
            installationDate: installationDate || undefined,
            removalDate: removalDate || undefined,
            rentalDurationMonths: installationDate ? rentalDuration.months : undefined,
            rentalDurationDays: installationDate ? rentalDuration.days : undefined,
            rentalDurationDisplay: rentalDuration.display || undefined,
            totalAmount,
            paymentReceived,
            balanceAmount,
            remark: remark.trim(),
            followUpDate: followUpDate || undefined,
            followUpNotes: followUpNotes.trim(),
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
            installationDate: installationDate || undefined,
            removalDate: removalDate || undefined,
            rentalDurationMonths: installationDate ? rentalDuration.months : undefined,
            rentalDurationDays: installationDate ? rentalDuration.days : undefined,
            rentalDurationDisplay: rentalDuration.display || undefined,
            totalAmount,
            paymentReceived,
            balanceAmount,
            remark: remark.trim(),
            followUpDate: followUpDate || undefined,
            followUpNotes: followUpNotes.trim(),
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
          const defaultSup =
            users.find(u => u.role === 'SUPERVISOR') || users[0];
          resetForm(defaultSup?.id || currentUser?.id || '');
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
              {/* Quick Customer Selector */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#4d301c] mb-1">
                  Select Existing Customer (Optional — or enter new customer below)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectExistingCustomer(e.target.value)}
                  disabled={loadingRefs || submitting}
                  className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                >
                  <option value="">— New / Custom Customer Entry —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.customerCode}) — {c.phone}
                    </option>
                  ))}
                </select>
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
                      {sup.fullName} ({sup.role})
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

              {/* Assign Multiple Staff */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#4d301c] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#8f6541]" />
                    <span>Assign Staff Members (Multi-Select)</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#7d6553]">
                    {selectedStaffIds.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md">
                  {staffOptions.length === 0 ? (
                    <span className="text-stone-400 italic">Loading staff members...</span>
                  ) : (
                    staffOptions.map(staff => {
                      const active = selectedStaffIds.includes(staff.id);
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => toggleStaffMember(staff.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                            active
                              ? 'bg-[#24150c] text-white border-[#4d301c] shadow-2xs'
                              : 'bg-white text-[#4d301c] border-[#d6c7b2] hover:bg-[#f4ece1]'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                              active
                                ? 'bg-[#c79e7c] border-[#c79e7c] text-[#1c120c]'
                                : 'border-[#c7b39b] bg-white'
                            }`}
                          >
                            {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span>{staff.fullName}</span>
                          <span className={`text-[10px] font-mono px-1 rounded ${active ? 'bg-[#382315] text-[#dfcbab]' : 'bg-[#faf6ee] text-[#8c5e39]'}`}>
                            {staff.role}
                          </span>
                        </button>
                      );
                    })
                  )}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status */}
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

              {removalDate && !rentalDuration.isInvalid && (
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

