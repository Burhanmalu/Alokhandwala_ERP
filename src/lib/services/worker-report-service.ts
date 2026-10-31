// ALOKHANDWALA - Worker & Supervisor Performance Analytics Service

import { dbStore } from '../db/store';
import { Project, UserProfile } from '../schema';

export interface CompletedProjectRecord {
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
  month: number; // 1 - 12
  monthKey: string; // "YYYY-MM"
  supervisors: { id: string; name: string }[];
  workers: { id: string; name: string; role: string }[];
}

export interface EmployeePerformanceRecord {
  id: string;
  name: string;
  role: 'SUPERVISOR' | 'WORKER';
  email?: string;
  phone?: string;
  completedProjectsCount: number; // in selected filter
  allTimeProjectsCount: number; // across all completed projects
  monthlyBreakdown: Record<string, number>; // "YYYY-MM": count
  projects: {
    projectId: string;
    projectCode: string;
    customerName: string;
    siteName: string;
    siteAddress: string;
    installationDate: string;
    status: string;
    assignedSupervisors: string[];
    assignedWorkers: string[];
  }[];
}

export interface PerformanceReportSummary {
  totalCompletedProjects: number;
  activeSupervisorsCount: number;
  activeWorkersCount: number;
  totalSupervisorAssignments: number;
  totalWorkerAssignments: number;
  topSupervisor?: { name: string; count: number };
  topWorker?: { name: string; count: number };
}

export interface PerformanceReportFilter {
  year?: number | string; // e.g. 2026 or "ALL"
  month?: number | string; // 1-12 or "ALL"
  role?: 'ALL' | 'SUPERVISOR' | 'WORKER';
  employeeName?: string;
}

export class WorkerReportService {
  /**
   * Helper to normalize employee names by stripping role suffixes like "(Supervisor)" or "(Worker)"
   */
  public static normalizeName(rawName?: string): string {
    if (!rawName) return '';
    return rawName.replace(/\s*\((supervisor|worker|admin|technician)\)/gi, '').trim();
  }

  /**
   * Determine if a project has completed installation
   */
  public static isInstallationCompleted(project: Project): boolean {
    if (!project) return false;

    // Has an explicit actual installation date
    if (project.actualInstallationDate && project.actualInstallationDate.trim().length > 0) {
      return true;
    }

    // Is in installed or subsequent active operations status
    const completedStatuses = [
      'INSTALLED',
      'ACTIVE_RENTAL',
      'BUFFER_PERIOD',
      'EXTENSION_REQUESTED',
      'EXTENDED',
      'SHIFTING_PENDING',
      'SHIFTING_IN_PROGRESS',
      'REMOVAL_PENDING',
      'RETURNED_RECONCILIATION',
      'CLOSED',
    ];

    return completedStatuses.includes(project.status);
  }

  /**
   * Parse a valid installation date object from project record
   */
  public static parseInstallationDate(project: Project): { dateStr: string; year: number; month: number; monthKey: string } {
    const rawDate = project.actualInstallationDate || project.rentalStartDate || project.plannedInstallationDate || project.createdAt || new Date().toISOString();
    const parsed = new Date(rawDate);
    const valid = !isNaN(parsed.getTime());

    const dateObj = valid ? parsed : new Date();
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // 1-indexed
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const dateStr = valid ? rawDate : dateObj.toISOString();

    return { dateStr, year, month, monthKey };
  }

  /**
   * Extract distinct, deduplicated supervisors and workers from a project
   */
  public static extractProjectPersonnel(
    project: Project,
    users: UserProfile[]
  ): {
    supervisors: { id: string; name: string }[];
    workers: { id: string; name: string; role: string }[];
  } {
    const userMap = new Map<string, UserProfile>();
    users.forEach(u => {
      userMap.set(u.id, u);
      if (u.fullName) {
        userMap.set(u.fullName.trim().toLowerCase(), u);
        userMap.set(this.normalizeName(u.fullName).toLowerCase(), u);
      }
    });

    // 1. Supervisors - deduplicate by normalized name
    const supervisorMap = new Map<string, { id: string; name: string }>();

    const addSupervisor = (id?: string, name?: string) => {
      if (!name || !name.trim()) return;
      const cleanName = this.normalizeName(name);
      if (!cleanName) return;
      const normKey = cleanName.toLowerCase();
      if (!supervisorMap.has(normKey)) {
        supervisorMap.set(normKey, {
          id: id || userMap.get(normKey)?.id || `sup-${supervisorMap.size + 1}`,
          name: cleanName,
        });
      }
    };

    // Primary assigned supervisor
    addSupervisor(project.assignedSupervisorId, project.supervisorName);

    // Installation record supervisors
    if (project.installationSupervisor) {
      addSupervisor(
        project.installationSupervisor.assignedSupervisorId,
        project.installationSupervisor.assignedSupervisorName
      );
      addSupervisor(
        project.installationSupervisor.executingSupervisorId,
        project.installationSupervisor.executingSupervisorName
      );
    }

    // 2. Workers - deduplicate by normalized name
    const workerMap = new Map<string, { id: string; name: string; role: string }>();

    const addWorker = (id?: string, name?: string, role?: string) => {
      if (!name || !name.trim()) return;
      const cleanName = this.normalizeName(name);
      if (!cleanName) return;
      const normKey = cleanName.toLowerCase();
      if (!workerMap.has(normKey)) {
        workerMap.set(normKey, {
          id: id || userMap.get(normKey)?.id || `wrk-${workerMap.size + 1}`,
          name: cleanName,
          role: role || 'Scaffolder / Technician',
        });
      }
    };

    // Installation workers array
    if (Array.isArray(project.installationWorkers)) {
      project.installationWorkers.forEach(w => {
        addWorker(w.id, w.name, w.role);
      });
    }

    // Assigned worker IDs
    if (Array.isArray(project.assignedWorkerIds)) {
      project.assignedWorkerIds.forEach(wId => {
        const u = userMap.get(wId);
        if (u) {
          addWorker(u.id, u.fullName, u.role === 'WORKER' ? 'Technician' : u.role);
        }
      });
    }

    return {
      supervisors: Array.from(supervisorMap.values()),
      workers: Array.from(workerMap.values()),
    };
  }

  /**
   * Get all completed installation projects with personnel details
   */
  public static getCompletedProjects(): CompletedProjectRecord[] {
    const projects = dbStore.getProjects();
    const users = dbStore.getUsers();

    return projects
      .filter(p => this.isInstallationCompleted(p))
      .map(p => {
        const { dateStr, year, month, monthKey } = this.parseInstallationDate(p);
        const { supervisors, workers } = this.extractProjectPersonnel(p, users);

        return {
          id: p.id,
          projectCode: p.projectCode,
          customerId: p.customerId,
          customerName: p.customerName,
          siteId: p.siteId,
          siteName: p.siteName,
          siteAddress: p.siteAddress || 'Site Location',
          status: p.status,
          installationDate: dateStr,
          year,
          month,
          monthKey,
          supervisors,
          workers,
        };
      })
      .sort((a, b) => new Date(b.installationDate).getTime() - new Date(a.installationDate).getTime());
  }

  /**
   * Build complete performance report data with filters and summaries
   */
  public static generatePerformanceReport(filters: PerformanceReportFilter = {}) {
    const allCompletedProjects = this.getCompletedProjects();
    const allUsers = dbStore.getUsers();

    // Collect all available years and months from actual completed projects
    const yearsSet = new Set<number>();
    const monthsSet = new Set<string>();

    allCompletedProjects.forEach(p => {
      yearsSet.add(p.year);
      monthsSet.add(p.monthKey);
    });

    // Ensure current year is present
    yearsSet.add(new Date().getFullYear());
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    const availableMonthKeys = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

    // Determine filter parameters
    const filterYear = filters.year && filters.year !== 'ALL' ? Number(filters.year) : null;
    const filterMonth = filters.month && filters.month !== 'ALL' ? Number(filters.month) : null;
    const filterRole = filters.role && filters.role !== 'ALL' ? filters.role : null;
    const filterName = filters.employeeName ? filters.employeeName.trim().toLowerCase() : '';

    // Filter projects based on Year and Month
    const filteredProjects = allCompletedProjects.filter(p => {
      if (filterYear !== null && p.year !== filterYear) return false;
      if (filterMonth !== null && p.month !== filterMonth) return false;
      return true;
    });

    // Map all employees (Supervisors and Workers)
    // 1. Seed from registered users with SUPERVISOR, WORKER, or ADMIN roles
    const employeeMap = new Map<string, EmployeePerformanceRecord>();

    const getOrCreateEmployee = (
      name: string,
      role: 'SUPERVISOR' | 'WORKER',
      id?: string,
      email?: string,
      phone?: string
    ): EmployeePerformanceRecord => {
      const cleanName = this.normalizeName(name);
      const normKey = `${role}:${cleanName.toLowerCase()}`;
      if (!employeeMap.has(normKey)) {
        employeeMap.set(normKey, {
          id: id || `emp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          role,
          email,
          phone,
          completedProjectsCount: 0,
          allTimeProjectsCount: 0,
          monthlyBreakdown: {},
          projects: [],
        });
      }
      return employeeMap.get(normKey)!;
    };

    // Pre-populate registered workers and supervisors from system user accounts
    allUsers.forEach(u => {
      if (u.isActive) {
        if (u.role === 'SUPERVISOR') {
          getOrCreateEmployee(u.fullName, 'SUPERVISOR', u.id, u.email, u.phone);
        } else if (u.role === 'WORKER') {
          getOrCreateEmployee(u.fullName, 'WORKER', u.id, u.email, u.phone);
        } else if (u.role === 'ADMIN') {
          // If admin has been assigned as supervisor, will be added as supervisor
        }
      }
    });

    // 2. Count projects all-time and build monthly breakdowns
    allCompletedProjects.forEach(project => {
      const assignedSupNames = project.supervisors.map(s => s.name);
      const assignedWrkNames = project.workers.map(w => w.name);

      // Process Supervisors (guaranteed 1 count per project per supervisor)
      project.supervisors.forEach(sup => {
        const emp = getOrCreateEmployee(sup.name, 'SUPERVISOR', sup.id);
        emp.allTimeProjectsCount += 1;
        emp.monthlyBreakdown[project.monthKey] = (emp.monthlyBreakdown[project.monthKey] || 0) + 1;
      });

      // Process Workers (guaranteed 1 count per project per worker)
      project.workers.forEach(wrk => {
        const emp = getOrCreateEmployee(wrk.name, 'WORKER', wrk.id);
        emp.allTimeProjectsCount += 1;
        emp.monthlyBreakdown[project.monthKey] = (emp.monthlyBreakdown[project.monthKey] || 0) + 1;
      });
    });

    // 3. Populate filtered period counts and project details for filtered timeframe
    filteredProjects.forEach(project => {
      const assignedSupNames = project.supervisors.map(s => s.name);
      const assignedWrkNames = project.workers.map(w => w.name);

      const projDetail = {
        projectId: project.id,
        projectCode: project.projectCode,
        customerName: project.customerName,
        siteName: project.siteName,
        siteAddress: project.siteAddress,
        installationDate: project.installationDate,
        status: project.status,
        assignedSupervisors: assignedSupNames,
        assignedWorkers: assignedWrkNames,
      };

      // Supervisors
      project.supervisors.forEach(sup => {
        const emp = getOrCreateEmployee(sup.name, 'SUPERVISOR', sup.id);
        emp.completedProjectsCount += 1;
        emp.projects.push(projDetail);
      });

      // Workers
      project.workers.forEach(wrk => {
        const emp = getOrCreateEmployee(wrk.name, 'WORKER', wrk.id);
        emp.completedProjectsCount += 1;
        emp.projects.push(projDetail);
      });
    });

    // Convert map to array and apply employee filters (role, name)
    let employees = Array.from(employeeMap.values());

    if (filterRole) {
      employees = employees.filter(e => e.role === filterRole);
    }

    if (filterName) {
      employees = employees.filter(e => e.name.toLowerCase().includes(filterName));
    }

    // Sort: highest completion count first, then alphabetical by name
    employees.sort((a, b) => {
      if (b.completedProjectsCount !== a.completedProjectsCount) {
        return b.completedProjectsCount - a.completedProjectsCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate Summary KPIs
    const supervisors = employees.filter(e => e.role === 'SUPERVISOR');
    const workers = employees.filter(e => e.role === 'WORKER');

    const activeSupervisors = supervisors.filter(s => s.completedProjectsCount > 0);
    const activeWorkers = workers.filter(w => w.completedProjectsCount > 0);

    const totalSupervisorAssignments = supervisors.reduce((acc, s) => acc + s.completedProjectsCount, 0);
    const totalWorkerAssignments = workers.reduce((acc, w) => acc + w.completedProjectsCount, 0);

    let topSupervisor: { name: string; count: number } | undefined;
    if (activeSupervisors.length > 0) {
      const top = activeSupervisors[0];
      topSupervisor = { name: top.name, count: top.completedProjectsCount };
    }

    let topWorker: { name: string; count: number } | undefined;
    if (activeWorkers.length > 0) {
      const top = activeWorkers[0];
      topWorker = { name: top.name, count: top.completedProjectsCount };
    }

    const summary: PerformanceReportSummary = {
      totalCompletedProjects: filteredProjects.length,
      activeSupervisorsCount: activeSupervisors.length,
      activeWorkersCount: activeWorkers.length,
      totalSupervisorAssignments,
      totalWorkerAssignments,
      topSupervisor,
      topWorker,
    };

    return {
      filters: {
        year: filterYear,
        month: filterMonth,
        role: filterRole,
        employeeName: filters.employeeName || '',
      },
      availableYears,
      availableMonthKeys,
      summary,
      employees,
      projects: filteredProjects,
    };
  }

  /**
   * Compare workforce performance across two specified months
   */
  public static compareMonths(monthKeyA: string, monthKeyB: string) {
    const reportA = this.generatePerformanceReport({
      year: parseInt(monthKeyA.split('-')[0]),
      month: parseInt(monthKeyA.split('-')[1]),
    });

    const reportB = this.generatePerformanceReport({
      year: parseInt(monthKeyB.split('-')[0]),
      month: parseInt(monthKeyB.split('-')[1]),
    });

    const employeeMap = new Map<string, {
      id: string;
      name: string;
      role: 'SUPERVISOR' | 'WORKER';
      countA: number;
      countB: number;
      diff: number;
      percentChange: number | null;
    }>();

    // Seed from A
    reportA.employees.forEach(e => {
      const key = `${e.role}:${e.name.toLowerCase()}`;
      employeeMap.set(key, {
        id: e.id,
        name: e.name,
        role: e.role,
        countA: e.completedProjectsCount,
        countB: 0,
        diff: 0,
        percentChange: null,
      });
    });

    // Merge B
    reportB.employees.forEach(e => {
      const key = `${e.role}:${e.name.toLowerCase()}`;
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          id: e.id,
          name: e.name,
          role: e.role,
          countA: 0,
          countB: e.completedProjectsCount,
          diff: 0,
          percentChange: null,
        });
      } else {
        const item = employeeMap.get(key)!;
        item.countB = e.completedProjectsCount;
      }
    });

    // Compute diff and percentage
    const comparisonList = Array.from(employeeMap.values()).map(item => {
      const diff = item.countB - item.countA;
      let percentChange: number | null = null;
      if (item.countA > 0) {
        percentChange = Math.round(((item.countB - item.countA) / item.countA) * 100);
      } else if (item.countB > 0) {
        percentChange = 100; // New contributor
      } else {
        percentChange = 0;
      }
      return {
        ...item,
        diff,
        percentChange,
      };
    });

    comparisonList.sort((a, b) => (b.countB + b.countA) - (a.countB + a.countA));

    return {
      monthKeyA,
      monthKeyB,
      summaryA: reportA.summary,
      summaryB: reportB.summary,
      comparison: comparisonList,
    };
  }
}
