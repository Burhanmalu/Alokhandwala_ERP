import { Pool } from 'pg';
import { 
  initialCategories, 
  initialMaterials, 
  initialUsers, 
  initialWarehouses, 
  initialCustomers, 
  initialSites, 
  initialProjects, 
  initialCompanySettings 
} from '../src/lib/db/seed-data';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_c1BFe3JWzthl@ep-aged-smoke-b5wjcyii-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function migrate() {
  console.log('Connecting to Neon PostgreSQL database...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('Connected! Creating database schema tables...');

    await client.query('BEGIN');

    // 1. Material Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_categories (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT
      );
    `);

    // 2. Materials (Stock Inventory)
    await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id VARCHAR(64) PRIMARY KEY,
        item_code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        category_id VARCHAR(64) REFERENCES material_categories(id) ON DELETE SET NULL,
        category_name VARCHAR(255),
        description TEXT,
        unit_of_measurement VARCHAR(32) DEFAULT 'NOS',
        standard_weight_kg NUMERIC(10,2) DEFAULT 0,
        purchase_cost NUMERIC(12,2) DEFAULT 0,
        rental_rate_per_month NUMERIC(12,2) DEFAULT 0,
        minimum_stock_threshold INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT TRUE,
        total_owned_qty INTEGER DEFAULT 0,
        usable_warehouse_qty INTEGER DEFAULT 0,
        reserved_qty INTEGER DEFAULT 0,
        site_allocated_qty INTEGER DEFAULT 0,
        in_transit_qty INTEGER DEFAULT 0,
        damaged_qty INTEGER DEFAULT 0,
        missing_qty INTEGER DEFAULT 0,
        under_inspection_qty INTEGER DEFAULT 0,
        available_to_allocate INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Customers
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(64) PRIMARY KEY,
        customer_code VARCHAR(64) NOT NULL UNIQUE,
        company_name VARCHAR(255) NOT NULL,
        reference_name VARCHAR(255),
        contact_person VARCHAR(255),
        phone VARCHAR(64),
        email VARCHAR(255),
        billing_address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        gstin VARCHAR(32),
        status VARCHAR(32) DEFAULT 'ACTIVE',
        credit_limit NUMERIC(14,2) DEFAULT 500000,
        outstanding_balance NUMERIC(14,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Sites
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id VARCHAR(64) PRIMARY KEY,
        site_code VARCHAR(64) NOT NULL UNIQUE,
        customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE CASCADE,
        customer_name VARCHAR(255),
        site_name VARCHAR(255) NOT NULL,
        site_address TEXT NOT NULL,
        referral_name VARCHAR(255),
        landmark VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        contact_person VARCHAR(255),
        contact_phone VARCHAR(64),
        assigned_supervisor_id VARCHAR(64),
        supervisor_name VARCHAR(255),
        status VARCHAR(32) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Projects
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(64) PRIMARY KEY,
        project_code VARCHAR(64) NOT NULL UNIQUE,
        customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE RESTRICT,
        customer_name VARCHAR(255) NOT NULL,
        site_id VARCHAR(64) REFERENCES sites(id) ON DELETE SET NULL,
        site_name VARCHAR(255) NOT NULL,
        site_address TEXT NOT NULL,
        referral_name VARCHAR(255),
        assigned_supervisor_id VARCHAR(64),
        supervisor_name VARCHAR(255),
        status VARCHAR(64) NOT NULL DEFAULT 'NOT_INSTALLED',
        pricing_model VARCHAR(32) DEFAULT 'MONTHLY_RENTAL',
        monthly_rental_rate NUMERIC(14,2) DEFAULT 0,
        agreed_project_price NUMERIC(14,2) DEFAULT 0,
        deposit_amount NUMERIC(14,2) DEFAULT 0,
        transport_charges NUMERIC(14,2) DEFAULT 0,
        installation_labour_charges NUMERIC(14,2) DEFAULT 0,
        shifting_charges NUMERIC(14,2) DEFAULT 0,
        dismantling_labour_charges NUMERIC(14,2) DEFAULT 0,
        gst_percentage NUMERIC(5,2) DEFAULT 18,
        planned_installation_date DATE,
        duration_months INTEGER DEFAULT 1,
        actual_installation_date TIMESTAMPTZ,
        rental_start_date DATE,
        rental_end_date DATE,
        original_rental_end_date DATE,
        buffer_end_date DATE,
        actual_dismantling_date TIMESTAMPTZ,
        closure_date TIMESTAMPTZ,
        quotation_number VARCHAR(100),
        quotation_date DATE,
        payment_terms TEXT,
        site_remarks TEXT,
        measurements JSONB,
        photos JSONB,
        materials JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Project Materials
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_materials (
        id VARCHAR(64) PRIMARY KEY,
        project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
        material_id VARCHAR(64) REFERENCES materials(id) ON DELETE RESTRICT,
        material_name VARCHAR(255) NOT NULL,
        item_code VARCHAR(64) NOT NULL,
        unit VARCHAR(32) DEFAULT 'NOS',
        required_quantity INTEGER DEFAULT 0,
        reserved_quantity INTEGER DEFAULT 0,
        issued_quantity INTEGER DEFAULT 0,
        installed_quantity INTEGER DEFAULT 0,
        returned_usable_quantity INTEGER DEFAULT 0,
        returned_damaged_quantity INTEGER DEFAULT 0,
        missing_quantity INTEGER DEFAULT 0,
        monthly_rental_rate NUMERIC(12,2) DEFAULT 0
      );
    `);

    // 7. Inventory Transactions Ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id VARCHAR(64) PRIMARY KEY,
        transaction_number VARCHAR(64) NOT NULL UNIQUE,
        movement_type VARCHAR(64) NOT NULL,
        source_location VARCHAR(255),
        destination_location VARCHAR(255),
        project_id VARCHAR(64),
        project_code VARCHAR(64),
        lines JSONB NOT NULL,
        gate_pass_number VARCHAR(64),
        vehicle_number VARCHAR(64),
        driver_name VARCHAR(255),
        driver_phone VARCHAR(64),
        performed_by_id VARCHAR(64),
        performed_by_name VARCHAR(255),
        verified_by_id VARCHAR(64),
        verified_by_name VARCHAR(255),
        transaction_date TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 8. System State Store Backup
    await client.query(`
      CREATE TABLE IF NOT EXISTS erp_state_sync (
        key VARCHAR(64) PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Schema created successfully. Upserting 18 stock materials...');

    // Upsert categories
    for (const cat of initialCategories) {
      await client.query(`
        INSERT INTO material_categories (id, code, name, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          description = EXCLUDED.description;
      `, [cat.id, cat.code, cat.name, cat.description]);
    }

    // Upsert exact 18 materials
    for (const mat of initialMaterials) {
      await client.query(`
        INSERT INTO materials (
          id, item_code, name, category_id, category_name, description,
          unit_of_measurement, standard_weight_kg, purchase_cost, rental_rate_per_month,
          minimum_stock_threshold, is_active, total_owned_qty, usable_warehouse_qty,
          reserved_qty, site_allocated_qty, in_transit_qty, damaged_qty, missing_qty,
          under_inspection_qty, available_to_allocate
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (id) DO UPDATE SET
          item_code = EXCLUDED.item_code,
          name = EXCLUDED.name,
          category_id = EXCLUDED.category_id,
          category_name = EXCLUDED.category_name,
          description = EXCLUDED.description,
          rental_rate_per_month = EXCLUDED.rental_rate_per_month,
          total_owned_qty = EXCLUDED.total_owned_qty,
          usable_warehouse_qty = EXCLUDED.usable_warehouse_qty,
          reserved_qty = EXCLUDED.reserved_qty,
          site_allocated_qty = EXCLUDED.site_allocated_qty,
          available_to_allocate = EXCLUDED.available_to_allocate;
      `, [
        mat.id, mat.itemCode, mat.name, mat.categoryId, mat.categoryName, mat.description,
        mat.unitOfMeasurement, mat.standardWeightKg, mat.purchaseCost, mat.rentalRatePerMonth,
        mat.minimumStockThreshold, mat.isActive, mat.totalOwnedQty, mat.usableWarehouseQty,
        mat.reservedQty, mat.siteAllocatedQty, mat.inTransitQty, mat.damagedQty, mat.missingQty,
        mat.underInspectionQty, mat.availableToAllocate
      ]);
    }

    // Upsert Customers
    for (const c of initialCustomers) {
      await client.query(`
        INSERT INTO customers (
          id, customer_code, company_name, reference_name, contact_person,
          phone, email, billing_address, city, state, gstin, status,
          credit_limit, outstanding_balance
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          reference_name = EXCLUDED.reference_name,
          contact_person = EXCLUDED.contact_person,
          phone = EXCLUDED.phone,
          billing_address = EXCLUDED.billing_address;
      `, [
        c.id, c.customerCode, c.companyName, c.referenceName, c.contactPerson,
        c.phone, c.email, c.billingAddress, c.city, c.state, c.gstin, c.status,
        c.creditLimit, c.outstandingBalance
      ]);
    }

    // Upsert Sites
    for (const s of initialSites) {
      await client.query(`
        INSERT INTO sites (
          id, site_code, customer_id, customer_name, site_name,
          site_address, landmark, city, state, contact_person, contact_phone,
          assigned_supervisor_id, supervisor_name, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          site_name = EXCLUDED.site_name,
          site_address = EXCLUDED.site_address,
          supervisor_name = EXCLUDED.supervisor_name;
      `, [
        s.id, s.siteCode, s.customerId, s.customerName, s.siteName,
        s.siteAddress, s.landmark, s.city, s.state, s.contactPerson, s.contactPhone,
        s.assignedSupervisorId, s.supervisorName, s.status
      ]);
    }

    // Upsert Projects
    for (const p of initialProjects) {
      await client.query(`
        INSERT INTO projects (
          id, project_code, customer_id, customer_name, site_id, site_name,
          site_address, assigned_supervisor_id, supervisor_name, status,
          pricing_model, monthly_rental_rate, agreed_project_price, deposit_amount,
          transport_charges, installation_labour_charges, shifting_charges,
          dismantling_labour_charges, gst_percentage, quotation_number, quotation_date,
          planned_installation_date, payment_terms, site_remarks, measurements, photos, materials
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          monthly_rental_rate = EXCLUDED.monthly_rental_rate,
          agreed_project_price = EXCLUDED.agreed_project_price;
      `, [
        p.id, p.projectCode, p.customerId, p.customerName, p.siteId, p.siteName,
        p.siteAddress, p.assignedSupervisorId, p.supervisorName, p.status,
        p.pricingModel, p.monthlyRentalRate, p.agreedProjectPrice, p.depositAmount,
        p.transportCharges, p.installationLabourCharges, p.shiftingCharges,
        p.dismantlingLabourCharges, p.gstPercentage, p.quotationNumber, p.quotationDate ? new Date(p.quotationDate) : null,
        p.plannedInstallationDate ? new Date(p.plannedInstallationDate) : null, p.paymentTerms, p.siteRemarks,
        JSON.stringify(p.measurements), JSON.stringify(p.photos), JSON.stringify(p.materials)
      ]);
    }

    await client.query('COMMIT');
    console.log('✓ Migration to Neon PostgreSQL completed successfully!');

    // Query back the 18 items to verify
    const matResult = await client.query('SELECT item_code, name, usable_warehouse_qty, available_to_allocate FROM materials ORDER BY item_code;');
    console.log(`\nVerified ${matResult.rowCount} Scaffolding Stock Items in Neon PostgreSQL:`);
    matResult.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.item_code}] ${r.name} - Warehouse: ${r.usable_warehouse_qty}, Available: ${r.available_to_allocate}`);
    });

    client.release();
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
