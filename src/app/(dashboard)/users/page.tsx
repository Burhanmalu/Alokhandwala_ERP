'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { UserCheck, Shield, Phone, Mail, CheckCircle2, UserPlus, Eye, EyeOff, Lock, KeyRound } from 'lucide-react';
import { initialUsers } from '@/lib/db/seed-data';
import { UserProfile, UserRole } from '@/lib/schema';
import { formatDate } from '@/lib/formatters';

export default function UserManagementPage() {
  const router = useRouter();
  const { currentUser, updateUserRole, refreshUsers } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  useEffect(() => {
    refreshUsers()
      .then(liveData => {
        if (liveData && liveData.length > 0) {
          setUsers(liveData);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshUsers]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('SUPERVISOR');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Change password modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenChangePassword = (u: UserProfile) => {
    setTargetUser(u);
    setNewPassword(u.password || '');
    setShowNewPassword(false);
    setPasswordModalOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !newPassword.trim()) return;
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetUser.id,
          password: newPassword.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, password: newPassword.trim() } : u));
        await refreshUsers();
        setSuccessToast(`Password updated successfully for ${targetUser.fullName}`);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        alert(json.error || 'Failed to update password');
      }
    } catch (err) {
      console.error('Failed to update password:', err);
      alert('Error updating password');
    } finally {
      setPasswordSaving(false);
      setPasswordModalOpen(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      alert('Full Name and Email are required.');
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          password: password.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUsers(prev => [...prev, json.data]);
        await refreshUsers();
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setModalOpen(false);
        setSuccessToast(`User ${json.data.fullName} registered successfully.`);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        alert(json.error || 'Failed to add user to database.');
      }
    } catch (err) {
      console.error('Failed to add user:', err);
      alert('Failed to connect to server to create user.');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    // Optimistic UI state update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    
    // Synchronize to database and global AuthContext
    const ok = await updateUserRole(userId, newRole);
    if (ok) {
      setSuccessToast(`Role permanently updated to ${newRole}. Permissions synchronized.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } else {
      alert('Failed to update role in the database. Please try again.');
      const live = await refreshUsers();
      setUsers(live);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SUPERVISOR':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'WORKER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <span>User Management</span>
          </h1>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition w-full sm:w-auto min-h-[42px] shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add System User</span>
        </button>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Mobile User Card View */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading user profiles...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
            No users found. Add your first user to get started.
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900 text-sm">{u.fullName}</div>
                <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
              </div>
              <select
                value={u.role}
                onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans ${getRoleBadge(u.role)}`}
                title="Change assigned role"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="WORKER">WORKER</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{u.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{u.phone}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
              <span className="text-slate-400 flex items-center gap-1 font-sans">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Password</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {visiblePasswords[u.id] ? (u.password || '(not set)') : '••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(u.id)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition"
                  title={visiblePasswords[u.id] ? "Hide password" : "Show password"}
                >
                  {visiblePasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenChangePassword(u)}
                  className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition rounded flex items-center gap-1 text-[10px] font-sans font-semibold border border-emerald-200 px-1.5"
                  title="Change user password"
                >
                  <KeyRound className="w-3 h-3 text-emerald-600" />
                  <span>Change</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-400">
              <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                Active
              </span>
              <span>Joined: {formatDate(u.createdAt)}</span>
            </div>
          </div>
        )))}
      </div>

      {/* Desktop User Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto responsive-table-container">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Full Name & ID</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                    Loading user profiles...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No users found. Add your first user to get started.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{u.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans ${getRoleBadge(u.role)}`}
                      title="Change assigned role"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                      <option value="WORKER">WORKER</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                  <td className="px-4 py-3 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {visiblePasswords[u.id] ? (u.password || '(not set)') : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(u.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 transition rounded"
                        title={visiblePasswords[u.id] ? "Hide password" : "Show password"}
                      >
                        {visiblePasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenChangePassword(u)}
                        className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition rounded flex items-center gap-1 text-[10px] font-sans font-semibold border border-emerald-200 ml-1 px-1.5"
                        title="Change user password"
                      >
                        <KeyRound className="w-3 h-3 text-emerald-600" />
                        <span>Change</span>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-sans">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-sans">{formatDate(u.createdAt)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Add System User</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Shabbir Contractor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg min-h-[40px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium min-h-[40px]"
                >
                  <option value="ADMIN">Admin (Full Access & All Powers)</option>
                  <option value="SUPERVISOR">Supervisor (Site Form & Installation Form)</option>
                  <option value="WORKER">Worker (Sites Worked On Only)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="e.g. shabbir@alokhandwala.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg min-h-[40px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98200 44444"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg min-h-[40px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Login Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Set login password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg min-h-[40px] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Credentials used by this user to sign into the ALOKHANDWALA portal.</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition min-h-[42px]"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
                  <div className="text-[11px] text-slate-500 font-medium">{targetUser.fullName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Login Password *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg min-h-[40px] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition"
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Credentials for <strong className="text-slate-700 font-mono">{targetUser.email}</strong> to sign into the ALOKHANDWALA portal.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition min-h-[38px] flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{passwordSaving ? 'Saving...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
