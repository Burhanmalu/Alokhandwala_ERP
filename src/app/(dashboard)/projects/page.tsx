'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { Project, ProjectStatus } from '@/lib/schema';
import { formatINR, formatDate, getStatusBadgeConfig, getDaysDifference } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All Projects' },
  { key: 'NOT_INSTALLED', label: 'Not Installed' },
  { key: 'CONFIRMED_PROJECT', label: 'Confirmed (Reserved)' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'ACTIVE_RENTAL', label: 'Active Rentals' },
  { key: 'BUFFER_PERIOD', label: 'Buffer Period' },
  { key: 'EXTENDED', label: 'Extended' },
  { key: 'SHIFTING_IN_PROGRESS', label: 'Shifting' },
  { key: 'REMOVAL_PENDING', label: 'Removal Pending' },
  { key: 'RETURNED_RECONCILIATION', label: 'Reconciliation' },
  { key: 'CLOSED', label: 'Closed' },
];

export default function ProjectsListPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading projects directory...</div>}>
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

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (statusFromUrl) setCurrentTab(statusFromUrl);

    const denied = searchParams.get('denied');
    if (denied && currentUser?.role === 'WORKER') {
      setRestrictionModal({
        open: true,
        title: 'You Cannot Create New Sites',
        message: 'As a Worker, your account does not have permission to create or register sites. You can only view the sites and scaffolding installations you have worked on. Only Supervisors and Admins can create sites and installation forms.',
      });
    }
  }, [searchParams, currentUser]);

  const handleRegisterClick = () => {
    if (currentUser?.role === 'WORKER') {
      setRestrictionModal({
        open: true,
        title: 'You Cannot Create New Sites',
        message: `As a Worker (${currentUser.fullName}), your account does not have permission to create or register sites. You can only view the sites and scaffolding installations you have worked on.\n\nOnly Supervisors and Admins can create sites and submit installation forms.`,
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

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Worker Role: ONLY see sites worked on
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

      // Tab Filter
      if (currentTab !== 'ALL' && p.status !== currentTab) {
        if (currentTab === 'ACTIVE_RENTAL' && (p.status === 'INSTALLED' || p.status === 'EXTENDED')) {
          // group active
        } else {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = p.projectCode.toLowerCase().includes(q);
        const matchCust = p.customerName.toLowerCase().includes(q);
        const matchSite = p.siteName.toLowerCase().includes(q);
        const matchSup = p.supervisorName.toLowerCase().includes(q);
        if (!matchCode && !matchCust && !matchSite && !matchSup) return false;
      }

      return true;
    });
  }, [projects, currentTab, searchQuery, currentUser]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: projects.length };
    STATUS_TABS.forEach(t => {
      if (t.key === 'ALL') return;
      if (t.key === 'ACTIVE_RENTAL') {
        counts[t.key] = projects.filter(p => p.status === 'ACTIVE_RENTAL' || p.status === 'INSTALLED' || p.status === 'EXTENDED').length;
      } else {
        counts[t.key] = projects.filter(p => p.status === t.key).length;
      }
    });
    return counts;
  }, [projects]);

  const activeTabObj = STATUS_TABS.find(t => t.key === currentTab) || STATUS_TABS[0];

  const exportToCSV = () => {
    const headers = ['Project Code', 'Customer', 'Site', 'Supervisor', 'Status', 'Rental Start', 'Rental End', 'Monthly Rate (INR)'];
    const rows = filteredProjects.map(p => [
      p.projectCode,
      `"${p.customerName}"`,
      `"${p.siteName}"`,
      `"${p.supervisorName}"`,
      p.status,
      p.rentalStartDate || '',
      p.rentalEndDate || '',
      p.monthlyRentalRate || 0,
    ]);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-emerald-600" />
            <span>
              {currentUser.role === 'WORKER'
                ? 'Sites Worked On'
                : currentUser.role === 'SUPERVISOR'
                  ? 'Assigned Sites & Projects'
                  : 'Projects Lifecycle Directory'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser.role === 'WORKER'
              ? 'Showing only the sites and scaffolding installations you have worked on.'
              : 'Manage scaffolding contracts from site inspection to installation, rental extension, shifting, and dismantling.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {can('PROJECT_CREATE_INSPECTION') && (
            <Link
              href="/projects/new"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Site Inspection</span>
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by code, customer, site, or supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Button with Dropdown Popover */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer shrink-0 shadow-2xs ${
                currentTab !== 'ALL'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className={`w-3.5 h-3.5 ${currentTab !== 'ALL' ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>{currentTab === 'ALL' ? 'Filter by Status' : activeTabObj.label}</span>
              {currentTab !== 'ALL' && (
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {filteredProjects.length}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterDropdownOpen ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} />
            </button>

            {/* Dropdown Menu */}
            {filterDropdownOpen && (
              <div className="absolute right-0 sm:left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Filter by Status</span>
                  {currentTab !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('ALL');
                        setFilterDropdownOpen(false);
                      }}
                      className="text-emerald-700 hover:underline capitalize font-semibold cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto py-1 text-xs divide-y divide-slate-50">
                  {STATUS_TABS.map((tab) => {
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
                            ? 'bg-emerald-50/80 text-emerald-900 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            tab.key === 'ALL' ? 'bg-slate-400' :
                            tab.key === 'NOT_INSTALLED' ? 'bg-slate-400' :
                            tab.key === 'CONFIRMED_PROJECT' ? 'bg-blue-500' :
                            tab.key === 'ACTIVE_RENTAL' ? 'bg-emerald-500' :
                            tab.key === 'BUFFER_PERIOD' ? 'bg-amber-500' :
                            tab.key === 'EXTENDED' ? 'bg-teal-500' :
                            tab.key === 'SHIFTING_IN_PROGRESS' ? 'bg-indigo-500' :
                            tab.key === 'REMOVAL_PENDING' ? 'bg-rose-500' :
                            'bg-slate-300'
                          }`} />
                          <span>{tab.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                            isSelected ? 'bg-emerald-200 text-emerald-900 font-bold' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Count and Active Filter Pill */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium self-end sm:self-center whitespace-nowrap">
          {currentTab !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-semibold">
              <span>{activeTabObj.label}</span>
              <button
                type="button"
                onClick={() => setCurrentTab('ALL')}
                className="hover:text-emerald-950 p-0.5 rounded-full cursor-pointer"
                title="Clear status filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span>
            Showing <span className="font-bold text-slate-800">{filteredProjects.length}</span> of <span className="font-semibold text-slate-600">{projects.length}</span> projects
          </span>
        </div>
      </div>

      {/* Projects Directory Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Mobile Projects Card List (Phone View) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Loading project records...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2 max-w-sm mx-auto">
                <FolderKanban className="w-8 h-8 text-slate-300" />
                <p className="font-semibold text-slate-700 text-sm">No projects registered yet</p>
                <p className="text-xs text-slate-500 mb-2">
                  {currentUser?.role === 'WORKER'
                    ? 'You have not worked on any registered sites yet.'
                    : 'Start by registering a customer site to create a project.'}
                </p>
                <button
                  type="button"
                  onClick={handleRegisterClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition shadow-2xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Register New Site</span>
                </button>
              </div>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const badge = getStatusBadgeConfig(p.status);
              const daysLeft = getDaysDifference(p.bufferEndDate || p.rentalEndDate);

              return (
                <div key={p.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/projects/${p.id}`} className="font-mono font-bold text-slate-900 text-sm hover:text-emerald-700">
                      {p.projectCode}
                    </Link>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900 text-sm">{p.customerName}</div>
                    <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{p.siteName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Supervisor:</span>
                      <span className="font-medium text-slate-700">{p.supervisorName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Monthly Rate:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {p.monthlyRentalRate > 0 ? formatINR(p.monthlyRentalRate, false) : '-'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between pt-1">
                      <span className="text-slate-400">Rental Deadline:</span>
                      <span className="font-mono font-semibold">
                        {daysLeft !== null ? (
                          <span className={daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-700'}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days remaining`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pre-installation</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/projects/${p.id}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl transition text-xs min-h-[42px]"
                    >
                      <span>Open Project Workspace</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Projects Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
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
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading project records...
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-2 max-w-sm mx-auto">
                      <FolderKanban className="w-9 h-9 text-slate-300" />
                      <p className="font-semibold text-slate-700 text-sm">
                        {currentUser?.role === 'WORKER' ? 'No projects registered yet' : 'No projects registered yet'}
                      </p>
                      <p className="text-xs text-slate-500 mb-2">
                        {currentUser?.role === 'WORKER'
                          ? 'You have not worked on any registered sites yet. As a worker, you can only view sites where you have been assigned in the workforce.'
                          : 'Start by registering a customer site to create a project in Not Installed status.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleRegisterClick}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition shadow-2xs cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Register New Site</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const badge = getStatusBadgeConfig(p.status);
                  const daysLeft = getDaysDifference(p.bufferEndDate || p.rentalEndDate);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition group">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link href={`/projects/${p.id}`} className="hover:text-emerald-700 hover:underline">
                          {p.projectCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.customerName}</div>
                        <div className="text-slate-500 text-[11px] truncate max-w-xs">{p.siteName}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {p.supervisorName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">
                        {p.rentalStartDate ? (
                          <div>
                            <div>{formatDate(p.rentalStartDate)}</div>
                            <div className="text-[10px] text-slate-400">to {formatDate(p.rentalEndDate)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pre-installation</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        {daysLeft !== null ? (
                          <span className={`font-semibold ${
                            daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days`}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {p.monthlyRentalRate > 0 ? formatINR(p.monthlyRentalRate, false) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                        >
                          <span>Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Restriction Modal for Worker */}
      {restrictionModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-slate-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  {restrictionModal.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">
                  {restrictionModal.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictionModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>ERP Role Rules:</span>
              </div>
              <div>• <strong className="text-slate-900">ADMIN:</strong> Full control over all ERP modules and records</div>
              <div>• <strong className="text-slate-900">SUPERVISOR:</strong> Site Form & Installation Form creation</div>
              <div>• <strong className="text-slate-900">WORKER:</strong> View only sites worked on (no creation permissions)</div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setRestrictionModal(null)}
                className="w-full sm:w-auto px-5 py-2 bg-[#8c5e39] hover:bg-[#724a2c] text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
