# Alokhandwala Scaffolding & Formwork ERP

An enterprise, full-stack ERP web application custom-engineered for **Alokhandwala**, managing the complete end-to-end scaffolding rental, installation, shifting, dismantling, material recommendation, and billing reconciliation lifecycle.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS (Warm Cream & Dark Brown Design System)**, and **PostgreSQL (Neon / Supabase)**.

---

## 🏢 Corporate Profile & Contact

| Entity | Details |
|---|---|
| **Company Name** | **Alokhandwala** |
| **Contact Phone** | `8818852722` |
| **Contact Email** | `alokhandwala.sh@gmail.com` |
| **Corporate Office** | 4th Floor, Office No. 401 Sapphire Square Tower, Square Indore, Madhya Pradesh (MP), India |
| **GSTIN** | `23AABCA1234F1Z5` (State Code 23 - Madhya Pradesh) |
| **Design Aesthetic** | **Warm Cream & Dark Brown Theme** (`#FDF8F4`, `#F6EDE4`, `#4D3221`, `#322016`) |

---

## 🚀 Key Modules & Capabilities

### 1. ⚡ Smart Material Recommendation & Stock Reservation
An intelligent, physics-driven estimation and reservation engine built into the Project Confirmation Form:
- **Site Dimensions Input**: Enter site measurements (e.g., **60 × 40 × 20 ft** or metric equivalent) with unit toggle (`Feet` / `Meters`).
- **Scaffolding Staging Configuration**:
  - `PERIMETER_FACADE`: External 4-sides building wrap, 2 long sides, 1 single wall, or L-shape.
  - `BIRDCAGE_VOLUME`: Dense 3D matrix for internal ceiling / slab load shoring.
  - `INDEPENDENT_TIED`: Double-row perimeter scaffold tied to permanent structures.
  - `MOBILE_ACCESS_TOWER`: Free-standing mobile towers on heavy-duty 8" castor wheels with brake locks.
- **Configurable Deck Levels & Safety Planks**:
  - 1 Deck (Top Lift), 2 Decks, or All Lifts fully decked.
  - Mild Steel (MS) Anti-Skid Jali or Heavy Bass Reinforced safety platforms.
- **Automatic 3–4 Material Plan Generation**:
  1. **Option 1 — Standard Plan**: Compliant with IS 4014 / BS EN 12811 using standard 8ft bays and 10ft standards.
  2. **Option 2 — Stock-Optimized Plan**: Dynamically analyzes warehouse stock depths (e.g., 7ft or 5ft ledgers/standards) to minimize shortages and enable immediate dispatch.
  3. **Option 3 — Alternative Heavy-Duty Plan**: Heavy Bass Walkway Jali, tighter 5ft grid, double handrails, and reinforced diagonal cross braces.
  4. **Option 4 — Partial Stock / Procurement Plan**: Strictly caps reservation to 100% of currently available physical stock, generating an exact deficit manifest with procurement cost estimates.
- **Live PostgreSQL Integration & Concurrency**:
  - Real-time stock validation: $\text{Available Stock} = \text{Usable Warehouse Qty} - \text{Active Reservations}$.
  - Serialized mutex locking and atomic transactions to prevent double-reservation.
  - Separate quantities for physical stock, reserved stock, and available stock.
  - Complete reservation release and revision audit workflows.

### 2. 👷 Field Operations & Installation Verification
- **Supervisor In-Charge Verification**: Automatically checks whether the supervisor who executed the erection matches the originally assigned site inspector, capturing delegation remarks when delegated.
- **Installation Worker Team Roster**: Logs the individual skilled scaffolders and riggers who erected the structure.
- **Scaffolding Actual Size & Dimension Verification**: Compares erected physical dimensions on site against initial inspection measurements, computing percentage variances and safety tolerance flags.
- **Issued Material Accuracy & Variance Audit**: Audits materials dispatched from warehouse against items installed on site, flagging shortages or surplus unused returns.

### 3. 🏗️ Streamlined Site & Customer Onboarding
- Simplified site registration: clean input form focused on address, landmark, contact person, supervisor assignment, and staging dimensions without extraneous state/city dropdown clutter.

### 4. 🔄 End-to-End Operational Asset Lifecycle

```
[Customer Registration & Site Inspection]
                   │
                   ▼
            [NOT_INSTALLED] ──(Quotation & Smart Material Reservation)──► [CONFIRMED_PROJECT]
                                                                                │
                                                                                ▼
                                                                           [SCHEDULED]
                                                                                │
                                                                 (Erection & Actual Verification)
                                                                                ▼
   [BUFFER_PERIOD] (2-3 days) ◄── [ACTIVE_RENTAL / INSTALLED] ──► [EXTENDED] (1+ Months)
          │                                     │                        │
          │                        (Relocation Type A & B)               │
          │                                     ▼                        │
          │                         [SHIFTING_IN_PROGRESS]               │
          │                                     │                        │
          └─────────────────────────────┬───────┴────────────────────────┘
                                        ▼
                                [REMOVAL_PENDING]
                                        │
                           (Warehouse Gate Inspection)
                                        ▼
                           [RETURNED_RECONCILIATION]
                           ├── Usable ──► Restores Warehouse Stock
                           ├── Damaged ─► Quarantine / Repair Ledger
                           └── Missing ─► Loss Investigation & Billing
                                        │
                                        ▼
                                    [CLOSED]
```

### 5. 📦 Transactional Stock Conservation Formula
$$\text{Total Owned Stock} = \text{Warehouse Usable} + \text{On Customer Sites} + \text{In Transit} + \text{Damaged} + \text{Missing}$$
$$\text{Available to Allocate} = \text{Warehouse Usable} - \text{Active Project Reservations}$$

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) with React 19.
- **Language**: TypeScript (strict type safety throughout domain and schema).
- **Styling**: Tailwind CSS with custom **Warm Cream & Dark Brown** corporate color palette.
- **Icons**: [Lucide React](https://lucide.dev/).
- **Database Layer**:
  - **PostgreSQL**: Neon / Supabase Client Pool (`src/lib/db/postgres.ts`) for real-time live inventory queries and transactions.
  - **Local Persistence & Mutex**: Transactional ACID storage engine with async mutex row-level serialization (`src/lib/db/store.ts`).
- **Validation**: [Zod](https://zod.dev/) schemas for API payloads and form submissions (`src/lib/validations.ts`).
- **Formatting**: Indian English localization (`en-IN`), Indian Rupee formatting (`₹1,50,000`), and HSN/SAC `997312` scaffolding leasing standards.

---

## 🔌 Backend API Endpoints

### Scaffolding Material Calculation & Recommendation
- `POST /api/scaffolding/calculate`
  - Computes 3–4 scaffolding material plans based on dimensions, staging configuration, deck levels, and live warehouse inventory.
  - *Body*: `{ length, width, height, unit: 'FEET' | 'METERS', configurationType, facadeFaces, deckLevels, jaliPreference }`
- `GET /api/scaffolding/inventory-status`
  - Returns real-time stock breakdown for all scaffolding components (total owned, usable, reserved, site allocated, damaged, available to allocate).

### Project Confirmation & Material Reservations
- `POST /api/projects/:id/confirm`
  - Confirms project quotation, locks row, and atomically reserves required stock. Stores selected scaffolding plan and site dimensions.
- `POST /api/projects/:id/release-reservation`
  - Restores reserved stock back to available warehouse pool and reverts project status to `NOT_INSTALLED` with complete audit trail.
- `POST /api/projects/:id/revise-reservation`
  - Revises material reservation quantities atomically with delta availability verification.
- `GET / POST /api/projects/:id/material-plan`
  - Retrieves or persists the active scaffolding material recommendation plan.

### Core Inventory & Operations
- `GET /api/inventory` — Master inventory catalog and summary metrics.
- `GET / POST /api/projects` — Project directory and lifecycle state machine.
- `POST /api/projects/:id/install` — Material issue dispatch, actual size check, supervisor verification, and worker roster assignment.
- `POST /api/projects/:id/shift` — Scaffolding relocation (Type A unchanged / Type B quantity modifications).
- `POST /api/projects/:id/dismantle` — Gate return reconciliation for usable, damaged, and missing items.

---

## 👥 User Roles & Access Control (RBAC)

| Role Code | Role Name | Key Responsibilities |
|---|---|---|
| `SUPER_ADMIN` | Super Administrator | Full administrative control, system settings, user management, and audit logs. |
| `ADMIN_PM` | Project Manager | Project confirmation, smart material plan approval, stock reservation, and dispatch scheduling. |
| `SUPERVISOR` | Field Site Supervisor | Site inspections, erection reporting, actual dimension verification, and worker team logging. |
| `INVENTORY_MGR` | Yard & Inventory Lead | Material catalog, stock dispatches, warehouse returns, and damaged/missing quarantine. |
| `ACCOUNTANT` | Billing & Accounts Lead | Quotations, GST tax invoices, payment receipts, and security deposit management. |
| `VIEWER` | Auditor / Stakeholder | Read-only visibility across operational dashboards and reports. |

> **Persona Switcher**: An interactive Role Switcher in the top navigation header allows instant persona switching for testing workflows without relogging.

---

## 💻 Quick Start & Setup

### Prerequisites
- Node.js `v20.0.0` or higher (`v22.x` / `v24.x` recommended)
- npm `v10.x` or higher

### Installation & Launch
```bash
# 1. Clone repository
git clone <repo-url>
cd ALOKHANDWALA_ERP

# 2. Install dependencies
npm install

# 3. Environment configuration
# Ensure .env.local contains your PostgreSQL connection string:
# DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"

# 4. Start development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📑 Automated Business Rules & Quality Assurance

The system enforces strict operational integrity rules:
1. **Zero Over-Reservation Guarantee**: Cannot reserve more materials than `usableWarehouseQty - reservedQty`.
2. **Atomic Mutex Serialization**: Parallel project confirmations cannot oversubscribe the same physical inventory.
3. **Physical Stock Separation**: Reserved stock is not deducted from physical warehouse stock until materials are dispatched on site.
4. **Idempotent Installation**: Submitting an installation dispatches warehouse stock to site without double-counting on re-submission.
5. **Supervisor Accountability**: Flags when an executing supervisor differs from the initial inspector.
6. **Safety Standard Compliance**: Compliant with IS 4014 scaffolding engineering and safety standards.

---

## 📄 License & Commercial Rights
Proprietary enterprise software developed for **Alokhandwala**. All commercial rights reserved.
