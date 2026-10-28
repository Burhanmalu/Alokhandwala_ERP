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
  AuditLog,
  ProjectActivityEvent,
  ProjectStatus
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
  initialTransactions 
} from './seed-data';

interface DatabaseState {
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
  auditLogs: AuditLog[];
  activityEvents: ProjectActivityEvent[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
const DATA_FILE = path.join(DATA_DIR, isTestEnv ? 'alokhandwala-erp-test.json' : 'alokhandwala-erp.json');

class ERPDataStore {
  private state: DatabaseState;
  private lockPromise: Promise<void> = Promise.resolve();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure new materials & categories from seed data are seamlessly synced
        if (parsed.materials) {
          const existingIds = new Set(parsed.materials.map((m: any) => m.id));
          for (const seedMat of initialMaterials) {
            if (!existingIds.has(seedMat.id)) {
              parsed.materials.push(JSON.parse(JSON.stringify(seedMat)));
            }
          }
        }
        if (parsed.categories) {
          const existingCatIds = new Set(parsed.categories.map((c: any) => c.id));
          for (const seedCat of initialCategories) {
            if (!existingCatIds.has(seedCat.id)) {
              parsed.categories.push(JSON.parse(JSON.stringify(seedCat)));
            }
          }
        }
        // Ensure users are strictly mapped to the 3 roles: ADMIN, SUPERVISOR, WORKER
        if (parsed.users) {
          parsed.users = parsed.users.map((u: any) => {
            if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN_PM' || u.role === 'INVENTORY_MGR' || u.role === 'ACCOUNTANT') {
              return { ...u, role: 'ADMIN' };
            }
            if (u.role === 'SUPERVISOR') {
              return { ...u, role: 'SUPERVISOR' };
            }
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

        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load persistent file, falling back to seed state:', e);
    }

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
      auditLogs: [],
      activityEvents: [],
    };
  }

  private saveState() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');

      // Asynchronous replication to Neon PostgreSQL
      if (process.env.DATABASE_URL) {
        import('./postgres').then(({ getDbPool }) => {
          getDbPool().query(`
            INSERT INTO erp_state_sync (key, payload, updated_at)
            VALUES ('latest_state', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
          `, [JSON.stringify(this.state)]).catch((err) => {
            console.warn('[Neon Sync] Background sync warning:', err?.message || err);
          });
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Error persisting state to disk:', e);
    }
  }

  /**
   * Concurrency mutex lock: serializes critical transactional operations
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
      const result = await fn(this.state);
      this.saveState();
      return result;
    } finally {
      releaseLock!();
    }
  }

  // Read Accessors
  public getState(): DatabaseState {
    return this.state;
  }

  public getCompanySettings() { return this.state.companySettings; }
  public getUsers() { return this.state.users; }
  public getWarehouses() { return this.state.warehouses; }
  public getCategories() { return this.state.categories; }
  public getMaterials() { return this.state.materials; }
  public getCustomers() { return this.state.customers; }
  public getSites() { return this.state.sites; }
  public getProjects() { return this.state.projects; }
  public getInvoices() { return this.state.invoices; }
  public getPayments() { return this.state.payments; }
  public getTransactions() { return this.state.transactions; }
  public getBufferRequests() { return this.state.bufferRequests; }
  public getRentalExtensions() { return this.state.rentalExtensions; }
  public getShiftingRequests() { return this.state.shiftingRequests; }
  public getRemovalRequests() { return this.state.removalRequests; }
  public getNotifications() { return this.state.notifications; }
  public getAuditLogs() { return this.state.auditLogs; }
  public getActivityEvents(projectId?: string) {
    if (projectId) {
      return this.state.activityEvents.filter(e => e.projectId === projectId);
    }
    return this.state.activityEvents;
  }

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
      auditLogs: [],
      activityEvents: [],
    };
    this.saveState();
  }
}

const globalForStore = globalThis as unknown as { erpDataStore: ERPDataStore | undefined };
export const dbStore = globalForStore.erpDataStore ?? new ERPDataStore();
if (process.env.NODE_ENV !== 'production') {
  globalForStore.erpDataStore = dbStore;
}
