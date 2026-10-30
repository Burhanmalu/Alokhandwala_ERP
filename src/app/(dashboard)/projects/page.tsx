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
  X,
  Briefcase
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
        title: 'Site Registration Restricted',
        message: 'As a Worker, your account permissions allow viewing sites and scaffolding installations you have worked on. Creating new sites requires Supervisor or Admin authorization.',
      });
    }
  }, [searchParams, currentUser]);

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

      if (currentTab !== 'ALL' && p.status !== currentTab) {
        if (currentTab === 'ACTIVE_RENTAL' && (p.status === 'INSTALLED' || p.status === 'EXTENDED')) {
          // group active
        } else {
          return false;
        }
      }

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
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">Contract Operations</span>
            <span className="text-stone-500">|</span>
            <span className="text-xs text-stone-300">Scaffolding Lifecycle</span>
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#c79e7c]" />
            <span>
              {currentUser.role === 'WORKER'
                ? 'Assigned Sites & Workforce Deployments'
                : currentUser.role === 'SUPERVISOR'
                  ? 'Field Sites & Assigned Projects'
                  : 'Projects Lifecycle Directory'}
            </span>
          </h1>
          <p className="text-xs text-stone-300 mt-1">
            {currentUser.role === 'WORKER'
              ? 'Showing project records and scaffolding installations registered to your crew profile.'
              : 'Complete commercial custody tracking from site registration to commissioning, billing, and dismantling.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-200 bg-[#382315] hover:bg-[#4a301e] border border-[#523622] rounded-md transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Export CSV</span>
          </button>

          {can('PROJECT_CREATE_INSPECTION') && (
            <button
              onClick={handleRegisterClick}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-[#e8decb] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by code, customer name, site, or supervisor..."
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

          {/* Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border transition shrink-0 ${
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
                  <span>Lifecycle Status Filter</span>
                  {currentTab !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('ALL');
                        setFilterDropdownOpen(false);
                      }}
                      className="text-[#8f6541] hover:underline font-semibold"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto py-1 text-xs divide-y divide-[#faf6ee]">
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
                        className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-[#fbf7f0] text-[#24160c] font-bold'
                            : 'text-stone-700 hover:bg-[#faf6ee]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            tab.key === 'ALL' ? 'bg-stone-400' :
                            tab.key === 'NOT_INSTALLED' ? 'bg-stone-400' :
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
        </div>

        {/* Status Count and Active Filter Pill */}
        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium self-end sm:self-center whitespace-nowrap">
          {currentTab !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#fbf7f0] text-[#714f36] border border-[#ebdcc9] rounded-md text-[11px] font-semibold">
              <span>{activeTabObj.label}</span>
              <button
                type="button"
                onClick={() => setCurrentTab('ALL')}
                className="hover:text-black p-0.5 rounded-full"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span>
            Total: <span className="font-bold text-[#24160c]">{filteredProjects.length}</span> of {projects.length}
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
              <p className="font-semibold text-stone-700 text-sm">No project records found</p>
              <p className="text-xs text-stone-500 mb-3 mt-1">
                {currentUser?.role === 'WORKER'
                  ? 'You have not been assigned to any scaffolding sites yet.'
                  : 'Register a customer site to initialize a project.'}
              </p>
              {can('PROJECT_CREATE_INSPECTION') && (
                <button
                  type="button"
                  onClick={handleRegisterClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-white rounded-md text-xs font-semibold hover:bg-[#382315] transition"
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

              return (
                <div key={p.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/projects/${p.id}`} className="font-mono font-bold text-[#24160c] text-sm hover:underline">
                      {p.projectCode}
                    </Link>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-[#24160c] text-sm">{p.customerName}</div>
                    <div className="text-stone-500 text-xs flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{p.siteName}</span>
                    </div>
                  </div>

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

                  <div className="pt-1">
                    <Link
                      href={`/projects/${p.id}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#f7f2eb] hover:bg-[#ebdcc9] text-[#24160c] font-semibold rounded-md transition text-xs border border-[#d6c7b2]"
                    >
                      <span>Open Project Workspace</span>
                      <ChevronRight className="w-4 h-4 text-[#8f6541]" />
                    </Link>
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
            <tbody className="divide-y divide-[#f0e8db]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-stone-400">
                    Loading project records...
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-stone-400 gap-2 max-w-sm mx-auto">
                      <FolderKanban className="w-8 h-8 text-stone-300" />
                      <p className="font-semibold text-stone-700 text-sm">No project records found</p>
                      <p className="text-xs text-stone-500 mb-2">
                        {currentUser?.role === 'WORKER'
                          ? 'You have not worked on any registered sites yet.'
                          : 'Register a customer site to initialize a project.'}
                      </p>
                      {can('PROJECT_CREATE_INSPECTION') && (
                        <button
                          type="button"
                          onClick={handleRegisterClick}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-white rounded-md text-xs font-semibold hover:bg-[#382315] transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-[#c79e7c]" />
                          <span>Register Site</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const badge = getStatusBadgeConfig(p.status);
                  const daysLeft = getDaysDifference(p.bufferEndDate || p.rentalEndDate);

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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {badge.label}
                        </span>
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
                        {p.monthlyRentalRate > 0 ? formatINR(p.monthlyRentalRate, false) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#24160c] bg-[#f7f2eb] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded-md transition"
                        >
                          <span>Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#8f6541]" />
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
    </div>
  );
}
