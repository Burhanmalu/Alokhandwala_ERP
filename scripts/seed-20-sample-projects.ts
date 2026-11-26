import { ProjectService } from '../src/lib/services/project-service';
import { dbStore } from '../src/lib/db/store';
import { ProjectStatus } from '../src/lib/schema';

interface SeedProjectDef {
  customerCode: string;
  siteName: string;
  siteAddress: string;
  supervisorId: string;
  status: ProjectStatus;
  width: number;
  depth: number;
  height: number;
  unit: 'FEET' | 'METERS';
  scaffoldingType: string;
  totalAmount: number;
  paymentReceived: number;
  monthlyRentalRate?: number;
  installationDate?: string;
  removalDate?: string;
  actualDismantlingDate?: string;
  followUpDate?: string;
  remark: string;
}

const SAMPLE_PROJECTS: SeedProjectDef[] = [
  // 1. NOT_INSTALLED (3 projects)
  {
    customerCode: 'CUST-0002', // Sharma Construction & Developers
    siteName: 'Royal Palms Commercial Wing B',
    siteAddress: 'Plot 204, Scheme 54, Vijay Nagar, Indore, Madhya Pradesh 452010',
    supervisorId: 'usr-sup-01', // Mustafa Alokhandwala
    status: 'NOT_INSTALLED',
    width: 24,
    depth: 6,
    height: 30,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 45000,
    paymentReceived: 15000,
    followUpDate: '2026-11-28',
    remark: 'Pre-installation site inspection completed; waiting for foundation slab curing.',
  },
  {
    customerCode: 'CUST-0001', // Reliable Associates
    siteName: 'Sapphire Corporate Park - Block C',
    siteAddress: 'Tower Square, Sapna Sangeeta Road, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-sup-02', // Imran Khan
    status: 'NOT_INSTALLED',
    width: 10,
    depth: 15,
    height: 20,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 34574,
    paymentReceived: 25930.50,
    monthlyRentalRate: 22000,
    followUpDate: '2026-11-29',
    remark: 'Architectural drawings received; awaiting client clearance for site access.',
  },
  {
    customerCode: 'CUST-0003', // Malwa Infra Projects Pvt Ltd
    siteName: 'Malwa Logistic Hub - Phase 2',
    siteAddress: 'Plot No. 42, Scheme No. 78, Bypass Road, Indore, Madhya Pradesh 452010',
    supervisorId: 'usr-sup-03', // Shabbir Dawoodi
    status: 'NOT_INSTALLED',
    width: 40,
    depth: 10,
    height: 20,
    unit: 'FEET',
    scaffoldingType: 'Birdcage Slab Support Scaffolding',
    totalAmount: 80000,
    paymentReceived: 25000,
    followUpDate: '2026-11-30',
    remark: 'Initial site visit completed; awaiting steel reinforcement delivery schedule.',
  },

  // 2. QUOTATION_DRAFT (3 projects)
  {
    customerCode: 'CUST-0004', // Chouhan Buildcon & Developers
    siteName: 'Silver Castle Elevation Retouching',
    siteAddress: '108 Silver Sanchora Castle, RNT Marg, South Tukoganj, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-sup-04', // Farooq Sheikh
    status: 'QUOTATION_DRAFT',
    width: 18,
    depth: 3,
    height: 35,
    unit: 'FEET',
    scaffoldingType: 'Tube & Clamp Industrial Scaffolding',
    totalAmount: 38000,
    paymentReceived: 0,
    followUpDate: '2026-11-27',
    remark: 'Draft estimate prepared; awaiting management approval on transport charges.',
  },
  {
    customerCode: 'CUST-0005', // Narmada Structural Engineering
    siteName: 'Narmada Heavy Fabrication Plant',
    siteAddress: 'Sector C, Sanwer Road Industrial Area, Indore, Madhya Pradesh 452015',
    supervisorId: 'usr-sup-01', // Mustafa Alokhandwala
    status: 'QUOTATION_DRAFT',
    width: 50,
    depth: 12,
    height: 25,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 95000,
    paymentReceived: 0,
    followUpDate: '2026-11-28',
    remark: 'Quotation prepared for 3-month rental; client reviewing scope of cantilever supports.',
  },
  {
    customerCode: 'CUST-0006', // Apex Realcon Pvt Ltd
    siteName: 'Apex Sky Villas - Tower 1',
    siteAddress: 'Near TCS Square, Super Corridor, Indore, Madhya Pradesh 453555',
    supervisorId: 'usr-sup-02', // Imran Khan
    status: 'QUOTATION_DRAFT',
    width: 35,
    depth: 6,
    height: 45,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 120000,
    paymentReceived: 0,
    followUpDate: '2026-12-01',
    remark: 'Quotation drafted for full perimeter facade scaffolding.',
  },

  // 3. QUOTATION_ACCEPTED (2 projects)
  {
    customerCode: 'CUST-0007', // Mahakal Shoring & Civil Works
    siteName: 'Mahakal Commercial Complex',
    siteAddress: 'Sanwer Road, Near Toll Plaza, Indore / Ujjain Highway, Madhya Pradesh 453111',
    supervisorId: 'usr-sup-03', // Shabbir Dawoodi
    status: 'QUOTATION_ACCEPTED',
    width: 28,
    depth: 3,
    height: 30,
    unit: 'FEET',
    scaffoldingType: 'H-Frame Masonry Scaffolding',
    totalAmount: 62000,
    paymentReceived: 30000,
    followUpDate: '2026-11-26',
    remark: 'Quotation approved by client; advance token received, scheduling delivery.',
  },
  {
    customerCode: 'CUST-0008', // Shreeji Construction Corporation
    siteName: 'Shreeji Temple Gopuram Renovation',
    siteAddress: 'Rajwada Palace Precinct, MG Road, Indore, Madhya Pradesh 452002',
    supervisorId: 'usr-sup-04', // Farooq Sheikh
    status: 'QUOTATION_ACCEPTED',
    width: 20,
    depth: 20,
    height: 40,
    unit: 'FEET',
    scaffoldingType: 'Birdcage Slab Support Scaffolding',
    totalAmount: 85000,
    paymentReceived: 40000,
    followUpDate: '2026-11-27',
    remark: 'Quotation accepted; heritage safety protocols acknowledged by temple trust.',
  },

  // 4. CONFIRMED_PROJECT (2 projects)
  {
    customerCode: 'CUST-0009', // Horizon Heights Builders & Promoters
    siteName: 'Horizon Premium Enclave',
    siteAddress: 'AB Road, Near MR-10 Crossing, Indore, Madhya Pradesh 452010',
    supervisorId: 'usr-sup-01', // Mustafa Alokhandwala
    status: 'CONFIRMED_PROJECT',
    width: 32,
    depth: 4,
    height: 36,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 78000,
    paymentReceived: 45000,
    followUpDate: '2026-11-29',
    remark: 'Project confirmed and reserved in warehouse inventory; installation slot queued.',
  },
  {
    customerCode: 'CUST-0010', // Dewas Industrial Infrastructure Ltd
    siteName: 'Dewas Industrial Warehouse G-4',
    siteAddress: 'Industrial Area Phase II, AB Road, Dewas, Madhya Pradesh 455001',
    supervisorId: 'usr-admin-01', // Burhan Malu (Admin)
    status: 'CONFIRMED_PROJECT',
    width: 45,
    depth: 9,
    height: 22,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 68000,
    paymentReceived: 35000,
    followUpDate: '2026-11-30',
    remark: 'Confirmed order; materials earmarked in warehouse staging yard.',
  },

  // 5. SCHEDULED (3 projects)
  {
    customerCode: 'CUST-0011', // Ramesh Chandra Sharma & Sons
    siteName: 'Ramesh Heights Residential Block',
    siteAddress: 'Old Palasia Main Road, Near 56 Dukan, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-sup-02', // Imran Khan
    status: 'SCHEDULED',
    width: 25,
    depth: 3,
    height: 32,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 52000,
    paymentReceived: 26000,
    installationDate: '2026-12-01',
    removalDate: '2027-01-31',
    followUpDate: '2026-11-29',
    remark: 'Installation scheduled for Dec 1st; transport vehicle booked.',
  },
  {
    customerCode: 'CUST-0012', // Patel Scaffolding & Site Contractors
    siteName: 'Patel Logistics Shed No. 3',
    siteAddress: 'AB Road, Near Silicon City, Rau, Indore, Madhya Pradesh 453331',
    supervisorId: 'usr-sup-03', // Shabbir Dawoodi
    status: 'SCHEDULED',
    width: 40,
    depth: 6,
    height: 24,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 64000,
    paymentReceived: 32000,
    installationDate: '2026-12-05',
    removalDate: '2027-02-05',
    followUpDate: '2026-12-02',
    remark: 'Installation planned for Dec 5th; unloading crew notified.',
  },
  {
    customerCode: 'CUST-0013', // Verma Building Materials & Contracts
    siteName: 'Verma Commercial Arcade',
    siteAddress: 'Chhavani Main Road, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-sup-04', // Farooq Sheikh
    status: 'SCHEDULED',
    width: 22,
    depth: 3,
    height: 28,
    unit: 'FEET',
    scaffoldingType: 'H-Frame Masonry Scaffolding',
    totalAmount: 48000,
    paymentReceived: 24000,
    installationDate: '2026-12-10',
    removalDate: '2027-02-28',
    followUpDate: '2026-12-08',
    remark: 'Installation scheduled for mid-December after civil footings completion.',
  },

  // 6. ACTIVE_RENTAL (3 projects)
  {
    customerCode: 'CUST-0014', // Om Sai Residential Renovations
    siteName: 'Om Sai Apartment Exterior Restoration',
    siteAddress: 'Geeta Bhawan Square, AB Road, Navlakha, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-sup-01', // Mustafa Alokhandwala
    status: 'ACTIVE_RENTAL',
    width: 26,
    depth: 3,
    height: 34,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 58000,
    paymentReceived: 40000,
    installationDate: '2026-10-15',
    removalDate: '2026-12-31',
    followUpDate: '2026-12-15',
    remark: 'Active rental in progress; exterior plastering underway.',
  },
  {
    customerCode: 'CUST-0015', // Gour & Sons Civil Works
    siteName: 'Gour Industrial Workshop',
    siteAddress: 'Sector 1, Industrial Area, Pithampur, District Dhar / Indore, Madhya Pradesh 454775',
    supervisorId: 'usr-sup-02', // Imran Khan
    status: 'ACTIVE_RENTAL',
    width: 36,
    depth: 6,
    height: 25,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 72000,
    paymentReceived: 50000,
    installationDate: '2026-09-20',
    removalDate: '2026-12-20',
    followUpDate: '2026-12-10',
    remark: 'Active rental; ongoing structural fabrication works.',
  },
  {
    customerCode: 'CUST-0016', // Yadav Painting & Plastering Services
    siteName: 'Yadav Commercial Center Facade',
    siteAddress: 'Ring Road, Near Bengali Square, Indore, Madhya Pradesh 452016',
    supervisorId: 'usr-sup-03', // Shabbir Dawoodi
    status: 'ACTIVE_RENTAL',
    width: 30,
    depth: 3,
    height: 30,
    unit: 'FEET',
    scaffoldingType: 'Tube & Clamp Industrial Scaffolding',
    totalAmount: 60000,
    paymentReceived: 45000,
    installationDate: '2026-11-01',
    removalDate: '2027-01-15',
    followUpDate: '2026-12-25',
    remark: 'Scaffolding commissioned; painting team active on site.',
  },

  // 7. REMOVAL_PENDING (2 projects)
  {
    customerCode: 'CUST-0017', // Kalyan Housing Renovations
    siteName: 'Kalyan Heritage Villa',
    siteAddress: 'Annapurna Road, Near Usha Nagar, Indore, Madhya Pradesh 452009',
    supervisorId: 'usr-sup-04', // Farooq Sheikh
    status: 'REMOVAL_PENDING',
    width: 20,
    depth: 4,
    height: 24,
    unit: 'FEET',
    scaffoldingType: 'H-Frame Masonry Scaffolding',
    totalAmount: 42000,
    paymentReceived: 35000,
    installationDate: '2026-09-10',
    removalDate: '2026-11-26',
    followUpDate: '2026-11-25',
    remark: 'Exterior painting completed; dismantle inspection requested for Nov 26.',
  },
  {
    customerCode: 'CUST-0018', // Vikram Builders
    siteName: 'Vikram Plaza Front Glazing Site',
    siteAddress: 'RNT Marg, Near High Court, Indore, Madhya Pradesh 452001',
    supervisorId: 'usr-admin-01', // Burhan Malu (Admin)
    status: 'REMOVAL_PENDING',
    width: 35,
    depth: 3,
    height: 38,
    unit: 'FEET',
    scaffoldingType: 'Modular Façade Cuplock',
    totalAmount: 75000,
    paymentReceived: 65000,
    installationDate: '2026-08-25',
    removalDate: '2026-11-25',
    followUpDate: '2026-11-24',
    remark: 'Rental duration ending; dismantling crew scheduled for Nov 25.',
  },

  // 8. CLOSED (2 projects)
  {
    customerCode: 'CUST-0002', // Sharma Construction & Developers (Second Project)
    siteName: 'Sharma Commercial Hub - Wing A',
    siteAddress: 'Plot 204, Scheme 54, Vijay Nagar, Indore, Madhya Pradesh 452010',
    supervisorId: 'usr-sup-01', // Mustafa Alokhandwala
    status: 'CLOSED',
    width: 28,
    depth: 6,
    height: 30,
    unit: 'FEET',
    scaffoldingType: 'Cuplock Heavy Duty System',
    totalAmount: 84000,
    paymentReceived: 84000,
    installationDate: '2026-07-01',
    removalDate: '2026-10-15',
    actualDismantlingDate: '2026-10-15',
    followUpDate: '2026-10-16',
    remark: 'All materials dismantled, inspected, and reconciled back to central warehouse.',
  },
  {
    customerCode: 'CUST-0003', // Malwa Infra Projects Pvt Ltd (Second Project)
    siteName: 'Malwa Logistic Hub - Phase 1',
    siteAddress: 'Plot No. 42, Scheme No. 78, Bypass Road, Indore, Madhya Pradesh 452010',
    supervisorId: 'usr-sup-03', // Shabbir Dawoodi
    status: 'CLOSED',
    width: 42,
    depth: 10,
    height: 22,
    unit: 'FEET',
    scaffoldingType: 'Birdcage Slab Support Scaffolding',
    totalAmount: 96000,
    paymentReceived: 96000,
    installationDate: '2026-06-15',
    removalDate: '2026-09-30',
    actualDismantlingDate: '2026-09-30',
    followUpDate: '2026-10-01',
    remark: 'Phase 1 slab casting complete; scaffolding dismantled and account fully cleared.',
  },
];

async function seedSampleProjects() {
  console.log('Seeding 20 sample projects across all 8 project statuses...');

  // Reset projects first so the 20 sample projects are cleanly generated from AW-SCF-000001
  await dbStore.transaction(async state => {
    state.projects = [];
  });

  const customers = dbStore.getCustomers();
  const users = dbStore.getUsers();

  const createdProjects: string[] = [];

  for (let i = 0; i < SAMPLE_PROJECTS.length; i++) {
    const def = SAMPLE_PROJECTS[i];
    const customer = customers.find(c => c.customerCode === def.customerCode);
    if (!customer) {
      throw new Error(`Customer with code ${def.customerCode} not found in database.`);
    }

    const supervisor = users.find(u => u.id === def.supervisorId);
    if (!supervisor) {
      throw new Error(`Supervisor with ID ${def.supervisorId} not found in database.`);
    }

    const created = await ProjectService.createDirectProject({
      customerId: customer.id,
      customerName: customer.companyName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      siteName: def.siteName,
      siteAddress: def.siteAddress,
      assignedSupervisorId: supervisor.id,
      supervisorName: supervisor.fullName,
      width: def.width,
      depth: def.depth,
      height: def.height,
      unit: def.unit,
      scaffoldingType: def.scaffoldingType,
      status: def.status,
      installationDate: def.installationDate,
      removalDate: def.removalDate,
      actualDismantlingDate: def.actualDismantlingDate,
      monthlyRentalRate: def.monthlyRentalRate,
      totalAmount: def.totalAmount,
      paymentReceived: def.paymentReceived,
      followUpDate: def.followUpDate,
      remark: def.remark,
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu (Admin)',
    });

    createdProjects.push(`${created.projectCode} [${created.status}] - ${created.customerName} (${created.siteName})`);
  }

  // Ensure QTN-000002 links to AW-SCF-000002 for quotation sync test
  await dbStore.transaction(async state => {
    const p2 = state.projects.find(p => p.projectCode === 'AW-SCF-000002');
    const q2 = (state.quotations || []).find(q => q.quotationNumber === 'QTN-000002');
    if (p2 && q2) {
      q2.projectId = p2.id;
      p2.quotationId = q2.id;
      p2.monthlyRentalRate = 22000;
      p2.agreedProjectPrice = 34574;
    }
  });

  console.log(`\nSuccessfully created ${createdProjects.length} sample projects:`);
  createdProjects.forEach((p, idx) => console.log(`${idx + 1}. ${p}`));

  // Verify status distribution in database
  const allProjects = dbStore.getProjects();
  const distribution: Record<string, number> = {};
  allProjects.forEach(p => {
    distribution[p.status] = (distribution[p.status] || 0) + 1;
  });

  console.log('\nFinal Project Status Distribution:');
  console.table(distribution);
}

seedSampleProjects().catch(err => {
  console.error('Failed to seed sample projects:', err);
  process.exit(1);
});
