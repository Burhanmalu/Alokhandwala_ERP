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
  Sparkles
} from 'lucide-react';
import { formatINR, formatQuantity, formatDate, formatDateTime, getStatusBadgeConfig, getDaysDifference } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage, SAMPLE_SITE_PHOTOS } from '@/lib/image-utils';

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
  const photoInputRef = React.useRef<HTMLInputElement>(null);

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
        <Link href="/projects" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold">
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
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/projects" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects Directory</span>
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-slate-800">{project.projectCode}</span>
        <span>/</span>
        <span className="text-slate-600 truncate max-w-xs">{project.customerName}</span>
      </div>

      {/* Project Master Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {project.projectCode}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
              <span className={`w-2 h-2 rounded-full ${badge.dotColor}`} />
              {badge.label}
            </span>
            {project.status === 'BUFFER_PERIOD' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Removal Buffer Active ({formatDate(project.bufferEndDate)})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{project.customerName}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{project.siteName}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Supervisor: {project.supervisorName}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Action Buttons Based on Project Status */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status NOT_INSTALLED -> Confirm Action */}
          {project.status === 'NOT_INSTALLED' && can('PROJECT_CONFIRM') && (
            <Link
              href={`/projects/${project.id}/confirm`}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Project & Reserve Stock</span>
            </Link>
          )}

          {/* Status CONFIRMED_PROJECT -> Install Action */}
          {(project.status === 'CONFIRMED_PROJECT' || project.status === 'SCHEDULED') && can('PROJECT_INSTALL_SUBMIT') && (
            <Link
              href={`/projects/${project.id}/install`}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 min-h-[42px]"
            >
              <Boxes className="w-4 h-4" />
              <span>Record Installation & Activate Rental</span>
            </Link>
          )}

          {/* Active Rental Operations: Buffer, Extend, Shift, Dismantle */}
          {['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED'].includes(project.status) && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              {project.status !== 'BUFFER_PERIOD' && can('PROJECT_BUFFER_REQUEST') && (
                <Link
                  href={`/projects/${project.id}/buffer`}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 min-h-[40px]"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Buffer (2-3d)</span>
                </Link>
              )}

              {can('PROJECT_EXTEND') && (
                <Link
                  href={`/projects/${project.id}/extend`}
                  className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 min-h-[40px]"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Extend Rental</span>
                </Link>
              )}

              {can('PROJECT_SHIFT') && (
                <Link
                  href={`/projects/${project.id}/shift`}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 min-h-[40px]"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Shift Scaffolding</span>
                </Link>
              )}

              {can('PROJECT_DISMANTLE_SUBMIT') && (
                <Link
                  href={`/projects/${project.id}/dismantle`}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs min-h-[40px]"
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
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 min-h-[42px]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>{closing ? 'Closing Project...' : 'Finalize Closure'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 text-xs font-medium overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('measurements')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'measurements'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Site Dimensions</span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'photos'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Photographs ({project.photos?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'materials'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Materials & Site Stock ({project.materials?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('rental')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'rental'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Rental Schedule & Extensions</span>
        </button>

        {can('BILLING_VIEW') && (
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
              activeTab === 'billing'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ReceiptIndianRupee className="w-3.5 h-3.5" />
            <span>Invoices & Billing ({project.invoices?.length || 0})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 px-3 transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Activity Timeline ({project.activity?.length || 0})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Key Quotation & Pricing Summary */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              Commercial Terms & Pricing
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Quotation Reference</span>
                <span className="font-mono font-semibold text-slate-800">{project.quotationNumber || 'Pending Confirmation'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Monthly Rental Rate</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {project.monthlyRentalRate > 0 ? formatINR(project.monthlyRentalRate) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Agreed Price</span>
                <span className="font-mono font-bold text-slate-900">
                  {project.agreedProjectPrice > 0 ? formatINR(project.agreedProjectPrice) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Security Deposit</span>
                <span className="font-mono text-slate-800">{formatINR(project.depositAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Transport & Labour Charges</span>
                <span className="font-mono text-slate-800">{formatINR((project.transportCharges || 0) + (project.installationLabourCharges || 0))}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Applicable GST Rate</span>
                <span className="font-mono font-semibold text-slate-800">{project.gstPercentage || 18}% (Standard CGST+SGST)</span>
              </div>
            </div>
          </div>

          {/* Rental Operational Dates */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              Operational Dates & Timelines
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Planned Installation</span>
                <span className="font-mono text-slate-800">{formatDate(project.plannedInstallationDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Actual Installation</span>
                <span className="font-mono text-slate-800">{formatDate(project.actualInstallationDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Rental Start Date</span>
                <span className="font-mono font-semibold text-emerald-700">{formatDate(project.rentalStartDate)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Current Rental Expiry</span>
                <span className="font-mono font-semibold text-slate-900">{formatDate(project.rentalEndDate)}</span>
              </div>
              {project.bufferEndDate && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100 bg-amber-50/70 px-2 rounded">
                  <span className="text-amber-800 font-semibold">Buffer Removal Deadline</span>
                  <span className="font-mono font-bold text-amber-900">{formatDate(project.bufferEndDate)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Actual Dismantling Date</span>
                <span className="font-mono text-slate-800">{formatDate(project.actualDismantlingDate)}</span>
              </div>
            </div>
          </div>

          {/* Quick Health & Inspection Summary */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              Site Inspection Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-800">Dimensions:</div>
                <div className="font-mono text-emerald-800 font-bold mt-0.5">
                  {project.measurements?.length || 0}m (L) x {project.measurements?.width || 0}m (W) x {project.measurements?.height || 0}m (H)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Type: {project.measurements?.measurementType?.replace(/_/g, ' ') || 'Façade Scaffold'}
                </div>
              </div>

              {project.siteRemarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Remarks: </span>
                  {project.siteRemarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SITE MEASUREMENTS */}
      {activeTab === 'measurements' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span>Inspection Engineering & Actual Installed Dimensions</span>
            </h2>
            {project.actualMeasurements && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                project.actualMeasurements.isCorrect
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {project.actualMeasurements.isCorrect ? '✓ Actual Size Verified (100% Match)' : `⚠ Variance: ${project.actualMeasurements.variancePercentage || 0}%`}
              </span>
            )}
          </div>

          {/* Planned Dimensions */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">1. Planned Site Inspection Dimensions</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Façade Length</div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {project.measurements?.length || 0} <span className="text-xs text-slate-500 font-normal">{project.measurements?.unit || 'METERS'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Scaffold Width / Bay</div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {project.measurements?.width || 0} <span className="text-xs text-slate-500 font-normal">{project.measurements?.unit || 'METERS'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Working Height</div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {project.measurements?.height || 0} <span className="text-xs text-slate-500 font-normal">{project.measurements?.unit || 'METERS'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Approx. Façade Area</div>
                <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                  {((project.measurements?.length || 0) * (project.measurements?.height || 0)).toFixed(1)} <span className="text-xs text-slate-500 font-normal">sq.m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actual Installed Dimensions (if recorded) */}
          {project.actualMeasurements && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center justify-between">
                <span>2. Actual Installed Dimensions Verified On Site</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Verified by: {project.actualMeasurements.verifiedBy || 'Supervisor'} on {formatDate(project.actualMeasurements.verifiedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Actual Length</div>
                  <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                    {project.actualMeasurements.length} <span className="text-xs text-slate-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Actual Width</div>
                  <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                    {project.actualMeasurements.width} <span className="text-xs text-slate-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Actual Height</div>
                  <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                    {project.actualMeasurements.height} <span className="text-xs text-slate-500 font-normal">{project.actualMeasurements.unit || 'METERS'}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Actual Surface Area</div>
                  <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                    {(project.actualMeasurements.length * project.actualMeasurements.height).toFixed(1)} <span className="text-xs text-slate-500 font-normal">sq.m</span>
                  </div>
                </div>
              </div>

              {project.actualMeasurements.remarks && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Dimension Notes / Field Variance: </span>
                  {project.actualMeasurements.remarks}
                </div>
              )}
            </div>
          )}

          {/* Supervisor in Charge & Workers Crew Information */}
          {(project.installationSupervisor || (project.installationWorkers && project.installationWorkers.length > 0)) && (
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">3. Installation Supervision & Erection Crew</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {project.installationSupervisor && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Supervisor in Charge Check</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        project.installationSupervisor.isSameSupervisor
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {project.installationSupervisor.isSameSupervisor ? '✓ Assigned Supervisor' : '⚠ Delegated Substitute'}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      <div>Assigned: <strong>{project.installationSupervisor.assignedSupervisorName}</strong></div>
                      <div>Executing: <strong>{project.installationSupervisor.executingSupervisorName}</strong></div>
                      {project.installationSupervisor.delegationRemarks && (
                        <div className="mt-1 text-[11px] text-slate-500 italic">
                          "{project.installationSupervisor.delegationRemarks}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {project.installationWorkers && project.installationWorkers.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Erection Workers & Riggers</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                        {project.installationWorkers.length} Riggers
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.installationWorkers.map((w: { id?: string; name: string; role: string }) => (
                        <span key={w.id || w.name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-[11px]">
                          <strong>{w.name}</strong>
                          <span className="text-slate-400 font-medium">({w.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-800">Scaffolding Technical Classification:</div>
            <div className="text-slate-600">
              {project.measurements?.description || 'Standard heavy duty tubular façade staging with cup-lock nodes at 500mm spacing.'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-200">
              Initial inspection measured by: {project.measurements?.measuredBy || project.supervisorName} on {formatDate(project.measurements?.measuredAt)}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PHOTOGRAPHS */}
      {activeTab === 'photos' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Project Photographic Records</span>
                {(project.photos || []).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    {project.photos.length} photos
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">Site inspection, installation quality, shifting, and dismantling condition proof</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhotos}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                {uploadingPhotos ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
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
                className="col-span-3 text-center py-12 px-4 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl cursor-pointer bg-slate-50/60 hover:bg-emerald-50/20 transition group"
              >
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition" />
                <div className="text-xs font-bold text-slate-700">No photographs uploaded yet</div>
                <div className="text-[11px] text-slate-400 mt-1">Click here to upload site inspection or installation photos</div>
              </div>
            ) : (
              project.photos.map((photo: any) => (
                <div 
                  key={photo.id} 
                  className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-2xs cursor-pointer"
                  onClick={() => setPreviewPhoto(photo)}
                >
                  <div className="aspect-video relative overflow-hidden bg-slate-900">
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
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs font-mono">
                      {photo.stageLabel?.replace(/_/g, ' ') || photo.entityType}
                    </div>
                  </div>
                  <div className="p-2.5 text-xs bg-white">
                    <div className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{photo.fileName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
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
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
            >
              <div 
                className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">{previewPhoto.fileName}</span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300">
                      {previewPhoto.stageLabel?.replace(/_/g, ' ') || 'SITE PHOTO'}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
                  <img src={previewPhoto.fileUrl} alt={previewPhoto.fileName} className="max-w-full max-h-[75vh] object-contain" />
                </div>
                <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Uploaded by: <strong className="text-white">{previewPhoto.uploaderName || 'Supervisor'}</strong> on {formatDate(previewPhoto.createdAt)}</span>
                  <a
                    href={previewPhoto.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    <span>Open in new tab</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Materials Allocation & Physical Count</h2>
              <p className="text-xs text-slate-500">Reserved, installed on site, returned, damaged, and missing items</p>
            </div>
            <div className="flex items-center gap-2">
              {project.status === 'CONFIRMED_PROJECT' && can('PROJECT_CONFIRM') && (
                <button
                  type="button"
                  onClick={handleReleaseReservation}
                  disabled={releasingReservation}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  {releasingReservation ? 'Releasing...' : 'Release Stock Reservation'}
                </button>
              )}
              {project.status === 'NOT_INSTALLED' && can('PROJECT_CONFIRM') && (
                <Link
                  href={`/projects/${project.id}/confirm`}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  + Add Material Requirements
                </Link>
              )}
            </div>
          </div>

          {project.scaffoldingPlan && (
            <div className="p-4 bg-cream-50 border border-cream-300 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-brown-900">{project.scaffoldingPlan.planName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brown-200 text-brown-900">
                    {project.scaffoldingPlan.badge}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-brown-800">
                  {project.scaffoldingPlan.configurationSummary.dimensions.length} × {project.scaffoldingPlan.configurationSummary.dimensions.width} × {project.scaffoldingPlan.configurationSummary.dimensions.height} {project.scaffoldingPlan.configurationSummary.dimensions.unit}
                </div>
              </div>
              <p className="text-xs text-brown-700">{project.scaffoldingPlan.description}</p>
              <div className="flex flex-wrap gap-4 pt-2 border-t border-cream-200 text-xs font-mono">
                <div>
                  <span className="text-brown-600 font-sans">Bays × Lifts: </span>
                  <strong>{project.scaffoldingPlan.configurationSummary.totalBays} Bays × {project.scaffoldingPlan.configurationSummary.totalLifts} Lifts</strong>
                </div>
                <div>
                  <span className="text-brown-600 font-sans">Vertical Standards: </span>
                  <strong>{project.scaffoldingPlan.configurationSummary.totalVerticalStandardsGrid} Lines</strong>
                </div>
                <div>
                  <span className="text-brown-600 font-sans">Total Pieces: </span>
                  <strong>{project.scaffoldingPlan.totals.totalPieces} NOS</strong>
                </div>
                <div>
                  <span className="text-brown-600 font-sans">Tare Weight: </span>
                  <strong>{(project.scaffoldingPlan.totals.totalWeightKg / 1000).toFixed(2)} Tonnes</strong>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Materials Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {(project.materials || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No materials assigned yet.
              </div>
            ) : (
              project.materials.map((mat: any) => (
                <div key={mat.id} className="py-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{mat.materialName}</span>
                    <span className="font-mono text-[11px] text-slate-500 font-bold">{mat.itemCode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Required</span>
                      <span className="font-bold text-slate-800">{mat.requiredQuantity} {mat.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Reserved</span>
                      <span className="font-bold text-blue-700">{mat.reservedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Installed</span>
                      <span className="font-bold text-emerald-700">{mat.installedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Returned</span>
                      <span className="font-bold text-slate-700">{mat.returnedUsableQuantity}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Damaged</span>
                      <span className="font-bold text-amber-700">{mat.returnedDamagedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Missing</span>
                      <span className="font-bold text-rose-700">{mat.missingQuantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400">Monthly Rental:</span>
                    <span className="font-mono font-bold text-slate-900">{formatINR(mat.monthlyRentalRate)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Materials Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Material Name</th>
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5 text-center">Required</th>
                  <th className="px-4 py-2.5 text-center">Reserved</th>
                  <th className="px-4 py-2.5 text-center font-bold text-emerald-800">Installed (On Site)</th>
                  <th className="px-4 py-2.5 text-center">Returned Usable</th>
                  <th className="px-4 py-2.5 text-center text-amber-700">Damaged</th>
                  <th className="px-4 py-2.5 text-center text-rose-700">Missing</th>
                  <th className="px-4 py-2.5 text-right">Rental Rate/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(project.materials || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No materials assigned yet. Materials will be allocated during Project Confirmation.
                    </td>
                  </tr>
                ) : (
                  project.materials.map((mat: any) => (
                    <tr key={mat.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-sans font-medium text-slate-900">
                        {mat.materialName}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {mat.itemCode}
                      </td>
                      <td className="px-4 py-3 text-center">{mat.requiredQuantity} {mat.unit}</td>
                      <td className="px-4 py-3 text-center text-blue-700">{mat.reservedQuantity}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700 bg-emerald-50/50">
                        {mat.installedQuantity}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">{mat.returnedUsableQuantity}</td>
                      <td className="px-4 py-3 text-center text-amber-700">{mat.returnedDamagedQuantity}</td>
                      <td className="px-4 py-3 text-center text-rose-700 font-bold">{mat.missingQuantity}</td>
                      <td className="px-4 py-3 text-right text-slate-900 font-medium">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Rental Term & Contractual Deadlines</h2>
              <p className="text-xs text-slate-500">Calendar-month rental cycles, extensions, and removal buffers</p>
            </div>
            {['ACTIVE_RENTAL', 'INSTALLED', 'EXTENDED', 'BUFFER_PERIOD'].includes(project.status) && can('PROJECT_EXTEND') && (
              <Link
                href={`/projects/${project.id}/extend`}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                + Extend Rental
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-medium">Rental Start Date</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">{formatDate(project.rentalStartDate)}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-medium">Current Approved Rental End</div>
              <div className="text-lg font-bold font-mono text-emerald-800 mt-1">{formatDate(project.rentalEndDate)}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-medium">Approved Buffer Deadline</div>
              <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                {project.bufferEndDate ? formatDate(project.bufferEndDate) : 'None requested'}
              </div>
            </div>
          </div>

          {/* Extension Records History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Rental Extensions History</h3>
            {(project.extensions || []).length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 text-center">
                No extensions recorded. Project is running within original contractual period.
              </div>
            ) : (
              project.extensions.map((ext: any) => (
                <div key={ext.id} className="p-3 bg-teal-50/50 rounded-xl border border-teal-200 text-xs flex justify-between items-center">
                  <div>
                    <div className="font-mono font-bold text-teal-900">{ext.extensionNumber}</div>
                    <div className="text-slate-600 mt-0.5">Extended from {formatDate(ext.previousRentalEndDate)} to {formatDate(ext.newRentalEndDate)} ({ext.durationMonths} Month)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Reason: {ext.extensionReason}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-teal-800">{formatINR(ext.monthlyRentalRate)} /mo</div>
                    <div className="text-[10px] text-teal-600 font-sans">Approved by {ext.approverName || 'Admin'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: BILLING & INVOICES */}
      {activeTab === 'billing' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Project Tax Invoices & Payments</h2>
              <p className="text-xs text-slate-500">GST-compliant rental charges, mobilization, and settled amounts</p>
            </div>
            {can('BILLING_CREATE_INVOICE') && (
              <Link
                href={`/billing?projectId=${project.id}&customerId=${project.customerId}`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                + Issue New Invoice
              </Link>
            )}
          </div>

          {/* Mobile Invoices Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {(project.invoices || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No invoices issued for this project yet.
              </div>
            ) : (
              project.invoices.map((inv: any) => (
                <div key={inv.id} className="py-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/billing/${inv.id}/invoice-view`} className="font-mono font-bold text-slate-900 text-sm hover:text-emerald-700 underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div className="text-slate-500 text-[11px] flex items-center justify-between">
                    <span>{inv.invoiceType?.replace(/_/g, ' ')}</span>
                    <span>Date: {formatDate(inv.invoiceDate)} (Due: {formatDate(inv.dueDate)})</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Total</span>
                      <span className="font-bold text-slate-900">{formatINR(inv.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Paid</span>
                      <span className="font-bold text-emerald-700">{formatINR(inv.paidAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Due</span>
                      <span className="font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/billing/${inv.id}/invoice-view`}
                      className="w-full flex items-center justify-center py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg transition min-h-[38px]"
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
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 font-mono">
                {(project.invoices || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No invoices issued for this project yet.
                    </td>
                  </tr>
                ) : (
                  project.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <Link href={`/billing/${inv.id}/invoice-view`} className="hover:text-emerald-700 underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600">{inv.invoiceType?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(inv.taxableValue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatINR(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatINR(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Immutable Audit Timeline</h2>
          <div className="relative pl-6 border-l-2 border-emerald-800/20 space-y-6">
            {(project.activity || []).length === 0 ? (
              <div className="text-xs text-slate-400 py-4">No events logged yet.</div>
            ) : (
              project.activity.map((event: any) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
                  <div className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{event.eventTitle}</span>
                      <span className="text-[10px] font-mono text-slate-400">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <div className="text-slate-600 mt-1">{event.eventDescription}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Actor: {event.actorName}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
