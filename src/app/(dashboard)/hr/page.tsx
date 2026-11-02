'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, UserPlus, Building2, Calendar, ClipboardList, DollarSign,
  Search, Plus, X, CheckCircle2, AlertCircle, Clock, Ban,
  ChevronDown, RefreshCw, Edit2, Send, PlayCircle, DownloadCloud,
  Briefcase, BadgeCheck, UserCheck, Activity
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  Employee, Department, AttendanceRecord, LeaveRequest, PaySlip
} from '@/lib/schema';

type HRTab = 'overview' | 'employees' | 'attendance' | 'leaves' | 'payroll';

// ── Clean Status badge ────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PROBATION: 'bg-amber-50 text-amber-800 border-amber-200',
    ON_LEAVE: 'bg-blue-50 text-blue-800 border-blue-200',
    TERMINATED: 'bg-rose-50 text-rose-800 border-rose-200',
    PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ABSENT: 'bg-rose-50 text-rose-800 border-rose-200',
    HALF_DAY: 'bg-amber-50 text-amber-800 border-amber-200',
    LEAVE: 'bg-blue-50 text-blue-800 border-blue-200',
    ON_DUTY: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
    CANCELLED: 'bg-stone-100 text-stone-700 border-stone-200',
    DRAFT: 'bg-stone-100 text-stone-700 border-stone-200',
    DISBURSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    CASUAL: 'bg-blue-50 text-blue-800 border-blue-200',
    SICK: 'bg-purple-50 text-purple-800 border-purple-200',
    EARNED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    UNPAID: 'bg-rose-50 text-rose-800 border-rose-200',
    FULL_TIME: 'bg-stone-100 text-stone-800 border-stone-200',
    CONTRACT: 'bg-amber-50 text-amber-800 border-amber-200',
    DAILY_WAGE: 'bg-blue-50 text-blue-800 border-blue-200',
    INTERN: 'bg-purple-50 text-purple-800 border-purple-200',
  };
  const cls = map[status] ?? 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function InputField({
  label, required, children
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label}{required && <span className="text-rose-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541] placeholder-stone-400";
const selectCls = `${inputCls}`;

export default function HRPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<HRTab>('overview');

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [paySlips, setPaySlips] = useState<PaySlip[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [attModalOpen, setAttModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [disburseModalOpen, setDisburseModalOpen] = useState<string | null>(null);

  // Employee form
  const [empFullName, setEmpFullName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empAadhaar, setEmpAadhaar] = useState('');
  const [empPan, setEmpPan] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empDesig, setEmpDesig] = useState('');
  const [empType, setEmpType] = useState<Employee['employmentType']>('FULL_TIME');
  const [empLevel, setEmpLevel] = useState(1);
  const [empManager, setEmpManager] = useState('');
  const [empShopFloor, setEmpShopFloor] = useState<Employee['shopFloorRole']>('NONE');
  const [empHireDate, setEmpHireDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [empStatus, setEmpStatus] = useState<Employee['status']>('ACTIVE');
  const [empBaseSalary, setEmpBaseSalary] = useState(25000);

  // Bank details
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  // Attendance form
  const [attEmpId, setAttEmpId] = useState('');
  const [attDate, setAttDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attCheckIn, setAttCheckIn] = useState('09:00');
  const [attCheckOut, setAttCheckOut] = useState('18:00');
  const [attStatus, setAttStatus] = useState<AttendanceRecord['status']>('PRESENT');
  const [attOT, setAttOT] = useState(0);
  const [attRegularised, setAttRegularised] = useState(false);
  const [attReason, setAttReason] = useState('');

  // Leave form
  const [leaveEmpId, setLeaveEmpId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('CASUAL');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState('');

  // Payroll form
  const [payPeriod, setPayPeriod] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payWorkingDays, setPayWorkingDays] = useState(26);
  const [payDeptFilter, setPayDeptFilter] = useState('');

  // Disburse form
  const [disburseRef, setDisburseRef] = useState('');
  const [disburseSelectedIds, setDisburseSelectedIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filters / search
  const [empSearch, setEmpSearch] = useState('');
  const [attDateFilter, setAttDateFilter] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('');
  const [payPeriodFilter, setPayPeriodFilter] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace(currentUser?.role === 'SUPERVISOR' ? '/sites/new' : '/projects');
    }
  }, [currentUser, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, dRes, aRes, lRes, pRes] = await Promise.all([
        fetch('/api/hr/employees'),
        fetch('/api/hr/departments'),
        fetch('/api/hr/attendance'),
        fetch('/api/hr/leaves'),
        fetch('/api/hr/payroll'),
      ]);
      const [eData, dData, aData, lData, pData] = await Promise.all([
        eRes.json(), dRes.json(), aRes.json(), lRes.json(), pRes.json()
      ]);
      if (eData.success) setEmployees(eData.data);
      if (dData.success) setDepartments(dData.data);
      if (aData.success) setAttendance(aData.data);
      if (lData.success) setLeaves(lData.data);
      if (pData.success) setPaySlips(pData.data);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetEmpForm = () => {
    setEmpFullName(''); setEmpEmail(''); setEmpPhone('');
    setEmpAadhaar(''); setEmpPan(''); setEmpDept('');
    setEmpDesig(''); setEmpType('FULL_TIME'); setEmpLevel(1);
    setEmpManager(''); setEmpShopFloor('NONE');
    setEmpHireDate(new Date().toISOString().split('T')[0]);
    setEmpStatus('ACTIVE'); setEmpBaseSalary(25000);
    setBankName(''); setBankAcc(''); setBankIfsc('');
    setEditEmp(null);
  };

  const openEditEmp = (emp: Employee) => {
    setEditEmp(emp);
    setEmpFullName(emp.fullName); setEmpEmail(emp.email); setEmpPhone(emp.phone);
    setEmpAadhaar(emp.aadhaarNumber || ''); setEmpPan(emp.panNumber || '');
    setEmpDept(emp.departmentId); setEmpDesig(emp.designation);
    setEmpType(emp.employmentType); setEmpLevel(emp.hierarchyLevel);
    setEmpManager(emp.managerId || ''); setEmpShopFloor(emp.shopFloorRole || 'NONE');
    setEmpHireDate(emp.hireDate); setEmpStatus(emp.status);
    setEmpBaseSalary(emp.baseSalary);
    setBankName(emp.bankDetails?.bankName || '');
    setBankAcc(emp.bankDetails?.accountNumber || '');
    setBankIfsc(emp.bankDetails?.ifscCode || '');
    setEmpModalOpen(true); setError('');
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        id: editEmp?.id,
        fullName: empFullName, email: empEmail, phone: empPhone,
        aadhaarNumber: empAadhaar || undefined, panNumber: empPan || undefined,
        departmentId: empDept, designation: empDesig,
        employmentType: empType, hierarchyLevel: empLevel,
        managerId: empManager || undefined, shopFloorRole: empShopFloor,
        hireDate: empHireDate, status: empStatus, baseSalary: empBaseSalary,
        bankDetails: (bankAcc && bankIfsc) ? { bankName, accountNumber: bankAcc, ifscCode: bankIfsc, branchName: '' } : undefined,
        actorId: currentUser?.id, actorName: currentUser?.fullName,
      };
      const res = await fetch('/api/hr/employees', {
        method: editEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setEmpModalOpen(false); resetEmpForm(); fetchAll();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const handleLogAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: attEmpId, workDate: attDate,
          checkIn: attCheckIn, checkOut: attCheckOut,
          status: attStatus, overtimeMinutes: attOT,
          regularised: attRegularised, regularisationReason: attReason,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setAttModalOpen(false); setAttOT(0); setAttRegularised(false); setAttReason('');
      fetchAll();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: leaveEmpId, leaveType, startDate: leaveStart,
          endDate: leaveEnd, totalDays: leaveDays, reason: leaveReason,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setLeaveModalOpen(false); setLeaveReason(''); fetchAll();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const handleUpdateLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveId, status, actorId: currentUser?.id, actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (data.success) fetchAll();
    } catch { /* silently ignore */ }
  };

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodMonth: payPeriod, workingDaysInMonth: payWorkingDays,
          departmentId: payDeptFilter || undefined,
          actorId: currentUser?.id, actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setPayrollModalOpen(false); fetchAll();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/hr/payroll/disburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paySlipIds: disburseSelectedIds,
          referenceNumber: disburseRef,
          actorId: currentUser?.id, actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setDisburseModalOpen(null); setDisburseSelectedIds([]); setDisburseRef('');
      fetchAll();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  const activeEmps = employees.filter(e => e.status === 'ACTIVE' || e.status === 'PROBATION');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.workDate === todayStr);
  const pendingLeaves = leaves.filter(l => l.status === 'PENDING').length;
  const approvedSlips = paySlips.filter(s => s.status === 'APPROVED');

  const filteredEmps = employees.filter(e =>
    !empSearch || e.fullName.toLowerCase().includes(empSearch.toLowerCase())
      || e.employeeCode.toLowerCase().includes(empSearch.toLowerCase())
      || e.departmentName.toLowerCase().includes(empSearch.toLowerCase())
  );

  const filteredAtt = attendance.filter(a =>
    !attDateFilter || a.workDate === attDateFilter
  );

  const filteredLeaves = leaves.filter(l =>
    !leaveStatusFilter || l.status === leaveStatusFilter
  );

  const filteredPaySlips = paySlips.filter(s =>
    !payPeriodFilter || s.periodMonth === payPeriodFilter
  );

  const payPeriods = [...new Set(paySlips.map(s => s.periodMonth))].sort().reverse();

  const tabs: { id: HRTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList },
    { id: 'leaves', label: 'Leave Requests', icon: Calendar },
    { id: 'payroll', label: 'Payroll & Pay Slips', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">
              Human Capital & Workforce
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#c79e7c]" />
            <span>Human Resources (HR)</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1">
            Workforce lifecycle · Daily attendance & leaves · Automated payroll & GL disbursement
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { resetEmpForm(); setEmpModalOpen(true); setError(''); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
          <button
            onClick={() => { setAttModalOpen(true); setError(''); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#debfa6] bg-[#382315] hover:bg-[#4d3221] rounded-md transition"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Log Attendance</span>
          </button>
          <button
            onClick={() => { setPayrollModalOpen(true); setError(''); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Run Payroll</span>
          </button>
          <button
            onClick={fetchAll}
            className="p-2 rounded-md bg-[#382315] hover:bg-[#4d3221] text-[#debfa6] transition"
            title="Refresh HR Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Headcount</div>
          <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">{employees.length}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">{activeEmps.length} active employees</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Operational Departments</div>
          <div className="text-2xl font-bold font-mono text-[#714f36] mt-1">{departments.length}</div>
          <div className="text-[11px] text-stone-500 mt-1">Erection, Yard, Logistics, Office</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Today&apos;s Attendance</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {todayAttendance.filter(a => a.status === 'PRESENT').length} Present
          </div>
          <div className="text-[11px] text-stone-500 mt-1">out of {activeEmps.length} workforce</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Pending Leave Approvals</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{pendingLeaves}</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">Awaiting manager decision</div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#e8decb] pb-2 text-xs font-semibold overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-[#8f6541] text-white shadow-2xs'
                : 'text-stone-600 hover:bg-[#ede3d4]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
            {t.id === 'leaves' && pendingLeaves > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-200 text-amber-900 font-bold">
                {pendingLeaves}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="p-12 text-center text-xs text-stone-400">Loading Human Resources records...</div>
      )}

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#8f6541]" />
                  <h2 className="text-sm font-bold text-stone-900">Department Workforce Distribution</h2>
                </div>
              </div>
              <div className="p-5 divide-y divide-[#f7f2ea]">
                {departments.map((d) => {
                  const count = employees.filter(
                    (e) => e.departmentId === d.id && (e.status === 'ACTIVE' || e.status === 'PROBATION')
                  ).length;
                  return (
                    <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-stone-900">{d.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">Code: {d.code}</div>
                      </div>
                      <span className="font-mono font-bold text-[#8f6541] px-2.5 py-1 bg-[#faf6ee] rounded-md border border-[#ebdcc9]">
                        {count} active staff
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payroll History Overview */}
            <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#8f6541]" />
                  <h2 className="text-sm font-bold text-stone-900">Recent Payroll Runs</h2>
                </div>
              </div>
              <div className="p-5">
                {payPeriods.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-400">
                    No payroll runs recorded. Click <strong className="text-[#8f6541]">Run Payroll</strong> to disburse staff compensation.
                  </div>
                ) : (
                  <div className="divide-y divide-[#f7f2ea] text-xs">
                    {payPeriods.slice(0, 5).map((period) => {
                      const periodSlips = paySlips.filter((s) => s.periodMonth === period);
                      const totalNet = periodSlips.reduce((sum, s) => sum + s.netSalary, 0);
                      const disbursed = periodSlips.filter((s) => s.status === 'DISBURSED').length;
                      return (
                        <div key={period} className="py-2.5 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-stone-900">Period {period}</div>
                            <div className="text-[10px] text-stone-500">
                              {periodSlips.length} pay slips · {disbursed} disbursed
                            </div>
                          </div>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatINR(totalNet)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Today's Attendance Snapshot */}
          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#8f6541]" />
                <h2 className="text-sm font-bold text-stone-900">Today&apos;s Attendance Register</h2>
              </div>
              <button
                onClick={() => setActiveTab('attendance')}
                className="text-xs text-[#8f6541] hover:underline font-semibold"
              >
                View full attendance →
              </button>
            </div>

            {todayAttendance.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                No attendance entries logged for today ({todayStr}). Click <strong className="text-[#8f6541]">Log Attendance</strong> to record check-ins.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fcfaf7] border-b border-[#e8decb] text-stone-500 font-semibold text-[11px]">
                      <th className="px-4 py-2.5 text-left">Employee</th>
                      <th className="px-4 py-2.5 text-left">Department</th>
                      <th className="px-4 py-2.5 text-left">Check-In</th>
                      <th className="px-4 py-2.5 text-left">Check-Out</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8db]">
                    {todayAttendance.map((a) => (
                      <tr key={a.id} className="hover:bg-[#fbf9f5]">
                        <td className="px-4 py-2.5 font-medium text-stone-900">{a.employeeName}</td>
                        <td className="px-4 py-2.5 text-stone-600">{a.departmentName}</td>
                        <td className="px-4 py-2.5 font-mono text-stone-700">{a.checkIn || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-stone-700">{a.checkOut || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge status={a.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-stone-600">
                          {a.overtimeMinutes > 0 ? `${a.overtimeMinutes} mins` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EMPLOYEES TAB ─────────────────────────────────────────────────── */}
      {!loading && activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search by employee name, code, designation..."
                className="w-full pl-9 pr-3 py-2 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
              />
            </div>
            <span className="text-xs text-stone-500 whitespace-nowrap">{filteredEmps.length} registered employees</span>
          </div>

          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            {filteredEmps.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                No employees match the filter. Click <strong className="text-[#8f6541]">Add Employee</strong> to register staff.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-left">Full Name</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Designation</th>
                      <th className="px-4 py-3 text-left">Employment</th>
                      <th className="px-4 py-3 text-left">Hire Date</th>
                      <th className="px-4 py-3 text-right">Base Salary</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8db]">
                    {filteredEmps.map((e) => (
                      <tr key={e.id} className="hover:bg-[#fcfaf7] transition">
                        <td className="px-4 py-3 font-mono font-bold text-[#8f6541]">{e.employeeCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900">{e.fullName}</div>
                          <div className="text-[10px] text-stone-400 font-mono">{e.email}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-700">{e.departmentName}</td>
                        <td className="px-4 py-3 text-stone-600">{e.designation}</td>
                        <td className="px-4 py-3">
                          <Badge status={e.employmentType} />
                        </td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(e.hireDate)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                          {formatINR(e.baseSalary)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={e.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openEditEmp(e)}
                            className="p-1.5 rounded-md hover:bg-stone-100 text-stone-600 hover:text-[#8f6541] transition"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ────────────────────────────────────────────────── */}
      {!loading && activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-stone-700 whitespace-nowrap">Filter Work Date:</label>
              <input
                type="date"
                value={attDateFilter}
                onChange={(e) => setAttDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
              />
              {attDateFilter && (
                <button
                  onClick={() => setAttDateFilter('')}
                  className="text-xs text-[#8f6541] hover:underline font-semibold"
                >
                  Clear filter
                </button>
              )}
            </div>

            <span className="text-xs text-stone-500 whitespace-nowrap">{filteredAtt.length} records found</span>
          </div>

          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            {filteredAtt.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                No attendance logs found{attDateFilter ? ` for date ${attDateFilter}` : ''}. Click <strong className="text-[#8f6541]">Log Attendance</strong> to record.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                      <th className="px-4 py-3 text-left">Work Date</th>
                      <th className="px-4 py-3 text-left">Employee Name</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Clock In</th>
                      <th className="px-4 py-3 text-left">Clock Out</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Overtime</th>
                      <th className="px-4 py-3 text-left">Regularisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8db]">
                    {filteredAtt.map((a) => (
                      <tr key={a.id} className="hover:bg-[#fbf9f5]">
                        <td className="px-4 py-3 font-mono text-stone-600 whitespace-nowrap">{formatDate(a.workDate)}</td>
                        <td className="px-4 py-3 font-semibold text-stone-900">{a.employeeName}</td>
                        <td className="px-4 py-3 text-stone-600">{a.departmentName}</td>
                        <td className="px-4 py-3 font-mono text-stone-700">{a.checkIn || '—'}</td>
                        <td className="px-4 py-3 font-mono text-stone-700">{a.checkOut || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={a.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-stone-700">
                          {a.overtimeMinutes > 0 ? `${a.overtimeMinutes} mins` : '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {a.regularised ? (
                            <span className="text-emerald-700 font-semibold">✓ Regularised: {a.regularisationReason}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVES TAB ───────────────────────────────────────────────────── */}
      {!loading && activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-stone-700">Filter Status:</label>
              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setLeaveModalOpen(true); setError(''); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] rounded-md transition shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Leave Request</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            {filteredLeaves.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                No leave requests found. Click <strong className="text-[#8f6541]">Submit Leave Request</strong> to apply.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                      <th className="px-4 py-3 text-left">Leave #</th>
                      <th className="px-4 py-3 text-left">Employee Name</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">From</th>
                      <th className="px-4 py-3 text-left">To</th>
                      <th className="px-4 py-3 text-center">Days</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-center">Approval State</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8db]">
                    {filteredLeaves.map((l) => (
                      <tr key={l.id} className="hover:bg-[#fbf9f5]">
                        <td className="px-4 py-3 font-mono font-bold text-[#8f6541]">{l.leaveNumber}</td>
                        <td className="px-4 py-3 font-semibold text-stone-900">{l.employeeName}</td>
                        <td className="px-4 py-3 text-stone-600">{l.departmentName}</td>
                        <td className="px-4 py-3">
                          <Badge status={l.leaveType} />
                        </td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(l.startDate)}</td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(l.endDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-stone-900">{l.totalDays}</td>
                        <td className="px-4 py-3 text-stone-600 max-w-xs">{l.reason}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={l.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {l.status === 'PENDING' && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleUpdateLeave(l.id, 'APPROVED')}
                                className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded text-[11px] font-bold"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateLeave(l.id, 'REJECTED')}
                                className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 rounded text-[11px] font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PAYROLL TAB ──────────────────────────────────────────────────── */}
      {!loading && activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-stone-700">Filter Period:</label>
              <select
                value={payPeriodFilter}
                onChange={(e) => setPayPeriodFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
              >
                <option value="">All Pay Periods</option>
                {payPeriods.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {approvedSlips.length > 0 && (
              <button
                onClick={() => {
                  setDisburseModalOpen('batch');
                  setDisburseSelectedIds(approvedSlips.map((s) => s.id));
                  setDisburseRef('');
                  setError('');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition shadow-2xs"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Disburse Approved Slips ({approvedSlips.length})</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            {filteredPaySlips.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                No pay slips found. Click <strong className="text-[#8f6541]">Run Payroll</strong> to compute salary slips for the month.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                      <th className="px-4 py-3 text-left">Slip #</th>
                      <th className="px-4 py-3 text-left">Employee Name</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Period</th>
                      <th className="px-4 py-3 text-center">Working Days</th>
                      <th className="px-4 py-3 text-center">Present Days</th>
                      <th className="px-4 py-3 text-right">Gross Earnings</th>
                      <th className="px-4 py-3 text-right">Deductions</th>
                      <th className="px-4 py-3 text-right">Net Payable</th>
                      <th className="px-4 py-3 text-center">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8db]">
                    {filteredPaySlips.map((s) => (
                      <tr key={s.id} className="hover:bg-[#fbf9f5]">
                        <td className="px-4 py-3 font-mono font-bold text-[#8f6541]">{s.slipNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900">{s.employeeName}</div>
                          <div className="text-[10px] text-stone-400 font-mono">{s.designation}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{s.departmentName}</td>
                        <td className="px-4 py-3 font-mono text-stone-700 whitespace-nowrap">{s.periodMonth}</td>
                        <td className="px-4 py-3 text-center font-mono text-stone-600">{s.workingDays}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-stone-900">{s.presentDays}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-stone-900 whitespace-nowrap">
                          {formatINR(s.grossEarnings)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-rose-700 whitespace-nowrap">
                          {formatINR(s.totalDeductions)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatINR(s.netSalary)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs overflow-y-auto py-8 px-4">
          <form
            onSubmit={handleSaveEmployee}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-2xl"
          >
            <div className="px-6 py-4 border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#8f6541]" />
                <span className="font-bold text-stone-900 text-sm">{editEmp ? `Edit ${editEmp.employeeCode}` : 'Add New Employee'}</span>
              </div>
              <button
                type="button"
                onClick={() => { setEmpModalOpen(false); resetEmpForm(); }}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Full Name" required>
                  <input
                    value={empFullName}
                    onChange={(e) => setEmpFullName(e.target.value)}
                    required
                    placeholder="Employee full name"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Official Email" required>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    required
                    placeholder="employee@alokhandwala.com"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Phone Number" required>
                  <input
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    required
                    placeholder="+91 99999 00000"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Hire Date" required>
                  <input
                    type="date"
                    value={empHireDate}
                    onChange={(e) => setEmpHireDate(e.target.value)}
                    required
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Aadhaar KYC Number">
                  <input
                    value={empAadhaar}
                    onChange={(e) => setEmpAadhaar(e.target.value)}
                    placeholder="12-digit number"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="PAN Tax Identifier">
                  <input
                    value={empPan}
                    onChange={(e) => setEmpPan(e.target.value)}
                    placeholder="ABCDE1234F"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Department" required>
                  <select
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                    required
                    className={selectCls}
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Designation" required>
                  <input
                    value={empDesig}
                    onChange={(e) => setEmpDesig(e.target.value)}
                    required
                    placeholder="e.g. Scaffolding Rigger"
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Employment Model" required>
                  <select
                    value={empType}
                    onChange={(e) => setEmpType(e.target.value as Employee['employmentType'])}
                    className={selectCls}
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="DAILY_WAGE">Daily Wage</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </InputField>
                <InputField label="Shop Floor Role">
                  <select
                    value={empShopFloor || 'NONE'}
                    onChange={(e) => setEmpShopFloor(e.target.value as Employee['shopFloorRole'])}
                    className={selectCls}
                  >
                    <option value="NONE">Office Staff</option>
                    <option value="SCAFFOLDER">Scaffolder</option>
                    <option value="RIGGER">Rigger</option>
                    <option value="FABRICATOR">Fabricator</option>
                    <option value="DRIVER">Driver</option>
                    <option value="YARD_SUPERVISOR">Yard Supervisor</option>
                  </select>
                </InputField>
                <InputField label="Monthly Base Salary (₹)" required>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={empBaseSalary}
                    onChange={(e) => setEmpBaseSalary(Number(e.target.value))}
                    required
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Employee Status" required>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as Employee['status'])}
                    className={selectCls}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PROBATION">Probation</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </InputField>
              </div>

              {/* Bank Details for Direct Salary Disbursement */}
              <div className="pt-2 border-t border-[#e8decb]">
                <h4 className="text-xs font-bold text-stone-900 mb-2">Bank Account (for Disbursal Runs)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InputField label="Bank Name">
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className={inputCls}
                    />
                  </InputField>
                  <InputField label="Account Number">
                    <input
                      value={bankAcc}
                      onChange={(e) => setBankAcc(e.target.value)}
                      placeholder="Account number"
                      className={inputCls}
                    />
                  </InputField>
                  <InputField label="IFSC Code">
                    <input
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value)}
                      placeholder="HDFC0001234"
                      className={inputCls}
                    />
                  </InputField>
                </div>
              </div>

              {error && <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
                <button
                  type="button"
                  onClick={() => { setEmpModalOpen(false); resetEmpForm(); }}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editEmp ? 'Save Changes' : 'Register Employee')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: LOG ATTENDANCE */}
      {attModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <form
            onSubmit={handleLogAttendance}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#8f6541]" />
                <h3 className="font-bold text-stone-900 text-sm">Log Attendance Entry</h3>
              </div>
              <button
                type="button"
                onClick={() => setAttModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <InputField label="Employee Name" required>
                <select
                  value={attEmpId}
                  onChange={(e) => setAttEmpId(e.target.value)}
                  required
                  className={selectCls}
                >
                  <option value="">— Select Employee —</option>
                  {employees.filter(e => e.status === 'ACTIVE' || e.status === 'PROBATION').map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
                  ))}
                </select>
              </InputField>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Work Date" required>
                  <input
                    type="date"
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                    required
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Attendance Status" required>
                  <select
                    value={attStatus}
                    onChange={(e) => setAttStatus(e.target.value as AttendanceRecord['status'])}
                    className={selectCls}
                  >
                    <option value="PRESENT">Present</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="LEAVE">On Leave</option>
                    <option value="ON_DUTY">On Duty</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </InputField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Check-In Time">
                  <input
                    type="time"
                    value={attCheckIn}
                    onChange={(e) => setAttCheckIn(e.target.value)}
                    className={inputCls}
                  />
                </InputField>
                <InputField label="Check-Out Time">
                  <input
                    type="time"
                    value={attCheckOut}
                    onChange={(e) => setAttCheckOut(e.target.value)}
                    className={inputCls}
                  />
                </InputField>
              </div>

              <InputField label="Overtime (Minutes)">
                <input
                  type="number"
                  min="0"
                  value={attOT}
                  onChange={(e) => setAttOT(Number(e.target.value))}
                  className={inputCls}
                />
              </InputField>
            </div>

            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
              <button
                type="button"
                onClick={() => setAttModalOpen(false)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition disabled:opacity-50"
              >
                {saving ? 'Recording...' : 'Log Attendance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: LEAVE REQUEST */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <form
            onSubmit={handleSubmitLeave}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#8f6541]" />
                <h3 className="font-bold text-stone-900 text-sm">Submit Leave Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setLeaveModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <InputField label="Employee" required>
                <select
                  value={leaveEmpId}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  required
                  className={selectCls}
                >
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
                  ))}
                </select>
              </InputField>

              <InputField label="Leave Category" required>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveRequest['leaveType'])}
                  className={selectCls}
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EARNED">Earned Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </InputField>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="From Date" required>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    required
                    className={inputCls}
                  />
                </InputField>
                <InputField label="To Date" required>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    required
                    className={inputCls}
                  />
                </InputField>
              </div>

              <InputField label="Duration (Total Days)" required>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={leaveDays}
                  onChange={(e) => setLeaveDays(Number(e.target.value))}
                  required
                  className={inputCls}
                />
              </InputField>

              <InputField label="Reason / Remarks" required>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  required
                  rows={2}
                  placeholder="State reason for leave request..."
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541] resize-none"
                />
              </InputField>
            </div>

            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
              <button
                type="button"
                onClick={() => setLeaveModalOpen(false)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RUN PAYROLL */}
      {payrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <form
            onSubmit={handleRunPayroll}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-stone-900 text-sm">Run Monthly Payroll Engine</h3>
              </div>
              <button
                type="button"
                onClick={() => setPayrollModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
              Aggregates monthly attendance, computes pro-rata earnings and statutory deductions (PF, PT), and automatically posts a balanced journal entry to the General Ledger.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InputField label="Period (YYYY-MM)" required>
                <input
                  type="month"
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  required
                  className={inputCls}
                />
              </InputField>
              <InputField label="Working Days in Month">
                <input
                  type="number"
                  min="20"
                  max="31"
                  value={payWorkingDays}
                  onChange={(e) => setPayWorkingDays(Number(e.target.value))}
                  className={inputCls}
                />
              </InputField>
            </div>

            <div>
              <InputField label="Department Filter (Blank = All Departments)">
                <select
                  value={payDeptFilter}
                  onChange={(e) => setPayDeptFilter(e.target.value)}
                  className={selectCls}
                >
                  <option value="">All Operational Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </InputField>
            </div>

            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
              <button
                type="button"
                onClick={() => setPayrollModalOpen(false)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || activeEmps.length === 0}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {saving ? 'Processing...' : `Execute Payroll (${payPeriod})`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DISBURSE PAYROLL */}
      {disburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <form
            onSubmit={handleDisburse}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-stone-900 text-sm">Disburse Approved Pay Slips</h3>
              </div>
              <button
                type="button"
                onClick={() => setDisburseModalOpen(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#fbf9f5] border border-[#e8decb] rounded-md text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Pay Slips Selected:</span>
                <span className="font-bold text-stone-900">{disburseSelectedIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Net Disbursal:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatINR(
                    approvedSlips
                      .filter((s) => disburseSelectedIds.includes(s.id))
                      .reduce((sum, s) => sum + s.netSalary, 0)
                  )}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Disbursing will credit staff bank accounts and post an automated journal entry (Debit Salary Payable → Credit Bank Account).
            </p>

            <InputField label="Bank Reference / UTR Number *" required>
              <input
                value={disburseRef}
                onChange={(e) => setDisburseRef(e.target.value)}
                required
                placeholder="e.g. UTR-HDFC-20261101"
                className={inputCls}
              />
            </InputField>

            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
              <button
                type="button"
                onClick={() => setDisburseModalOpen(null)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {saving ? 'Disbursing...' : 'Confirm Bank Disbursal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
