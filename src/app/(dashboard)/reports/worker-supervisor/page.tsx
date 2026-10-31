'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { 
  Award, 
  Users, 
  UserCheck, 
  Calendar, 
  Filter, 
  Search, 
  Download, 
  RefreshCw, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  ChevronRight, 
  X, 
  Eye, 
  Layers, 
  Clock, 
  ShieldCheck, 
  ArrowUpDown,
  Briefcase,
  GitCompare,
  TrendingDown,
  Minus
} from 'lucide-react';
import { formatDate, getStatusBadgeConfig } from '@/lib/formatters';

interface ProjectDetail {
  projectId: string;
  projectCode: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  installationDate: string;
  status: string;
  assignedSupervisors: string[];
  assignedWorkers: string[];
}

interface EmployeeRecord {
  id: string;
  name: string;
  role: 'SUPERVISOR' | 'WORKER';
  email?: string;
  phone?: string;
  completedProjectsCount: number;
  allTimeProjectsCount: number;
  monthlyBreakdown: Record<string, number>;
  projects: ProjectDetail[];
}

interface SummaryData {
  totalCompletedProjects: number;
  activeSupervisorsCount: number;
  activeWorkersCount: number;
  totalSupervisorAssignments: number;
  totalWorkerAssignments: number;
  topSupervisor?: { name: string; count: number };
  topWorker?: { name: string; count: number };
}

interface RawProject {
  id: string;
  projectCode: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  status: string;
  installationDate: string;
  year: number;
  month: number;
  monthKey: string;
  supervisors: { id: string; name: string }[];
  workers: { id: string; name: string; role: string }[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function WorkerSupervisorReportsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // Role-based security redirect
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECTS' | 'COMPARISON'>('OVERVIEW');

  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<'ALL' | 'SUPERVISOR' | 'WORKER'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cross-Month Comparison State
  const [compareMonthA, setCompareMonthA] = useState<string>('');
  const [compareMonthB, setCompareMonthB] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<SummaryData>({
    totalCompletedProjects: 0,
    activeSupervisorsCount: 0,
    activeWorkersCount: 0,
    totalSupervisorAssignments: 0,
    totalWorkerAssignments: 0,
  });
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [projects, setProjects] = useState<RawProject[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([2026]);
  const [availableMonthKeys, setAvailableMonthKeys] = useState<string[]>([]);

  // Selected Employee Modal State
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  // Fetch Report Data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear);
      if (selectedMonth && selectedMonth !== 'ALL') params.append('month', selectedMonth);
      if (selectedRole && selectedRole !== 'ALL') params.append('role', selectedRole);
      if (searchQuery.trim()) params.append('employeeName', searchQuery.trim());

      const res = await fetch(`/api/reports/worker-supervisor?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setSummary(json.data.summary || {});
        setEmployees(json.data.employees || []);
        setProjects(json.data.projects || []);
        if (json.data.availableYears?.length) {
          setAvailableYears(json.data.availableYears);
        }
        if (json.data.availableMonthKeys?.length) {
          setAvailableMonthKeys(json.data.availableMonthKeys);
          // Set default comparison months if empty
          if (!compareMonthA && json.data.availableMonthKeys[1]) {
            setCompareMonthA(json.data.availableMonthKeys[1]);
          } else if (!compareMonthA && json.data.availableMonthKeys[0]) {
            setCompareMonthA(json.data.availableMonthKeys[0]);
          }
          if (!compareMonthB && json.data.availableMonthKeys[0]) {
            setCompareMonthB(json.data.availableMonthKeys[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load performance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedYear, selectedMonth, selectedRole, searchQuery]);

  // Handle Cross-Month Comparison
  const fetchComparison = async () => {
    if (!compareMonthA || !compareMonthB) return;
    setLoadingComparison(true);
    try {
      const res = await fetch(`/api/reports/worker-supervisor?compareA=${compareMonthA}&compareB=${compareMonthB}`);
      const json = await res.json();
      if (json.success && json.data) {
        setComparisonResult(json.data);
      }
    } catch (err) {
      console.error('Comparison fetch failed:', err);
    } finally {
      setLoadingComparison(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'COMPARISON' && compareMonthA && compareMonthB) {
      fetchComparison();
    }
  }, [activeTab, compareMonthA, compareMonthB]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!employees || employees.length === 0) return;

    const headers = [
      'Employee Name',
      'Role',
      'Phone',
      'Email',
      'Completed Projects (Selected Period)',
      'All-Time Completed Projects',
      'Assigned Projects (Codes)'
    ];

    const rows = employees.map(emp => [
      `"${emp.name.replace(/"/g, '""')}"`,
      emp.role,
      `"${emp.phone || ''}"`,
      `"${emp.email || ''}"`,
      emp.completedProjectsCount,
      emp.allTimeProjectsCount,
      `"${emp.projects.map(p => p.projectCode).join(', ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `alokhandwala_worker_supervisor_report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper label for month display
  const getMonthLabel = (mKey: string) => {
    if (!mKey || !mKey.includes('-')) return mKey;
    const [y, m] = mKey.split('-');
    const mIdx = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[mIdx] || m} ${y}`;
  };

  return (
    <div className="min-h-full space-y-6 pb-16 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#24160c] text-[#fdf8f4] p-5 sm:p-6 rounded-2xl border border-[#4d301c] shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#8c5e39]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#c79e7c]">
              <span>COMMERCIAL DIRECTORY</span>
              <span>&bull;</span>
              <span>Performance Analytics</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#362113] border border-[#5a3821] text-[#c79e7c]">
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fdf8f4]">
                Worker & Supervisor Performance Reports
              </h1>
            </div>
            <p className="text-xs text-[#debfa6] max-w-2xl">
              Track project completion metrics for field supervisors and scaffolders. Audit actual installation records, filter by month/year, and analyze workforce deployment across sites.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={handleExportCSV}
              disabled={loading || employees.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#c79e7c] text-[#19100a] hover:bg-[#d8b394] transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-[#362113] text-[#fdf8f4] border border-[#5a3821] hover:bg-[#432918] transition shadow-sm cursor-pointer"
              title="Refresh Performance Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-[#3d2515] overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#c79e7c] text-[#19100a] font-semibold shadow-xs'
                : 'text-[#debfa6] hover:bg-[#362113] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workforce Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('PROJECTS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'PROJECTS'
                ? 'bg-[#c79e7c] text-[#19100a] font-semibold shadow-xs'
                : 'text-[#debfa6] hover:bg-[#362113] hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Completed Projects ({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('COMPARISON')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'COMPARISON'
                ? 'bg-[#c79e7c] text-[#19100a] font-semibold shadow-xs'
                : 'text-[#debfa6] hover:bg-[#362113] hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Cross-Month Comparison</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar (Always visible on Overview and Projects tabs) */}
      {activeTab !== 'COMPARISON' && (
        <div className="bg-[#fdfbf7] border border-[#ebdcc9] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#f0e3d3]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#24160c] uppercase tracking-wide">
              <Filter className="w-4 h-4 text-[#8c5e39]" />
              <span>Report Filters &amp; Parameters</span>
            </div>
            
            {(selectedYear !== '2026' || selectedMonth !== 'ALL' || selectedRole !== 'ALL' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedYear('2026');
                  setSelectedMonth('ALL');
                  setSelectedRole('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-[#8c5e39] hover:text-[#5a3821] font-semibold underline underline-offset-2 self-start md:self-auto cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Year Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#664b38] block">
                Year
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c5e39] pointer-events-none" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Month Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#664b38] block">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
              >
                <option value="ALL">All Months (Full Year)</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {String(idx + 1).padStart(2, '0')} - {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#664b38] block">
                Role Filter
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
              >
                <option value="ALL">All Personnel (Workers &amp; Supervisors)</option>
                <option value="SUPERVISOR">Supervisors Only</option>
                <option value="WORKER">Workers Only</option>
              </select>
            </div>

            {/* Employee Name Search */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#664b38] block">
                Search Employee
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c5e39] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Ramesh, Mustafa..."
                  className="w-full pl-9 pr-7 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c5e39] hover:text-[#24160c]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Month Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px]">
            <span className="text-[#8c5e39] font-semibold mr-1">Quick Select:</span>
            <button
              onClick={() => { setSelectedMonth('ALL'); setSelectedYear('2026'); }}
              className={`px-2.5 py-1 rounded-full transition cursor-pointer border ${
                selectedMonth === 'ALL'
                  ? 'bg-[#24160c] text-white border-[#24160c] font-semibold'
                  : 'bg-white text-[#664b38] border-[#ebdcc9] hover:bg-[#f7f2ea]'
              }`}
            >
              All Year 2026
            </button>
            <button
              onClick={() => { setSelectedMonth('10'); setSelectedYear('2026'); }}
              className={`px-2.5 py-1 rounded-full transition cursor-pointer border ${
                selectedMonth === '10' && selectedYear === '2026'
                  ? 'bg-[#24160c] text-white border-[#24160c] font-semibold'
                  : 'bg-white text-[#664b38] border-[#ebdcc9] hover:bg-[#f7f2ea]'
              }`}
            >
              October 2026
            </button>
            <button
              onClick={() => { setSelectedMonth('11'); setSelectedYear('2026'); }}
              className={`px-2.5 py-1 rounded-full transition cursor-pointer border ${
                selectedMonth === '11' && selectedYear === '2026'
                  ? 'bg-[#24160c] text-white border-[#24160c] font-semibold'
                  : 'bg-white text-[#664b38] border-[#ebdcc9] hover:bg-[#f7f2ea]'
              }`}
            >
              November 2026
            </button>
            <button
              onClick={() => { setSelectedMonth('12'); setSelectedYear('2026'); }}
              className={`px-2.5 py-1 rounded-full transition cursor-pointer border ${
                selectedMonth === '12' && selectedYear === '2026'
                  ? 'bg-[#24160c] text-white border-[#24160c] font-semibold'
                  : 'bg-white text-[#664b38] border-[#ebdcc9] hover:bg-[#f7f2ea]'
              }`}
            >
              December 2026
            </button>
          </div>
        </div>
      )}

      {/* 3. Performance Summary KPI Cards (Overview & Projects tabs) */}
      {activeTab !== 'COMPARISON' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Completed Projects */}
          <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#ebdcc9] shadow-xs hover:border-[#c79e7c] transition">
            <div className="flex items-center justify-between text-[#8c5e39] mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Completed Sites</span>
              <Building2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#24160c]">
              {summary.totalCompletedProjects}
            </div>
            <p className="text-[10px] text-[#8c5e39] mt-0.5 font-medium">
              Sites installed in selected period
            </p>
          </div>

          {/* Card 2: Active Supervisors */}
          <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#ebdcc9] shadow-xs hover:border-[#c79e7c] transition">
            <div className="flex items-center justify-between text-[#8c5e39] mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Supervisors Active</span>
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#24160c]">
              {summary.activeSupervisorsCount}
            </div>
            <p className="text-[10px] text-[#8c5e39] mt-0.5 font-medium">
              Assigned &amp; oversaw site erections
            </p>
          </div>

          {/* Card 3: Active Workers */}
          <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#ebdcc9] shadow-xs hover:border-[#c79e7c] transition">
            <div className="flex items-center justify-between text-[#8c5e39] mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Workers Deployed</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-[#24160c]">
              {summary.activeWorkersCount}
            </div>
            <p className="text-[10px] text-[#8c5e39] mt-0.5 font-medium">
              Riggers &amp; technicians on sites
            </p>
          </div>

          {/* Card 4: Top Supervisor */}
          <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#ebdcc9] shadow-xs hover:border-[#c79e7c] transition">
            <div className="flex items-center justify-between text-[#8c5e39] mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Top Supervisor</span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-sm font-bold text-[#24160c] truncate">
              {summary.topSupervisor ? summary.topSupervisor.name : 'None'}
            </div>
            <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
              {summary.topSupervisor ? `${summary.topSupervisor.count} projects completed` : 'No completions yet'}
            </p>
          </div>

          {/* Card 5: Top Worker */}
          <div className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#ebdcc9] shadow-xs hover:border-[#c79e7c] transition col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[#8c5e39] mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Top Worker</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-sm font-bold text-[#24160c] truncate">
              {summary.topWorker ? summary.topWorker.name : 'None'}
            </div>
            <p className="text-[10px] text-emerald-800 font-semibold mt-0.5">
              {summary.topWorker ? `${summary.topWorker.count} projects completed` : 'No completions yet'}
            </p>
          </div>
        </div>
      )}

      {/* 4. TAB 1: WORKFORCE OVERVIEW (Individual Employee Performance) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#ebdcc9] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#fbf9f5] border-b border-[#ebdcc9] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#24160c]">
                  Personnel Project Completion Output
                </h2>
                <p className="text-[11px] text-[#664b38]">
                  Showing individual counts for {employees.length} personnel in {selectedMonth === 'ALL' ? `Year ${selectedYear}` : `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f4ece1] text-[#664b38] border border-[#ebdcc9]">
                {employees.filter(e => e.completedProjectsCount > 0).length} active in period
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#8c5e39] space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8c5e39]" />
                <p>Loading real workforce performance records...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="w-8 h-8 text-[#c79e7c] mx-auto opacity-70" />
                <p className="text-sm font-semibold text-[#24160c]">No employees match the current filters</p>
                <p className="text-xs text-[#8c5e39]">Try resetting the month, year, or search query above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f7f2ea] text-[#664b38] border-b border-[#ebdcc9] text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3 text-center">Projects In Period</th>
                      <th className="py-3 px-3 text-center">All-Time Total</th>
                      <th className="py-3 px-4">Recent Assigned Projects</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e4d4]">
                    {employees.map((emp) => {
                      const isSupervisor = emp.role === 'SUPERVISOR';
                      const hasProjects = emp.completedProjectsCount > 0;

                      return (
                        <tr 
                          key={`${emp.role}-${emp.name}`} 
                          className="hover:bg-[#fdfaf5] transition group cursor-pointer"
                          onClick={() => setSelectedEmployee(emp)}
                        >
                          {/* Name & Contact */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isSupervisor 
                                  ? 'bg-[#3d2515] text-[#fdf8f4] border border-[#5a3821]'
                                  : 'bg-[#1e3b2b] text-emerald-100 border border-[#2d5740]'
                              }`}>
                                {emp.name[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[#24160c] text-xs group-hover:text-[#8c5e39] transition">
                                  {emp.name}
                                </div>
                                <div className="text-[10px] text-[#8c5e39] truncate">
                                  {emp.phone || emp.email || 'Alokhandwala Field Team'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isSupervisor
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}>
                              {isSupervisor ? <Award className="w-3 h-3 text-amber-700" /> : <Users className="w-3 h-3 text-emerald-700" />}
                              <span>{emp.role}</span>
                            </span>
                          </td>

                          {/* Period Project Count */}
                          <td className="py-3.5 px-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg font-bold text-xs transition ${
                              hasProjects
                                ? 'bg-[#24160c] text-[#fdf8f4] shadow-2xs'
                                : 'bg-[#f4ece1] text-[#9c826e]'
                            }`}>
                              {emp.completedProjectsCount} {emp.completedProjectsCount === 1 ? 'project' : 'projects'}
                            </span>
                          </td>

                          {/* All-time Projects */}
                          <td className="py-3.5 px-3 text-center text-[#664b38] font-medium">
                            <span className="font-semibold text-[#24160c]">{emp.allTimeProjectsCount}</span> total
                          </td>

                          {/* Recent Projects preview */}
                          <td className="py-3.5 px-4">
                            {emp.projects.length === 0 ? (
                              <span className="text-[11px] text-[#a9927d] italic">No projects in this period</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 max-w-md">
                                {emp.projects.slice(0, 3).map((p) => (
                                  <span 
                                    key={p.projectId}
                                    className="px-2 py-0.5 rounded-md bg-[#f4ece1] text-[#3d2515] text-[10px] font-mono border border-[#e2d2c0]"
                                    title={`${p.customerName} - ${p.siteName}`}
                                  >
                                    {p.projectCode}
                                  </span>
                                ))}
                                {emp.projects.length > 3 && (
                                  <span className="text-[10px] text-[#8c5e39] font-medium self-center">
                                    +{emp.projects.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployee(emp);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#8c5e39] hover:bg-[#f4ece1] border border-transparent hover:border-[#ebdcc9] transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 2: COMPLETED PROJECTS VIEW */}
      {activeTab === 'PROJECTS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#ebdcc9] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#fbf9f5] border-b border-[#ebdcc9] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#24160c]">
                  Installed &amp; Commissioned Projects
                </h2>
                <p className="text-[11px] text-[#664b38]">
                  Verified site installations with recorded supervisors and erection workforce.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f4ece1] text-[#664b38] border border-[#ebdcc9]">
                {projects.length} completed projects
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#8c5e39] space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8c5e39]" />
                <p>Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Building2 className="w-8 h-8 text-[#c79e7c] mx-auto opacity-70" />
                <p className="text-sm font-semibold text-[#24160c]">No completed projects in the selected period</p>
                <p className="text-xs text-[#8c5e39]">Select another month or year from the filter bar above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f7f2ea] text-[#664b38] border-b border-[#ebdcc9] text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Project ID &amp; Code</th>
                      <th className="py-3 px-4">Customer &amp; Site</th>
                      <th className="py-3 px-3">Installation Date</th>
                      <th className="py-3 px-4">Supervisors In Charge</th>
                      <th className="py-3 px-4">Riggers / Workers Assigned</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e4d4]">
                    {projects.map((proj) => {
                      const badgeConfig = getStatusBadgeConfig(proj.status);

                      return (
                        <tr key={proj.id} className="hover:bg-[#fdfaf5] transition">
                          {/* Project Code */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-xs text-[#24160c]">
                              {proj.projectCode}
                            </div>
                            <div className="text-[10px] text-[#8c5e39] font-mono">
                              {proj.id}
                            </div>
                          </td>

                          {/* Customer & Site */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-xs text-[#24160c]">
                              {proj.customerName}
                            </div>
                            <div className="text-[11px] text-[#664b38]">
                              {proj.siteName}
                            </div>
                            <div className="text-[10px] text-[#8c5e39] truncate max-w-xs">
                              {proj.siteAddress}
                            </div>
                          </td>

                          {/* Installation Date */}
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-xs text-[#24160c]">
                              {formatDate(proj.installationDate)}
                            </div>
                            <div className="text-[10px] text-[#8c5e39]">
                              {getMonthLabel(proj.monthKey)}
                            </div>
                          </td>

                          {/* Supervisors */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {proj.supervisors.length === 0 ? (
                                <span className="text-[11px] text-[#a9927d] italic">Unassigned</span>
                              ) : (
                                proj.supervisors.map(sup => (
                                  <span
                                    key={sup.name}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-medium"
                                  >
                                    <Award className="w-2.5 h-2.5 text-amber-700" />
                                    <span>{sup.name}</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Workers */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {proj.workers.length === 0 ? (
                                <span className="text-[11px] text-[#a9927d] italic">No workers logged</span>
                              ) : (
                                proj.workers.map(wrk => (
                                  <span
                                    key={wrk.name}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 text-[10px] font-medium"
                                  >
                                    <Users className="w-2.5 h-2.5 text-emerald-700" />
                                    <span>{wrk.name}</span>
                                    {wrk.role && <span className="text-[9px] text-emerald-700 font-normal">({wrk.role})</span>}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeConfig.className}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dotColor}`} />
                              <span>{badgeConfig.label}</span>
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => router.push(`/projects/${proj.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#8c5e39] hover:text-[#24160c] hover:bg-[#f4ece1] rounded-lg transition cursor-pointer"
                            >
                              <span>View Site</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 3: CROSS-MONTH COMPARISON */}
      {activeTab === 'COMPARISON' && (
        <div className="space-y-6">
          {/* Comparison Selector */}
          <div className="bg-[#fdfbf7] border border-[#ebdcc9] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-[#8c5e39]" />
                  <span>Compare Performance Across Two Months</span>
                </h3>
                <p className="text-[11px] text-[#664b38]">
                  Select two target months to compare completed projects, workforce productivity, and individual deltas.
                </p>
              </div>

              <button
                onClick={fetchComparison}
                disabled={loadingComparison || !compareMonthA || !compareMonthB}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#24160c] text-[#fdf8f4] text-xs font-semibold rounded-xl hover:bg-[#362113] transition shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingComparison ? 'animate-spin' : ''}`} />
                <span>Run Comparison</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-[#f0e3d3]">
              {/* Month A */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#664b38] block">
                  Base Month (Period A)
                </label>
                <select
                  value={compareMonthA}
                  onChange={(e) => setCompareMonthA(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39]"
                >
                  {availableMonthKeys.map(mKey => (
                    <option key={mKey} value={mKey}>
                      {getMonthLabel(mKey)} ({mKey})
                    </option>
                  ))}
                </select>
              </div>

              {/* Month B */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#664b38] block">
                  Target Month (Period B)
                </label>
                <select
                  value={compareMonthB}
                  onChange={(e) => setCompareMonthB(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#debfa6] rounded-xl text-xs text-[#24160c] font-medium focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39]"
                >
                  {availableMonthKeys.map(mKey => (
                    <option key={mKey} value={mKey}>
                      {getMonthLabel(mKey)} ({mKey})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Comparison Output */}
          {comparisonResult && (
            <div className="space-y-6">
              {/* Summary Cards Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Period A Card */}
                <div className="bg-white p-5 rounded-2xl border border-[#ebdcc9] shadow-xs">
                  <div className="text-xs font-bold text-[#8c5e39] uppercase tracking-wider mb-2">
                    Period A: {getMonthLabel(comparisonResult.monthKeyA)}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryA.totalCompletedProjects}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Projects</div>
                    </div>
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryA.activeSupervisorsCount}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Supervisors</div>
                    </div>
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryA.activeWorkersCount}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Workers</div>
                    </div>
                  </div>
                </div>

                {/* Period B Card */}
                <div className="bg-white p-5 rounded-2xl border border-[#c79e7c] shadow-xs">
                  <div className="text-xs font-bold text-[#8c5e39] uppercase tracking-wider mb-2">
                    Period B: {getMonthLabel(comparisonResult.monthKeyB)}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryB.totalCompletedProjects}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Projects</div>
                    </div>
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryB.activeSupervisorsCount}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Supervisors</div>
                    </div>
                    <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                      <div className="text-xl font-bold text-[#24160c]">
                        {comparisonResult.summaryB.activeWorkersCount}
                      </div>
                      <div className="text-[10px] text-[#8c5e39] font-medium">Workers</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Employee Comparison Table */}
              <div className="bg-white rounded-2xl border border-[#ebdcc9] shadow-xs overflow-hidden">
                <div className="p-4 bg-[#fbf9f5] border-b border-[#ebdcc9]">
                  <h3 className="text-sm font-bold text-[#24160c]">
                    Employee-by-Employee Performance Delta
                  </h3>
                  <p className="text-[11px] text-[#664b38]">
                    Comparing completions in {getMonthLabel(comparisonResult.monthKeyA)} vs {getMonthLabel(comparisonResult.monthKeyB)}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f7f2ea] text-[#664b38] border-b border-[#ebdcc9] text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3 text-center">{getMonthLabel(comparisonResult.monthKeyA)}</th>
                        <th className="py-3 px-3 text-center">{getMonthLabel(comparisonResult.monthKeyB)}</th>
                        <th className="py-3 px-3 text-center">Net Delta</th>
                        <th className="py-3 px-4 text-center">Variance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d4]">
                      {comparisonResult.comparison.map((row: any) => {
                        const isPositive = row.diff > 0;
                        const isNegative = row.diff < 0;

                        return (
                          <tr key={`${row.role}-${row.name}`} className="hover:bg-[#fdfaf5] transition">
                            <td className="py-3 px-4 font-bold text-[#24160c]">
                              {row.name}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                row.role === 'SUPERVISOR'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              }`}>
                                {row.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-[#24160c]">
                              {row.countA}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-[#24160c]">
                              {row.countB}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs ${
                                isPositive 
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isNegative 
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {isPositive && <TrendingUp className="w-3 h-3" />}
                                {isNegative && <TrendingDown className="w-3 h-3" />}
                                {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
                                <span>{isPositive ? `+${row.diff}` : row.diff}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-semibold">
                              {row.percentChange !== null ? (
                                <span className={isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-600'}>
                                  {row.percentChange > 0 ? `+${row.percentChange}%` : `${row.percentChange}%`}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Performance Matrix Across All Available Months */}
              <div className="bg-white rounded-2xl border border-[#ebdcc9] shadow-xs overflow-hidden">
                <div className="p-4 bg-[#fbf9f5] border-b border-[#ebdcc9]">
                  <h3 className="text-sm font-bold text-[#24160c]">
                    All-Time Monthly Completion Matrix
                  </h3>
                  <p className="text-[11px] text-[#664b38]">
                    Breakdown of project completions for each worker and supervisor across all recorded months.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f7f2ea] text-[#664b38] border-b border-[#ebdcc9] text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-3">Role</th>
                        {availableMonthKeys.map(mKey => (
                          <th key={mKey} className="py-3 px-3 text-center">
                            {getMonthLabel(mKey)}
                          </th>
                        ))}
                        <th className="py-3 px-4 text-center font-bold bg-[#efe5d7] text-[#24160c]">
                          All-Time Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d4]">
                      {employees.map(emp => (
                        <tr key={emp.name} className="hover:bg-[#fdfaf5] transition">
                          <td className="py-3 px-4 font-bold text-[#24160c]">
                            {emp.name}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              emp.role === 'SUPERVISOR'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}>
                              {emp.role}
                            </span>
                          </td>
                          {availableMonthKeys.map(mKey => {
                            const count = emp.monthlyBreakdown[mKey] || 0;
                            return (
                              <td key={mKey} className="py-3 px-3 text-center">
                                {count > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md font-bold bg-[#24160c] text-[#fdf8f4] text-xs">
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">0</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-center font-bold text-sm text-[#24160c] bg-[#faf6ef]">
                            {emp.allTimeProjectsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. EMPLOYEE DETAILS & PROJECT HISTORY MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#ebdcc9] max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#24160c] text-[#fdf8f4] p-5 border-b border-[#4d301c] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  selectedEmployee.role === 'SUPERVISOR'
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-700 text-white'
                }`}>
                  {selectedEmployee.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#fdf8f4]">
                    {selectedEmployee.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#debfa6]">
                    <span>{selectedEmployee.role}</span>
                    <span>&bull;</span>
                    <span>{selectedEmployee.phone || selectedEmployee.email || 'Alokhandwala Field Operations'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 rounded-lg text-[#debfa6] hover:text-white hover:bg-[#362113] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Stat Chips */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                  <div className="text-2xl font-bold text-[#24160c]">
                    {selectedEmployee.completedProjectsCount}
                  </div>
                  <div className="text-[11px] text-[#8c5e39] font-medium">
                    Projects in Selected Filter
                  </div>
                </div>
                <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                  <div className="text-2xl font-bold text-[#24160c]">
                    {selectedEmployee.allTimeProjectsCount}
                  </div>
                  <div className="text-[11px] text-[#8c5e39] font-medium">
                    All-Time Completed Sites
                  </div>
                </div>
              </div>

              {/* Monthly Activity Bars */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#24160c] uppercase tracking-wider">
                  Monthly Performance Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(selectedEmployee.monthlyBreakdown).map(([mKey, count]) => (
                    <div key={mKey} className="p-2.5 bg-[#f7f2ea] rounded-lg border border-[#ebdcc9] flex items-center justify-between">
                      <span className="font-semibold text-[#664b38]">{getMonthLabel(mKey)}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#24160c] text-white font-bold text-xs">
                        {count} sites
                      </span>
                    </div>
                  ))}
                  {Object.keys(selectedEmployee.monthlyBreakdown).length === 0 && (
                    <div className="col-span-full text-slate-400 italic py-2">
                      No monthly records logged for this employee yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Project History List */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[#24160c] uppercase tracking-wider">
                  Sites Worked On in Selected Period ({selectedEmployee.projects.length})
                </h4>

                {selectedEmployee.projects.length === 0 ? (
                  <div className="p-4 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9] text-center text-[#8c5e39] italic">
                    No projects found for the currently selected filter period.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedEmployee.projects.map((proj) => (
                      <div 
                        key={proj.projectId}
                        className="p-3 bg-[#fdfbf7] rounded-xl border border-[#ebdcc9] hover:border-[#c79e7c] transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-[#24160c]">
                            {proj.projectCode}
                          </span>
                          <span className="text-[10px] text-[#8c5e39] font-medium">
                            {formatDate(proj.installationDate)}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-[#24160c]">
                          {proj.customerName}
                        </div>
                        <div className="text-[11px] text-[#664b38]">
                          {proj.siteName} &bull; {proj.siteAddress}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-[#f0e3d3] text-[10px] text-[#8c5e39]">
                          <span className="font-semibold">Team:</span>
                          <span>Supervisors: {proj.assignedSupervisors.join(', ') || 'None'}</span>
                          <span>&bull;</span>
                          <span>Workers: {proj.assignedWorkers.join(', ') || 'None'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#fbf9f5] border-t border-[#ebdcc9] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 bg-[#24160c] text-[#fdf8f4] text-xs font-semibold rounded-xl hover:bg-[#362113] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

