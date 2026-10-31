import { dbStore } from '../src/lib/db/store';
import { WorkerReportService } from '../src/lib/services/worker-report-service';
import { Project, UserProfile } from '../src/lib/schema';

export async function runWorkerSupervisorReportTests() {
  console.log('\n===============================================================');
  console.log('WORKER & SUPERVISOR PERFORMANCE REPORT TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // Setup test environment in dbStore
  await dbStore.transaction((state) => {
    // Clean up test projects
    state.projects = [
      // 1. Completed project in Oct 2026 (Month 10)
      {
        id: 'test-proj-oct-1',
        projectCode: 'AW-TEST-OCT1',
        customerId: 'cust-1',
        customerName: 'DLF Realty Ltd',
        siteId: 'site-1',
        siteName: 'Tower A',
        siteAddress: 'Andheri East, Mumbai',
        status: 'ACTIVE_RENTAL',
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 25000,
        agreedProjectPrice: 30000,
        depositAmount: 5000,
        transportCharges: 2000,
        installationLabourCharges: 3000,
        shiftingCharges: 0,
        dismantlingLabourCharges: 2000,
        gstPercentage: 18,
        actualInstallationDate: '2026-10-15T10:00:00.000Z',
        assignedSupervisorId: 'usr-sup-01',
        supervisorName: 'Mustafa Alokhandwala (Supervisor)',
        installationSupervisor: {
          assignedSupervisorId: 'usr-sup-01',
          assignedSupervisorName: 'Mustafa Alokhandwala (Supervisor)',
          executingSupervisorId: 'usr-sup-01',
          executingSupervisorName: 'Mustafa Alokhandwala',
          isSameSupervisor: true,
        },
        installationWorkers: [
          { id: 'w-1', name: 'Ramesh Kumar (Worker)', role: 'Lead Scaffolder' },
          { id: 'w-2', name: 'Suresh Patil', role: 'Rigger' },
        ],
      } as Project,

      // 2. Completed project in Nov 2026 (Month 11) - Project 1
      {
        id: 'test-proj-nov-1',
        projectCode: 'AW-TEST-NOV1',
        customerId: 'cust-2',
        customerName: 'Godrej Properties Ltd',
        siteId: 'site-2',
        siteName: 'Wing B',
        siteAddress: 'Bandra West, Mumbai',
        status: 'ACTIVE_RENTAL',
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 40000,
        agreedProjectPrice: 45000,
        depositAmount: 10000,
        transportCharges: 3000,
        installationLabourCharges: 4000,
        shiftingCharges: 0,
        dismantlingLabourCharges: 3000,
        gstPercentage: 18,
        actualInstallationDate: '2026-11-05T14:30:00.000Z',
        assignedSupervisorId: 'usr-sup-01',
        supervisorName: 'Mustafa Alokhandwala',
        installationWorkers: [
          { id: 'w-1', name: 'Ramesh Kumar', role: 'Lead Scaffolder' },
          { id: 'w-3', name: 'Ganesh Shinde', role: 'Technician' },
        ],
      } as Project,

      // 3. Completed project in Nov 2026 (Month 11) - Project 2 (Different supervisor)
      {
        id: 'test-proj-nov-2',
        projectCode: 'AW-TEST-NOV2',
        customerId: 'cust-3',
        customerName: 'Shapoorji Pallonji',
        siteId: 'site-3',
        siteName: 'Commercial Hub',
        siteAddress: 'Worli, Mumbai',
        status: 'INSTALLED',
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 60000,
        agreedProjectPrice: 70000,
        depositAmount: 15000,
        transportCharges: 5000,
        installationLabourCharges: 6000,
        shiftingCharges: 0,
        dismantlingLabourCharges: 4000,
        gstPercentage: 18,
        actualInstallationDate: '2026-11-20T09:00:00.000Z',
        assignedSupervisorId: 'usr-admin-01',
        supervisorName: 'Burhan Malu (Admin)',
        installationSupervisor: {
          assignedSupervisorId: 'usr-admin-01',
          assignedSupervisorName: 'Burhan Malu (Admin)',
          executingSupervisorId: 'usr-admin-01',
          executingSupervisorName: 'Burhan Malu',
          isSameSupervisor: true,
        },
        installationWorkers: [
          { id: 'w-2', name: 'Suresh Patil', role: 'Rigger' },
          { id: 'w-3', name: 'Ganesh Shinde', role: 'Technician' },
        ],
      } as Project,

      // 4. NOT_INSTALLED project (Must NOT be counted in completed reports)
      {
        id: 'test-proj-uninstalled',
        projectCode: 'AW-TEST-UNINSTALLED',
        customerId: 'cust-1',
        customerName: 'DLF Realty Ltd',
        siteId: 'site-4',
        siteName: 'Tower C Future',
        siteAddress: 'Powai, Mumbai',
        status: 'NOT_INSTALLED',
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 35000,
        agreedProjectPrice: 35000,
        depositAmount: 0,
        transportCharges: 0,
        installationLabourCharges: 0,
        shiftingCharges: 0,
        dismantlingLabourCharges: 0,
        gstPercentage: 18,
        assignedSupervisorId: 'usr-sup-01',
        supervisorName: 'Mustafa Alokhandwala',
      } as Project,
    ];
  });

  // Test 1: Completed projects filtering excludes uninstalled projects
  const completedProjects = WorkerReportService.getCompletedProjects();
  assert(
    completedProjects.length === 3 &&
    !completedProjects.some(p => p.id === 'test-proj-uninstalled'),
    '1. Strictly counts completed installations and excludes uninstalled projects'
  );

  // Test 2: October 2026 Monthly Report
  const octReport = WorkerReportService.generatePerformanceReport({
    year: 2026,
    month: 10,
  });
  assert(
    octReport.summary.totalCompletedProjects === 1 &&
    octReport.summary.activeSupervisorsCount === 1 &&
    octReport.summary.activeWorkersCount === 2,
    '2. Month filter (October 2026) isolates exactly 1 project with 1 supervisor and 2 workers'
  );

  // Test 3: Deduplication of same supervisor on a project
  const mustafaOct = octReport.employees.find(e => e.name === 'Mustafa Alokhandwala' && e.role === 'SUPERVISOR');
  assert(
    mustafaOct !== undefined && mustafaOct.completedProjectsCount === 1,
    '3. Avoids duplicate counting when supervisor is both assigned and executing supervisor'
  );

  // Test 4: November 2026 Monthly Report
  const novReport = WorkerReportService.generatePerformanceReport({
    year: 2026,
    month: 11,
  });
  assert(
    novReport.summary.totalCompletedProjects === 2 &&
    novReport.summary.activeSupervisorsCount === 2 &&
    novReport.summary.activeWorkersCount === 3,
    '4. Month filter (November 2026) reflects 2 projects across 2 supervisors and 3 workers'
  );

  // Test 5: Top supervisor and top worker calculation in November
  assert(
    novReport.summary.topSupervisor?.name === 'Mustafa Alokhandwala' ||
    novReport.summary.topSupervisor?.name === 'Burhan Malu',
    '5. Top supervisor is correctly identified in monthly summary'
  );

  const ganeshNov = novReport.employees.find(e => e.name === 'Ganesh Shinde');
  assert(
    ganeshNov !== undefined && ganeshNov.completedProjectsCount === 2,
    '6. Worker Ganesh Shinde completed 2 projects in November'
  );

  // Test 6: Role filter isolation
  const supervisorsOnly = WorkerReportService.generatePerformanceReport({
    role: 'SUPERVISOR',
  });
  assert(
    supervisorsOnly.employees.every(e => e.role === 'SUPERVISOR'),
    '7. Role filter strictly isolates supervisors when selected'
  );

  const workersOnly = WorkerReportService.generatePerformanceReport({
    role: 'WORKER',
  });
  assert(
    workersOnly.employees.every(e => e.role === 'WORKER'),
    '8. Role filter strictly isolates workers when selected'
  );

  // Test 7: Employee Name Search filter
  const searchResults = WorkerReportService.generatePerformanceReport({
    employeeName: 'suresh',
  });
  assert(
    searchResults.employees.length === 1 &&
    searchResults.employees[0].name.toLowerCase().includes('suresh'),
    '9. Employee Name search filter locates exact person case-insensitively'
  );

  // Test 8: Cross-month comparison calculation
  const comparison = WorkerReportService.compareMonths('2026-10', '2026-11');
  const ganeshComp = comparison.comparison.find(c => c.name === 'Ganesh Shinde');
  assert(
    comparison.summaryA.totalCompletedProjects === 1 &&
    comparison.summaryB.totalCompletedProjects === 2 &&
    ganeshComp !== undefined &&
    ganeshComp.countA === 0 &&
    ganeshComp.countB === 2 &&
    ganeshComp.diff === 2,
    '10. Cross-month comparison computes accurate deltas (Month A vs Month B)'
  );

  console.log('---------------------------------------------------------------');
  console.log(`Worker & Supervisor Report Results: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Worker & Supervisor Report suite`);
  }
}

if (require.main === module) {
  runWorkerSupervisorReportTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

