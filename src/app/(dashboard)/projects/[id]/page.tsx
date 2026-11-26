'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Ruler,
  Camera,
  Boxes,
  Calendar,
  ReceiptIndianRupee,
  History,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Repeat,
  ArrowRightLeft,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  MapPin,
  Tag,
  Check,
  Layers,
  FileText,
  Plus,
  UploadCloud,
  Loader2,
  X,
  Maximize2,
  ImageIcon,
  Sparkles,
  FileDown,
  Ban,
  AlertOctagon,
  Info,
  Edit3
} from 'lucide-react';
import {
  formatINR,
  formatQuantity,
  formatDate,
  formatDateTime,
  getStatusBadgeConfig,
  calculateScaffoldingArea,
  extractProjectDimensions,
  calculateRentalDurationBreakdown,
  getRemainingDaysInfo,
  getFollowUpStatus,
  calculateExtendedRemovalDate,
  getEffectiveRemovalDate,
  getProjectInstallDateStr,
  toDateOnlyString,
  isDateNotApplicableStatus,
} from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage } from '@/lib/image-utils';
import { generateConfirmationPdf, generateInstallationPdf } from '@/lib/pdf/project-pdf';
import { OFFICIAL_TERMS_AND_CONDITIONS } from '@/lib/constants/terms-and-conditions';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';

function formatLongDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const str = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (m >= 0 && m < 12 && !isNaN(d) && !isNaN(y)) {
      return `${String(d).padStart(2, '0')} ${monthNames[m]} ${y}`;
    }
  }
  return formatDate(dateStr);
}

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can, currentUser } = useAuth();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'measurements' | 'photos' | 'materials' | 'rental' | 'billing' | 'timeline'>('overview');
  const [closing, setClosing] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<any | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Rental Action States (Buffer Period & Extend Rental Modal)
  const [configuredBufferDays, setConfiguredBufferDays] = useState<number>(3);
  const [activatingBuffer, setActivatingBuffer] = useState(false);
  const [rentalBanner, setRentalBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Buffer Period Modal States
  const [bufferModalOpen, setBufferModalOpen] = useState(false);
  const [bufferDaysInput, setBufferDaysInput] = useState<string>('3');
  const [bufferReason, setBufferReason] = useState<string>('');
  const [bufferSubmitting, setBufferSubmitting] = useState(false);
  const [bufferError, setBufferError] = useState<string | null>(null);

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendType, setExtendType] = useState<'DAYS' | 'MONTHS'>('MONTHS');
  const [extendValueInput, setExtendValueInput] = useState<string>('1');
  const [extendReason, setExtendReason] = useState<string>('');
  const [extendSubmitting, setExtendSubmitting] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Overview Card 3 PDF Download States
  const [downloadingConfPdf, setDownloadingConfPdf] = useState(false);
  const [downloadingInstPdf, setDownloadingInstPdf] = useState(false);

  const isConfirmed = Boolean(
    project && (
      (project.status !== 'NOT_INSTALLED' && project.status !== 'CANCELLED') ||
      project.quotationNumber ||
      (project.materials && project.materials.some((m: any) => (m.reservedQuantity || 0) > 0 || (m.installedQuantity || 0) > 0))
    )
  );

  const handleDownloadConfirmationPdf = async () => {
    if (!project || !isConfirmed) return;
    setDownloadingConfPdf(true);
    try {
      await generateConfirmationPdf(project);
    } catch (err: any) {
      console.error('Failed to generate Confirmation PDF:', err);
      alert('Failed to generate Confirmation PDF: ' + (err?.message || 'Unknown error occurred'));
    } finally {
      setDownloadingConfPdf(false);
    }
  };

  const handleDownloadInstallationPdf = async () => {
    if (!project || !isInstalled) return;
    setDownloadingInstPdf(true);
    try {
      await generateInstallationPdf(project);
    } catch (err: any) {
      console.error('Failed to generate Installation PDF:', err);
      alert('Failed to generate Installation PDF: ' + (err?.message || 'Unknown error occurred'));
    } finally {
      setDownloadingInstPdf(false);
    }
  };

  const isInstalled = Boolean(
    project && (
      ['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENSION_REQUESTED', 'EXTENDED', 'SHIFTING_PENDING', 'SHIFTING_IN_PROGRESS', 'REMOVAL_PENDING', 'RETURNED_RECONCILIATION', 'CLOSED'].includes(project.status) ||
      project.actualInstallationDate ||
      (project.materials && project.materials.some((m: any) => (m.installedQuantity || 0) > 0))
    )
  );

  const isPreInstallation = Boolean(
    project &&
    !isInstalled &&
    ['SITE_CREATED', 'NOT_INSTALLED', 'QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED', 'CONFIRMED_PROJECT', 'SCHEDULED'].includes(project.status) &&
    project.status !== 'CANCELLED'
  );

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleExecuteCancel = async () => {
    if (!project) return;
    if (!cancelReason || !cancelReason.trim()) {
      setCancelError('Please enter a mandatory cancellation reason.');
      return;
    }
    if (!cancelConfirmed) {
      setCancelError('Please verify and check the confirmation box.');
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason.trim(),
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu (Admin)',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to cancel project');
      }

      setProject(json.data.project);
      setCancelModalOpen(false);
      fetchProjectDetails(); // refresh full workspace details
    } catch (err: any) {
      setCancelError(err.message || 'An error occurred during project cancellation');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenBufferModal = () => {
    if (project?.status === 'BUFFER_PERIOD' || Boolean(project?.bufferEndDate)) {
      setRentalBanner({
        type: 'error',
        text: 'Buffer period is already active for this project.',
      });
      return;
    }
    const defaultDays = Number(project?.configuredBufferDays || configuredBufferDays || 3);
    setBufferDaysInput(String(defaultDays > 0 ? defaultDays : 3));
    setBufferReason('');
    setBufferError(null);
    setBufferModalOpen(true);
  };

  const handleConfirmBufferPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || bufferSubmitting) return;

    const numDays = Number(bufferDaysInput);
    if (!bufferDaysInput.trim() || !Number.isInteger(numDays) || numDays < 1) {
      setBufferError('Please enter a valid positive number of additional days (minimum 1 day).');
      return;
    }

    setBufferSubmitting(true);
    setBufferError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/buffer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedBufferDays: numDays,
          reason: bufferReason.trim() || `Configured ${numDays}-day rental buffer period activated`,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to activate buffer period');
      }

      const updated = json.data?.project;
      const daysApplied = json.data?.bufferRequest?.requestedBufferDays || updated?.bufferDaysApplied || numDays;
      if (updated) {
        setProject((prev: any) => ({ ...prev, ...updated }));
      }
      await fetchProjectDetails();
      setBufferModalOpen(false);
      setRentalBanner({
        type: 'success',
        text: `Buffer Period Active (+${daysApplied} Days). Updated effective removal date: ${formatLongDate(updated?.bufferEndDate || updated?.removalDate)}.`,
      });
    } catch (err: any) {
      setBufferError(err.message || 'Unable to activate buffer period.');
    } finally {
      setBufferSubmitting(false);
    }
  };

  const handleOpenExtendModal = () => {
    setExtendType('MONTHS');
    setExtendValueInput('1');
    setExtendReason('');
    setExtendError(null);
    setExtendModalOpen(true);
  };

  const handleConfirmExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || extendSubmitting) return;

    const numericDuration = Number(extendValueInput);
    if (!extendValueInput.trim() || !Number.isInteger(numericDuration) || numericDuration < 1) {
      setExtendError('Please enter a valid positive whole number (minimum 1) for extension duration.');
      return;
    }

    setExtendSubmitting(true);
    setExtendError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionType: extendType,
          extensionValue: numericDuration,
          extensionReason: extendReason.trim() || undefined,
          monthlyRentalRate: project.monthlyRentalRate || 0,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to extend rental period');
      }

      const updated = json.data?.project;
      if (updated) {
        setProject((prev: any) => ({ ...prev, ...updated }));
      }
      await fetchProjectDetails();
      setExtendModalOpen(false);
      setRentalBanner({
        type: 'success',
        text: `Rental extended by ${numericDuration} ${extendType === 'DAYS' ? (numericDuration === 1 ? 'Day' : 'Days') : (numericDuration === 1 ? 'Month' : 'Months')}. New effective removal date: ${formatDate(updated?.removalDate || updated?.rentalEndDate)}.`,
      });
    } catch (err: any) {
      setExtendError(err.message || 'An error occurred while extending rental period.');
    } finally {
      setExtendSubmitting(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetch('/api/settings')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.bufferDaysDefault) {
          setConfiguredBufferDays(Number(json.data.bufferDaysDefault));
        }
      })
      .catch(() => { });
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = await res.json();
      if (json.success) {
        setProject(json.data);
        if (json.data?.configuredBufferDays) {
          setConfiguredBufferDays(Number(json.data.configuredBufferDays));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProjectPhotos = async (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    setUploadingPhotos(true);
    try {
      const urls = await Promise.all(valid.map(f => processAndUploadImage(f)));
      const validUrls = urls.filter(Boolean);
      if (validUrls.length === 0) return;

      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addPhotos: validUrls,
          stageLabel: project?.status === 'INSTALLED' || project?.status === 'ACTIVE_RENTAL' ? 'AFTER_INSTALLATION' : 'SITE_INSPECTION',
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        fetchProjectDetails();
      } else {
        alert(json.error || 'Failed to attach photos');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error uploading photos: ' + err.message);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleCloseProject = async () => {
    if (!confirm('Close this project and seal historical records? All materials must be reconciled.')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'CLOSED',
          reason: 'All material returns and billing reconciliation finalized',
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProjectDetails();
      } else {
        alert(json.error || 'Failed to close project');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setClosing(false);
    }
  };

  const [releasingReservation, setReleasingReservation] = useState(false);
  const handleReleaseReservation = async () => {
    if (!confirm('Are you sure you want to release the reserved materials back to the warehouse? The project status will revert to NOT_INSTALLED.')) {
      return;
    }
    setReleasingReservation(true);
    try {
      const res = await fetch(`/api/projects/${id}/release-reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          reason: 'Reservation released from project details view',
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProjectDetails();
      } else {
        alert(json.error || 'Failed to release reservation');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReleasingReservation(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="h-40 bg-slate-200 rounded-2xl"></div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-lg font-bold text-slate-800">Project Not Found</div>
        <p className="text-xs text-slate-500">The project identifier '{id}' could not be located in the database.</p>
        <Link href="/projects" className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold">
          Return to Projects Directory
        </Link>
      </div>
    );
  }

  // WORKER restriction: can only see the site he has worked on
  if (currentUser?.role === 'WORKER') {
    const hasWorked = (
      project.assignedWorkerIds?.includes(currentUser.id) ||
      project.installationWorkers?.some((w: any) =>
        w.id === currentUser.id ||
        (w.name && currentUser.fullName && (
          w.name.toLowerCase().trim() === currentUser.fullName.toLowerCase().trim() ||
          currentUser.fullName.toLowerCase().includes(w.name.toLowerCase().trim()) ||
          w.name.toLowerCase().includes(currentUser.fullName.toLowerCase().trim())
        ))
      )
    );

    if (!hasWorked) {
      return (
        <div className="text-center py-20 space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Site Access Restricted</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            As a site worker, you are only authorized to view projects and sites where you have been registered in the installation crew.
          </p>
          <div className="pt-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#8c5e39] hover:bg-[#724a2c] text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to My Worked Sites</span>
            </Link>
          </div>
        </div>
      );
    }
  }

  const badge = getStatusBadgeConfig(project.status);
  const installDate = getProjectInstallDateStr(project);
  const effectiveRemovalDate = getEffectiveRemovalDate(project);
  const effectiveDuration = calculateRentalDurationBreakdown(installDate, effectiveRemovalDate);
  const remainingDaysInfo = getRemainingDaysInfo(effectiveRemovalDate, project.status);
  const followUpStatus = getFollowUpStatus(project.followUpDate, effectiveRemovalDate, project.status);
  const effectiveBufferDays = Number(project.bufferDaysApplied || project.configuredBufferDays || configuredBufferDays || 3);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/projects" className="hover:text-[#24160c] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects Directory</span>
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-stone-800">{project.projectCode}</span>
        <span>/</span>
        <span className="text-stone-600 truncate max-w-xs">{project.customerName}</span>
      </div>

      {/* Rental Action Feedback Banner */}
      {rentalBanner && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-2xs ${rentalBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
        >
          <div className="flex items-center gap-2">
            {rentalBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-semibold">{rentalBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setRentalBanner(null)}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Project Cancelled Banner */}
      {project.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-rose-950 space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-950">
            <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0" />
            <span>This Project Was Cancelled During Pre-installation</span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed pl-7">
            <strong className="text-rose-950">Cancellation Reason:</strong> {project.cancellationReason || 'Pre-installation cancellation'}
          </p>
          <div className="text-[11px] text-rose-800 flex flex-wrap gap-x-6 pl-7 pt-0.5">
            {project.cancelledAt && <span><strong>Cancelled Date:</strong> {formatDateTime(project.cancelledAt)}</span>}
            {project.cancelledByName && <span><strong>Cancelled By:</strong> {project.cancelledByName}</span>}
          </div>
          <div className="text-[11px] text-rose-700 italic pl-7 pt-1 border-t border-rose-200">
            All active scaffolding reservations for this project were automatically released back to available warehouse stock. Complete records, quotations, site forms, and logs remain securely preserved in read-only mode for audit compliance.
          </div>
        </div>
      )}

      {/* Project Master Hero Card */}
      <div className="bg-white rounded-lg border border-[#e8decb] p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-start justify-between gap-5 sm:gap-6">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-[#24160c] tracking-tight">
              {project.projectCode}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border ${badge.className}`}>
              <span className={`w-2 h-2 rounded-full ${badge.dotColor}`} />
              {badge.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs border ${remainingDaysInfo.severity === 'danger' || remainingDaysInfo.severity === 'overdue'
                  ? 'font-bold shadow-2xs'
                  : 'font-semibold'
                } ${remainingDaysInfo.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${remainingDaysInfo.dotClass}`} />
              {remainingDaysInfo.label}
            </span>
            {project.status === 'BUFFER_PERIOD' && (
              <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#fbf7f0] text-[#78350f] border border-[#d6b692]">
                Buffer Period Active (+{effectiveBufferDays}d · Expiry: {formatDate(effectiveRemovalDate)})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-600">
            <div className="flex items-center gap-1.5 font-semibold text-stone-900">
              <Building2 className="w-4 h-4 text-[#8f6541] shrink-0" />
              <span>{project.customerName}</span>
            </div>
            <span className="text-stone-300">•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
              <span>{project.siteName}</span>
            </div>
            <span className="text-stone-300">•</span>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-stone-400 shrink-0" />
              <span>Supervisor: {project.supervisorName}</span>
              {project.supervisorPhone && (
                <span className="font-mono text-stone-500 text-xs">({project.supervisorPhone})</span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Action Buttons & Customer PDF Downloads */}
        <div className="flex flex-col sm:items-end justify-center gap-2.5 w-full lg:w-auto shrink-0">
          {/* Row 1: Workflow Lifecycle Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            {/* Status SITE_CREATED / NOT_INSTALLED / QUOTATION_* -> Quotation & Confirm Actions */}
            {['SITE_CREATED', 'NOT_INSTALLED', 'QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED'].includes(project.status) && (
              <Link
                href={`/quotation?projectId=${project.id}`}
                className="w-full sm:w-auto h-9 px-3.5 bg-[#fbf9f5] hover:bg-[#f3ebe1] text-[#24160c] border border-[#ebdcc9] rounded-md text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#8c5e39]" />
                <span>Commercial Quotation</span>
              </Link>
            )}

            {/* Unconfirmed Project -> Confirm Action (Strictly eligible only when Quotation is Accepted) */}
            {project.status === 'QUOTATION_ACCEPTED' && can('PROJECT_CONFIRM') && (
              <Link
                href={`/projects/${project.id}/confirm`}
                className="w-full sm:w-auto h-9 px-4 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Project & Reserve Stock</span>
              </Link>
            )}

            {/* Status CONFIRMED_PROJECT -> Install Action */}
            {(project.status === 'CONFIRMED_PROJECT' || project.status === 'SCHEDULED') && can('PROJECT_INSTALL_SUBMIT') && (
              <Link
                href={`/projects/${project.id}/install`}
                className="w-full sm:w-auto h-9 px-4 bg-[#24160c] hover:bg-[#382315] text-white border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <Boxes className="w-3.5 h-3.5 text-[#c79e7c]" />
                <span>Record Installation & Activate Rental</span>
              </Link>
            )}

            {/* Cancel Project Button (Pre-installation only) */}
            {isPreInstallation && can('PROJECT_CLOSE') && (
              <button
                type="button"
                onClick={() => {
                  setCancelReason('');
                  setCancelConfirmed(false);
                  setCancelError(null);
                  setCancelModalOpen(true);
                }}
                className="w-full sm:w-auto h-9 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-md text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Cancel Pre-installation Project"
              >
                <Ban className="w-3.5 h-3.5 text-rose-700" />
                <span>Cancel Project</span>
              </button>
            )}

            {/* Active Rental Operations: Buffer Period, Extend Rental, Shift Scaffolding, Dismantle */}
            {['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED', 'REMOVAL_PENDING'].includes(project.status) && (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                {can('PROJECT_BUFFER_REQUEST') && (
                  project.status === 'BUFFER_PERIOD' || Boolean(project.bufferEndDate) ? (
                    <button
                      type="button"
                      disabled
                      title="Buffer period is already active for this project"
                      className="h-9 px-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Buffer Period Active (+{effectiveBufferDays} Days)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenBufferModal}
                      title="Open Buffer Period modal to configure additional days"
                      className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#78350f] border border-[#ebdcc9] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#8f6541]" />
                      <span>Buffer Period Active</span>
                    </button>
                  )
                )}

                {can('PROJECT_EXTEND') && (
                  <button
                    type="button"
                    onClick={handleOpenExtendModal}
                    className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#714f36] border border-[#ebdcc9] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5 text-[#8f6541]" />
                    <span>Extend Rental</span>
                  </button>
                )}

                {can('PROJECT_SHIFT') && (
                  <Link
                    href={`/projects/${project.id}/shift`}
                    className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-stone-800 border border-[#ebdcc9] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-stone-600" />
                    <span>Shift Scaffolding</span>
                  </Link>
                )}

                {can('PROJECT_DISMANTLE_SUBMIT') && (
                  <Link
                    href={`/projects/${project.id}/dismantle`}
                    className="h-9 px-3.5 bg-rose-700 hover:bg-rose-800 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Dismantle</span>
                  </Link>
                )}
              </div>
            )}

            {/* Close Project */}
            {project.status === 'RETURNED_RECONCILIATION' && can('PROJECT_CLOSE') && (
              <button
                onClick={handleCloseProject}
                disabled={closing}
                className="w-full sm:w-auto h-9 px-4 bg-[#24160c] hover:bg-[#382315] text-white rounded-md text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-[#c79e7c]" />
                <span>{closing ? 'Closing Project...' : 'Finalize Closure'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-[#e8decb] text-xs font-medium overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'overview'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <Building2 className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('measurements')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'measurements'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <Ruler className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Site Dimensions</span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'photos'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <Camera className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Photographs ({project.photos?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'materials'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <Boxes className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Materials & Site Stock ({project.materials?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('rental')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'rental'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Rental Schedule & Extensions</span>
        </button>

        {can('BILLING_VIEW') && (
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'billing'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
          >
            <ReceiptIndianRupee className="w-3.5 h-3.5 text-[#8f6541]" />
            <span>Invoices & Billing ({project.invoices?.length || 0})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${activeTab === 'timeline'
            ? 'border-[#8f6541] text-[#24160c] font-bold'
            : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
        >
          <History className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Audit Activity Timeline ({project.activity?.length || 0})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Key Quotation & Pricing Summary */}
          <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
              <h3 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                Commercial Terms & Pricing
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-[11px] font-semibold text-[#714f36] bg-[#fbf7f0] hover:bg-[#f4ebe1] border border-[#ebdcc9] px-2 py-0.5 rounded cursor-pointer transition"
              >
                11 Terms §
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Quotation Reference</span>
                <span className="font-mono font-semibold text-stone-800">{project.quotationNumber || 'Pending Confirmation'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">
                  Rental Cycle Rate
                  <span className="text-[10px] text-stone-400 block font-normal">Term 2: 28 Days / Month</span>
                </span>
                <span className="font-mono font-bold text-[#714f36] text-sm">
                  {project.monthlyRentalRate > 0 ? formatINR(project.monthlyRentalRate) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Total Agreed Price</span>
                <span className="font-mono font-bold text-stone-900">
                  {project.agreedProjectPrice > 0 ? formatINR(project.agreedProjectPrice) : '-'}
                </span>
              </div>
              {(() => {
                const dims = extractProjectDimensions(project);
                if (dims.elevationAreaSqFt <= 0) return null;
                return (
                  <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-[#fbf9f5] px-2 rounded">
                    <span className="text-stone-700 font-semibold">Billable Façade Area (Term 1)</span>
                    <span className="font-mono font-bold text-stone-900">
                      {dims.formattedArea} {project.ratePerSqFt ? `(@ ₹${project.ratePerSqFt}/sq. ft.)` : ''}
                    </span>
                  </div>
                );
              })()}
              <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-[#fbf7f0] px-2 rounded">
                <span className="text-[#714f36] font-semibold">
                  75% Advance (Term 7)
                  <span className="text-[10px] text-stone-500 font-normal block">Required before installation</span>
                </span>
                <span className="font-mono font-bold text-[#24160c]">
                  {formatINR(project.advanceRequiredAmount || Math.round((project.agreedProjectPrice || 0) * 0.75))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] px-2">
                <span className="text-stone-600">
                  25% Completion Balance
                  <span className="text-[10px] text-stone-400 font-normal block">Payable after installation</span>
                </span>
                <span className="font-mono font-bold text-stone-800">
                  {formatINR(project.completionDueAmount || Math.round((project.agreedProjectPrice || 0) * 0.25))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">
                  Transportation (Term 3)
                  <span className="text-[10px] text-stone-400 font-normal block">2-Way (Delivery & Return)</span>
                </span>
                <span className="font-mono text-stone-800">{formatINR((project.twoWayTransportCharges || project.transportCharges || 0) * 2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">
                  Walkway Jali (Term 4)
                  <span className="text-[10px] text-stone-400 font-normal block">1 included per unit</span>
                </span>
                <span className="font-mono text-stone-800">
                  {project.extraJaliQuantity > 0 ? `+${project.extraJaliQuantity} extra (₹${project.extraJaliCharges || project.extraJaliQuantity * 200})` : 'Standard Included'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500">Applicable GST Rate</span>
                <span className="font-mono font-semibold text-stone-800">{project.gstPercentage || 18}% (Standard CGST+SGST)</span>
              </div>
            </div>
          </div>

          {/* Rental Operational Dates */}
          <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
              <h3 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                Operational Dates & Timelines
              </h3>
              {can('PROJECT_CREATE_INSPECTION') && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#714f36] bg-[#faf6ee] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Details</span>
                </button>
              )}
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Planned Installation</span>
                <span className="font-mono text-stone-800">
                  {isDateNotApplicableStatus(project.status) || !(project.plannedInstallationDate || project.installationDate)
                    ? 'N/A'
                    : formatDate(project.plannedInstallationDate || project.installationDate)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Actual Installation</span>
                <span className="font-mono text-stone-800">
                  {isDateNotApplicableStatus(project.status) || !(project.actualInstallationDate || project.installationDate)
                    ? 'N/A'
                    : formatDate(project.actualInstallationDate || project.installationDate)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Rental Start Date</span>
                <span className="font-mono font-semibold text-[#714f36]">
                  {isDateNotApplicableStatus(project.status) || !(project.rentalStartDate || project.installationDate)
                    ? 'N/A'
                    : formatDate(project.rentalStartDate || project.installationDate)}
                </span>
              </div>
              {(project.originalRemovalDate || project.originalRentalEndDate) &&
                toDateOnlyString(project.originalRemovalDate || project.originalRentalEndDate) !== toDateOnlyString(effectiveRemovalDate) && (
                  <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                    <span className="text-stone-500">Original Removal Date</span>
                    <span className="font-mono text-stone-600">
                      {isDateNotApplicableStatus(project.status)
                        ? 'N/A'
                        : formatDate(project.originalRemovalDate || project.originalRentalEndDate)}
                    </span>
                  </div>
                )}
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Removal / Expiry Date</span>
                <span className="font-mono font-semibold text-stone-900">
                  {isDateNotApplicableStatus(project.status) || !effectiveRemovalDate
                    ? 'N/A'
                    : formatDate(effectiveRemovalDate)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db]">
                <span className="text-stone-500">Remaining Days</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] border ${remainingDaysInfo.severity === 'danger' || remainingDaysInfo.severity === 'overdue'
                      ? 'font-bold'
                      : 'font-semibold'
                    } ${remainingDaysInfo.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${remainingDaysInfo.dotClass}`} />
                  <span>{remainingDaysInfo.label}</span>
                </span>
              </div>
              {effectiveDuration.display && (
                <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-[#fbf7f0] px-2 rounded">
                  <span className="text-[#714f36] font-semibold">Rental Duration</span>
                  <span className="font-mono font-bold text-[#24160c]">{effectiveDuration.display}</span>
                </div>
              )}
              {project.bufferEndDate && (
                <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-amber-50/70 px-2 rounded border border-amber-200/80">
                  <span className="text-amber-900 font-semibold">
                    Buffer Period Expiry (+{effectiveBufferDays}d)
                  </span>
                  <span className="font-mono font-bold text-amber-950">{formatDate(project.bufferEndDate)}</span>
                </div>
              )}
              <div className="flex justify-between items-start gap-2 py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500 shrink-0">Follow-up Date</span>
                <div className="text-right">
                  {project.followUpDate ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 font-mono font-semibold">
                        <span className={followUpStatus.isOverdue || followUpStatus.isDueToday ? 'text-rose-700' : 'text-[#714f36]'}>
                          {formatDate(project.followUpDate)}
                        </span>
                        {followUpStatus.isOverdue && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[9px] font-sans font-bold uppercase">
                            Overdue
                          </span>
                        )}
                        {followUpStatus.isDueToday && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-sans font-bold uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      {project.followUpNotes && (
                        <div className="text-[11px] text-stone-500 mt-0.5">{project.followUpNotes}</div>
                      )}
                    </>
                  ) : (
                    <span className="font-mono text-stone-400">Not Scheduled</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500">Actual Dismantling Date</span>
                <span className="font-mono text-stone-800">{formatDate(project.actualDismantlingDate)}</span>
              </div>
            </div>
          </div>

          {/* Quick Health & Inspection Summary + Customer Document Handover */}
          <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c]">
                  Site Inspection & Details
                </h3>
                {can('PROJECT_CREATE_INSPECTION') && (
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#714f36] bg-[#faf6ee] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded transition cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                  <div className="font-semibold text-stone-800">Site Dimensions:</div>
                  <div className="font-mono text-[#714f36] font-bold mt-0.5">
                    {extractProjectDimensions(project).formattedDimensions}
                  </div>
                  <div className="text-[11px] text-[#8c5e39] font-mono font-semibold mt-0.5">
                    Elevation Area: {extractProjectDimensions(project).formattedArea}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Type: {project.measurements?.measurementType?.replace(/_/g, ' ') || 'Façade Scaffold'}
                  </div>
                </div>

                {project.siteRemarks && (
                  <div className="p-2.5 bg-[#fbf9f5] rounded-md border border-[#ede3d4] text-[11px] text-stone-600">
                    <span className="font-semibold text-stone-800">Remarks: </span>
                    {project.siteRemarks}
                  </div>
                )}
              </div>
            </div>

            {/* Official Customer Handover PDF summary in Card 3 */}
            <div className="pt-3 border-t border-[#f0e8db] space-y-2">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center justify-between">
                <span>Official Customer PDFs</span>
                <span className="font-mono text-[10px] text-stone-400 font-normal">Direct Downloads</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs p-2.5 rounded-md bg-[#fbf9f5] border border-[#ede3d4]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                    <span className="text-stone-800 font-medium">Confirmation PDF</span>
                  </div>
                  {isConfirmed ? (
                    <button
                      onClick={handleDownloadConfirmationPdf}
                      disabled={downloadingConfPdf}
                      className="px-2.5 py-1 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition active:scale-95"
                    >
                      {downloadingConfPdf ? <Loader2 className="w-3 h-3 animate-spin text-[#c79e7c]" /> : <FileDown className="w-3 h-3 text-[#c79e7c]" />}
                      <span>{downloadingConfPdf ? 'Generating...' : 'Download'}</span>
                    </button>
                  ) : (
                    <span className="text-stone-400 text-[11px] font-medium bg-stone-100 px-2 py-0.5 rounded">Pending Confirmation</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs p-2.5 rounded-md bg-[#fbf7f0] border border-[#ebdcc9]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#8f6541] shrink-0" />
                    <span className="text-stone-900 font-medium">Installation PDF</span>
                  </div>
                  {isInstalled ? (
                    <button
                      onClick={handleDownloadInstallationPdf}
                      disabled={downloadingInstPdf}
                      className="px-2.5 py-1 bg-[#382315] hover:bg-[#4a301e] text-[#f7e7d7] rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition active:scale-95"
                    >
                      {downloadingInstPdf ? <Loader2 className="w-3 h-3 animate-spin text-[#c79e7c]" /> : <FileDown className="w-3 h-3 text-[#c79e7c]" />}
                      <span>{downloadingInstPdf ? 'Generating...' : 'Download'}</span>
                    </button>
                  ) : (
                    <span className="text-stone-400 text-[11px] font-medium bg-stone-100 px-2 py-0.5 rounded">Pending Installation</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SITE MEASUREMENTS */}
      {activeTab === 'measurements' && (
        <div className="bg-white p-6 rounded-lg border border-[#e8decb] shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
            <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
              <Ruler className="w-4 h-4 text-[#8f6541]" />
              <span>Inspection Engineering & Actual Installed Dimensions</span>
            </h2>
            {project.actualMeasurements && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border ${project.actualMeasurements.isCorrect
                ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]'
                : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}>
                {project.actualMeasurements.isCorrect ? '✓ Actual Size Verified (100% Match)' : `⚠ Variance: ${project.actualMeasurements.variancePercentage || 0}%`}
              </span>
            )}
          </div>

          {/* Planned Dimensions */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">1. Planned Site Inspection Dimensions</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                <div className="text-xs text-stone-500 font-medium">Width</div>
                <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                  {project.measurements?.width || project.measurements?.length || 0} <span className="text-xs text-stone-500 font-normal">{project.measurements?.unit === 'METERS' ? 'm' : 'ft'}</span>
                </div>
              </div>

              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                <div className="text-xs text-stone-500 font-medium">Depth</div>
                <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                  {project.measurements?.depth !== undefined ? project.measurements.depth : 3} <span className="text-xs text-stone-500 font-normal">{project.measurements?.unit === 'METERS' ? 'm' : 'ft'}</span>
                </div>
              </div>

              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                <div className="text-xs text-stone-500 font-medium">Height</div>
                <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                  {project.measurements?.height || 0} <span className="text-xs text-stone-500 font-normal">{project.measurements?.unit === 'METERS' ? 'm' : 'ft'}</span>
                </div>
              </div>

              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                <div className="text-xs text-stone-500 font-medium">Calculated Elevation Area</div>
                <div className="text-2xl font-bold font-mono text-[#714f36] mt-1">
                  {extractProjectDimensions(project).formattedArea}
                </div>
              </div>
            </div>
          </div>

          {/* Actual Installed Dimensions (if recorded) */}
          {project.actualMeasurements && (
            <div className="pt-2 border-t border-[#f0e8db]">
              <div className="text-xs font-bold uppercase tracking-wider text-[#714f36] mb-2 flex items-center justify-between">
                <span>2. Actual Installed Dimensions Verified On Site</span>
                <span className="text-[10px] text-stone-500 font-normal">
                  Verified by: {project.actualMeasurements.verifiedBy || 'Supervisor'} on {formatDate(project.actualMeasurements.verifiedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-[#fbf7f0] rounded-md border border-[#ebdcc9]">
                  <div className="text-xs text-[#714f36] font-medium">Actual Length</div>
                  <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                    {project.actualMeasurements.length} <span className="text-xs text-stone-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fbf7f0] rounded-md border border-[#ebdcc9]">
                  <div className="text-xs text-[#714f36] font-medium">Actual Width</div>
                  <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                    {project.actualMeasurements.width} <span className="text-xs text-stone-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fbf7f0] rounded-md border border-[#ebdcc9]">
                  <div className="text-xs text-[#714f36] font-medium">Actual Height</div>
                  <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
                    {project.actualMeasurements.height} <span className="text-xs text-stone-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fbf7f0] rounded-md border border-[#ebdcc9]">
                  <div className="text-xs text-[#714f36] font-medium">Actual Surface Area</div>
                  <div className="text-2xl font-bold font-mono text-[#714f36] mt-1">
                    {(project.actualMeasurements.length * project.actualMeasurements.height).toFixed(1)} <span className="text-xs text-stone-500 font-normal">sq.m</span>
                  </div>
                </div>
              </div>

              {project.actualMeasurements.remarks && (
                <div className="mt-3 p-3 bg-[#fbf9f5] border border-[#ede3d4] rounded-md text-xs text-stone-700">
                  <span className="font-semibold text-stone-900">Dimension Notes / Field Variance: </span>
                  {project.actualMeasurements.remarks}
                </div>
              )}
            </div>
          )}

          {/* Supervisor in Charge & Workers Crew Information */}
          {(project.installationSupervisor || (project.installationWorkers && project.installationWorkers.length > 0)) && (
            <div className="pt-2 border-t border-[#f0e8db] space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-700">3. Installation Supervision & Erection Crew</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {project.installationSupervisor && (
                  <div className="p-3.5 bg-[#fbf9f5] rounded-md border border-[#ede3d4] space-y-2">
                    <div className="font-bold text-stone-800 flex items-center justify-between">
                      <span>Supervisor in Charge Check</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${project.installationSupervisor.isSameSupervisor
                        ? 'bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9]'
                        : 'bg-amber-100 text-amber-800'
                        }`}>
                        {project.installationSupervisor.isSameSupervisor ? '✓ Assigned Supervisor' : '⚠ Delegated Substitute'}
                      </span>
                    </div>
                    <div className="text-stone-600">
                      <div>Assigned: <strong>{project.installationSupervisor.assignedSupervisorName}</strong></div>
                      <div>Executing: <strong>{project.installationSupervisor.executingSupervisorName}</strong></div>
                      {project.installationSupervisor.delegationRemarks && (
                        <div className="mt-1 text-[11px] text-stone-500 italic">
                          "{project.installationSupervisor.delegationRemarks}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {project.installationWorkers && project.installationWorkers.length > 0 && (
                  <div className="p-3.5 bg-[#fbf9f5] rounded-md border border-[#ede3d4] space-y-2">
                    <div className="font-bold text-stone-800 flex items-center justify-between">
                      <span>Erection Workers & Riggers</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-200 text-stone-700 font-mono">
                        {project.installationWorkers.length} Riggers
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.installationWorkers.map((w: { id?: string; name: string; role: string }) => (
                        <span key={w.id || w.name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#d6c7b2] rounded text-stone-800 text-[11px]">
                          <strong>{w.name}</strong>
                          <span className="text-stone-400 font-medium">({w.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4] text-xs space-y-2">
            <div className="font-bold text-stone-800">Scaffolding Technical Classification:</div>
            <div className="text-stone-600">
              {project.measurements?.description || 'Standard heavy duty tubular façade staging with cup-lock nodes at 500mm spacing.'}
            </div>
            <div className="text-[11px] text-stone-400 font-mono pt-2 border-t border-[#ede3d4]">
              Initial inspection measured by: {project.measurements?.measuredBy || project.supervisorName} on {formatDate(project.measurements?.measuredAt)}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PHOTOGRAPHS */}
      {activeTab === 'photos' && (
        <div className="bg-white p-6 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUploadProjectPhotos(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0e8db] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#8f6541]" />
                <span>Project Photographic Records</span>
                {(project.photos || []).length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9]">
                    {project.photos.length} photos
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500">Site inspection, installation quality, shifting, and dismantling condition proof</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhotos}
                className="px-3.5 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                {uploadingPhotos ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c79e7c]" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 text-[#c79e7c]" />
                    <span>Upload Site Photos</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(project.photos || []).length === 0 ? (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="col-span-3 text-center py-12 px-4 border-2 border-dashed border-[#d6c7b2] hover:border-[#8f6541] rounded-lg cursor-pointer bg-[#fbf9f5] hover:bg-[#fbf7f0] transition group"
              >
                <UploadCloud className="w-8 h-8 text-stone-400 group-hover:text-[#8f6541] mx-auto mb-2 transition" />
                <div className="text-xs font-bold text-stone-700">No photographs uploaded yet</div>
                <div className="text-[11px] text-stone-400 mt-1">Click here to upload site inspection or installation photos</div>
              </div>
            ) : (
              project.photos.map((photo: any) => (
                <div
                  key={photo.id}
                  className="rounded-md overflow-hidden border border-[#e8decb] bg-stone-900 group shadow-2xs cursor-pointer hover:border-[#8f6541] transition"
                  onClick={() => setPreviewPhoto(photo)}
                >
                  <div className="aspect-video relative overflow-hidden bg-stone-900">
                    <img
                      src={photo.fileUrl}
                      alt={photo.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="p-1.5 bg-black/60 rounded-full text-white shadow-sm">
                        <Maximize2 className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[#140b06]/80 text-[#dfcbab] backdrop-blur-xs font-mono border border-[#382315]">
                      {photo.stageLabel?.replace(/_/g, ' ') || photo.entityType}
                    </div>
                  </div>
                  <div className="p-2.5 text-xs bg-white">
                    <div className="font-medium text-stone-800 truncate flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{photo.fileName}</span>
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5 flex justify-between">
                      <span>By: {photo.uploaderName || 'Supervisor'}</span>
                      <span>{formatDate(photo.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Lightbox Modal */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-50 bg-[#140b06]/85 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
            >
              <div
                className="relative max-w-4xl w-full bg-stone-950 rounded-lg overflow-hidden shadow-2xl border border-[#523622]"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-3 bg-[#19100a] border-b border-[#382315] flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#c79e7c]" />
                    <span className="font-semibold text-stone-200">{previewPhoto.fileName}</span>
                    <span className="px-2 py-0.5 bg-[#24160c] border border-[#382315] rounded text-[10px] text-[#c79e7c]">
                      {previewPhoto.stageLabel?.replace(/_/g, ' ') || 'SITE PHOTO'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="p-1 rounded text-stone-400 hover:text-white hover:bg-[#24160c] transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
                  <img src={previewPhoto.fileUrl} alt={previewPhoto.fileName} className="max-w-full max-h-[75vh] object-contain" />
                </div>
                <div className="p-3 bg-[#19100a] border-t border-[#382315] flex items-center justify-between text-xs text-stone-400">
                  <span>Uploaded by: <strong className="text-white">{previewPhoto.uploaderName || 'Supervisor'}</strong> on {formatDate(previewPhoto.createdAt)}</span>
                  <a
                    href={previewPhoto.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#c79e7c] hover:text-[#dfcbab] flex items-center gap-1 font-medium"
                  >
                    <span>Open original in new tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0e8db] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#24160c]">Materials Allocation & Physical Inventory Count</h2>
              <p className="text-xs text-stone-500">Reserved, installed on site, returned, damaged, and missing scaffolding inventory</p>
            </div>
            <div className="flex items-center gap-2">
              {project.status === 'CONFIRMED_PROJECT' && can('PROJECT_CONFIRM') && (
                <button
                  type="button"
                  onClick={handleReleaseReservation}
                  disabled={releasingReservation}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold shadow-xs transition"
                >
                  {releasingReservation ? 'Releasing...' : 'Release Stock Reservation'}
                </button>
              )}
              {project.status === 'NOT_INSTALLED' && can('PROJECT_CONFIRM') && (
                <Link
                  href={`/projects/${project.id}/confirm`}
                  className="px-3 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition"
                >
                  + Add Material Requirements
                </Link>
              )}
            </div>
          </div>

          {project.scaffoldingPlan && (
            <div className="p-4 bg-[#fbf9f5] border border-[#ede3d4] rounded-md space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#24160c]">{project.scaffoldingPlan.planName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ebdcc9] text-[#24160c]">
                    {project.scaffoldingPlan.badge}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-[#714f36]">
                  {project.scaffoldingPlan.configurationSummary.dimensions.length} × {project.scaffoldingPlan.configurationSummary.dimensions.width} × {project.scaffoldingPlan.configurationSummary.dimensions.height} {project.scaffoldingPlan.configurationSummary.dimensions.unit}
                </div>
              </div>
              <p className="text-xs text-stone-600">{project.scaffoldingPlan.description}</p>
              <div className="flex flex-wrap gap-4 pt-2 border-t border-[#ede3d4] text-xs font-mono">
                <div>
                  <span className="text-stone-500 font-sans">Bays × Lifts: </span>
                  <strong className="text-stone-900">{project.scaffoldingPlan.configurationSummary.totalBays} Bays × {project.scaffoldingPlan.configurationSummary.totalLifts} Lifts</strong>
                </div>
                <div>
                  <span className="text-stone-500 font-sans">Vertical Standards: </span>
                  <strong className="text-stone-900">{project.scaffoldingPlan.configurationSummary.totalVerticalStandardsGrid} Lines</strong>
                </div>
                <div>
                  <span className="text-stone-500 font-sans">Total Pieces: </span>
                  <strong className="text-stone-900">{project.scaffoldingPlan.totals.totalPieces} NOS</strong>
                </div>
                <div>
                  <span className="text-stone-500 font-sans">Tare Weight: </span>
                  <strong className="text-stone-900">{(project.scaffoldingPlan.totals.totalWeightKg / 1000).toFixed(2)} Tonnes</strong>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Materials Card List */}
          <div className="block md:hidden divide-y divide-[#f0e8db]">
            {(project.materials || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400">
                No materials assigned yet.
              </div>
            ) : (
              project.materials.map((mat: any) => (
                <div key={mat.id} className="py-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#24160c]">{mat.materialName}</span>
                    <span className="font-mono text-[11px] text-stone-500 font-bold">{mat.itemCode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-[#fbf9f5] p-2.5 rounded-md border border-[#ede3d4] text-center font-mono text-[11px]">
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Required</span>
                      <span className="font-bold text-stone-800">{mat.requiredQuantity} {mat.unit}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Reserved</span>
                      <span className="font-bold text-[#714f36]">{mat.reservedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Installed</span>
                      <span className="font-bold text-[#24160c]">{mat.installedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Returned</span>
                      <span className="font-bold text-stone-700">{mat.returnedUsableQuantity}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Damaged</span>
                      <span className="font-bold text-amber-700">{mat.returnedDamagedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Missing</span>
                      <span className="font-bold text-rose-700">{mat.missingQuantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-500">Monthly Rental:</span>
                    <span className="font-mono font-bold text-stone-900">{formatINR(mat.monthlyRentalRate)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Materials Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                <tr>
                  <th className="px-4 py-2.5">Material Name</th>
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5 text-center">Required</th>
                  <th className="px-4 py-2.5 text-center">Reserved</th>
                  <th className="px-4 py-2.5 text-center font-bold text-[#24160c]">Installed (On Site)</th>
                  <th className="px-4 py-2.5 text-center">Returned Usable</th>
                  <th className="px-4 py-2.5 text-center text-amber-700">Damaged</th>
                  <th className="px-4 py-2.5 text-center text-rose-700">Missing</th>
                  <th className="px-4 py-2.5 text-right">Rental Rate/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db] font-mono">
                {(project.materials || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-stone-400 font-sans">
                      No materials assigned yet. Materials will be allocated during Project Confirmation.
                    </td>
                  </tr>
                ) : (
                  project.materials.map((mat: any) => (
                    <tr key={mat.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-sans font-medium text-stone-900">
                        {mat.materialName}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-[11px]">
                        {mat.itemCode}
                      </td>
                      <td className="px-4 py-3 text-center">{mat.requiredQuantity} {mat.unit}</td>
                      <td className="px-4 py-3 text-center text-[#714f36]">{mat.reservedQuantity}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#24160c] bg-[#fbf7f0]">
                        {mat.installedQuantity}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-700">{mat.returnedUsableQuantity}</td>
                      <td className="px-4 py-3 text-center text-amber-700">{mat.returnedDamagedQuantity}</td>
                      <td className="px-4 py-3 text-center text-rose-700 font-bold">{mat.missingQuantity}</td>
                      <td className="px-4 py-3 text-right text-stone-900 font-medium">
                        {formatINR(mat.monthlyRentalRate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: RENTAL & DATES */}
      {activeTab === 'rental' && (
        <div className="bg-white p-5 sm:p-6 rounded-lg border border-[#e8decb] shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0e8db] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#24160c]">Rental Term, Buffer & Extension History</h2>
              <p className="text-xs text-stone-500">Synchronized effective removal dates, rental duration, buffer periods, and extension audit log</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['INSTALLED', 'ACTIVE_RENTAL', 'EXTENDED'].includes(project.status) &&
                !project.bufferEndDate &&
                can('PROJECT_BUFFER_REQUEST') && (
                  <button
                    type="button"
                    onClick={handleOpenBufferModal}
                    className="px-3.5 py-1.5 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#78350f] border border-[#ebdcc9] rounded-md text-xs font-semibold transition cursor-pointer"
                  >
                    Activate Buffer
                  </button>
                )}
              {['ACTIVE_RENTAL', 'INSTALLED', 'EXTENDED', 'BUFFER_PERIOD', 'REMOVAL_PENDING'].includes(project.status) &&
                can('PROJECT_EXTEND') && (
                  <button
                    type="button"
                    onClick={handleOpenExtendModal}
                    className="px-3.5 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    + Extend Rental
                  </button>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Installation / Start Date</div>
              <div className="text-base font-bold font-mono text-stone-900 mt-1">
                {isDateNotApplicableStatus(project.status) || !installDate ? 'N/A' : formatDate(installDate)}
              </div>
            </div>
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Original Removal Date</div>
              <div className="text-base font-bold font-mono text-stone-700 mt-1">
                {isDateNotApplicableStatus(project.status)
                  ? 'N/A'
                  : (project.originalRemovalDate || project.originalRentalEndDate || effectiveRemovalDate)
                    ? formatDate(project.originalRemovalDate || project.originalRentalEndDate || effectiveRemovalDate)
                    : 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Effective Removal Date</div>
              <div className="text-base font-bold font-mono text-[#714f36] mt-1">
                {isDateNotApplicableStatus(project.status) || !effectiveRemovalDate ? 'N/A' : formatDate(effectiveRemovalDate)}
              </div>
              {project.status === 'BUFFER_PERIOD' && project.bufferEndDate && (
                <div className="text-[11px] font-semibold text-amber-800 mt-1">
                  Buffer Period Active (+{effectiveBufferDays} Days)
                </div>
              )}
            </div>
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Rental Duration & Remaining</div>
              <div className="text-sm font-bold font-mono text-[#24160c] mt-1">
                {isDateNotApplicableStatus(project.status) ? 'N/A' : (effectiveDuration.display || '—')}
              </div>
              <div className="mt-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border ${remainingDaysInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${remainingDaysInfo.dotClass}`} />
                  <span>{remainingDaysInfo.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Complete Rental History & Audit Tracking */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Rental History & Audit Tracking</h3>
            {(project.rentalHistory || []).length === 0 && (project.extensions || []).length === 0 && (project.buffers || []).length === 0 ? (
              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4] text-xs text-stone-400 text-center">
                No buffer periods or extensions recorded yet. Project is running on its original schedule.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(project.rentalHistory || []).map((entry: any) => {
                  const unitText =
                    entry.addedUnit === 'DAYS'
                      ? `${entry.addedValue} ${entry.addedValue === 1 ? 'Day' : 'Days'}`
                      : `${entry.addedValue} ${entry.addedValue === 1 ? 'Month' : 'Months'}`;
                  const isBuffer = entry.actionType === 'BUFFER_PERIOD';
                  const isManual = entry.actionType === 'MANUAL_DATE_UPDATE';
                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 bg-[#fbf9f5] rounded-md border border-[#ebdcc9] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isBuffer
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : isManual
                                  ? 'bg-stone-100 text-stone-800 border-stone-300'
                                  : 'bg-[#f4ebe1] text-[#714f36] border-[#d6b692]'
                              }`}
                          >
                            {isBuffer ? 'Buffer Period' : isManual ? 'Manual Date Edit' : 'Extend Rental'}
                          </span>
                          {entry.addedValue > 0 && (
                            <span className="font-mono font-bold text-[#24160c]">
                              +{unitText}
                            </span>
                          )}
                        </div>
                        <div className="text-stone-700 font-mono text-[11px]">
                          Previous: <span className="font-semibold">{formatDate(entry.previousRemovalDate)}</span>
                          {' → '}
                          New Effective Date: <span className="font-bold text-[#24160c]">{formatDate(entry.newRemovalDate)}</span>
                          <span className="text-stone-400 ml-2">(Original: {formatDate(entry.originalRemovalDate)})</span>
                        </div>
                        {entry.reason && (
                          <div className="text-[11px] text-stone-500">Note: {entry.reason}</div>
                        )}
                      </div>
                      <div className="sm:text-right text-[11px] text-stone-500 shrink-0">
                        <div className="font-semibold text-stone-800">{entry.changedByName || 'Admin'}</div>
                        <div className="font-mono text-[10px] text-stone-400">{formatDateTime(entry.changedAt)}</div>
                      </div>
                    </div>
                  );
                })}

                {/* Legacy Extensions Fallback (if project had extensions prior to rentalHistory) */}
                {(project.rentalHistory || []).length === 0 &&
                  (project.extensions || []).map((ext: any) => (
                    <div key={ext.id} className="p-3 bg-[#fbf7f0] rounded-md border border-[#ebdcc9] text-xs flex justify-between items-center">
                      <div>
                        <div className="font-mono font-bold text-[#24160c]">{ext.extensionNumber}</div>
                        <div className="text-stone-600 mt-0.5">
                          Extended from {formatDate(ext.previousRentalEndDate)} to {formatDate(ext.newRentalEndDate)} (
                          {ext.extensionValue || ext.durationMonths} {ext.extensionUnit === 'DAYS' ? 'Day(s)' : 'Month(s)'})
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">Reason: {ext.extensionReason}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-[10px] text-stone-500 font-sans">By {ext.approverName || 'Admin'}</div>
                        <div className="text-[10px] text-stone-400">{formatDateTime(ext.createdAt)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: BILLING & INVOICES */}
      {activeTab === 'billing' && (
        <div className="bg-white p-5 sm:p-6 rounded-lg border border-[#e8decb] shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#24160c]">Project Tax Invoices & Payments</h2>
              <p className="text-xs text-stone-500">GST-compliant rental charges, mobilization, and settled amounts</p>
            </div>
            {can('BILLING_CREATE_INVOICE') && (
              <Link
                href={`/billing?projectId=${project.id}&customerId=${project.customerId}`}
                className="px-3.5 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition"
              >
                + Issue New Invoice
              </Link>
            )}
          </div>

          {/* Mobile Invoices Card List */}
          <div className="block md:hidden divide-y divide-[#f0e8db]">
            {(project.invoices || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400">
                No invoices issued for this project yet.
              </div>
            ) : (
              project.invoices.map((inv: any) => (
                <div key={inv.id} className="py-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/billing/${inv.id}/invoice-view`} className="font-mono font-bold text-[#24160c] text-sm hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div className="text-stone-500 text-[11px] flex items-center justify-between">
                    <span>{inv.invoiceType?.replace(/_/g, ' ')}</span>
                    <span>Date: {formatDate(inv.invoiceDate)} (Due: {formatDate(inv.dueDate)})</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#fbf9f5] p-2.5 rounded-md border border-[#ede3d4] text-center font-mono text-[11px]">
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Total</span>
                      <span className="font-bold text-stone-900">{formatINR(inv.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Paid</span>
                      <span className="font-bold text-[#714f36]">{formatINR(inv.paidAmount)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Due</span>
                      <span className="font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/billing/${inv.id}/invoice-view`}
                      className="w-full flex items-center justify-center py-2 px-3 bg-[#f7f2eb] hover:bg-[#ebdcc9] text-[#24160c] font-semibold rounded-md border border-[#d6c7b2] transition min-h-[38px]"
                    >
                      View GST Invoice →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Invoices Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Invoice Date</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Taxable</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total (Incl GST)</th>
                  <th className="px-4 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-right">Outstanding</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db] font-mono">
                {(project.invoices || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-stone-400 font-sans">
                      No invoices issued for this project yet.
                    </td>
                  </tr>
                ) : (
                  project.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-bold text-[#24160c]">
                        <Link href={`/billing/${inv.id}/invoice-view`} className="hover:underline hover:text-[#8f6541]">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-sans text-stone-600">{inv.invoiceType?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(inv.taxableValue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-stone-900">{formatINR(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-[#714f36]">{formatINR(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: ACTIVITY TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white p-5 sm:p-6 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-[#24160c] border-b border-[#f0e8db] pb-3">Immutable Audit Timeline</h2>
          <div className="relative pl-6 border-l-2 border-[#8f6541]/30 space-y-6">
            {(project.activity || []).length === 0 ? (
              <div className="text-xs text-stone-400 py-4">No events logged yet.</div>
            ) : (
              project.activity.map((event: any) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#24160c] border-2 border-white shadow-xs" />
                  <div className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#24160c]">{event.eventTitle}</span>
                      <span className="text-[10px] font-mono text-stone-400">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <div className="text-stone-600 mt-1">{event.eventDescription}</div>
                    <div className="text-[10px] text-stone-400 mt-1">Actor: {event.actorName}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Official 11 Terms & Conditions Modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-hidden flex flex-col border border-[#d6c7b2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#f0e8db]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9] font-bold flex items-center justify-center text-sm">
                  §
                </span>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#24160c]">Official Business Terms & Conditions</h3>
                  <p className="text-[11px] text-stone-500">Contractual terms applicable to Project {project.projectCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3.5 pr-2 divide-y divide-[#faf6ee] text-xs">
              {(project.termsSnapshot && project.termsSnapshot.length > 0
                ? project.termsSnapshot
                : OFFICIAL_TERMS_AND_CONDITIONS
              ).map((term: any) => (
                <div key={term.id} className="pt-3 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9] font-bold text-[10px] flex items-center justify-center shrink-0">
                      {term.id}
                    </span>
                    <span className="font-bold text-stone-900">{term.title}</span>
                    <span className="text-[10px] text-stone-400 uppercase font-mono ml-auto">{term.category}</span>
                  </div>
                  <p className="text-stone-600 text-xs mt-1 leading-relaxed pl-7">{term.fullText || term.shortSummary || term.content}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#f0e8db] flex justify-end">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-md text-xs font-semibold transition"
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL PROJECT CONFIRMATION MODAL */}
      {cancelModalOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !cancelling && setCancelModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#f0e8db] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200">
                  <AlertOctagon className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#24160c]">
                    Cancel Project: {project.projectCode}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Pre-installation project cancellation and stock reservation release
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            {/* Project Summary Card */}
            <div className="bg-[#fbf9f5] rounded-lg p-3.5 border border-[#ede3d4] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-bold text-[#24160c]">{project.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Site Location:</span>
                <span className="font-semibold text-stone-800 truncate max-w-[260px]">{project.siteName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Current Lifecycle Status:</span>
                <span className="font-mono font-semibold text-[#8f6541] bg-white px-2 py-0.5 rounded border border-[#ebdcc9]">
                  {project.status}
                </span>
              </div>

              {/* Reserved Stock Details */}
              {project.materials && project.materials.some((m: any) => (m.reservedQuantity || 0) > 0) && (
                <div className="pt-2 border-t border-[#ebdcc9] flex items-center justify-between text-[#8c5e39]">
                  <span className="font-semibold flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Active Reserved Scaffolding:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                    {project.materials.reduce((sum: number, m: any) => sum + (m.reservedQuantity || 0), 0)} pieces will be released
                  </span>
                </div>
              )}
            </div>

            {/* Warning Message */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md text-[11px] text-amber-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>Important Cancellation Rules:</span>
              </div>
              <div>• Project will be transitioned to <strong className="text-rose-900">Cancelled</strong> status and moved out of active directory.</div>
              <div>• Any active material reservations will be automatically released back to warehouse usable stock.</div>
              <div>• All project records, site forms, quotations, dimensions, and photos remain permanently saved for audit compliance.</div>
            </div>

            {/* Mandatory Reason Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#24160c]">
                Mandatory Cancellation Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                disabled={cancelling}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter detailed reason (e.g. Client postponed construction start date, municipal height permit denied, commercial renegotiation)..."
                className="w-full p-2.5 text-xs bg-white border border-[#d6c7b2] rounded-md focus:border-rose-600 focus:ring-1 focus:ring-rose-500 focus:outline-none text-[#24160c]"
              />
            </div>

            {/* Final Confirmation Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={cancelling}
                  checked={cancelConfirmed}
                  onChange={(e) => setCancelConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-[#d6c7b2] text-rose-700 focus:ring-rose-600 accent-rose-700 cursor-pointer"
                />
                <span className="text-xs font-semibold text-stone-800 leading-snug">
                  I confirm final cancellation of this pre-installation project. I understand reserved materials will be restored to warehouse available stock.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#f0e8db]">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-[#faf6ee] border border-[#d8c8b4] rounded-md transition cursor-pointer"
              >
                Keep Project (Back)
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim() || !cancelConfirmed}
                onClick={handleExecuteCancel}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 border border-rose-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{cancelling ? 'Cancelling Project...' : 'Confirm Project Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUFFER PERIOD MODAL */}
      {bufferModalOpen && project && (() => {
        const originalRemovalDateStr =
          toDateOnlyString(project.originalRemovalDate || project.originalRentalEndDate || project.removalDate || project.rentalEndDate || effectiveRemovalDate) ||
          toDateOnlyString(new Date());
        const numericBufferDays = Number(bufferDaysInput);
        const isValidBufferDays =
          bufferDaysInput.trim() !== '' &&
          Number.isInteger(numericBufferDays) &&
          numericBufferDays >= 1;
        const calculatedNewRemovalDate = isValidBufferDays
          ? calculateExtendedRemovalDate(originalRemovalDateStr, numericBufferDays, 'DAYS')
          : originalRemovalDateStr;
        const previewRemaining = getRemainingDaysInfo(calculatedNewRemovalDate, 'BUFFER_PERIOD');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className="fixed inset-0"
              onClick={() => !bufferSubmitting && setBufferModalOpen(false)}
            />
            <form
              onSubmit={handleConfirmBufferPeriod}
              className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] overflow-hidden text-stone-800 max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-[#24160c] px-5 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-[#382315] border border-[#523622] flex items-center justify-center text-[#c79e7c]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Buffer Period Selection</h3>
                    <p className="text-[11px] font-mono text-[#c79e7c]">
                      {project.projectCode} · {project.customerName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={bufferSubmitting}
                  onClick={() => setBufferModalOpen(false)}
                  className="p-1 text-stone-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-y-auto text-xs bg-[#fbf9f5]/50">
                {bufferError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-md text-rose-800 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{bufferError}</span>
                  </div>
                )}

                {/* 1. Original Removal Date (Automatically fetched) */}
                <div className="p-3.5 bg-white rounded-lg border border-[#e5dac8] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#8f6541]" />
                      <span>Original Removal Date</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#faf6ee] text-[#714f36] border border-[#ebdcc9]">
                      Existing Project Date
                    </span>
                  </div>
                  <div className="font-mono font-bold text-base text-[#24160c] mt-1.5">
                    {formatLongDate(originalRemovalDateStr)}
                  </div>
                  <div className="text-[11px] text-[#8c5e39] mt-0.5">
                    Current project removal deadline fetched from records
                  </div>
                </div>

                {/* 2. Buffer Period (Days) Selection */}
                <div className="p-3.5 bg-white rounded-lg border border-[#e5dac8] shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-semibold text-[#4d301c]">
                      Buffer Period (Days) <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[11px] text-[#9c826e]">Enter additional grace days</span>
                  </div>

                  <div className="relative">
                    <Clock className="w-4 h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={bufferDaysInput}
                      onChange={(e) => {
                        setBufferDaysInput(e.target.value);
                        setBufferError(null);
                      }}
                      placeholder="e.g. 3, 5, 7"
                      className="w-full pl-9 pr-14 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] font-mono font-bold text-sm focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 font-mono">
                      Days
                    </span>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] uppercase font-semibold text-stone-500 mr-1">Quick Select:</span>
                    {[2, 3, 5, 7, 10, 15].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setBufferDaysInput(String(d));
                          setBufferError(null);
                        }}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                          Number(bufferDaysInput) === d
                            ? 'bg-[#24160c] text-white shadow-2xs'
                            : 'bg-[#faf6ee] text-[#714f36] border border-[#d6c7b2] hover:bg-[#ebdcc9]'
                        }`}
                      >
                        +{d} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. New Removal / Expiry Date (Automatically calculated) */}
                <div
                  className={`p-3.5 rounded-lg border transition-all ${
                    isValidBufferDays
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-rose-50/70 border-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>New Removal / Expiry Date</span>
                    </span>
                    {isValidBufferDays && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                        +{numericBufferDays} {numericBufferDays === 1 ? 'Day' : 'Days'}
                      </span>
                    )}
                  </div>

                  <div className="font-mono font-bold text-base text-amber-950 mt-1.5">
                    {isValidBufferDays ? formatLongDate(calculatedNewRemovalDate) : '—'}
                  </div>

                  <div className="text-[11px] text-amber-900/90 mt-1 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      {isValidBufferDays
                        ? `${formatLongDate(originalRemovalDateStr)} + ${numericBufferDays} Days = ${formatLongDate(calculatedNewRemovalDate)}`
                        : 'Enter a valid positive number of days to calculate new removal date'}
                    </span>
                    {isValidBufferDays && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${previewRemaining.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${previewRemaining.dotClass}`} />
                        <span>{previewRemaining.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional Reason / Remarks */}
                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Buffer Reason / Activity Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={bufferReason}
                    onChange={(e) => setBufferReason(e.target.value)}
                    placeholder="e.g. Additional grace window granted for dismantling"
                    className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] text-xs focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>

                {/* Policy Notice */}
                <div className="p-2.5 rounded-md bg-[#faf6ee] border border-[#ede3d4] text-[11px] text-[#7d6553] space-y-1">
                  <div className="font-semibold text-[#24160c] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Preserved Contract Terms</span>
                  </div>
                  <div>
                    Buffer period extends the operational dismantling window without modifying original monthly rental charges or rental duration history.
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="bg-white border-t border-[#e5dac8] px-5 py-3.5 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={bufferSubmitting}
                  onClick={() => setBufferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bufferSubmitting || !isValidBufferDays}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] border border-[#19100a] rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {bufferSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{bufferSubmitting ? 'Confirming...' : 'Confirm Buffer Period'}</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* EXTEND RENTAL MODAL */}
      {extendModalOpen && project && (() => {
        const numericDuration = Number(extendValueInput);
        const isValidDuration =
          extendValueInput.trim() !== '' &&
          Number.isInteger(numericDuration) &&
          numericDuration >= 1;
        const baseDateForPreview = toDateOnlyString(effectiveRemovalDate) || toDateOnlyString(new Date());
        const previewNewRemovalDate = isValidDuration
          ? calculateExtendedRemovalDate(baseDateForPreview, numericDuration, extendType)
          : baseDateForPreview;
        const previewDuration = calculateRentalDurationBreakdown(installDate, previewNewRemovalDate);
        const previewRemaining = getRemainingDaysInfo(previewNewRemovalDate, 'EXTENDED');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
            <div
              className="fixed inset-0"
              onClick={() => !extendSubmitting && setExtendModalOpen(false)}
            />
            <form
              onSubmit={handleConfirmExtension}
              className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] overflow-hidden text-stone-800 max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-[#24160c] px-5 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-[#382315] border border-[#523622] flex items-center justify-center text-[#c79e7c]">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Extend Rental Period</h3>
                    <p className="text-[11px] font-mono text-[#c79e7c]">{project.projectCode} · {project.customerName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={extendSubmitting}
                  onClick={() => setExtendModalOpen(false)}
                  className="p-1 text-stone-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto text-xs bg-[#fbf9f5]/50">
                {extendError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-md text-rose-800 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{extendError}</span>
                  </div>
                )}

                {/* Read-Only Current Dates */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#fbf9f5] rounded-lg border border-[#e5dac8]">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 block">
                      Current Removal Date
                    </span>
                    <span className="font-mono font-bold text-sm text-[#24160c] mt-0.5 block">
                      {formatDate(baseDateForPreview)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 block">
                      Current Rental Duration
                    </span>
                    <span className="font-mono font-bold text-sm text-[#714f36] mt-0.5 block">
                      {effectiveDuration.display || '—'}
                    </span>
                  </div>
                </div>

                {/* Extension Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Extension Type <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f7f2eb] border border-[#d6c7b2] rounded-md">
                      {(['DAYS', 'MONTHS'] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          disabled={extendSubmitting}
                          onClick={() => {
                            setExtendType(unit);
                            setExtendError(null);
                          }}
                          className={`py-1.5 rounded text-xs font-bold transition cursor-pointer ${extendType === unit
                              ? 'bg-[#24160c] text-[#c79e7c] shadow-2xs'
                              : 'text-[#714f36] hover:bg-[#ebdcc9]/60'
                            }`}
                        >
                          {unit === 'DAYS' ? 'Days' : 'Months'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Extension Duration ({extendType === 'DAYS' ? 'Days' : 'Months'}) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      disabled={extendSubmitting}
                      value={extendValueInput}
                      onChange={(e) => {
                        setExtendValueInput(e.target.value);
                        setExtendError(null);
                      }}
                      placeholder={extendType === 'DAYS' ? 'e.g. 15' : 'e.g. 2'}
                      className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono font-bold text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#4d301c] mb-1">
                    Extension Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={extendSubmitting}
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    placeholder="e.g. Site work extended per client request"
                    className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>

                {/* Live Calculated Preview */}
                <div className="p-3.5 bg-[#f7f2eb] rounded-lg border border-[#d6c7b2] space-y-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#714f36]">
                    Calculated Extension Summary
                  </div>
                  <div className="flex items-center justify-between border-b border-[#e5dac8] pb-2">
                    <span className="text-stone-600">New Removal Date</span>
                    <span className="font-mono font-bold text-sm text-[#24160c]">
                      {isValidDuration ? formatDate(previewNewRemovalDate) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#e5dac8] pb-2">
                    <span className="text-stone-600">Updated Total Rental Duration</span>
                    <span className="font-mono font-bold text-[#714f36]">
                      {isValidDuration ? (previewDuration.display || '—') : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-600">Updated Remaining Days</span>
                    {isValidDuration ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[11px] font-bold ${previewRemaining.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${previewRemaining.dotClass}`} />
                        <span>{previewRemaining.label}</span>
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="bg-white border-t border-[#e5dac8] px-5 py-3.5 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={extendSubmitting}
                  onClick={() => setExtendModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendSubmitting || !isValidDuration}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] border border-[#19100a] rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {extendSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{extendSubmitting ? 'Confirming...' : 'Confirm Extension'}</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* EDIT PROJECT DETAILS MODAL */}
      <ProjectFormModal
        isOpen={editModalOpen}
        editingProject={project}
        currentUser={currentUser}
        onClose={() => setEditModalOpen(false)}
        onSaved={(updatedProject) => {
          setProject((prev: any) => ({ ...prev, ...updatedProject }));
          setEditModalOpen(false);
        }}
      />
    </div>
  );
}
