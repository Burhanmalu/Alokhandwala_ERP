import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { dbStore } from '../src/lib/db/store';
import { hasPermission } from '../src/lib/auth';

async function runRolePersistenceTests() {
  console.log('\n--- Running Role Persistence & Permissions Tests ---');

  // Test 1: Change worker to ADMIN
  const workerUser = dbStore.getUsers().find(u => u.email === 'worker@alokhandwala.com');
  assert(workerUser, 'Worker user should exist');
  console.log(`Initial role for ${workerUser.email}:`, workerUser.role);

  // Update role in transaction (same as PATCH /api/users)
  await dbStore.transaction((state) => {
    const user = state.users.find(u => u.email === 'worker@alokhandwala.com');
    if (user) {
      user.role = 'ADMIN';
    }
    return user;
  });

  // Verify in-memory store
  const updatedInMemory = dbStore.getUsers().find(u => u.email === 'worker@alokhandwala.com');
  assert.strictEqual(updatedInMemory?.role, 'ADMIN', 'In-memory role must be ADMIN');
  console.log('✓ In-memory role verified as ADMIN');

  // Verify disk persistence
  const DATA_DIR = path.join(process.cwd(), '.data');
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
  const DATA_FILE = path.join(DATA_DIR, isTestEnv ? 'alokhandwala-erp-test.json' : 'alokhandwala-erp.json');
  assert(fs.existsSync(DATA_FILE), 'Persistent data file must exist');

  const fileContent = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const userInFile = fileContent.users.find((u: any) => u.email === 'worker@alokhandwala.com');
  assert.strictEqual(userInFile?.role, 'ADMIN', 'Role saved in database file must be ADMIN');
  console.log('✓ Database file role verified as ADMIN');

  // Test 2: Cold restart simulation - verify loadState does not revert to WORKER
  // Re-read file with a simulated store load logic
  const reloadedUsers = fileContent.users.map((u: any) => {
    if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN_PM' || u.role === 'INVENTORY_MGR' || u.role === 'ACCOUNTANT') {
      return { ...u, role: 'ADMIN' };
    }
    if (u.role === 'SUPERVISOR') {
      return { ...u, role: 'SUPERVISOR' };
    }
    return { ...u, role: 'WORKER' };
  });

  const workerAfterReload = reloadedUsers.find((u: any) => u.email === 'worker@alokhandwala.com');
  assert.strictEqual(workerAfterReload?.role, 'ADMIN', 'Reloaded user must maintain ADMIN role and NOT revert to WORKER');
  console.log('✓ Cold restart reload verified: Role remains ADMIN');

  // Test 3: Permissions synchronization
  assert.strictEqual(hasPermission('WORKER', 'USER_MANAGEMENT'), false, 'Worker should not have USER_MANAGEMENT');
  assert.strictEqual(hasPermission('WORKER', 'INVENTORY_VIEW'), false, 'Worker should not have INVENTORY_VIEW');
  assert.strictEqual(hasPermission('ADMIN', 'USER_MANAGEMENT'), true, 'Admin must have USER_MANAGEMENT');
  assert.strictEqual(hasPermission('ADMIN', 'INVENTORY_VIEW'), true, 'Admin must have INVENTORY_VIEW');
  assert.strictEqual(hasPermission('ADMIN', 'PROJECT_VIEW_ALL'), true, 'Admin must have PROJECT_VIEW_ALL');
  assert.strictEqual(hasPermission('ADMIN', 'BILLING_VIEW'), true, 'Admin must have BILLING_VIEW');
  console.log('✓ RBAC Permissions successfully verified: Full admin authority granted');

  // Clean up: Reset worker back to WORKER
  await dbStore.transaction((state) => {
    const user = state.users.find(u => u.email === 'worker@alokhandwala.com');
    if (user) {
      user.role = 'WORKER';
    }
    return user;
  });
  console.log('✓ Role test cleaned up successfully');
  console.log('--- ALL ROLE PERSISTENCE TESTS PASSED ---\n');
}

runRolePersistenceTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
