import { dbStore } from '../src/lib/db/store';
import { Customer } from '../src/lib/schema';
import { customerSchema } from '../src/lib/validations';

interface RawExcelRow {
  customerName: string;
  referenceName: string;
  mobileNumber: string;
  gst: string;
  address: string;
}

const EXCEL_ROWS: RawExcelRow[] = [
  { customerName: 'ABBAS BHAI (HUSSAIN SAIFFY)', referenceName: '', mobileNumber: '9826011121', gst: '', address: 'SAIFEE NAGAR 153' },
  { customerName: 'ABBAS NAJMI (CHIRAG FABRICATOR)', referenceName: '', mobileNumber: '9111116933', gst: '', address: 'KANUPRIYA NAGAR HASANJI NAGAR RAU' },
  { customerName: 'AJIT KRISH CAR DECOR', referenceName: '', mobileNumber: '9827257251', gst: '', address: 'OSCOR FORT' },
  { customerName: 'AKSHARAM RESORT PVT. LTD. MOHD AKHTAR', referenceName: '', mobileNumber: '8874964771', gst: '', address: '7/3 RAM CHANDRA NAGAR PHOTI KHOTI' },
  { customerName: 'ANKUSH NAGAR', referenceName: '', mobileNumber: '9827246225', gst: '', address: 'SANSKRITI COLONY RAU' },
  { customerName: 'ARJUN', referenceName: '', mobileNumber: '9713858266', gst: '', address: 'SPRING FIELD 21' },
  { customerName: 'AVINASH SIR', referenceName: '', mobileNumber: '8817643323', gst: '', address: '105 -TREASURE FANTASY' },
  { customerName: 'BURHAN BHAI', referenceName: '', mobileNumber: '7869327106', gst: '', address: 'JASMINE PRIME 20' },
  { customerName: 'DILIP RAJANI', referenceName: '', mobileNumber: '9131525504', gst: '', address: 'TAKSHAT INFRA SANWER' },
  { customerName: 'EKTARA LAWN (PAPPU BHAI)', referenceName: '', mobileNumber: '9826249513', gst: '', address: 'RAU BYPASS' },
  { customerName: 'HASAN BHAI', referenceName: '', mobileNumber: '9893111572', gst: '', address: 'EZZI MOHALLA MHOW' },
  { customerName: 'HUSSAIN BHAI MUNDRAWALA', referenceName: '', mobileNumber: '93020 25692', gst: '', address: '182 MASAKIN' },
  { customerName: 'IQBAL BHAI CHAPPU', referenceName: '', mobileNumber: '9302562370', gst: '', address: 'HAIDERY B' },
  { customerName: 'MAA BABA DOORMATIC (NITIN)', referenceName: '', mobileNumber: '8546073748 (NITIN)/92114 52600', gst: '', address: 'PITHAMPUR' },
  { customerName: 'MIRAJ BHAI REF HUSSAIN SAIFEE', referenceName: '', mobileNumber: '9893418688', gst: '', address: 'MASAKIN 115' },
  { customerName: 'OM CHOUDHARY', referenceName: '', mobileNumber: '8827552019', gst: '', address: 'TRIMULLA BIJALPUR' },
  { customerName: 'PRAFUL TALKIES', referenceName: '', mobileNumber: '7869680555', gst: '', address: 'INDRA NAGAR' },
  { customerName: 'QURESH BHAI', referenceName: '', mobileNumber: '9406682786', gst: '', address: 'SHIVALAY CITYOPTICAL 523' },
  { customerName: 'RAJAN JETH', referenceName: '', mobileNumber: '9893065636', gst: '', address: 'KHATIWALA TANK M 64' },
  { customerName: 'ROMIL JAIN', referenceName: '', mobileNumber: '9893060010', gst: '', address: 'PLOT NO. 22.23 RAMESHWARAM PLATINUM PARADISE BEHIND MALWA COLONY JHALARIYA' },
  { customerName: 'ROMIL JAIN', referenceName: '', mobileNumber: '9893060010', gst: '', address: 'RAMESHWARAM' },
  { customerName: 'SANDEEP JI', referenceName: '', mobileNumber: '7697680764', gst: '', address: 'PRIDE HOTEL (BLACK ROCK)' },
  { customerName: 'SANDEEP MAHESHWARI', referenceName: '', mobileNumber: '9826582039', gst: '', address: 'COUNTY WOK' },
  { customerName: 'SHABBIR BHAI BETMAWALA', referenceName: '', mobileNumber: '9826325652', gst: '', address: 'HAIDERY B 44' },
  { customerName: 'SHANKAR WADHWANI', referenceName: '', mobileNumber: '98273 49049', gst: '', address: '41 TREASURE TOWN' },
  { customerName: 'TAHA SAIFEE', referenceName: '', mobileNumber: '8878600455', gst: '', address: 'EMERALD SCHEME NO.78' },
  { customerName: 'TAHER BHAI', referenceName: '', mobileNumber: '9826068350', gst: '', address: 'ALITOWNSHIP 168' },
];

function parseMobileNumbers(raw: string): {
  primary: string;
  alternate?: string;
  rawAmbiguityFlag?: string;
} {
  const parts = raw.split('/').map(p => p.trim()).filter(Boolean);
  const extractDigits = (s: string) => s.replace(/[^0-9]/g, '');

  const primary = extractDigits(parts[0] || '');
  const alternate = parts[1] ? extractDigits(parts[1]) : undefined;

  let rawAmbiguityFlag: string | undefined;
  if (parts.length > 1) {
    rawAmbiguityFlag = `Multiple numbers in source (${raw})`;
  }

  return { primary, alternate, rawAmbiguityFlag };
}

function isValidIndianMobile(num: string): boolean {
  return /^[6-9]\d{9}$/.test(num);
}

async function importCustomers() {
  console.log(`Starting import of ${EXCEL_ROWS.length} customers from Customer.xlsx...`);

  // Pre-compute duplicate phone occurrences within the spreadsheet
  const phoneCounts: Record<string, number> = {};
  for (const row of EXCEL_ROWS) {
    const { primary } = parseMobileNumbers(row.mobileNumber);
    phoneCounts[primary] = (phoneCounts[primary] || 0) + 1;
  }

  const flaggedRecords: Array<{ code: string; name: string; reason: string }> = [];
  const importedRecords: Customer[] = [];

  await dbStore.transaction(async (state) => {
    const existingMaxNum = state.customers.reduce((max, c) => {
      const m = c.customerCode?.match(/CUST-(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    let nextSeq = existingMaxNum + 1;

    for (let i = 0; i < EXCEL_ROWS.length; i++) {
      const row = EXCEL_ROWS[i];
      const { primary, alternate, rawAmbiguityFlag } = parseMobileNumbers(row.mobileNumber);

      // Check for exact existing duplicate in database (same name + same phone + same address)
      const exactExisting = state.customers.find(
        c =>
          c.companyName.trim().toLowerCase() === row.customerName.trim().toLowerCase() &&
          c.phone === primary &&
          c.billingAddress.trim().toLowerCase() === row.address.trim().toLowerCase()
      );
      if (exactExisting) {
        flaggedRecords.push({
          code: exactExisting.customerCode,
          name: row.customerName,
          reason: 'Exact duplicate already exists in database — skipped overwrite',
        });
        continue;
      }

      // Validate via existing customerSchema
      const validated = customerSchema.parse({
        companyName: row.customerName,
        referenceName: row.referenceName || undefined,
        contactPerson: row.customerName,
        phone: primary,
        email: '',
        billingAddress: row.address,
        city: 'Indore',
        state: 'Madhya Pradesh',
        gstin: undefined,
        creditLimit: 500000,
      });

      const flags: string[] = [];
      if (!isValidIndianMobile(primary)) {
        flags.push(`Invalid primary mobile format: ${primary}`);
      }
      if (alternate && !isValidIndianMobile(alternate)) {
        flags.push(`Invalid alternate mobile format: ${alternate}`);
      }
      if (phoneCounts[primary] > 1) {
        flags.push(`Duplicate mobile number (${primary}) with different address — review required`);
      }
      if (rawAmbiguityFlag) {
        flags.push(rawAmbiguityFlag);
      }

      const customerCode = `CUST-${nextSeq.toString().padStart(4, '0')}`;
      nextSeq += 1;

      const now = new Date().toISOString();
      const newCustomer: Customer = {
        id: `cust-${Date.now()}-${i}`,
        customerCode,
        companyName: validated.companyName,
        referenceName: validated.referenceName || undefined,
        contactPerson: validated.companyName,
        phone: validated.phone,
        alternatePhone: alternate || undefined,
        email: '',
        billingAddress: validated.billingAddress,
        city: 'Indore',
        state: 'Madhya Pradesh',
        gstin: undefined, // All GST cells blank -> GST Registered = No
        reviewFlag: flags.length > 0 ? flags.join('; ') : undefined,
        status: 'ACTIVE',
        creditLimit: 500000,
        outstandingBalance: 0,
        sitesCount: 0,
        projectsCount: 0,
        activeRentalsCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      state.customers.push(newCustomer);
      importedRecords.push(newCustomer);

      if (newCustomer.reviewFlag) {
        flaggedRecords.push({
          code: newCustomer.customerCode,
          name: newCustomer.companyName,
          reason: newCustomer.reviewFlag,
        });
      }
    }

    state.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      actorId: 'usr-admin-01',
      actorEmail: 'Burhan Malu (Admin)',
      action: 'BULK_IMPORT_CUSTOMERS',
      entityTable: 'customers',
      entityId: 'excel-import-27',
      newState: {
        importedCount: importedRecords.length,
        flaggedCount: flaggedRecords.length,
      },
      createdAt: new Date().toISOString(),
    });
  });

  console.log(`\nSuccessfully imported ${importedRecords.length} customers into database.`);
  console.log(`Total customers in database: ${dbStore.getCustomers().length}`);
  if (flaggedRecords.length > 0) {
    console.log('\nFlagged records for review:');
    flaggedRecords.forEach(f => console.log(`  - [${f.code}] ${f.name}: ${f.reason}`));
  }
}

importCustomers().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

