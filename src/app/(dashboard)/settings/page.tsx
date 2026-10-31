'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Settings, Building2, Clock, Check, FileText, RotateCcw } from 'lucide-react';
import { initialCompanySettings } from '@/lib/db/seed-data';
import { OFFICIAL_TERMS_AND_CONDITIONS, BusinessTerm } from '@/lib/constants/terms-and-conditions';

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(initialCompanySettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setSettings({
            ...json.data,
            termsAndConditions: json.data.termsAndConditions || OFFICIAL_TERMS_AND_CONDITIONS,
          });
        }
      })
      .catch(err => console.error('Error fetching settings:', err));
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTermChange = (index: number, newFullText: string) => {
    const updated = [...(settings.termsAndConditions || OFFICIAL_TERMS_AND_CONDITIONS)];
    updated[index] = { ...updated[index], fullText: newFullText };
    setSettings({ ...settings, termsAndConditions: updated });
  };

  const handleResetTerms = () => {
    if (confirm('Reset all Terms & Conditions to official business defaults?')) {
      setSettings({ ...settings, termsAndConditions: OFFICIAL_TERMS_AND_CONDITIONS });
    }
  };

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24160c] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#8c5e39]" />
            <span>Settings</span>
          </h1>
        </div>
      </div>

      {saved && (
        <div className="p-3 bg-[#fdf8f4] border border-[#debfa6] text-[#4d3221] text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-[#8c5e39]" />
          <span>Company settings and rental policies updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Company Brand Logo */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#8c5e39]" />
              <span>Official Brand & Corporate Logo</span>
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
              Active Brand Identity
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0 flex items-center justify-center">
              <img src="/logo.png" alt="Alokhandwala Logo" className="h-16 w-auto object-contain" />
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <div className="font-bold text-slate-800 text-sm">Alokhandwala Official Insignia</div>
              <p className="text-xs text-slate-500">
                This logo is actively displayed across the ERP navigation, login gateway, tax invoices, and operational reports.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 bg-slate-200/70 rounded font-mono">PNG Transparent</span>
                <span className="px-2 py-0.5 bg-slate-200/70 rounded font-mono">High Resolution</span>
                <span className="px-2 py-0.5 bg-slate-200/70 rounded font-mono">Light & Dark Optimized</span>
              </div>
            </div>
          </div>
        </div>

        {/* Company Identity */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#8c5e39]" />
            <span>1. Legal Entity & Taxation Metadata</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Registered Company Name *</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company GSTIN *</label>
              <input
                type="text"
                value={settings.gstin}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company PAN *</label>
              <input
                type="text"
                value={settings.pan}
                onChange={(e) => setSettings({ ...settings, pan: e.target.value })}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Registered Yard & Head Office Address</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone *</label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Email *</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State & State Code</label>
              <input
                type="text"
                value={`${settings.state} (${settings.stateCode})`}
                disabled
                className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default GST Rate (%)</label>
              <input
                type="number"
                value={settings.defaultGstRate}
                onChange={(e) => setSettings({ ...settings, defaultGstRate: Number(e.target.value) })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-[#322016]"
              />
            </div>
          </div>
        </div>

        {/* Operational Policies */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>2. Scaffolding Rental & Buffer Operational Defaults</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Removal Buffer Window (Days)</label>
              <input
                type="number"
                value={settings.bufferDaysDefault}
                onChange={(e) => setSettings({ ...settings, bufferDaysDefault: Number(e.target.value) })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Grace period granted for site clearance without billing extra month.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Extension Duration (Months)</label>
              <input
                type="number"
                value={settings.extensionDurationMonthsDefault}
                onChange={(e) => setSettings({ ...settings, extensionDurationMonthsDefault: Number(e.target.value) })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Calendar month arithmetic extension default.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Warehouse Low Stock Warning Threshold</label>
              <input
                type="number"
                value={settings.lowStockThresholdDefault}
                onChange={(e) => setSettings({ ...settings, lowStockThresholdDefault: Number(e.target.value) })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Triggers dashboard warning when available stock dips below this level.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Currency</label>
              <input
                type="text"
                value="INR (Indian Rupee - ₹)"
                disabled
                className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Official Business Terms & Conditions */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8c5e39]" />
                <span>3. Official Business Terms & Conditions (11 Clauses)</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Centralized clauses automatically injected across quotations, project confirmations, delivery challans, invoices, and PDF downloads.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetTerms}
              className="text-xs text-[#8c5e39] hover:text-[#59371d] font-semibold flex items-center gap-1 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          <div className="space-y-4 pt-1">
            {((settings.termsAndConditions && settings.termsAndConditions.length > 0)
              ? settings.termsAndConditions
              : OFFICIAL_TERMS_AND_CONDITIONS
            ).map((term: BusinessTerm, idx: number) => (
              <div key={term.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-5 h-5 rounded-full bg-[#322016] text-white flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span>{term.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    {term.category}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={term.fullText}
                  onChange={(e) => handleTermChange(idx, e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs leading-relaxed text-slate-800 focus:ring-1 focus:ring-[#8c5e39] focus:border-[#8c5e39]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#322016] hover:bg-[#4d3221] text-[#fdf8f4] rounded-lg font-bold shadow-xs transition flex items-center justify-center disabled:opacity-50"
          >
            {saving ? 'Saving Configuration...' : 'Save Configuration & Terms'}
          </button>
        </div>
      </form>
    </div>
  );
}
