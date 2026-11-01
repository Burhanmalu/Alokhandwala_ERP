'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  FolderKanban, 
  Search, 
  Filter, 
  PlusCircle, 
  Download, 
  ChevronRight, 
  ChevronDown,
  Check,
  Calendar, 
  Building2, 
  User, 
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Lock,
  X,
  Briefcase,
  Ban,
  Archive,
  FileText,
  AlertOctagon,
  Info,
  Layers,
  ArrowRight,
  XCircle,
  Edit3,
  Loader2
} from 'lucide-react';
import { Project, ProjectStatus } from '@/lib/schema';
import { formatINR, formatDate, getStatusBadgeConfig, getDaysDifference, extractProjectDimensions } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All Active Projects' },
  { key: 'NOT_INSTALLED', label: 'Not Installed' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'CONFIRMED_PROJECT', label: 'Confirmed (Reserved)' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'ACTIVE_RENTAL', label: 'Active Rentals' },
  { key: 'BUFFER_PERIOD', label: 'Buffer Period' },
  { key: 'EXTENDED', label: 'Extended' },
  { key: 'SHIFTING_IN_PROGRESS', label: 'Shifting' },
  { key: 'REMOVAL_PENDING', label: 'Removal Pending' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'CANCELLED', label: 'Cancelled Projects' },
];

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
}

interface MenuAnchorState {
  project: Project;
  triggerEl: HTMLElement;
  position: MenuPosition;
}

const calculateMenuPosition = (rect: DOMRect): MenuPosition => {
  const dropdownHeight = 185;
  const dropdownWidth = 220;
  const padding = 12;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  let top: number | undefined;
  let bottom: number | undefined;

  // Intelligently open upwards if not enough space below and more space above
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    bottom = Math.max(padding, viewportHeight - rect.top + 6);
  } else {
    top = Math.max(padding, rect.bottom + 6);
  }

  // Keep aligned with button's left edge, capped to viewport bounds
  let left = rect.left;
  if (left + dropdownWidth > viewportWidth - padding) {
    left = Math.max(padding, viewportWidth - dropdownWidth - padding);
  }
  if (left < padding) {
    left = padding;
  }

  return { top, bottom, left };
};

export default function ProjectsListPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-stone-400">Loading projects directory...</div>}>
      <ProjectsListContent />
    </React.Suspense>
  );
}

function ProjectsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialSearch = searchParams.get('search') || '';

  const { can, currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const [restrictionModal, setRestrictionModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);

  // Cancellation Modal State
  const [projectToCancel, setProjectToCancel] = useState<Project | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Quotation Approval Interactive Status Menu State (Section 1)
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchorState | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const quotationMenuRef = useRef<HTMLDivElement>(null);

  const activeQuotationMenuId = menuAnchor?.project.id || null;
  const setActiveQuotationMenuId = (val: string | null) => {
    if (!val) setMenuAnchor(null);
  };

  const [acceptModalProject, setAcceptModalProject] = useState<Project | null>(null);
  const [rejectModalProject, setRejectModalProject] = useState<Project | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter dropdown click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quotation Approval Floating Menu event listeners: outside click, ESC key, scroll, resize
  useEffect(() => {
    if (!menuAnchor) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (quotationMenuRef.current && quotationMenuRef.current.contains(target)) return;
      if (menuAnchor?.triggerEl && menuAnchor.triggerEl.contains(target)) return;
      setMenuAnchor(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuAnchor(null);
      }
    }

    function handleScrollResize() {
      if (!menuAnchor?.triggerEl) {
        setMenuAnchor(null);
        return;
      }
      const rect = menuAnchor.triggerEl.getBoundingClientRect();
      if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
        setMenuAnchor(null);
        return;
      }
      setMenuAnchor(prev => prev ? {
        ...prev,
        position: calculateMenuPosition(rect),
      } : null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [menuAnchor]);

  const handleToggleQuotationMenu = (project: Project, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor?.project.id === project.id) {
      setMenuAnchor(null);
      return;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const pos = calculateMenuPosition(rect);
    setMenuAnchor({
      project,
      triggerEl: el,
      position: pos,
    });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (statusFromUrl) setCurrentTab(statusFromUrl);

    // Deep link redirect for Projects Lifecycle -> Project Confirmation & Material Reservation
    const section = searchParams.get('section') || searchParams.get('tab') || searchParams.get('action');
    const targetProjId = searchParams.get('projectId');
    const targetQtnId = searchParams.get('quotationId');
    if ((section === 'confirmation' || section === 'confirm') && targetProjId) {
      router.replace(`/confirmation?projectId=${encodeURIComponent(targetProjId)}${targetQtnId ? `&quotationId=${encodeURIComponent(targetQtnId)}` : ''}`);
      return;
    }

    const denied = searchParams.get('denied');
    if (denied && currentUser?.role === 'WORKER') {
      setRestrictionModal({
        open: true,
        title: 'Site Registration Restricted',
        message: 'As a Worker, your account permissions allow viewing sites and scaffolding installations you have worked on. Creating new sites requires Supervisor or Admin authorization.',
      });
    }
  }, [searchParams, currentUser, router]);

  const handleRegisterClick = () => {
    if (currentUser?.role === 'WORKER') {
      setRestrictionModal({
        open: true,
        title: 'Site Registration Restricted',
        message: `As a Worker (${currentUser.fullName}), your account permissions allow viewing sites and scaffolding installations you have worked on.\n\nOnly Supervisors and Administrators can register new sites and submit installation forms.`,
      });
    } else {
      router.push('/sites/new');
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success) setProjects(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper: check if a project is in pre-installation stage (eligible for cancellation)
  const isPreInstallation = (status: ProjectStatus, actualInstallationDate?: string) => {
    const preStatuses: ProjectStatus[] = [
      'SITE_CREATED',
      'NOT_INSTALLED',
      'QUOTATION_DRAFT',
      'QUOTATION_SENT',
      'QUOTATION_ACCEPTED',
      'QUOTATION_REJECTED',
      'CONFIRMED_PROJECT',
      'SCHEDULED',
    ];
    return preStatuses.includes(status) && !actualInstallationDate;
  };

  // Open Cancel Modal
  const openCancelModal = (p: Project) => {
    setProjectToCancel(p);
    setCancelReason('');
    setCancelConfirmed(false);
    setCancelError(null);
  };

  // Handle Cancel Project Submission
  const handleExecuteCancel = async () => {
    if (!projectToCancel) return;
    if (!cancelReason || !cancelReason.trim()) {
      setCancelError('Please enter a mandatory cancellation reason.');
      return;
    }
    if (!cancelConfirmed) {
      setCancelError('Please check the confirmation box to verify project cancellation.');
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/projects/${projectToCancel.id}/cancel`, {
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

      const updatedProject: Project = json.data.project;
      const releasedCount = json.data.releasedMaterialsCount || 0;

      // Update local state
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      
      const successMsg = `Project ${updatedProject.projectCode} cancelled successfully.${
        releasedCount > 0 ? ` Released ${releasedCount} reserved items back to warehouse stock.` : ''
      } Moved to Cancelled Projects folder.`;
      
      setSuccessBanner(successMsg);
      setProjectToCancel(null);

      // Auto dismiss success banner after 8 seconds
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (err: any) {
      setCancelError(err.message || 'An error occurred during project cancellation');
    } finally {
      setCancelling(false);
    }
  };

  // Handle Quotation Accept Submission (Section 1)
  const handleConfirmAccept = async () => {
    if (!acceptModalProject) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const qId = acceptModalProject.quotationId || acceptModalProject.id;
      const res = await fetch(`/api/quotations/${qId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ACCEPTED',
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to accept quotation');
      }

      setProjects(prev => prev.map(p => {
        if (p.id === acceptModalProject.id) {
          return {
            ...p,
            status: 'QUOTATION_ACCEPTED',
            quotationStatus: 'ACCEPTED',
            approval_status: 'ACCEPTED',
            approved_at: new Date().toISOString(),
            approved_by: currentUser?.id || 'usr-admin-01',
            approvedByName: currentUser?.fullName || 'Burhan Malu',
          };
        }
        return p;
      }));

      setSuccessBanner(`✓ Commercial Quotation for ${acceptModalProject.projectCode} (${acceptModalProject.customerName}) accepted! Project is now eligible for Confirmation & Plan.`);
      setAcceptModalProject(null);
      setActiveQuotationMenuId(null);
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (e: any) {
      setActionError(e.message || 'Error accepting quotation');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Quotation Reject Submission (Section 1)
  const handleConfirmReject = async () => {
    if (!rejectModalProject) return;
    if (!rejectionReason.trim()) {
      setActionError('Rejection reason is mandatory.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const qId = rejectModalProject.quotationId || rejectModalProject.id;
      const res = await fetch(`/api/quotations/${qId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          reason: rejectionReason.trim(),
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reject quotation');
      }

      setProjects(prev => prev.map(p => {
        if (p.id === rejectModalProject.id) {
          return {
            ...p,
            status: 'QUOTATION_REJECTED',
            quotationStatus: 'REJECTED',
            approval_status: 'REJECTED',
            rejected_at: new Date().toISOString(),
            rejected_by: currentUser?.id || 'usr-admin-01',
            rejectedByName: currentUser?.fullName || 'Burhan Malu',
            rejection_reason: rejectionReason.trim(),
          };
        }
        return p;
      }));

      setSuccessBanner(`Commercial Quotation for ${rejectModalProject.projectCode} was marked as Rejected. Project cannot proceed to confirmation.`);
      setRejectModalProject(null);
      setRejectionReason('');
      setActiveQuotationMenuId(null);
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (e: any) {
      setActionError(e.message || 'Error rejecting quotation');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Quotation (Section 1)
  const handleEditQuotation = (p: Project) => {
    setActiveQuotationMenuId(null);
    router.push(`/quotation?projectId=${p.id}`);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (currentUser?.role === 'WORKER') {
        const hasWorked = (
          p.assignedWorkerIds?.includes(currentUser.id) ||
          p.installationWorkers?.some(w => 
            w.id === currentUser.id || 
            (w.name && currentUser.fullName && (
              w.name.toLowerCase().trim() === currentUser.fullName.toLowerCase().trim() ||
              currentUser.fullName.toLowerCase().includes(w.name.toLowerCase().trim()) ||
              w.name.toLowerCase().includes(currentUser.fullName.toLowerCase().trim())
            ))
          )
        );
        if (!hasWorked) return false;
      }

      // Tab / Filter logic
      if (currentTab === 'ALL') {
        // Exclude cancelled projects from the active All Projects directory
        if (p.status === 'CANCELLED') return false;
      } else if (currentTab === 'QUOTED') {
        // Quoted filter: displays projects with quotations saved (draft, sent, accepted, rejected)
        const quotedStatuses: ProjectStatus[] = [
          'QUOTATION_DRAFT', 
          'QUOTATION_SENT', 
          'QUOTATION_ACCEPTED', 
          'QUOTATION_REJECTED'
        ];
        if (!quotedStatuses.includes(p.status)) return false;
      } else if (currentTab === 'CANCELLED') {
        if (p.status !== 'CANCELLED') return false;
      } else if (currentTab === 'ACTIVE_RENTAL') {
        if (p.status !== 'ACTIVE_RENTAL' && p.status !== 'INSTALLED' && p.status !== 'EXTENDED') {
          return false;
        }
      } else {
        if (p.status !== currentTab) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = p.projectCode.toLowerCase().includes(q);
        const matchCust = p.customerName.toLowerCase().includes(q);
        const matchSite = p.siteName.toLowerCase().includes(q);
        const matchSup = (p.supervisorName || '').toLowerCase().includes(q);
        const matchReason = (p.cancellationReason || '').toLowerCase().includes(q);
        if (!matchCode && !matchCust && !matchSite && !matchSup && !matchReason) return false;
      }

      return true;
    });
  }, [projects, currentTab, searchQuery, currentUser]);

  const statusCounts = useMemo(() => {
    const activeProjects = projects.filter(p => p.status !== 'CANCELLED');
    const counts: Record<string, number> = { 
      ALL: activeProjects.length,
      QUOTED: projects.filter(p => ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED'].includes(p.status)).length,
      CANCELLED: projects.filter(p => p.status === 'CANCELLED').length,
    };
    STATUS_TABS.forEach(t => {
      if (t.key === 'ALL' || t.key === 'QUOTED' || t.key === 'CANCELLED') return;
      if (t.key === 'ACTIVE_RENTAL') {
        counts[t.key] = projects.filter(p => p.status === 'ACTIVE_RENTAL' || p.status === 'INSTALLED' || p.status === 'EXTENDED').length;
      } else {
        counts[t.key] = projects.filter(p => p.status === t.key).length;
      }
    });
    return counts;
  }, [projects]);

  const activeTabObj = STATUS_TABS.find(t => t.key === currentTab) || STATUS_TABS[0];
  const isCancelledView = currentTab === 'CANCELLED';

  const exportToCSV = () => {
    const headers = isCancelledView
      ? ['Project Code', 'Customer', 'Site', 'Supervisor', 'Status', 'Cancellation Date', 'Cancellation Reason', 'Cancelled By']
      : ['Project Code', 'Customer', 'Site', 'Supervisor', 'Status', 'Rental Start', 'Rental End', 'Monthly Rate (INR)'];

    const rows = filteredProjects.map(p => {
      if (isCancelledView) {
        return [
          p.projectCode,
          `"${p.customerName}"`,
          `"${p.siteName}"`,
          `"${p.supervisorName || ''}"`,
          p.status,
          p.cancelledAt || p.updatedAt || '',
          `"${(p.cancellationReason || '').replace(/"/g, '""')}"`,
          `"${p.cancelledByName || ''}"`,
        ];
      }
      return [
        p.projectCode,
        `"${p.customerName}"`,
        `"${p.siteName}"`,
        `"${p.supervisorName || ''}"`,
        p.status,
        p.rentalStartDate || '',
        p.rentalEndDate || '',
        p.monthlyRentalRate || 0,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alokhandwala_projects_${currentTab.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">Commercial Operations</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#c79e7c]" />
            <span>
              {currentUser.role === 'WORKER'
                ? 'Assigned Sites'
                : currentUser.role === 'SUPERVISOR'
                  ? 'Assigned Projects'
                  : 'Projects Directory'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-200 bg-[#382315] hover:bg-[#4a301e] border border-[#523622] rounded-md transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Export CSV</span>
          </button>

          {can('PROJECT_CREATE_INSPECTION') && (
            <button
              onClick={handleRegisterClick}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Folder Navigation: Active Directory vs Cancelled Archive */}
      <div className="flex items-center gap-2 border-b border-[#e5dac8] pb-1">
        <button
          type="button"
          onClick={() => setCurrentTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition -mb-[5px] cursor-pointer ${
            !isCancelledView
              ? 'border-[#8f6541] text-[#24160c] bg-white rounded-t-lg'
              : 'border-transparent text-stone-600 hover:text-[#24160c] hover:bg-[#fbf9f5] rounded-t-lg'
          }`}
        >
          <FolderKanban className={`w-4 h-4 ${!isCancelledView ? 'text-[#8f6541]' : 'text-stone-400'}`} />
          <span>Active Projects Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            !isCancelledView ? 'bg-[#24160c] text-white' : 'bg-[#ebdcc9] text-[#24160c]'
          }`}>
            {statusCounts.ALL || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('CANCELLED')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition -mb-[5px] cursor-pointer ${
            isCancelledView
              ? 'border-rose-600 text-rose-900 bg-white rounded-t-lg'
              : 'border-transparent text-stone-600 hover:text-rose-900 hover:bg-rose-50/50 rounded-t-lg'
          }`}
        >
          <Ban className={`w-4 h-4 ${isCancelledView ? 'text-rose-600' : 'text-stone-400'}`} />
          <span>Cancelled Projects Folder</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            isCancelledView ? 'bg-rose-700 text-white' : 'bg-stone-200 text-stone-700'
          }`}>
            {statusCounts.CANCELLED || 0}
          </span>
        </button>
      </div>

      {/* Cancelled Projects Archive Banner (when in Cancelled Folder) */}
      {isCancelledView && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-3 shadow-2xs">
          <Archive className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Cancelled Projects Archive Folder</div>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              All projects cancelled during pre-installation are safely archived here with their complete customer details, quotation history, site photos, and audit logs preserved. Scaffolding material reservations were automatically released and restored to available warehouse stock.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-[#e8decb] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isCancelledView ? "Search cancelled projects by code, customer, or reason..." : "Search projects by code, customer name, site, or supervisor..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none text-stone-800 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown (in active directory) */}
          {!isCancelledView && (
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border transition shrink-0 cursor-pointer ${
                  currentTab !== 'ALL'
                    ? 'bg-[#f7f2eb] text-[#24160c] border-[#8f6541] ring-1 ring-[#8f6541]/20'
                    : 'bg-white text-stone-700 border-[#d6c7b2] hover:bg-[#fbf9f5]'
                }`}
              >
                <Filter className={`w-3.5 h-3.5 ${currentTab !== 'ALL' ? 'text-[#8f6541]' : 'text-stone-500'}`} />
                <span>{currentTab === 'ALL' ? 'Filter by Status' : activeTabObj.label}</span>
                {currentTab !== 'ALL' && (
                  <span className="w-4 h-4 rounded-full bg-[#24160c] text-white text-[10px] font-bold flex items-center justify-center">
                    {filteredProjects.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterDropdownOpen ? 'rotate-180 text-[#8f6541]' : 'text-stone-400'}`} />
              </button>

              {filterDropdownOpen && (
                <div className="absolute right-0 sm:left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#d6c7b2] py-1 z-40">
                  <div className="px-3 py-2 border-b border-[#f0e8db] flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <span>Status Filter</span>
                    {currentTab !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('ALL');
                          setFilterDropdownOpen(false);
                        }}
                        className="text-[#8f6541] hover:underline font-semibold cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto py-1 text-xs divide-y divide-[#faf6ee]">
                    {STATUS_TABS.filter(t => t.key !== 'CANCELLED').map((tab) => {
                      const isSelected = currentTab === tab.key;
                      const count = statusCounts[tab.key] || 0;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setCurrentTab(tab.key);
                            setFilterDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#fbf7f0] text-[#24160c] font-bold'
                              : 'text-stone-700 hover:bg-[#faf6ee]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              tab.key === 'ALL' ? 'bg-stone-400' :
                              tab.key === 'NOT_INSTALLED' ? 'bg-stone-400' :
                              tab.key === 'QUOTED' ? 'bg-blue-600' :
                              tab.key === 'CONFIRMED_PROJECT' ? 'bg-amber-600' :
                              tab.key === 'ACTIVE_RENTAL' ? 'bg-emerald-600' :
                              tab.key === 'BUFFER_PERIOD' ? 'bg-orange-500' :
                              tab.key === 'EXTENDED' ? 'bg-teal-600' :
                              tab.key === 'SHIFTING_IN_PROGRESS' ? 'bg-indigo-600' :
                              tab.key === 'REMOVAL_PENDING' ? 'bg-rose-600' :
                              'bg-stone-400'
                            }`} />
                            <span>{tab.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              isSelected ? 'bg-[#ebdcc9] text-[#24160c] font-bold' : 'bg-stone-100 text-stone-500'
                            }`}>
                              {count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#8f6541]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Count and Active Filter Pill */}
        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium self-end sm:self-center whitespace-nowrap">
          {currentTab !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9] rounded-md text-[11px] font-semibold">
              <span>{activeTabObj.label}</span>
              <button
                type="button"
                onClick={() => setCurrentTab('ALL')}
                className="hover:text-black p-0.5 rounded-full cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span>
            {isCancelledView ? 'Cancelled Projects:' : 'Active Projects:'}{' '}
            <span className="font-bold text-[#24160c]">{filteredProjects.length}</span>
          </span>
        </div>
      </div>

      {/* Projects Directory Container */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-[#f0e8db]">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading project records...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center">
              <FolderKanban className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="font-semibold text-stone-700 text-sm">
                {isCancelledView ? 'No cancelled projects' : 'No active project records found'}
              </p>
              <p className="text-xs text-stone-500 mb-3 mt-1">
                {isCancelledView
                  ? 'Projects cancelled during pre-installation will be archived here.'
                  : currentUser?.role === 'WORKER'
                    ? 'You have not been assigned to any scaffolding sites yet.'
                    : 'Register a customer site to initialize a project.'}
              </p>
              {!isCancelledView && can('PROJECT_CREATE_INSPECTION') && (
                <button
                  type="button"
                  onClick={handleRegisterClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-white rounded-md text-xs font-semibold hover:bg-[#382315] transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#c79e7c]" />
                  <span>Register Site</span>
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((p) => {
              const badge = getStatusBadgeConfig(p.status);
              const daysLeft = getDaysDifference(p.bufferEndDate || p.rentalEndDate);
              const preInstall = isPreInstallation(p.status, p.actualInstallationDate);

              return (
                <div key={p.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/projects/${p.id}`} className="font-mono font-bold text-[#24160c] text-sm hover:underline">
                      {p.projectCode}
                    </Link>
                    {['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED'].includes(p.status) || p.quotationId ? (
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={(e) => handleToggleQuotationMenu(p, e)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer hover:shadow-xs hover:brightness-95 active:scale-95 ${badge.className}`}
                          title="Click to Accept, Reject, or Edit quotation"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          <span>{badge.label}</span>
                          <ChevronDown className={`w-3 h-3 opacity-60 ml-0.5 transition-transform duration-150 ${activeQuotationMenuId === p.id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-bold text-[#24160c] text-sm">{p.customerName}</div>
                    <div className="text-stone-500 text-xs flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{p.siteName}</span>
                    </div>
                  </div>

                  {isCancelledView ? (
                    <div className="bg-rose-50/60 p-2.5 rounded-md border border-rose-200/60 text-[11px] space-y-1">
                      <div className="text-rose-900">
                        <strong className="text-rose-950">Cancelled:</strong> {formatDate(p.cancelledAt || p.updatedAt)}
                      </div>
                      <div className="text-rose-800">
                        <strong className="text-rose-950">Reason:</strong> {p.cancellationReason || 'Pre-installation cancellation'}
                      </div>
                      {p.cancelledByName && (
                        <div className="text-[10px] text-rose-700">
                          By: {p.cancelledByName}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f0e8db] text-[11px]">
                      <div>
                        <span className="text-stone-400 block">Supervisor:</span>
                        <span className="font-medium text-stone-700">{p.supervisorName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Monthly Rate:</span>
                        <span className="font-mono font-bold text-stone-900">
                          {p.monthlyRentalRate > 0 ? formatINR(p.monthlyRentalRate, false) : '-'}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between pt-1">
                        <span className="text-stone-400">Rental Deadline:</span>
                        <span className="font-mono font-semibold">
                          {daysLeft !== null ? (
                            <span className={daysLeft < 0 ? 'text-rose-700' : daysLeft <= 3 ? 'text-amber-700' : 'text-stone-700'}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days remaining`}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">Pre-installation</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex items-center gap-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#f7f2eb] hover:bg-[#ebdcc9] text-[#24160c] font-semibold rounded-md transition text-xs border border-[#d6c7b2]"
                    >
                      <span>{isCancelledView ? 'View History' : 'Open Workspace'}</span>
                      <ChevronRight className="w-4 h-4 text-[#8f6541]" />
                    </Link>

                    {!isCancelledView && preInstall && can('PROJECT_CLOSE') && (
                      <button
                        type="button"
                        onClick={() => openCancelModal(p)}
                        className="px-3 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Cancel Pre-installation Project"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
              {isCancelledView ? (
                <tr>
                  <th className="px-4 py-3">Project ID</th>
                  <th className="px-4 py-3">Customer & Site</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Cancellation Date</th>
                  <th className="px-4 py-3">Mandatory Cancellation Reason</th>
                  <th className="px-4 py-3">Cancelled By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3">Project ID</th>
                  <th className="px-4 py-3">Customer & Site</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rental Window</th>
                  <th className="px-4 py-3">Days Left</th>
                  <th className="px-4 py-3">Monthly Rent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[#f0e8db]">
              {loading ? (
                <tr>
                  <td colSpan={isCancelledView ? 7 : 8} className="px-4 py-12 text-center text-stone-400">
                    Loading project records...
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={isCancelledView ? 7 : 8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-stone-400 gap-2 max-w-sm mx-auto">
                      {isCancelledView ? (
                        <>
                          <Archive className="w-8 h-8 text-stone-300" />
                          <p className="font-semibold text-stone-700 text-sm">No Cancelled Projects</p>
                          <p className="text-xs text-stone-500">
                            Pre-installation projects that are cancelled will appear in this archive folder.
                          </p>
                        </>
                      ) : (
                        <>
                          <FolderKanban className="w-8 h-8 text-stone-300" />
                          <p className="font-semibold text-stone-700 text-sm">No active project records found</p>
                          <p className="text-xs text-stone-500 mb-2">
                            {currentUser?.role === 'WORKER'
                              ? 'You have not worked on any registered sites yet.'
                              : 'Register a customer site to initialize a project.'}
                          </p>
                          {can('PROJECT_CREATE_INSPECTION') && (
                            <button
                              type="button"
                              onClick={handleRegisterClick}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-white rounded-md text-xs font-semibold hover:bg-[#382315] transition cursor-pointer"
                            >
                              <PlusCircle className="w-3.5 h-3.5 text-[#c79e7c]" />
                              <span>Register Site</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const badge = getStatusBadgeConfig(p.status);
                  const daysLeft = getDaysDifference(p.bufferEndDate || p.rentalEndDate);
                  const preInstall = isPreInstallation(p.status, p.actualInstallationDate);

                  if (isCancelledView) {
                    return (
                      <tr key={p.id} className="hover:bg-rose-50/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-rose-900 whitespace-nowrap">
                          <Link href={`/projects/${p.id}`} className="hover:underline">
                            {p.projectCode}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900">{p.customerName}</div>
                          <div className="text-stone-500 text-[11px] truncate max-w-xs">{p.siteName}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                          {p.supervisorName || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-700 whitespace-nowrap font-mono">
                          {formatDate(p.cancelledAt || p.updatedAt)}
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          <div className="text-rose-900 bg-rose-50 p-1.5 rounded border border-rose-200/80 font-medium text-[11px] line-clamp-2">
                            {p.cancellationReason || 'Pre-installation cancellation'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                          {p.cancelledByName || 'Burhan Malu (Admin)'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            href={`/projects/${p.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-stone-800 bg-[#f7f2eb] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded-md transition"
                          >
                            <span>Open History</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#8f6541]" />
                          </Link>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-mono font-bold text-[#24160c] whitespace-nowrap">
                        <Link href={`/projects/${p.id}`} className="hover:underline hover:text-[#8f6541]">
                          {p.projectCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-stone-900">{p.customerName}</div>
                        <div className="text-stone-500 text-[11px] truncate max-w-xs">{p.siteName}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                        {p.supervisorName || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED'].includes(p.status) || p.quotationId ? (
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(e) => handleToggleQuotationMenu(p, e)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold border transition cursor-pointer hover:shadow-xs hover:brightness-95 active:scale-95 ${badge.className}`}
                              title="Click to Accept, Reject, or Edit quotation"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                              <span>{badge.label}</span>
                              <ChevronDown className={`w-3 h-3 opacity-60 ml-0.5 transition-transform duration-150 ${activeQuotationMenuId === p.id ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600 whitespace-nowrap font-mono">
                        {p.rentalStartDate ? (
                          <div>
                            <div>{formatDate(p.rentalStartDate)}</div>
                            <div className="text-[10px] text-stone-400">to {formatDate(p.rentalEndDate)}</div>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Pre-installation</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        {daysLeft !== null ? (
                          <span className={`font-semibold ${
                            daysLeft < 0 ? 'text-rose-700' : daysLeft <= 3 ? 'text-amber-700' : 'text-stone-700'
                          }`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days`}
                          </span>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-stone-900 whitespace-nowrap">
                        {(() => {
                          const pDims = extractProjectDimensions(p);
                          const rent = (p.monthlyRentalRate === 11000 && pDims.elevationAreaSqFt === 1000)
                            ? 22000
                            : (p.monthlyRentalRate || (pDims.elevationAreaSqFt > 0 ? pDims.elevationAreaSqFt * (p.ratePerSqFt || 22) : 0));
                          return rent > 0 ? formatINR(rent, false) : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/projects/${p.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#24160c] bg-[#f7f2eb] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded-md transition"
                          >
                            <span>Workspace</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#8f6541]" />
                          </Link>

                          {preInstall && can('PROJECT_CLOSE') && (
                            <button
                              type="button"
                              onClick={() => openCancelModal(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition cursor-pointer"
                              title="Cancel Pre-installation Project"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-700" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CANCEL PROJECT CONFIRMATION MODAL */}
      {projectToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !cancelling && setProjectToCancel(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#f0e8db] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200">
                  <AlertOctagon className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#24160c]">
                    Cancel Project: {projectToCancel.projectCode}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Pre-installation project cancellation and inventory release
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setProjectToCancel(null)}
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
                <span className="font-bold text-[#24160c]">{projectToCancel.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Site Location:</span>
                <span className="font-semibold text-stone-800 truncate max-w-[260px]">{projectToCancel.siteName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Current Lifecycle Status:</span>
                <span className="font-mono font-semibold text-[#8f6541] bg-white px-2 py-0.5 rounded border border-[#ebdcc9]">
                  {projectToCancel.status}
                </span>
              </div>

              {/* Reserved Stock Details */}
              {projectToCancel.materials && projectToCancel.materials.some(m => (m.reservedQuantity || 0) > 0) && (
                <div className="pt-2 border-t border-[#ebdcc9] flex items-center justify-between text-[#8c5e39]">
                  <span className="font-semibold flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Active Reserved Scaffolding:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                    {projectToCancel.materials.reduce((sum, m) => sum + (m.reservedQuantity || 0), 0)} pieces will be released
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
              <div>• Project will be transitioned to <strong className="text-rose-900">Cancelled</strong> status and moved out of active directory into the <strong className="text-stone-900">Cancelled Projects Folder</strong>.</div>
              <div>• Any active material reservations will be automatically released back to warehouse usable stock.</div>
              <div>• All existing project records, quotations, dimensions, site photos, and logs will remain permanently saved in read-only mode for audit compliance.</div>
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
                onClick={() => setProjectToCancel(null)}
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

      {/* Access Restriction Modal */}
      {restrictionModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-[#d6c7b2] p-6 text-stone-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#fbf7f0] text-[#8f6541] flex items-center justify-center shrink-0 border border-[#ebdcc9]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-serif font-bold text-[#24160c]">
                  {restrictionModal.title}
                </h3>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed whitespace-pre-line">
                  {restrictionModal.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictionModal(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#fbf9f5] rounded-md p-3 border border-[#ede3d4] text-[11px] text-stone-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#24160c]">
                <Lock className="w-3.5 h-3.5 text-[#8f6541]" />
                <span>ERP Role Matrix:</span>
              </div>
              <div>• <strong className="text-stone-900">ADMIN:</strong> Full control over all ERP modules, inventory, accounts, and audits</div>
              <div>• <strong className="text-stone-900">SUPERVISOR:</strong> Site Registration, field inspection, and commissioning execution</div>
              <div>• <strong className="text-stone-900">WORKER:</strong> View only sites worked on with read-only workforce log access</div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setRestrictionModal(null)}
                className="w-full sm:w-auto px-5 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-md text-xs font-semibold transition"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT QUOTATION CONFIRMATION MODAL (Section 1) */}
      {acceptModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !actionLoading && setAcceptModalProject(null)} />
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
                    {acceptModalProject.projectCode} • {acceptModalProject.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setAcceptModalProject(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="bg-[#fbf9f5] rounded-lg p-3.5 border border-[#ede3d4] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-bold text-[#24160c]">{acceptModalProject.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Site Location:</span>
                <span className="font-semibold text-stone-800 truncate max-w-[260px]">{acceptModalProject.siteName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Quotation Total:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  {acceptModalProject.quotationAmount ? formatINR(acceptModalProject.quotationAmount) : formatINR(acceptModalProject.agreedProjectPrice)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-md text-[11px] text-emerald-950 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Info className="w-3.5 h-3.5 text-emerald-700" />
                <span>Approval Confirmation:</span>
              </div>
              <div>• Approving this quotation will transition the project status to <strong className="text-emerald-900">Quotation Accepted</strong>.</div>
              <div>• The approval date, time, and your administrator ID will be permanently saved in the database.</div>
              <div>• The project will become officially eligible to proceed to <strong className="text-stone-900">Project Confirmation & Plan</strong>.</div>
            </div>

            <div className="pt-2 border-t border-[#f0e8db] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setAcceptModalProject(null)}
                className="px-4 py-2 rounded-md border border-[#d6c7b2] text-stone-700 hover:bg-[#fbf9f5] text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAccept}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Accept Quotation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT QUOTATION CONFIRMATION MODAL (Section 1) */}
      {rejectModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => !actionLoading && setRejectModalProject(null)} />
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
                    {rejectModalProject.projectCode} • {rejectModalProject.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectModalProject(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="bg-[#fbf9f5] rounded-lg p-3.5 border border-[#ede3d4] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-bold text-[#24160c]">{rejectModalProject.customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Site Location:</span>
                <span className="font-semibold text-stone-800 truncate max-w-[260px]">{rejectModalProject.siteName}</span>
              </div>
            </div>

            {/* Mandatory Reason Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#24160c]">
                Mandatory Rejection Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (actionError) setActionError(null);
                }}
                placeholder="Enter mandatory reason for rejecting this quotation (e.g. Commercial rate revision requested, site measurement mismatch, alternate package requested)..."
                className="w-full p-2.5 text-xs bg-white border border-[#d6c7b2] rounded-md focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-md text-[11px] text-rose-950 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <Info className="w-3.5 h-3.5 text-rose-700" />
                <span>Rejection Rules:</span>
              </div>
              <div>• Status will update to <strong className="text-rose-900">Quotation Rejected</strong> with a red indicator.</div>
              <div>• The project is <strong className="text-rose-950 font-bold">blocked</strong> from proceeding to Project Confirmation & Plan until revised.</div>
              <div>• The quotation can be edited, which will return it to Pending Approval for re-evaluation.</div>
            </div>

            <div className="pt-2 border-t border-[#f0e8db] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectModalProject(null)}
                className="px-4 py-2 rounded-md border border-[#d6c7b2] text-stone-700 hover:bg-[#fbf9f5] text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 border border-rose-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
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

      {/* FLOATING PORTAL DROPDOWN: QUOTATION APPROVAL ACTIONS */}
      {isMounted && menuAnchor && createPortal(
        <div
          ref={quotationMenuRef}
          style={{
            position: 'fixed',
            top: menuAnchor.position.top !== undefined ? `${menuAnchor.position.top}px` : undefined,
            bottom: menuAnchor.position.bottom !== undefined ? `${menuAnchor.position.bottom}px` : undefined,
            left: `${menuAnchor.position.left}px`,
            width: '220px',
            zIndex: 9999,
          }}
          className="bg-white rounded-lg shadow-2xl border border-[#d6c7b2] py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-1.5 border-b border-[#f0e8db] flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Quotation Approval
            </span>
            <span className="text-[9px] font-mono font-bold text-[#8f6541] bg-[#fbf7f0] px-1.5 py-0.5 rounded border border-[#ebdcc9]">
              {menuAnchor.project.projectCode}
            </span>
          </div>

          <div className="py-1">
            {/* Option 1: Accept */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const p = menuAnchor.project;
                setMenuAnchor(null);
                setAcceptModalProject(p);
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex flex-col">
                <span>Accept Quotation</span>
                <span className="text-[10px] text-emerald-700 font-normal">Approve & enable confirmation</span>
              </div>
            </button>

            {/* Option 2: Reject */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const p = menuAnchor.project;
                setMenuAnchor(null);
                setRejectModalProject(p);
                setRejectionReason('');
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="flex flex-col">
                <span>Reject Quotation</span>
                <span className="text-[10px] text-rose-700 font-normal">Decline with mandatory reason</span>
              </div>
            </button>

            {/* Option 3: Edit */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const p = menuAnchor.project;
                setMenuAnchor(null);
                handleEditQuotation(p);
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#4d301c] hover:bg-[#faf6ee] flex items-center gap-2.5 transition cursor-pointer border-t border-[#f4ede3] mt-0.5"
            >
              <Edit3 className="w-4 h-4 text-[#8f6541] shrink-0" />
              <div className="flex flex-col">
                <span>Edit Quotation</span>
                <span className="text-[10px] text-stone-500 font-normal">Revise rates, items & remarks</span>
              </div>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
