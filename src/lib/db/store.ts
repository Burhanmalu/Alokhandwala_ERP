// ALOKHANDWALA - Transactional Persistent Storage Engine
// Supports ACID mutex transactions, atomic inventory operations, audit logging, and persistence

import fs from 'fs';
import path from 'path';
import { 
  UserProfile, 
  Customer, 
  Site, 
  MaterialCategory, 
  Material, 
  Warehouse, 
  Project, 
  Invoice, 
  Payment,
  InventoryTransaction,
  CompanySettings,
  BufferRequest,
  RentalExtension,
  ShiftingRequest,
  RemovalRequest,
  Notification,
  InstallationReminder,
  RentalExpiryReminderRecord,
  AuditLog,
  ProjectActivityEvent,
  ProjectStatus,
  Quotation,
  ChartOfAccount,
  AccountingPeriod,
  JournalEntry,
  VendorBill,
  CostCenter,
  Department,
  Employee,
  AttendanceRecord,
  LeaveRequest,
  PaySlip,
  Challan
} from '../schema';
import { 
  initialCompanySettings, 
  initialUsers, 
  initialWarehouses, 
  initialCategories, 
  initialMaterials, 
  initialCustomers, 
  initialSites, 
  initialProjects, 
  initialInvoices, 
  initialPayments, 
  initialTransactions,
  initialChartOfAccounts,
  initialAccountingPeriods,
  initialCostCenters,
  initialDepartments,
  initialJournalEntries,
  initialVendorBills,
  initialEmployees,
  initialAttendanceRecords,
  initialLeaveRequests,
  initialPaySlips
} from './seed-data';

export interface DatabaseState {
  companySettings: CompanySettings;
  users: UserProfile[];
  warehouses: Warehouse[];
  categories: MaterialCategory[];
  materials: Material[];
  customers: Customer[];
  sites: Site[];
  projects: Project[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: InventoryTransaction[];
  bufferRequests: BufferRequest[];
  rentalExtensions: RentalExtension[];
  shiftingRequests: ShiftingRequest[];
  removalRequests: RemovalRequest[];
  notifications: Notification[];
  installationReminders: InstallationReminder[];
  rentalExpiryReminders: RentalExpiryReminderRecord[];
  auditLogs: AuditLog[];
  activityEvents: ProjectActivityEvent[];
  quotations: Quotation[];
  chartOfAccounts: ChartOfAccount[];
  accountingPeriods: AccountingPeriod[];
  costCenters: CostCenter[];
  departments: Department[];
  journalEntries: JournalEntry[];
  vendorBills: VendorBill[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  paySlips: PaySlip[];
  challans: Challan[];
}

const DATA_DIR = path.join(process.cwd(), '.data');

function getDataFilePath(): string {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
  return path.join(DATA_DIR, isTest ? 'alokhandwala-erp-test.json' : 'alokhandwala-erp.json');
}

class ERPDataStore {
  private state: DatabaseState;
  private lockPromise: Promise<void> = Promise.resolve();
  private lastMtime: number = 0;
  private syncInFlight: Promise<void> | null = null;

  private normalizeState(parsed: any): DatabaseState {
    if (!parsed || typeof parsed !== 'object') {
      return this.createSeedState();
    }

    if (Array.isArray(parsed.materials)) {
      const existingIds = new Set(parsed.materials.map((m: any) => m.id));
      for (const seedMat of initialMaterials) {
        if (!existingIds.has(seedMat.id)) {
          parsed.materials.push(JSON.parse(JSON.stringify(seedMat)));
        }
      }
    } else {
      parsed.materials = JSON.parse(JSON.stringify(initialMaterials));
    }

    if (Array.isArray(parsed.categories)) {
      const existingCatIds = new Set(parsed.categories.map((c: any) => c.id));
      for (const seedCat of initialCategories) {
        if (!existingCatIds.has(seedCat.id)) {
          parsed.categories.push(JSON.parse(JSON.stringify(seedCat)));
        }
      }
    } else {
      parsed.categories = JSON.parse(JSON.stringify(initialCategories));
    }

    if (Array.isArray(parsed.users)) {
      parsed.users = parsed.users.map((u: any) => {
        if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN_PM' || u.role === 'INVENTORY_MGR') {
          return { ...u, role: 'ADMIN' };
        }
        if (u.role === 'SUPERVISOR') return { ...u, role: 'SUPERVISOR' };
        if (u.role === 'ACCOUNTANT') return { ...u, role: 'ACCOUNTANT' };
        if (u.role === 'CLIENT') return { ...u, role: 'CLIENT' };
        return { ...u, role: 'WORKER' };
      });
      const existingUserIds = new Set(parsed.users.map((u: any) => u.id));
      for (const seedUser of initialUsers) {
        if (!existingUserIds.has(seedUser.id)) {
          parsed.users.push(JSON.parse(JSON.stringify(seedUser)));
        }
      }
    } else {
      parsed.users = JSON.parse(JSON.stringify(initialUsers));
    }

    if (!parsed.companySettings) {
      parsed.companySettings = JSON.parse(JSON.stringify(initialCompanySettings));
    } else if (!parsed.companySettings.termsAndConditions) {
      parsed.companySettings.termsAndConditions = JSON.parse(JSON.stringify(initialCompanySettings.termsAndConditions));
    }

    if (!parsed.warehouses) parsed.warehouses = JSON.parse(JSON.stringify(initialWarehouses));
    if (!parsed.customers) parsed.customers = JSON.parse(JSON.stringify(initialCustomers));
    if (!parsed.sites) parsed.sites = JSON.parse(JSON.stringify(initialSites));
    if (!parsed.projects) parsed.projects = [];
    if (!parsed.invoices) parsed.invoices = [];
    if (!parsed.payments) parsed.payments = [];
    if (!parsed.transactions) parsed.transactions = [];
    if (!parsed.bufferRequests) parsed.bufferRequests = [];
    if (!parsed.rentalExtensions) parsed.rentalExtensions = [];
    if (!parsed.shiftingRequests) parsed.shiftingRequests = [];
    if (!parsed.removalRequests) parsed.removalRequests = [];
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.installationReminders) parsed.installationReminders = [];
    if (!parsed.rentalExpiryReminders) parsed.rentalExpiryReminders = [];
    if (!parsed.auditLogs) parsed.auditLogs = [];
    if (!parsed.activityEvents) parsed.activityEvents = [];
    if (!parsed.quotations) parsed.quotations = [];
    if (!parsed.chartOfAccounts || parsed.chartOfAccounts.length === 0) {
      parsed.chartOfAccounts = JSON.parse(JSON.stringify(initialChartOfAccounts));
    }
    if (!parsed.accountingPeriods || parsed.accountingPeriods.length === 0) {
      parsed.accountingPeriods = JSON.parse(JSON.stringify(initialAccountingPeriods));
    }
    if (!parsed.costCenters || parsed.costCenters.length === 0) {
      parsed.costCenters = JSON.parse(JSON.stringify(initialCostCenters));
    }
    if (!parsed.departments || parsed.departments.length === 0) {
      parsed.departments = JSON.parse(JSON.stringify(initialDepartments));
    }
    if (!parsed.journalEntries) parsed.journalEntries = [];
    if (!parsed.vendorBills) parsed.vendorBills = [];
    if (!parsed.employees) parsed.employees = [];
    if (!parsed.attendanceRecords) parsed.attendanceRecords = [];
    if (!parsed.leaveRequests) parsed.leaveRequests = [];
    if (!parsed.paySlips) parsed.paySlips = [];
    if (!parsed.challans) parsed.challans = [];

    return parsed as DatabaseState;
  }

  private createSeedState(): DatabaseState {
    return {
      companySettings: JSON.parse(JSON.stringify(initialCompanySettings)),
      users: JSON.parse(JSON.stringify(initialUsers)),
      warehouses: JSON.parse(JSON.stringify(initialWarehouses)),
      categories: JSON.parse(JSON.stringify(initialCategories)),
      materials: JSON.parse(JSON.stringify(initialMaterials)),
      customers: JSON.parse(JSON.stringify(initialCustomers)),
      sites: JSON.parse(JSON.stringify(initialSites)),
      projects: JSON.parse(JSON.stringify(initialProjects)),
      invoices: JSON.parse(JSON.stringify(initialInvoices)),
      payments: JSON.parse(JSON.stringify(initialPayments)),
      transactions: JSON.parse(JSON.stringify(initialTransactions)),
      bufferRequests: [],
      rentalExtensions: [],
      shiftingRequests: [],
      removalRequests: [],
      notifications: [],
      installationReminders: [],
      rentalExpiryReminders: [],
      auditLogs: [],
      activityEvents: [],
      quotations: [],
      chartOfAccounts: JSON.parse(JSON.stringify(initialChartOfAccounts)),
      accountingPeriods: JSON.parse(JSON.stringify(initialAccountingPeriods)),
      costCenters: JSON.parse(JSON.stringify(initialCostCenters)),
      departments: JSON.parse(JSON.stringify(initialDepartments)),
      journalEntries: [],
      vendorBills: [],
      employees: [],
      attendanceRecords: [],
      leaveRequests: [],
      paySlips: [],
      challans: [],
    };
  }

  public syncFromDisk(): void {
    try {
      const dataFile = getDataFilePath();
      if (fs.existsSync(dataFile)) {
        const stat = fs.statSync(dataFile);
        if (stat.mtimeMs !== this.lastMtime) {
          this.state = this.loadState();
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Synchronize in-memory state from Neon PostgreSQL before serving any read API request.
   * Ensures every Vercel serverless instance always returns consistent, persisted database records.
   */
  public async ensureSynced(): Promise<void> {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
    if (isTest) {
      this.syncFromDisk();
      return;
    }

    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    this.syncInFlight = (async () => {
      try {
        const { isPostgresEnabled, getDbPool, ensureErpStateTable } = await import('./postgres');
        if (!isPostgresEnabled()) {
          this.syncFromDisk();
          return;
        }

        await ensureErpStateTable();
        const pool = getDbPool();
        const res = await pool.query(
          "SELECT payload FROM erp_state_sync WHERE key = 'latest_state' LIMIT 1"
        );

        if (res.rows.length > 0 && res.rows[0].payload) {
          this.state = this.normalizeState(res.rows[0].payload);
        } else {
          // Initialize empty Neon row once from local seed/disk state
          const initial = this.loadState();
          await pool.query(
            `INSERT INTO erp_state_sync (key, payload, updated_at)
             VALUES ('latest_state', $1::jsonb, NOW())
             ON CONFLICT (key) DO NOTHING`,
            [JSON.stringify(initial)]
          );
          const seeded = await pool.query(
            "SELECT payload FROM erp_state_sync WHERE key = 'latest_state' LIMIT 1"
          );
          this.state = seeded.rows[0]?.payload
            ? this.normalizeState(seeded.rows[0].payload)
            : initial;
        }
      } catch (err: any) {
        console.error('[ERPDataStore] Failed to sync from Neon PostgreSQL:', err?.message || err);
        throw new Error('Database connection error while loading ERP records. Please retry.');
      } finally {
        this.syncInFlight = null;
      }
    })();

    return this.syncInFlight;
  }

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    try {
      const dataFile = getDataFilePath();
      if (fs.existsSync(dataFile)) {
        const raw = fs.readFileSync(dataFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.normalizeState(parsed);
      }
    } catch (e) {
      console.warn('Failed to load persistent file, falling back to seed state:', e);
    }

    return this.createSeedState();
  }

  private saveStateToDiskBestEffort() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataFile = getDataFilePath();
      fs.writeFileSync(dataFile, JSON.stringify(this.state, null, 2), 'utf-8');
      try {
        if (fs.existsSync(dataFile)) {
          this.lastMtime = fs.statSync(dataFile).mtimeMs;
        }
      } catch {}
    } catch {
      // Vercel serverless filesystem is read-only; Neon PostgreSQL is the primary persistence store
    }
  }

  /**
   * Concurrency mutex lock + PostgreSQL FOR UPDATE row lock:
   * Serializes transactional writes across both local and Vercel serverless instances.
   */
  public async transaction<T>(fn: (state: DatabaseState) => Promise<T> | T): Promise<T> {
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.lockPromise;
    this.lockPromise = (async () => {
      await previousLock;
      await currentLock;
    })();

    await previousLock;

    try {
      const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
      if (isTest) {
        this.syncFromDisk();
        const result = await fn(this.state);
        this.saveStateToDiskBestEffort();
        return result;
      }

      const { isPostgresEnabled, getDbPool, ensureErpStateTable } = await import('./postgres');
      if (!isPostgresEnabled()) {
        this.syncFromDisk();
        const result = await fn(this.state);
        this.saveStateToDiskBestEffort();
        return result;
      }

      await ensureErpStateTable();
      const pool = getDbPool();
      const client = await pool.connect();

      try {
        await client.query(
          "BEGIN; SET LOCAL lock_timeout = '8000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms';"
        );
        const locked = await client.query(
          "SELECT payload FROM erp_state_sync WHERE key = 'latest_state' FOR UPDATE"
        );
        const rowExists = locked.rows.length > 0;
        if (locked.rows[0]?.payload) {
          this.state = this.normalizeState(locked.rows[0].payload);
        }

        const result = await fn(this.state);
        const serializedState = JSON.stringify(this.state);

        if (rowExists) {
          await client.query(
            `UPDATE erp_state_sync
             SET payload = $1::jsonb, updated_at = NOW()
             WHERE key = 'latest_state'`,
            [serializedState]
          );
        } else {
          await client.query(
            `INSERT INTO erp_state_sync (key, payload, updated_at)
             VALUES ('latest_state', $1::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
            [serializedState]
          );
        }
        await client.query('COMMIT');
        this.saveStateToDiskBestEffort();
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } finally {
      releaseLock!();
    }
  }

  // Read Accessors
  public getState(): DatabaseState {
    this.syncFromDisk();
    return this.state;
  }

  public getCompanySettings() { return this.getState().companySettings; }
  public getUsers() { return this.getState().users; }
  public getWarehouses() { return this.getState().warehouses; }
  public getCategories() { return this.getState().categories; }
  public getMaterials() { return this.getState().materials; }
  public getCustomers() { return this.getState().customers; }
  public getSites() { return this.getState().sites; }
  public getProjects() { return this.getState().projects; }
  public getInvoices() { return this.getState().invoices; }
  public getPayments() { return this.getState().payments; }
  public getTransactions() { return this.getState().transactions; }
  public getBufferRequests() { return this.getState().bufferRequests; }
  public getRentalExtensions() { return this.getState().rentalExtensions; }
  public getShiftingRequests() { return this.getState().shiftingRequests; }
  public getRemovalRequests() { return this.getState().removalRequests; }
  public getNotifications() { return this.getState().notifications; }
  public getInstallationReminders() { return this.getState().installationReminders || []; }
  public getRentalExpiryReminders() { return this.getState().rentalExpiryReminders || []; }
  public getAuditLogs() { return this.getState().auditLogs; }
  public getQuotations() { return this.getState().quotations || []; }
  public getQuotationById(id: string) { 
    return (this.getState().quotations || []).find(q => q.id === id); 
  }
  public getQuotationByProjectId(projectId: string) { 
    return (this.getState().quotations || []).find(q => q.projectId === projectId); 
  }
  public getActivityEvents(projectId?: string) {
    if (projectId) {
      return this.getState().activityEvents.filter(e => e.projectId === projectId);
    }
    return this.getState().activityEvents;
  }

  // Accounts & Finance Accessors
  public getChartOfAccounts() { return this.getState().chartOfAccounts || []; }
  public getAccountingPeriods() { return this.getState().accountingPeriods || []; }
  public getCostCenters() { return this.getState().costCenters || []; }
  public getJournalEntries() { return this.getState().journalEntries || []; }
  public getVendorBills() { return this.getState().vendorBills || []; }

  // HR & Workforce Accessors
  public getDepartments() { return this.getState().departments || []; }
  public getEmployees() { return this.getState().employees || []; }
  public getAttendanceRecords() { return this.getState().attendanceRecords || []; }
  public getLeaveRequests() { return this.getState().leaveRequests || []; }
  public getPaySlips() { return this.getState().paySlips || []; }
  public getChallans() { return this.getState().challans || []; }

  // Reset to seed data
  public resetToSeed() {
    this.state = {
      companySettings: JSON.parse(JSON.stringify(initialCompanySettings)),
      users: JSON.parse(JSON.stringify(initialUsers)),
      warehouses: JSON.parse(JSON.stringify(initialWarehouses)),
      categories: JSON.parse(JSON.stringify(initialCategories)),
      materials: JSON.parse(JSON.stringify(initialMaterials)),
      customers: JSON.parse(JSON.stringify(initialCustomers)),
      sites: JSON.parse(JSON.stringify(initialSites)),
      projects: JSON.parse(JSON.stringify(initialProjects)),
      invoices: JSON.parse(JSON.stringify(initialInvoices)),
      payments: JSON.parse(JSON.stringify(initialPayments)),
      transactions: JSON.parse(JSON.stringify(initialTransactions)),
      bufferRequests: [],
      rentalExtensions: [],
      shiftingRequests: [],
      removalRequests: [],
      notifications: [],
      installationReminders: [],
      rentalExpiryReminders: [],
      auditLogs: [],
      activityEvents: [],
      quotations: [],
      chartOfAccounts: JSON.parse(JSON.stringify(initialChartOfAccounts)),
      accountingPeriods: JSON.parse(JSON.stringify(initialAccountingPeriods)),
      costCenters: JSON.parse(JSON.stringify(initialCostCenters)),
      departments: JSON.parse(JSON.stringify(initialDepartments)),
      journalEntries: [],
      vendorBills: [],
      employees: [],
      attendanceRecords: [],
      leaveRequests: [],
      paySlips: [],
      challans: [],
    };
    this.saveStateToDiskBestEffort();
  }
}

export const dbStore = new ERPDataStore();
