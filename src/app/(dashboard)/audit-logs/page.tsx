'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, History, Calendar, User, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { AuditLog } from '@/lib/schema';
import { formatDateTime } from '@/lib/formatters';

export default function AuditLogsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    fetch('/api/audit-logs')
      .then(r => r.json())
      .then(json => {
        if (json.success) setLogs(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entityTable.toLowerCase().includes(q) ||
      l.actorEmail.toLowerCase().includes(q) ||
      l.entityId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-600" />
          <span>System Security & Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable records of critical project transitions, inventory movements, commercial confirmations, and user actions.
        </p>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Action, Entity, Actor or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs min-h-[40px]"
          />
        </div>
        <div className="text-slate-500 font-medium shrink-0">Recorded Events: <span className="font-bold text-slate-800">{filtered.length}</span></div>
      </div>

      {/* Mobile Audit Logs Card View */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
            No audit logs found matching your search.
          </div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                  {log.action}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="font-bold text-emerald-800 font-mono">{log.entityTable}</span>
                <span className="text-[11px] font-mono text-slate-500">{log.entityId}</span>
              </div>
              <div className="text-[11px] text-slate-600 truncate pt-0.5">
                Actor: <span className="font-medium text-slate-800">{log.actorEmail}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Audit Logs Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto responsive-table-container">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Table</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Actor / Performer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-emerald-800 font-bold">{log.entityTable}</td>
                  <td className="px-4 py-3 text-slate-600">{log.entityId}</td>
                  <td className="px-4 py-3 font-sans text-slate-700 whitespace-nowrap">{log.actorEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
