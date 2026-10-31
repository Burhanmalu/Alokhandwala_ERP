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
  FileDown
} from 'lucide-react';
import { formatINR, formatQuantity, formatDate, formatDateTime, getStatusBadgeConfig, getDaysDifference, calculateScaffoldingArea } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage } from '@/lib/image-utils';
import { generateConfirmationPdf, generateInstallationPdf } from '@/lib/pdf/project-pdf';
import { OFFICIAL_TERMS_AND_CONDITIONS } from '@/lib/constants/terms-and-conditions';

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
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // PDF Download States
  const [downloadingConfPdf, setDownloadingConfPdf] = useState(false);
  const [downloadingInstPdf, setDownloadingInstPdf] = useState(false);

  // Status checks for PDF availability
  const isConfirmed = Boolean(
    project && (
      (project.status !== 'NOT_INSTALLED' && project.status !== 'CANCELLED') ||
      project.quotationNumber ||
      (project.materials && project.materials.some((m: any) => (m.reservedQuantity || 0) > 0 || (m.installedQuantity || 0) > 0))
    )
  );

  const isInstalled = Boolean(
    project && (
      ['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENSION_REQUESTED', 'EXTENDED', 'SHIFTING_PENDING', 'SHIFTING_IN_PROGRESS', 'REMOVAL_PENDING', 'RETURNED_RECONCILIATION', 'CLOSED'].includes(project.status) ||
      project.actualInstallationDate ||
      (project.materials && project.materials.some((m: any) => (m.installedQuantity || 0) > 0))
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

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = await res.json();
      if (json.success) {
        setProject(json.data);
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
  const daysRemaining = getDaysDifference(project.bufferEndDate || project.rentalEndDate);

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
            {project.status === 'BUFFER_PERIOD' && (
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#fbf7f0] text-[#78350f] border border-[#ebdcc9]">
                Removal Buffer Active ({formatDate(project.bufferEndDate)})
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
            </div>
          </div>
        </div>

        {/* Dynamic Action Buttons & Customer PDF Downloads */}
        <div className="flex flex-col sm:items-end justify-center gap-2.5 w-full lg:w-auto shrink-0">
          {/* Row 1: Workflow Lifecycle Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            {/* Status NOT_INSTALLED -> Confirm Action */}
            {project.status === 'NOT_INSTALLED' && can('PROJECT_CONFIRM') && (
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

            {/* Active Rental Operations: Buffer, Extend, Shift, Dismantle */}
            {['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED'].includes(project.status) && (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                {project.status !== 'BUFFER_PERIOD' && can('PROJECT_BUFFER_REQUEST') && (
                  <Link
                    href={`/projects/${project.id}/buffer`}
                    className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#78350f] border border-[#ebdcc9] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#8f6541]" />
                    <span>Buffer (2-3d)</span>
                  </Link>
                )}

                {can('PROJECT_EXTEND') && (
                  <Link
                    href={`/projects/${project.id}/extend`}
                    className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#714f36] border border-[#ebdcc9] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Repeat className="w-3.5 h-3.5 text-[#8f6541]" />
                    <span>Extend Rental</span>
                  </Link>
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

          {/* Row 2: Customer Official PDF Downloads */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            {/* Confirmation PDF Button */}
            {isConfirmed ? (
              <button
                onClick={handleDownloadConfirmationPdf}
                disabled={downloadingConfPdf}
                title="Download official Project Confirmation & Material Reservation PDF"
                className="h-9 px-3.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs group active:scale-[0.98]"
              >
                {downloadingConfPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c79e7c]" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-[#c79e7c]" />
                )}
                <span>{downloadingConfPdf ? 'Generating PDF...' : 'Download Confirmation PDF'}</span>
              </button>
            ) : (
              <div className="relative group inline-block">
                <button
                  disabled
                  className="h-9 px-3.5 bg-stone-100 text-stone-400 border border-stone-200 rounded-md text-xs font-medium cursor-not-allowed flex items-center justify-center gap-1.5 opacity-75"
                >
                  <FileDown className="w-3.5 h-3.5 text-stone-400" />
                  <span>Download Confirmation PDF</span>
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-40 pointer-events-none">
                  <div className="bg-stone-900 text-stone-100 text-[11px] font-medium py-1 px-2.5 rounded-md shadow-lg border border-stone-800 whitespace-nowrap">
                    Submit Project Confirmation Form first to enable Confirmation PDF
                  </div>
                </div>
              </div>
            )}

            {/* Installation PDF Button */}
            {isInstalled ? (
              <button
                onClick={handleDownloadInstallationPdf}
                disabled={downloadingInstPdf}
                title="Download official Scaffolding Installation Handover Certificate PDF"
                className="h-9 px-3.5 bg-[#382315] hover:bg-[#4a301e] text-[#f7e7d7] border border-[#523622] rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs group active:scale-[0.98]"
              >
                {downloadingInstPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c79e7c]" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-[#c79e7c]" />
                )}
                <span>{downloadingInstPdf ? 'Generating PDF...' : 'Download Installation PDF'}</span>
              </button>
            ) : (
              <div className="relative group inline-block">
                <button
                  disabled
                  className="h-9 px-3.5 bg-stone-100 text-stone-400 border border-stone-200 rounded-md text-xs font-medium cursor-not-allowed flex items-center justify-center gap-1.5 opacity-75"
                >
                  <FileDown className="w-3.5 h-3.5 text-stone-400" />
                  <span>Download Installation PDF</span>
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-40 pointer-events-none">
                  <div className="bg-stone-900 text-stone-100 text-[11px] font-medium py-1 px-2.5 rounded-md shadow-lg border border-stone-800 whitespace-nowrap">
                    Record on-site installation first to generate Installation PDF
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-[#e8decb] text-xs font-medium overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('measurements')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'measurements'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Site Dimensions</span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'photos'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Photographs ({project.photos?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'materials'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5 text-[#8f6541]" />
          <span>Materials & Site Stock ({project.materials?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('rental')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'rental'
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
            className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'billing'
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
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'timeline'
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
              {project.totalAreaSqFt > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-[#fbf9f5] px-2 rounded">
                  <span className="text-stone-700 font-semibold">Billable Façade Area (Term 1)</span>
                  <span className="font-mono font-bold text-stone-900">
                    {project.totalAreaSqFt} sq. ft. {project.ratePerSqFt ? `(@ ₹${project.ratePerSqFt}/sqft)` : ''}
                  </span>
                </div>
              )}
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
            <h3 className="text-xs font-bold text-[#24160c] uppercase tracking-wider border-b border-[#f0e8db] pb-3">
              Operational Dates & Timelines
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Planned Installation</span>
                <span className="font-mono text-stone-800">{formatDate(project.plannedInstallationDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Actual Installation</span>
                <span className="font-mono text-stone-800">{formatDate(project.actualInstallationDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Rental Start Date</span>
                <span className="font-mono font-semibold text-[#714f36]">{formatDate(project.rentalStartDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#f0e8db]">
                <span className="text-stone-500">Current Rental Expiry</span>
                <span className="font-mono font-semibold text-stone-900">{formatDate(project.rentalEndDate)}</span>
              </div>
              {project.bufferEndDate && (
                <div className="flex justify-between items-center py-1.5 border-b border-[#f0e8db] bg-[#fbf7f0] px-2 rounded">
                  <span className="text-[#78350f] font-semibold">Buffer Removal Deadline</span>
                  <span className="font-mono font-bold text-[#78350f]">{formatDate(project.bufferEndDate)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500">Actual Dismantling Date</span>
                <span className="font-mono text-stone-800">{formatDate(project.actualDismantlingDate)}</span>
              </div>
            </div>
          </div>

          {/* Quick Health & Inspection Summary + Customer Document Handover */}
          <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c] border-b border-[#f0e8db] pb-3">
                Site Inspection & Details
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
                  <div className="font-semibold text-stone-800">Dimensions:</div>
                  <div className="font-mono text-[#714f36] font-bold mt-0.5">
                    {project.measurements?.depth !== undefined
                      ? `${project.measurements.width} (W) × ${project.measurements.depth} (D) × ${project.measurements.height} (H) ${project.measurements.unit || 'FT'}`
                      : `${project.measurements?.length || 0} (L) × ${project.measurements?.width || 0} (W) × ${project.measurements?.height || 0} (H) ${project.measurements?.unit || 'METERS'}`}
                  </div>
                  <div className="text-[11px] text-[#8c5e39] font-mono font-semibold mt-0.5">
                    Elevation Area: {calculateScaffoldingArea(
                      project.measurements?.width || project.measurements?.length || 0,
                      project.measurements?.depth !== undefined ? project.measurements.depth : 3,
                      project.measurements?.height || 0,
                      project.measurements?.unit || 'FEET'
                    ).toLocaleString('en-IN')} sq. ft.
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
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border ${
                project.actualMeasurements.isCorrect
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
                  {calculateScaffoldingArea(
                    project.measurements?.width || project.measurements?.length || 0,
                    project.measurements?.depth !== undefined ? project.measurements.depth : 3,
                    project.measurements?.height || 0,
                    project.measurements?.unit || 'FEET'
                  ).toLocaleString('en-IN')} <span className="text-xs text-stone-500 font-normal">sq. ft.</span>
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
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        project.installationSupervisor.isSameSupervisor
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
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#24160c]">Rental Term & Contractual Deadlines</h2>
              <p className="text-xs text-stone-500">28-day monthly rental cycles, extensions, and removal buffers</p>
            </div>
            {['ACTIVE_RENTAL', 'INSTALLED', 'EXTENDED', 'BUFFER_PERIOD'].includes(project.status) && can('PROJECT_EXTEND') && (
              <Link
                href={`/projects/${project.id}/extend`}
                className="px-3.5 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md text-xs font-semibold shadow-xs transition"
              >
                + Extend Rental
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Rental Start Date</div>
              <div className="text-lg font-bold font-mono text-stone-900 mt-1">{formatDate(project.rentalStartDate)}</div>
            </div>
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Current Approved Rental End</div>
              <div className="text-lg font-bold font-mono text-[#714f36] mt-1">{formatDate(project.rentalEndDate)}</div>
            </div>
            <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4]">
              <div className="text-stone-500 font-medium">Approved Buffer Deadline</div>
              <div className="text-lg font-bold font-mono text-[#78350f] mt-1">
                {project.bufferEndDate ? formatDate(project.bufferEndDate) : 'None requested'}
              </div>
            </div>
          </div>

          {/* Extension Records History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Rental Extensions History</h3>
            {(project.extensions || []).length === 0 ? (
              <div className="p-4 bg-[#fbf9f5] rounded-md border border-[#ede3d4] text-xs text-stone-400 text-center">
                No extensions recorded. Project is running within original contractual period.
              </div>
            ) : (
              project.extensions.map((ext: any) => (
                <div key={ext.id} className="p-3 bg-[#fbf7f0] rounded-md border border-[#ebdcc9] text-xs flex justify-between items-center">
                  <div>
                    <div className="font-mono font-bold text-[#24160c]">{ext.extensionNumber}</div>
                    <div className="text-stone-600 mt-0.5">Extended from {formatDate(ext.previousRentalEndDate)} to {formatDate(ext.newRentalEndDate)} ({ext.durationMonths} Month)</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Reason: {ext.extensionReason}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-[#714f36]">{formatINR(ext.monthlyRentalRate)} /mo</div>
                    <div className="text-[10px] text-stone-500 font-sans">Approved by {ext.approverName || 'Admin'}</div>
                  </div>
                </div>
              ))
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
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${
                          inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
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
                  <p className="text-stone-600 text-xs mt-1 leading-relaxed pl-7">{term.content}</p>
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
    </div>
  );
}
