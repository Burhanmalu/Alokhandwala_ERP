// ALOKHANDWALA - HR, Workforce, Attendance & Payroll Service
// Manages employee lifecycle, attendance logs, leave management,
// salary structures, automated payroll calculations, and General Ledger integration.

import { dbStore } from '../db/store';
import { 
  Employee, 
  Department, 
  AttendanceRecord, 
  LeaveRequest, 
  PaySlip, 
  PaySlipLineItem, 
  CostCenter, 
  JournalEntry 
} from '../schema';
import { AccountingService } from './accounting-service';

export class HRService {
  /**
   * Register or update an employee
   */
  public static async saveEmployee(data: {
    id?: string;
    fullName: string;
    email: string;
    phone: string;
    aadhaarNumber?: string;
    panNumber?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
    bankDetails?: {
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      branchName: string;
    };
    departmentId: string;
    designation: string;
    employmentType: Employee['employmentType'];
    hierarchyLevel: number;
    managerId?: string;
    shopFloorRole?: Employee['shopFloorRole'];
    hireDate: string;
    status: Employee['status'];
    baseSalary: number;
    salaryComponents?: Employee['salaryComponents'];
    actorId?: string;
    actorName?: string;
  }): Promise<Employee> {
    return await dbStore.transaction(async (state) => {
      const dept = (state.departments || []).find(d => d.id === data.departmentId);
      const departmentName = dept ? dept.name : 'Operations';
      let managerName: string | undefined;

      if (data.managerId) {
        const mgr = (state.employees || []).find(e => e.id === data.managerId);
        if (mgr) managerName = mgr.fullName;
      }

      if (data.id) {
        // Update existing
        const existingIdx = (state.employees || []).findIndex(e => e.id === data.id);
        if (existingIdx === -1) throw new Error('Employee not found.');

        const prev = state.employees[existingIdx];
        const updated: Employee = {
          ...prev,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          aadhaarNumber: data.aadhaarNumber,
          panNumber: data.panNumber,
          emergencyContact: data.emergencyContact,
          bankDetails: data.bankDetails,
          departmentId: data.departmentId,
          departmentName,
          designation: data.designation,
          employmentType: data.employmentType,
          hierarchyLevel: data.hierarchyLevel,
          managerId: data.managerId,
          managerName,
          shopFloorRole: data.shopFloorRole,
          hireDate: data.hireDate,
          status: data.status,
          baseSalary: data.baseSalary,
          salaryComponents: data.salaryComponents || prev.salaryComponents || [],
          updatedAt: new Date().toISOString(),
        };

        state.employees[existingIdx] = updated;
        return updated;
      }

      // Create new
      const count = (state.employees || []).length + 1;
      const employeeCode = `EMP-${count.toString().padStart(4, '0')}`;

      // Default standard salary structure components if none supplied:
      // Basic 50%, HRA 30%, Special Allowance 20%, Statutory PF deduction 12% of basic
      const base = data.baseSalary || 25000;
      const defaultComponents = data.salaryComponents && data.salaryComponents.length > 0 
        ? data.salaryComponents 
        : [
            { id: 'comp-basic', name: 'Basic Pay', type: 'EARNING' as const, amount: Math.round(base * 0.5), isPercentage: false, isStatutory: false },
            { id: 'comp-hra', name: 'House Rent Allowance (HRA)', type: 'EARNING' as const, amount: Math.round(base * 0.3), isPercentage: false, isStatutory: false },
            { id: 'comp-sa', name: 'Special Allowance', type: 'EARNING' as const, amount: Math.round(base * 0.2), isPercentage: false, isStatutory: false },
            { id: 'comp-pf', name: 'Provident Fund (PF Employee)', type: 'DEDUCTION' as const, amount: Math.round(base * 0.5 * 0.12), isPercentage: false, isStatutory: true },
            { id: 'comp-pt', name: 'Professional Tax (PT)', type: 'DEDUCTION' as const, amount: 200, isPercentage: false, isStatutory: true },
          ];

      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        employeeCode,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        aadhaarNumber: data.aadhaarNumber,
        panNumber: data.panNumber,
        emergencyContact: data.emergencyContact,
        bankDetails: data.bankDetails,
        departmentId: data.departmentId,
        departmentName,
        designation: data.designation,
        employmentType: data.employmentType,
        hierarchyLevel: data.hierarchyLevel,
        managerId: data.managerId,
        managerName,
        shopFloorRole: data.shopFloorRole || 'NONE',
        hireDate: data.hireDate,
        status: data.status,
        baseSalary: data.baseSalary,
        salaryComponents: defaultComponents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!state.employees) state.employees = [];
      state.employees.unshift(newEmp);

      return newEmp;
    });
  }

  /**
   * Log or regularise daily attendance
   */
  public static async logAttendance(data: {
    employeeId: string;
    workDate: string; // YYYY-MM-DD
    checkIn?: string;
    checkOut?: string;
    status: AttendanceRecord['status'];
    overtimeMinutes?: number;
    regularised?: boolean;
    regularisationReason?: string;
    notes?: string;
  }): Promise<AttendanceRecord> {
    return await dbStore.transaction(async (state) => {
      const emp = (state.employees || []).find(e => e.id === data.employeeId);
      if (!emp) throw new Error('Employee not found.');

      if (!state.attendanceRecords) state.attendanceRecords = [];

      // Check if attendance already recorded for this employee on this date
      const existingIdx = state.attendanceRecords.findIndex(
        a => a.employeeId === data.employeeId && a.workDate === data.workDate
      );

      const record: AttendanceRecord = {
        id: existingIdx >= 0 ? state.attendanceRecords[existingIdx].id : `att-${Date.now()}`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        departmentName: emp.departmentName,
        workDate: data.workDate,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        status: data.status,
        overtimeMinutes: data.overtimeMinutes || 0,
        regularised: Boolean(data.regularised),
        regularisationReason: data.regularisationReason,
        notes: data.notes,
        createdAt: existingIdx >= 0 ? state.attendanceRecords[existingIdx].createdAt : new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        state.attendanceRecords[existingIdx] = record;
      } else {
        state.attendanceRecords.unshift(record);
      }

      return record;
    });
  }

  /**
   * Submit Leave Request
   */
  public static async submitLeaveRequest(data: {
    employeeId: string;
    leaveType: LeaveRequest['leaveType'];
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }): Promise<LeaveRequest> {
    return await dbStore.transaction(async (state) => {
      const emp = (state.employees || []).find(e => e.id === data.employeeId);
      if (!emp) throw new Error('Employee not found.');

      const count = (state.leaveRequests || []).length + 1;
      const leaveNumber = `LV-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

      const leave: LeaveRequest = {
        id: `leave-${Date.now()}`,
        leaveNumber,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        departmentName: emp.departmentName,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays: data.totalDays,
        reason: data.reason,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      if (!state.leaveRequests) state.leaveRequests = [];
      state.leaveRequests.unshift(leave);

      return leave;
    });
  }

  /**
   * Approve or reject leave request
   */
  public static async updateLeaveStatus(
    leaveId: string, 
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    actorId: string,
    actorName: string,
    rejectionReason?: string
  ): Promise<LeaveRequest> {
    return await dbStore.transaction(async (state) => {
      const leave = (state.leaveRequests || []).find(l => l.id === leaveId);
      if (!leave) throw new Error('Leave request not found.');

      leave.status = status;
      leave.approverId = actorId;
      leave.approverName = actorName;
      leave.approvedAt = new Date().toISOString();
      if (rejectionReason) leave.rejectionReason = rejectionReason;

      return leave;
    });
  }

  /**
   * Run Monthly Payroll for a period:
   * Aggregates attendance -> calculates earnings and deductions -> generates pay slips
   * Dispatches balanced journal entry to General Ledger:
   *   DEBIT Salary & Wages Expense (Cost center distributed)
   *   CREDIT Statutory Deductions Payable (PF, ESI, TDS)
   *   CREDIT Salaries Payable (Net Payable to employees)
   */
  public static async runMonthlyPayroll(data: {
    periodMonth: string; // e.g. "2026-04"
    workingDaysInMonth?: number;
    departmentId?: string;
    actorId?: string;
    actorName?: string;
  }): Promise<{ paySlips: PaySlip[]; journalEntry: JournalEntry }> {
    return await dbStore.transaction(async (state) => {
      const totalWorkingDays = data.workingDaysInMonth || 26; // Default standard 26 operational working days
      let activeEmployees = (state.employees || []).filter(e => e.status === 'ACTIVE' || e.status === 'PROBATION');

      if (data.departmentId) {
        activeEmployees = activeEmployees.filter(e => e.departmentId === data.departmentId);
      }

      if (activeEmployees.length === 0) {
        throw new Error('No active employees found to process payroll for this period.');
      }

      const generatedSlips: PaySlip[] = [];
      let totalGrossEarnings = 0;
      let totalDeductionsAll = 0;
      let totalNetSalaries = 0;

      for (const emp of activeEmployees) {
        // Find attendance records for this employee in this month
        const empAttendance = (state.attendanceRecords || []).filter(
          a => a.employeeId === emp.id && a.workDate.startsWith(data.periodMonth)
        );

        let presentDays = 0;
        let leaveDays = 0;
        let absentDays = 0;
        let overtimeMinutes = 0;

        for (const att of empAttendance) {
          if (att.status === 'PRESENT' || att.status === 'ON_DUTY') presentDays += 1;
          else if (att.status === 'HALF_DAY') presentDays += 0.5;
          else if (att.status === 'LEAVE') leaveDays += 1;
          else if (att.status === 'ABSENT') absentDays += 1;

          overtimeMinutes += (att.overtimeMinutes || 0);
        }

        // If attendance wasn't logged per day yet, default to full present days for full-time
        if (empAttendance.length === 0) {
          presentDays = totalWorkingDays;
        }

        // Pro-rata factor based on present days + approved leaves
        const payableDays = Math.min(totalWorkingDays, presentDays + leaveDays);
        const attendanceFactor = payableDays / totalWorkingDays;

        // Calculate earnings and deductions
        const lineItems: PaySlipLineItem[] = [];
        let grossEarnings = 0;
        let totalDeductions = 0;

        for (const comp of emp.salaryComponents) {
          let lineAmt = comp.amount;
          if (comp.type === 'EARNING') {
            lineAmt = Math.round(comp.amount * attendanceFactor);
            grossEarnings += lineAmt;
          } else {
            // Deductions are also pro-rated to attendance factor so deductions never exceed earnings
            lineAmt = Math.min(Math.round(comp.amount * attendanceFactor), grossEarnings);
            totalDeductions += lineAmt;
          }

          lineItems.push({
            id: `psl-${Date.now()}-${lineItems.length}`,
            name: comp.name,
            type: comp.type,
            amount: lineAmt,
            isStatutory: comp.isStatutory,
          });
        }

        // Overtime earnings if applicable
        const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;
        if (overtimeHours > 0) {
          const hourlyRate = (emp.baseSalary / totalWorkingDays) / 8;
          const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
          lineItems.push({
            id: `psl-ot-${Date.now()}`,
            name: `Overtime Pay (${overtimeHours} hrs @ 1.5x)`,
            type: 'EARNING',
            amount: overtimePay,
            isStatutory: false,
          });
          grossEarnings += overtimePay;
        }

        const netSalary = Math.max(0, Math.round(grossEarnings - totalDeductions));
        const slipCount = (state.paySlips || []).length + generatedSlips.length + 1;
        const slipNumber = `PAY-${data.periodMonth}-${slipCount.toString().padStart(4, '0')}`;

        const slip: PaySlip = {
          id: `payslip-${Date.now()}-${emp.id}`,
          slipNumber,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.fullName,
          departmentName: emp.departmentName,
          designation: emp.designation,
          bankAccountNumber: emp.bankDetails?.accountNumber,
          ifscCode: emp.bankDetails?.ifscCode,
          periodMonth: data.periodMonth,
          workingDays: totalWorkingDays,
          presentDays,
          leaveDays,
          absentDays,
          overtimeHours,
          basicPay: emp.baseSalary,
          grossEarnings,
          totalDeductions,
          netSalary,
          status: 'APPROVED',
          lineItems,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        generatedSlips.push(slip);
        totalGrossEarnings += grossEarnings;
        totalDeductionsAll += totalDeductions;
        totalNetSalaries += netSalary;
      }

      // Find GL accounts:
      // 5010 = Employee Salaries & Wages Expense (DEBIT)
      // 2020 = Salaries & Wages Payable (CREDIT)
      // 2040 = TDS & Statutory Deductions Payable (CREDIT)
      const salaryExpAccount = state.chartOfAccounts.find(a => a.accountCode === '5010') || state.chartOfAccounts.find(a => a.accountType === 'EXPENSE');
      const salaryPayableAccount = state.chartOfAccounts.find(a => a.accountCode === '2020') || state.chartOfAccounts.find(a => a.accountType === 'LIABILITY');
      const deductionsPayableAccount = state.chartOfAccounts.find(a => a.accountCode === '2040') || state.chartOfAccounts.find(a => a.accountType === 'LIABILITY');

      if (!salaryExpAccount || !salaryPayableAccount) {
        throw new Error('Salary Expense (5010) or Salary Payable (2020) account not configured in Chart of Accounts.');
      }

      // Group salary expense lines by department cost center
      const journalLines: {
        accountId: string;
        costCenterId?: string;
        debit: number;
        credit: number;
        memo: string;
      }[] = [];

      // 1. DEBIT: Salaries Expense
      if (totalGrossEarnings > 0) {
        journalLines.push({
          accountId: salaryExpAccount.id,
          debit: totalGrossEarnings,
          credit: 0,
          memo: `Gross Payroll for ${data.periodMonth} (${activeEmployees.length} staff)`,
        });
      }

      // 2. CREDIT: Statutory Deductions (if any)
      if (totalDeductionsAll > 0 && deductionsPayableAccount) {
        journalLines.push({
          accountId: deductionsPayableAccount.id,
          debit: 0,
          credit: totalDeductionsAll,
          memo: `Statutory deductions (PF, PT, TDS) for ${data.periodMonth}`,
        });
      }

      // 3. CREDIT: Net Salaries Payable
      if (totalNetSalaries > 0) {
        journalLines.push({
          accountId: salaryPayableAccount.id,
          debit: 0,
          credit: totalNetSalaries,
          memo: `Net salary payable to staff for ${data.periodMonth}`,
        });
      }
      // Auto-post balanced journal entry directly to transaction state
      const journalEntry = AccountingService.postJournalToState(state, {
        postingDate: `${data.periodMonth}-28`,
        kind: 'PAYROLL_AUTO',
        referenceNumber: `PAY-${data.periodMonth}`,
        narration: `Monthly Payroll disbursement accrual for period ${data.periodMonth}`,
        lines: journalLines,
        actorId: data.actorId,
        actorName: data.actorName,
      });

      // Link journal entry id to all generated slips
      for (const slip of generatedSlips) {
        slip.journalEntryId = journalEntry.id;
      }

      if (!state.paySlips) state.paySlips = [];
      state.paySlips.unshift(...generatedSlips);

      return { paySlips: generatedSlips, journalEntry };
    });
  }

  /**
   * Disburse approved pay slips from Bank account
   */
  public static async disbursePayroll(data: {
    paySlipIds: string[];
    bankAccountId?: string;
    referenceNumber: string;
    actorId?: string;
    actorName?: string;
  }): Promise<{ disbursedCount: number; journalEntry: JournalEntry }> {
    return await dbStore.transaction(async (state) => {
      const slips = (state.paySlips || []).filter(s => data.paySlipIds.includes(s.id) && s.status === 'APPROVED');
      if (slips.length === 0) throw new Error('No eligible approved pay slips selected for disbursement.');

      const totalDisbursement = Math.round(slips.reduce((sum, s) => sum + s.netSalary, 0) * 100) / 100;
      const salaryPayableAccount = state.chartOfAccounts.find(a => a.accountCode === '2020');
      const bankAccount = (data.bankAccountId ? state.chartOfAccounts.find(a => a.id === data.bankAccountId) : null)
        || state.chartOfAccounts.find(a => a.accountCode === '1020')
        || state.chartOfAccounts.find(a => a.classification === 'BANK_CASH');

      if (!salaryPayableAccount || !bankAccount) {
        throw new Error('Salary Payable (2020) or Bank account (1020) not found in Chart of Accounts.');
      }

      // Balanced Journal:
      // DEBIT: Salary Payable (2020)
      const journalEntry = AccountingService.postJournalToState(state, {
        postingDate: new Date().toISOString().split('T')[0],
        kind: 'PAYROLL_AUTO',
        referenceNumber: data.referenceNumber,
        narration: `Bank salary disbursement for ${slips.length} employees (Ref #${data.referenceNumber})`,
        lines: [
          {
            accountId: salaryPayableAccount.id,
            debit: totalDisbursement,
            credit: 0,
            memo: `Discharge of salary payable liability`,
          },
          {
            accountId: bankAccount.id,
            debit: 0,
            credit: totalDisbursement,
            memo: `Bank disbursement transfer`,
          }
        ],
        actorId: data.actorId,
        actorName: data.actorName,
      });

      const today = new Date().toISOString().split('T')[0];
      for (const s of slips) {
        s.status = 'DISBURSED';
        s.disbursedDate = today;
        s.updatedAt = new Date().toISOString();
      }

      return { disbursedCount: slips.length, journalEntry };
    });
  }
}
