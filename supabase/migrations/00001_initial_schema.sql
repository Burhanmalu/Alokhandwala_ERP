-- =============================================================================
-- ALOKHANDWALA SCAFFOLDING ERP - COMPREHENSIVE POSTGRESQL SCHEMA MIGRATION
-- Migration: 00001_initial_schema.sql
-- Description: Core identity, customers, sites, projects, inventory, finance & operations
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. IDENTITY & RBAC
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role_code VARCHAR(50) NOT NULL REFERENCES roles(code),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_code VARCHAR(50) NOT NULL REFERENCES roles(code),
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL DEFAULT 'Alokhandwala Scaffolding & Formwork Pvt. Ltd.',
    gstin VARCHAR(20) NOT NULL DEFAULT '27AABCA1234F1Z5',
    pan VARCHAR(20) DEFAULT 'AABCA1234F',
    address TEXT NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'Maharashtra',
    state_code VARCHAR(10) NOT NULL DEFAULT '27',
    contact_phone VARCHAR(50) NOT NULL,
    contact_email VARCHAR(100) NOT NULL,
    default_gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    buffer_days_default INT NOT NULL DEFAULT 3,
    extension_duration_months_default INT NOT NULL DEFAULT 1,
    low_stock_threshold_default INT NOT NULL DEFAULT 50,
    rental_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    rental_expiry_days_before INT[] DEFAULT ARRAY[7, 3, 1],
    low_stock_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    installation_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. CUSTOMERS & SITES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. CUST-0001
    company_name VARCHAR(200) NOT NULL,
    reference_name VARCHAR(150),
    contact_person VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150),
    billing_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Mumbai',
    state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    gstin VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, ARCHIVED
    credit_limit NUMERIC(15, 2) DEFAULT 500000.00,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    designation VARCHAR(100),
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. SITE-0001
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    site_name VARCHAR(200) NOT NULL,
    site_address TEXT NOT NULL,
    landmark VARCHAR(150),
    city VARCHAR(100) NOT NULL DEFAULT 'Mumbai',
    state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    contact_person VARCHAR(150),
    contact_phone VARCHAR(30),
    assigned_supervisor_id UUID REFERENCES profiles(id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    length NUMERIC(10, 2) NOT NULL,
    width NUMERIC(10, 2) NOT NULL,
    height NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'METERS', -- METERS, FEET
    measurement_type VARCHAR(100) NOT NULL DEFAULT 'FAÇADE_SCAFFOLD',
    description TEXT,
    measured_by UUID REFERENCES profiles(id),
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- SITE_INSPECTION, INSTALLATION, SHIFTING, DISMANTLING, AGREEMENT, INVOICE
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL, -- image/jpeg, image/png, application/pdf
    file_size_bytes BIGINT NOT NULL,
    stage_label VARCHAR(100), -- BEFORE_INSTALLATION, AFTER_INSTALLATION, DISMANTLED, DAMAGED
    uploaded_by UUID REFERENCES profiles(id),
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. INVENTORY & WAREHOUSES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS material_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. SCF-STD-3000
    name VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES material_categories(id),
    description TEXT,
    unit_of_measurement VARCHAR(20) NOT NULL DEFAULT 'NOS', -- NOS, SETS, METERS, KG
    standard_weight_kg NUMERIC(10, 2) DEFAULT 0.00,
    purchase_cost NUMERIC(12, 2) DEFAULT 0.00,
    rental_rate_per_month NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    minimum_stock_threshold INT NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Navi Mumbai',
    contact_person VARCHAR(100),
    contact_phone VARCHAR(30),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_type VARCHAR(30) NOT NULL, -- WAREHOUSE, CUSTOMER_SITE, IN_TRANSIT, SCRAP_QUARANTINE
    warehouse_id UUID REFERENCES warehouses(id),
    site_id UUID REFERENCES sites(id),
    label VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES warehouses(id),
    site_id UUID REFERENCES sites(id),
    usable_warehouse_qty INT NOT NULL DEFAULT 0 CHECK (usable_warehouse_qty >= 0),
    reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    site_allocated_qty INT NOT NULL DEFAULT 0 CHECK (site_allocated_qty >= 0),
    in_transit_qty INT NOT NULL DEFAULT 0 CHECK (in_transit_qty >= 0),
    damaged_qty INT NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    missing_qty INT NOT NULL DEFAULT 0 CHECK (missing_qty >= 0),
    under_inspection_qty INT NOT NULL DEFAULT 0 CHECK (under_inspection_qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_material_warehouse_site UNIQUE NULLS NOT DISTINCT (material_id, warehouse_id, site_id)
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, -- FK added below
    material_id UUID NOT NULL REFERENCES materials(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    reserved_quantity INT NOT NULL CHECK (reserved_quantity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ISSUED, RELEASED, CANCELLED
    reserved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. TXN-2026-000001
    movement_type VARCHAR(50) NOT NULL,
    -- Movement types: OPENING_STOCK, PURCHASE_RECEIPT, RESERVATION, RESERVATION_RELEASE,
    -- MATERIAL_ISSUE_DISPATCH, SITE_RECEIPT, SITE_TO_SITE_TRANSFER, WAREHOUSE_RETURN,
    -- DAMAGED_TRANSFER, REPAIR_COMPLETION, WRITE_OFF, MISSING_STOCK_ADJUSTMENT, PHYSICAL_COUNT_CORRECTION
    source_location_id UUID REFERENCES inventory_locations(id),
    destination_location_id UUID REFERENCES inventory_locations(id),
    project_id UUID,
    shifting_id UUID,
    removal_id UUID,
    reference_document VARCHAR(100),
    created_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES inventory_transactions(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity INT NOT NULL,
    condition VARCHAR(30) NOT NULL DEFAULT 'GOOD', -- GOOD, DAMAGED, SCRAP, MISSING
    remarks TEXT
);

-- -----------------------------------------------------------------------------
-- 4. PROJECTS & COMPLETE LIFECYCLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. AW-SCF-000001
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    assigned_supervisor_id UUID REFERENCES profiles(id),
    status VARCHAR(40) NOT NULL DEFAULT 'NOT_INSTALLED',
    -- State machine: NOT_INSTALLED, CONFIRMED_PROJECT, SCHEDULED, INSTALLED,
    -- ACTIVE_RENTAL, BUFFER_PERIOD, EXTENSION_REQUESTED, EXTENDED,
    -- SHIFTING_PENDING, SHIFTING_IN_PROGRESS, REMOVAL_PENDING,
    -- RETURNED_RECONCILIATION, CLOSED, CANCELLED
    pricing_model VARCHAR(50) NOT NULL DEFAULT 'MONTHLY_RENTAL', -- MONTHLY_RENTAL, LUMP_SUM, METRIC_RATE
    monthly_rental_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    agreed_project_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
    transport_charges NUMERIC(12, 2) DEFAULT 0.00,
    installation_labour_charges NUMERIC(12, 2) DEFAULT 0.00,
    shifting_charges NUMERIC(12, 2) DEFAULT 0.00,
    dismantling_labour_charges NUMERIC(12, 2) DEFAULT 0.00,
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    planned_installation_date DATE,
    actual_installation_date DATE,
    rental_start_date DATE,
    rental_end_date DATE,
    original_rental_end_date DATE,
    buffer_end_date DATE,
    actual_dismantling_date DATE,
    closure_date TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key linking back
ALTER TABLE inventory_reservations
    ADD CONSTRAINT fk_inv_res_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS project_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_status VARCHAR(40) NOT NULL,
    to_status VARCHAR(40) NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    quotation_number VARCHAR(50) NOT NULL,
    quotation_date DATE NOT NULL,
    approved_by UUID REFERENCES profiles(id),
    payment_terms TEXT,
    customer_po_number VARCHAR(100),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS project_material_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    required_quantity INT NOT NULL CHECK (required_quantity > 0),
    reserved_quantity INT NOT NULL DEFAULT 0,
    issued_quantity INT NOT NULL DEFAULT 0,
    installed_quantity INT NOT NULL DEFAULT 0,
    returned_usable_quantity INT NOT NULL DEFAULT 0,
    returned_damaged_quantity INT NOT NULL DEFAULT 0,
    missing_quantity INT NOT NULL DEFAULT 0,
    monthly_rental_rate NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_material UNIQUE (project_id, material_id)
);

CREATE TABLE IF NOT EXISTS project_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actual_installation_date TIMESTAMPTZ NOT NULL,
    supervisor_id UUID REFERENCES profiles(id),
    team_members TEXT,
    safety_checklist_completed BOOLEAN NOT NULL DEFAULT TRUE,
    client_representative_name VARCHAR(150),
    client_sign_off BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_installation_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES project_installations(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    issued_quantity INT NOT NULL,
    installed_quantity INT NOT NULL,
    unused_returned_qty INT NOT NULL DEFAULT 0,
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS project_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rental_start_date DATE NOT NULL,
    current_rental_end_date DATE NOT NULL,
    billing_cycle_day INT NOT NULL DEFAULT 1,
    rate_per_month NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buffer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    current_rental_end_date DATE NOT NULL,
    requested_buffer_days INT NOT NULL DEFAULT 3,
    proposed_removal_deadline DATE NOT NULL,
    reason TEXT NOT NULL,
    additional_charges NUMERIC(10, 2) DEFAULT 0.00,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extension_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. EXT-2026-000001
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    previous_rental_end_date DATE NOT NULL,
    new_rental_end_date DATE NOT NULL,
    duration_months INT NOT NULL DEFAULT 1,
    extension_reason TEXT NOT NULL,
    monthly_rental_rate NUMERIC(12, 2) NOT NULL,
    additional_charges NUMERIC(12, 2) DEFAULT 0.00,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifting_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shifting_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. SHF-2026-000001
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shifting_type VARCHAR(30) NOT NULL, -- TYPE_A_UNCHANGED, TYPE_B_QUANTITY_CHANGE
    current_site_id UUID REFERENCES sites(id),
    destination_site_id UUID REFERENCES sites(id),
    destination_area_description TEXT,
    planned_shifting_date DATE NOT NULL,
    actual_completion_date DATE,
    supervisor_id UUID REFERENCES profiles(id),
    team_members TEXT,
    labour_charges NUMERIC(10, 2) DEFAULT 0.00,
    transport_charges NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    approved_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifting_material_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shifting_id UUID NOT NULL REFERENCES shifting_requests(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    previous_quantity INT NOT NULL,
    new_required_quantity INT NOT NULL,
    quantity_difference INT NOT NULL, -- new - previous
    additional_issued_qty INT NOT NULL DEFAULT 0,
    surplus_returned_qty INT NOT NULL DEFAULT 0,
    damaged_qty INT NOT NULL DEFAULT 0,
    missing_qty INT NOT NULL DEFAULT 0,
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS removal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    removal_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. RMV-2026-000001
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_removal_date DATE NOT NULL,
    actual_dismantling_date DATE,
    reason TEXT,
    supervisor_id UUID REFERENCES profiles(id),
    team_members TEXT,
    transport_details TEXT,
    warehouse_id UUID REFERENCES warehouses(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, RECONCILED, COMPLETED
    received_by_warehouse_staff UUID REFERENCES profiles(id),
    warehouse_receipt_at TIMESTAMPTZ,
    reconciliation_notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_return_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    removal_id UUID NOT NULL REFERENCES removal_requests(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    expected_site_qty INT NOT NULL,
    collected_qty INT NOT NULL,
    usable_returned_qty INT NOT NULL DEFAULT 0,
    damaged_qty INT NOT NULL DEFAULT 0,
    missing_qty INT NOT NULL DEFAULT 0,
    quantity_still_at_site INT NOT NULL DEFAULT 0,
    inspection_result VARCHAR(50) DEFAULT 'PASSED',
    remarks TEXT
);

CREATE TABLE IF NOT EXISTS project_activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_title VARCHAR(200) NOT NULL,
    event_description TEXT,
    actor_id UUID REFERENCES profiles(id),
    actor_name VARCHAR(150),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. FINANCE, INVOICES & GST
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),
    quotation_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    cgst_amount NUMERIC(15, 2) DEFAULT 0.00,
    sgst_amount NUMERIC(15, 2) DEFAULT 0.00,
    igst_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED
    terms_and_conditions TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'NOS',
    rate NUMERIC(12, 2) NOT NULL,
    taxable_amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. INV-2026-000001
    customer_id UUID NOT NULL REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),
    invoice_type VARCHAR(40) NOT NULL DEFAULT 'RENTAL_CHARGE', -- RENTAL_CHARGE, TRANSPORT, LABOUR, SHIFTING, DAMAGE_PENALTY
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    taxable_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cgst_rate NUMERIC(5, 2) DEFAULT 9.00,
    cgst_amount NUMERIC(15, 2) DEFAULT 0.00,
    sgst_rate NUMERIC(5, 2) DEFAULT 9.00,
    sgst_amount NUMERIC(15, 2) DEFAULT 0.00,
    igst_rate NUMERIC(5, 2) DEFAULT 0.00,
    igst_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED', -- ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    hsn_sac_code VARCHAR(30) DEFAULT '997312', -- Scaffolding rental SAC code
    quantity INT NOT NULL DEFAULT 1,
    rate NUMERIC(12, 2) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. RCP-2026-000001
    customer_id UUID NOT NULL REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),
    invoice_id UUID REFERENCES invoices(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL, -- NEFT, RTGS, CHEQUE, UPI, CASH
    transaction_reference VARCHAR(100),
    bank_name VARCHAR(100),
    received_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. SUPPLIERS & PROCUREMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(30) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150),
    address TEXT,
    gstin VARCHAR(20),
    pan VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'ORDERED', -- ORDERED, PARTIAL_RECEIVED, RECEIVED, CANCELLED
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    ordered_quantity INT NOT NULL,
    received_quantity INT NOT NULL DEFAULT 0,
    unit_cost NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(15, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. GRN-2026-000001
    purchase_order_id UUID REFERENCES purchase_orders(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    received_date DATE NOT NULL,
    challan_invoice_number VARCHAR(100),
    received_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    accepted_quantity INT NOT NULL,
    rejected_quantity INT NOT NULL DEFAULT 0,
    remarks TEXT
);

-- -----------------------------------------------------------------------------
-- 7. OPERATIONS, NOTIFICATIONS & AUDIT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role_target VARCHAR(50), -- SUPER_ADMIN, ADMIN, SUPERVISOR, INVENTORY_MGR, ACCOUNTANT
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO', -- INFO, WARNING, URGENT, SUCCESS
    entity_type VARCHAR(50), -- PROJECT, RENTAL, INVENTORY, INVOICE
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id),
    actor_email VARCHAR(150),
    action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, STATUS_CHANGE, RESERVATION, DISPATCH, RETURN
    entity_table VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    old_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. INDEXES FOR PERFORMANCE
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_site_id ON projects(site_id);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(rental_start_date, rental_end_date);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_mat_wh ON inventory_balances(material_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status ON invoices(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
