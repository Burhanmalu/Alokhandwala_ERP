'use client';

import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ReceiptIndianRupee,
  Calendar,
  History,
} from 'lucide-react';
import { Project } from '@/lib/schema';
import { formatDate, formatINR } from '@/lib/formatters';

interface DismantleReconciliationPanelProps {
  project: Project;
  currentUser: any;
  onSaved?: (updatedProject?: Project) => void;
  onCancel?: () => void;
}

export default function DismantleReconciliationPanel({
  project,
  currentUser,
  onSaved,
  onCancel,
}: DismantleReconciliationPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [actualDismantlingDate, setActualDismantlingDate] = useState('');
  const [supervisorNameInput, setSupervisorNameInput] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');

  const [totalAgreedInput, setTotalAgreedInput] = useState('0');
  const [paymentReceivedInput, setPaymentReceivedInput] = useState('0');
  const [balanceAmountInput, setBalanceAmountInput] = useState('0');

  const [paymentDateType, setPaymentDateType] = useState<'EXPECTED' | 'ACTUAL'>('EXPECTED');
  const [outstandingPaymentNote, setOutstandingPaymentNote] = useState('');
  const [outstandingPaymentDate, setOutstandingPaymentDate] = useState('');

  useEffect(() => {
    if (!project) return;
    setSupervisorNameInput(
      project.supervisorName || project.installationSupervisor?.executingSupervisorName || ''
    );
    setActualDismantlingDate(project.actualDismantlingDate || '');

    const curTotal = Number(
      project.totalAmount ?? project.agreedProjectPrice ?? project.quotationAmount ?? 0
    );
    const curReceived = Number(project.paymentReceived ?? project.advancePaidAmount ?? 0);
    const curBalance = Math.round((curTotal - curReceived) * 100) / 100;

    setTotalAgreedInput(String(curTotal));
    setPaymentReceivedInput(String(curReceived));
    setBalanceAmountInput(String(curBalance));

    setOutstandingPaymentNote(project.outstandingPaymentNote || '');
    if (project.expectedPaymentDate) {
      setOutstandingPaymentDate(project.expectedPaymentDate);
      setPaymentDateType('EXPECTED');
    } else if (project.actualPaymentDate) {
      setOutstandingPaymentDate(project.actualPaymentDate);
      setPaymentDateType('ACTUAL');
    } else {
      setOutstandingPaymentDate('');
    }
  }, [project]);

  const numericTotal = Number(totalAgreedInput);
  const numericReceived = Number(paymentReceivedInput);
  const numericBalance = Number(balanceAmountInput);
  const hasOutstandingBalance = !isNaN(numericBalance) && numericBalance > 0;
  const paymentHistory = project.outstandingPaymentHistory || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!actualDismantlingDate) {
      setError('Actual Dismantling Date is required.');
      return;
    }

    if (!totalAgreedInput.trim() || isNaN(numericTotal) || numericTotal < 0) {
      setError('Total Agreed Price must be a valid non-negative number.');
      return;
    }
    if (!paymentReceivedInput.trim() || isNaN(numericReceived) || numericReceived < 0) {
      setError('Total Payment Received must be a valid non-negative number.');
      return;
    }
    if (!balanceAmountInput.trim() || isNaN(numericBalance) || numericBalance < 0) {
      setError('Balance Amount must be a valid non-negative number.');
      return;
    }
    if (Math.abs((numericTotal - numericReceived) - numericBalance) > 0.01) {
      setError('Balance Amount must equal Total Agreed Price − Total Payment Received.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/dismantle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualDismantlingDate,
          supervisorId: currentUser?.id || project?.assignedSupervisorId || 'usr-sup-01',
          teamMembers: supervisorNameInput.trim() || undefined,
          reconciliationNotes: reconciliationNotes.trim() || undefined,
          projectTotalAmount: Math.round(numericTotal * 100) / 100,
          projectPaymentReceived: Math.round(numericReceived * 100) / 100,
          projectBalanceAmount: Math.round(numericBalance * 100) / 100,
          outstandingPaymentNote: outstandingPaymentNote.trim() || undefined,
          paymentDateType: hasOutstandingBalance ? paymentDateType : 'ACTUAL',
          outstandingPaymentDate: outstandingPaymentDate || undefined,
          materialReturns: [],
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit dismantling settlement');
      }

      setSuccessMsg('Dismantling details and project financial settlement saved.');
      if (onSaved) {
        onSaved(json.data?.project);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-[#d6c7b2] shadow-xs space-y-5">
      <div className="border-b border-[#ebdcc9] pb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#24160c] flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-700" />
            <span>Dismantling & Material Condition Reconciliation</span>
          </h2>
          <p className="text-xs text-[#7d6553] mt-1">
            Record dismantling details, finalize project financial settlement, and track any remaining balance payment.
          </p>
        </div>
        <span className="font-mono font-bold text-xs bg-[#fbf7f0] text-[#24160c] border border-[#d6c7b2] px-2.5 py-1 rounded-md shrink-0">
          {project.projectCode}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Dismantling Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-[#4d301c] mb-1">
              Actual Dismantling Date <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={actualDismantlingDate}
              onChange={(e) => setActualDismantlingDate(e.target.value)}
              required
              disabled={submitting}
              className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono font-bold text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#4d301c] mb-1">
              Dismantling Supervisor
            </label>
            <input
              type="text"
              value={supervisorNameInput}
              onChange={(e) => setSupervisorNameInput(e.target.value)}
              placeholder="e.g. ALI"
              disabled={submitting}
              className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#4d301c] mb-1">
              Reconciliation Notes & Discrepancies
            </label>
            <textarea
              rows={2}
              value={reconciliationNotes}
              onChange={(e) => setReconciliationNotes(e.target.value)}
              placeholder="Optional site dismantling remarks..."
              disabled={submitting}
              className="w-full px-3 py-2 bg-white border border-[#d6c7b2] rounded-md text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
            />
          </div>
        </div>

        {/* Final Project Financial Settlement */}
        <div className="p-4 bg-[#fbf7f0] rounded-xl border border-[#d6b692] space-y-4">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-2.5">
            <div className="flex items-center gap-2">
              <ReceiptIndianRupee className="w-4 h-4 text-[#8f6541]" />
              <span className="font-bold text-[#24160c] uppercase tracking-wider text-[11px]">
                Final Project Financial Settlement
              </span>
            </div>
            <span className="text-[10px] text-[#714f36] font-mono">
              Balance = Total Agreed − Payment Received
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-semibold text-[#4d301c] mb-1 whitespace-nowrap">
                Total Agreed Price
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-mono font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  disabled={submitting}
                  value={totalAgreedInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTotalAgreedInput(val);
                    const t = Number(val) || 0;
                    const r = Number(paymentReceivedInput) || 0;
                    setBalanceAmountInput(String(Math.round((t - r) * 100) / 100));
                    setError(null);
                  }}
                  className="w-full pl-6 pr-2.5 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono font-bold text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#4d301c] mb-1 whitespace-nowrap">
                Total Payment Received
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600/70 font-mono font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  disabled={submitting}
                  value={paymentReceivedInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaymentReceivedInput(val);
                    const t = Number(totalAgreedInput) || 0;
                    const r = Number(val) || 0;
                    setBalanceAmountInput(String(Math.round((t - r) * 100) / 100));
                    setError(null);
                  }}
                  className="w-full pl-6 pr-2.5 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono font-bold text-emerald-700 focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#4d301c] mb-1 whitespace-nowrap">
                Balance Amount
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-700/70 font-mono font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  disabled={submitting}
                  value={balanceAmountInput}
                  onChange={(e) => {
                    setBalanceAmountInput(e.target.value);
                    setError(null);
                  }}
                  className="w-full pl-6 pr-2.5 py-2 bg-white border border-[#d6c7b2] rounded-md font-mono font-bold text-amber-800 focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Outstanding Balance Payment Details */}
          <div className="pt-3 border-t border-[#ebdcc9] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#24160c] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#8f6541]" />
                <span>Outstanding Balance Payment Details</span>
              </span>
              {!hasOutstandingBalance && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Fully Paid</span>
                </span>
              )}
            </div>

            {hasOutstandingBalance ? (
              <div className="p-3.5 bg-white rounded-lg border border-[#e5dac8] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#4d301c]">Date Type</span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f7f2eb] border border-[#d6c7b2] rounded-md w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPaymentDateType('EXPECTED')}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                        paymentDateType === 'EXPECTED'
                          ? 'bg-[#24160c] text-[#c79e7c] shadow-2xs'
                          : 'text-[#714f36] hover:bg-[#ebdcc9]/60'
                      }`}
                    >
                      Expected Payment Date
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPaymentDateType('ACTUAL')}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                        paymentDateType === 'ACTUAL'
                          ? 'bg-[#24160c] text-[#c79e7c] shadow-2xs'
                          : 'text-[#714f36] hover:bg-[#ebdcc9]/60'
                      }`}
                    >
                      Actual Payment Received Date
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      Payment Note
                    </label>
                    <input
                      type="text"
                      value={outstandingPaymentNote}
                      onChange={(e) => setOutstandingPaymentNote(e.target.value)}
                      placeholder="e.g. Client promised balance via UPI next week"
                      disabled={submitting}
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#4d301c] mb-1">
                      {paymentDateType === 'EXPECTED'
                        ? 'Expected Payment Date'
                        : 'Actual Payment Received Date'}
                    </label>
                    <input
                      type="date"
                      value={outstandingPaymentDate}
                      onChange={(e) => setOutstandingPaymentDate(e.target.value)}
                      disabled={submitting}
                      className="w-full px-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-bold text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#7d6553]">
                  Note: Entering an Expected Payment Date does not add to Total Payment Received. When the client pays, update Total Payment Received above and record the Actual Payment Received Date.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-medium">
                Project balance is ₹0. All previous payment notes and dates are preserved below.
              </div>
            )}

            {/* Previous Payment Notes & Dates History */}
            {paymentHistory.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#714f36] flex items-center gap-1.5">
                  <History className="w-3 h-3" />
                  <span>Payment Notes & Date History ({paymentHistory.length})</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {paymentHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2.5 bg-white border border-[#e5dac8] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.dateType === 'ACTUAL'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {entry.dateType === 'ACTUAL' ? 'Actual Paid Date' : 'Expected Date'}
                          </span>
                          <span className="font-mono font-bold text-[#24160c]">
                            {formatDate(entry.paymentDate)}
                          </span>
                          {entry.amountPaid && entry.amountPaid > 0 ? (
                            <span className="font-mono font-bold text-emerald-700">
                              +{formatINR(entry.amountPaid, false)}
                            </span>
                          ) : null}
                        </div>
                        {entry.note && <p className="text-[#574830]">{entry.note}</p>}
                      </div>
                      <div className="text-right font-mono text-[10px] text-[#7d6553] shrink-0">
                        <div>Received: {formatINR(entry.totalPaymentReceived, false)}</div>
                        <div>Balance: {formatINR(entry.balanceAmount, false)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ebdcc9]">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-[#574830] bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] rounded-md font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Saving Settlement...' : 'Submit Dismantling & Settlement'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

