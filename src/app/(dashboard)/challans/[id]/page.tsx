'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ScrollText,
  Building2,
  MapPin,
  Ruler,
  PackageOpen,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Trash2,
  Lock,
  Plus,
  Loader2,
  X,
  History,
} from 'lucide-react';
import { Challan } from '@/lib/schema';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function ChallanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser, can } = useAuth();

  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Return Entry Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnRows, setReturnRows] = useState<
    { date: string; materialId: string; quantity: string; remarks: string }[]
  >([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Record Lost / Missing Modal
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossRows, setLossRows] = useState<
    { date: string; materialId: string; quantity: string; reason: string }[]
  >([]);
  const [approveLossOnSubmit, setApproveLossOnSubmit] = useState(true);
  const [submittingLoss, setSubmittingLoss] = useState(false);
  const [lossError, setLossError] = useState<string | null>(null);

  // Close & Delete States
  const [closing, setClosing] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [approveLossOnClose, setApproveLossOnClose] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchChallan = async () => {
    try {
      const res = await fetch(`/api/challans/${id}`);
      const json = await res.json();
      if (json.success) {
        setChallan(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallan();
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-xs text-stone-500">Loading challan report...</div>;
  }

  if (!challan) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg border border-[#e5dac8] text-center space-y-3 mt-10">
        <h2 className="text-sm font-bold text-rose-800">Challan Not Found</h2>
        <Link
          href="/challans"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#24160c] text-[#c79e7c] rounded-md text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Challan Directory</span>
        </Link>
      </div>
    );
  }

  const returnableLines = (challan.reconciliation || []).filter(l => l.remainingAtSite > 0);
  const canCloseChallan =
    challan.status === 'UNCLOSED' &&
    challan.remainingAtSiteQuantity === 0 &&
    can('CHALLAN_CLOSE');

  const openReturnModal = () => {
    const first = returnableLines[0] || challan.reconciliation[0];
    setReturnRows([
      {
        date: getTodayDateString(),
        materialId: first?.materialId || '',
        quantity: first?.remainingAtSite ? String(first.remainingAtSite) : '1',
        remarks: '',
      },
    ]);
    setReturnError(null);
    setReturnModalOpen(true);
  };

  const openLossModal = () => {
    const first = returnableLines[0] || challan.reconciliation[0];
    setLossRows([
      {
        date: getTodayDateString(),
        materialId: first?.materialId || '',
        quantity: '1',
        reason: '',
      },
    ]);
    setApproveLossOnSubmit(true);
    setLossError(null);
    setLossModalOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingReturn) return;
    setReturnError(null);

    const parsed = returnRows.map(r => ({
      date: r.date,
      materialId: r.materialId,
      quantity: Math.trunc(Number(r.quantity)),
      remarks: r.remarks.trim() || undefined,
    }));

    if (parsed.some(r => !r.date || !r.materialId || !Number.isInteger(r.quantity) || r.quantity < 1)) {
      setReturnError('All return rows require a valid date, material, and positive integer quantity.');
      return;
    }

    setSubmittingReturn(true);
    try {
      const res = await fetch(`/api/challans/${challan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_RETURN',
          entries: parsed,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record return entry');
      }
      setChallan(json.data);
      setReturnModalOpen(false);
      setBanner({
        type: 'success',
        text: `Material return entry saved. Remaining at site: ${json.data.remainingAtSiteQuantity}. Status: ${json.data.status === 'CLOSED' ? 'Closed' : 'Unclosed'}.`,
      });
    } catch (err: any) {
      setReturnError(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleSubmitLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingLoss) return;
    setLossError(null);

    const parsed = lossRows.map(r => ({
      date: r.date,
      materialId: r.materialId,
      quantity: Math.trunc(Number(r.quantity)),
      reason: r.reason.trim() || 'Marked missing/lost during site reconciliation',
    }));

    if (parsed.some(r => !r.date || !r.materialId || !Number.isInteger(r.quantity) || r.quantity < 1)) {
      setLossError('All lost material rows require a valid date, material, and positive quantity.');
      return;
    }

    setSubmittingLoss(true);
    try {
      const res = await fetch(`/api/challans/${challan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECORD_LOSS',
          entries: parsed,
          approveLoss: approveLossOnSubmit,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record lost material');
      }
      setChallan(json.data);
      setLossModalOpen(false);
      setBanner({
        type: 'success',
        text: `Lost/missing material recorded separately (not added to warehouse stock).`,
      });
    } catch (err: any) {
      setLossError(err.message);
    } finally {
      setSubmittingLoss(false);
    }
  };

  const handleCloseChallan = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/challans/${challan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE',
          approveLoss: approveLossOnClose || !challan.hasLostMaterials,
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to close challan');
      }
      setChallan(json.data);
      setCloseConfirmOpen(false);
      setBanner({ type: 'success', text: `Challan ${challan.challanNumber} closed cleanly.` });
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setClosing(false);
    }
  };

  const handleDeleteChallan = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/challans/${challan.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete challan');
      }
      router.push('/challans');
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/challans" className="hover:text-[#24160c] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Challan Directory</span>
        </Link>
        <span>/</span>
        <span className="font-mono font-bold text-[#24160c]">{challan.challanNumber}</span>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-2xs ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-semibold">{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lost Material Prominent Warning */}
      {challan.hasLostMaterials && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-rose-950 text-xs flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-rose-950">
              Lost / Missing Material Recorded ({challan.totalLostQuantity} Unit(s))
            </div>
            <p className="text-rose-900 leading-relaxed">
              {challan.totalLostQuantity} unit(s) issued on this challan have been marked as lost/missing and were{' '}
              <strong>excluded from returned warehouse stock</strong> so they are not confused with material remaining on site (
              {challan.remainingAtSiteQuantity} unit(s)).
              {challan.lossApproved
                ? ` Approved by ${challan.lossApprovedBy || 'Admin'}.`
                : ' Requires authorized Admin approval before final closure.'}
            </p>
          </div>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-white rounded-lg border border-[#e5dac8] p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <ScrollText className="w-5 h-5 text-[#8f6541]" />
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-[#24160c] tracking-tight">
              {challan.challanNumber}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border ${
                challan.status === 'CLOSED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  challan.status === 'CLOSED' ? 'bg-emerald-600' : 'bg-amber-600'
                }`}
              />
              <span>{challan.status === 'CLOSED' ? 'Closed' : 'Unclosed'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-600">
            <div className="flex items-center gap-1.5 font-semibold text-stone-900">
              <Building2 className="w-4 h-4 text-[#8f6541] shrink-0" />
              <span>{challan.customerName}</span>
            </div>
            <span className="text-stone-300">•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
              <span>{challan.siteName}</span>
            </div>
            <span className="text-stone-300">•</span>
            <div className="flex items-center gap-1.5 font-mono">
              <Ruler className="w-4 h-4 text-stone-400 shrink-0" />
              <span>{challan.size}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-stone-500 pt-1">
            <span>
              Issue Date: <strong className="font-mono text-stone-800">{formatDate(challan.issueDate)}</strong>
            </span>
            <span>
              Created: <strong className="font-mono text-stone-800">{formatDateTime(challan.createdAt)}</strong>
            </span>
            <span>
              Last Updated: <strong className="font-mono text-stone-800">{formatDateTime(challan.updatedAt)}</strong>
            </span>
          </div>
        </div>

        {/* Challan Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {can('CHALLAN_RECORD_RETURN') && returnableLines.length > 0 && (
            <button
              type="button"
              onClick={openReturnModal}
              className="h-9 px-3.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Return Entry</span>
            </button>
          )}

          {can('CHALLAN_RECORD_LOSS') && returnableLines.length > 0 && (
            <button
              type="button"
              onClick={openLossModal}
              className="h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Record Missing / Lost</span>
            </button>
          )}

          {challan.status === 'UNCLOSED' && can('CHALLAN_CLOSE') && (
            <button
              type="button"
              disabled={challan.remainingAtSiteQuantity > 0 || closing}
              onClick={() => {
                setApproveLossOnClose(Boolean(challan.lossApproved));
                setCloseConfirmOpen(true);
              }}
              title={
                challan.remainingAtSiteQuantity > 0
                  ? `Cannot close: ${challan.remainingAtSiteQuantity} unit(s) still remaining at site`
                  : 'Close reconciled challan'
              }
              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Close Challan</span>
            </button>
          )}

          {can('CHALLAN_EDIT') && (
            <Link
              href={`/challans/${challan.id}/edit`}
              className="h-9 px-3 bg-[#fbf7f0] hover:bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] rounded-md text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#8f6541]" />
              <span>Edit</span>
            </Link>
          )}

          {can('CHALLAN_DELETE') && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="h-9 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 block">Total Output (Issued)</span>
          <span className="text-xl font-bold font-mono text-[#24160c] mt-1 block">
            {challan.totalOutputQuantity.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 block">Total Input (Returned)</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {challan.totalReturnedQuantity.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 block">Pending (Remaining at Site)</span>
          <span
            className={`text-xl font-bold font-mono mt-1 block ${
              challan.remainingAtSiteQuantity > 0 ? 'text-amber-800' : 'text-emerald-700'
            }`}
          >
            {challan.remainingAtSiteQuantity.toLocaleString('en-IN')}
          </span>
          {challan.pendingQuantity !== challan.remainingAtSiteQuantity && (
            <span className="text-[10px] text-stone-400 font-mono">
              Raw (Out − In): {challan.pendingQuantity}
            </span>
          )}
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 block">Lost / Missing Material</span>
          <span
            className={`text-xl font-bold font-mono mt-1 block ${
              challan.totalLostQuantity > 0 ? 'text-rose-700' : 'text-stone-400'
            }`}
          >
            {challan.totalLostQuantity.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Material-Wise Reconciliation Table */}
      <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#f0e8db] flex flex-wrap items-center justify-between gap-2 bg-[#fbf9f5]">
          <div>
            <h2 className="text-sm font-bold text-[#24160c]">Material-Wise Reconciliation</h2>
            <p className="text-[11px] text-stone-500">
              Remaining at Site = Issued Quantity − Returned Quantity − Lost Quantity
            </p>
          </div>
          {challan.notes && (
            <span className="text-xs text-stone-600 italic">Note: {challan.notes}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-[#e8decb]">
              <tr>
                <th className="px-4 py-2.5">Material</th>
                <th className="px-4 py-2.5">Item Code</th>
                <th className="px-4 py-2.5 text-right">Output (Issued)</th>
                <th className="px-4 py-2.5 text-right">Input (Returned)</th>
                <th className="px-4 py-2.5 text-right">Pending (Out − In)</th>
                <th className="px-4 py-2.5 text-right">Lost / Missing</th>
                <th className="px-4 py-2.5 text-right">Remaining at Site</th>
                <th className="px-4 py-2.5">Line Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8db] font-mono">
              {(challan.reconciliation || []).map(line => (
                <tr key={line.materialId} className="hover:bg-[#fcfbf9]">
                  <td className="px-4 py-3 font-sans font-semibold text-[#24160c]">{line.materialName}</td>
                  <td className="px-4 py-3 text-stone-500 text-[11px]">{line.itemCode}</td>
                  <td className="px-4 py-3 text-right font-bold">{line.issuedQuantity}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-bold">{line.returnedQuantity}</td>
                  <td className="px-4 py-3 text-right text-amber-800">{line.pendingQuantity}</td>
                  <td className="px-4 py-3 text-right text-rose-700 font-bold">{line.lostQuantity}</td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      line.remainingAtSite > 0 ? 'text-amber-800' : 'text-emerald-700'
                    }`}
                  >
                    {line.remainingAtSite}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    {line.remainingAtSite === 0 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        {line.lostQuantity > 0 ? 'Reconciled (With Loss)' : 'Fully Returned'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        Pending ({line.remainingAtSite} at site)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#f7f2eb] font-mono font-bold text-[#24160c] border-t border-[#d6c7b2]">
              <tr>
                <td colSpan={2} className="px-4 py-2.5 font-sans">Totals</td>
                <td className="px-4 py-2.5 text-right">{challan.totalOutputQuantity}</td>
                <td className="px-4 py-2.5 text-right text-emerald-800">{challan.totalReturnedQuantity}</td>
                <td className="px-4 py-2.5 text-right text-amber-900">{challan.pendingQuantity}</td>
                <td className="px-4 py-2.5 text-right text-rose-800">{challan.totalLostQuantity}</td>
                <td className="px-4 py-2.5 text-right">{challan.remainingAtSiteQuantity}</td>
                <td className="px-4 py-2.5 font-sans">
                  {challan.status === 'CLOSED' ? 'Closed' : 'Unclosed'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Output & Input Entries Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* All Output Material Entries */}
        <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0e8db] flex items-center gap-2 bg-[#fbf9f5]">
            <PackageOpen className="w-4 h-4 text-[#8f6541]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c]">
              Output Material Entries (Issued)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] font-bold uppercase text-stone-500 border-b border-[#e8decb]">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db]">
                {(challan.outputEntries || []).map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2.5 font-mono text-stone-700 whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#24160c]">{entry.materialName}</div>
                      {entry.remarks && <div className="text-[10px] text-stone-400">{entry.remarks}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#24160c]">
                      {entry.quantity} {entry.unit || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* All Input Material Entries */}
        <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0e8db] flex items-center justify-between bg-[#fbf9f5]">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c]">
                Input Material Entries (Returned)
              </h3>
            </div>
            {can('CHALLAN_RECORD_RETURN') && returnableLines.length > 0 && (
              <button
                type="button"
                onClick={openReturnModal}
                className="text-[11px] font-bold text-[#714f36] hover:underline cursor-pointer"
              >
                + Add Return
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            {(challan.inputEntries || []).length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">
                No material returns recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-bold uppercase text-stone-500 border-b border-[#e8decb]">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Material</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8db]">
                  {challan.inputEntries.map(entry => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2.5 font-mono text-stone-700 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#24160c]">{entry.materialName}</div>
                        {entry.remarks && <div className="text-[10px] text-stone-400">{entry.remarks}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-right text-emerald-700">
                        {entry.quantity} {entry.unit || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Lost / Missing Material Details & Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0e8db] flex items-center gap-2 bg-[#fbf9f5]">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c]">
              Lost / Missing Material Details
            </h3>
          </div>
          {(challan.lostEntries || []).length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              No lost or missing materials recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-bold uppercase text-stone-500 border-b border-[#e8decb]">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Material & Reason</th>
                    <th className="px-4 py-2 text-right">Lost Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8db]">
                  {challan.lostEntries.map(entry => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2.5 font-mono text-stone-700 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-rose-900">{entry.materialName}</div>
                        <div className="text-[10px] text-stone-500">{entry.reason || 'Missing on site'}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-right text-rose-700">
                        {entry.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0e8db] flex items-center gap-2 bg-[#fbf9f5]">
            <History className="w-4 h-4 text-[#8f6541]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#24160c]">
              Challan Transaction History
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto text-xs">
            {(challan.history || []).map(h => (
              <div key={h.id} className="border-l-2 border-[#8f6541]/40 pl-3 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#24160c]">{h.actionType.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-mono text-stone-400">{formatDateTime(h.timestamp)}</span>
                </div>
                <div className="text-stone-600">{h.description}</div>
                <div className="text-[10px] text-stone-400">By {h.actorName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADD RETURN ENTRY MODAL */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => !submittingReturn && setReturnModalOpen(false)} />
          <form
            onSubmit={handleSubmitReturn}
            className="relative z-10 w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#d6c7b2] overflow-hidden text-xs"
          >
            <div className="bg-[#24160c] px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Add Return Entry · {challan.challanNumber}</h3>
                <p className="text-[11px] text-[#c79e7c]">Returns increase warehouse usable stock atomically</p>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="p-1 text-stone-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {returnError && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-rose-800 font-semibold">
                  {returnError}
                </div>
              )}
              {returnRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-[#fbf9f5] p-2.5 rounded border border-[#e5dac8]">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-[#4d301c] mb-1">Date</label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        setReturnRows(prev => prev.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-[#d6c7b2] rounded font-mono"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block font-semibold text-[#4d301c] mb-1">Material</label>
                    <select
                      value={row.materialId}
                      onChange={(e) =>
                        setReturnRows(prev => prev.map((r, i) => (i === idx ? { ...r, materialId: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-[#d6c7b2] rounded font-medium"
                    >
                      {returnableLines.map(l => (
                        <option key={l.materialId} value={l.materialId}>
                          {l.materialName} (Rem: {l.remainingAtSite})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-[#4d301c] mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(e) =>
                        setReturnRows(prev => prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-[#d6c7b2] rounded font-mono font-bold"
                    />
                  </div>
                  <div className="sm:col-span-1 text-right">
                    <button
                      type="button"
                      disabled={returnRows.length <= 1}
                      onClick={() => setReturnRows(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-rose-700 hover:bg-rose-100 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setReturnRows(prev => [
                    ...prev,
                    {
                      date: getTodayDateString(),
                      materialId: returnableLines[0]?.materialId || '',
                      quantity: '1',
                      remarks: '',
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-[#714f36] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Return Row</span>
              </button>
            </div>

            <div className="px-5 py-3.5 border-t border-[#e5dac8] flex justify-end gap-2 bg-white">
              <button
                type="button"
                disabled={submittingReturn}
                onClick={() => setReturnModalOpen(false)}
                className="px-4 py-1.5 border border-[#d6c7b2] rounded-md font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReturn}
                className="px-4 py-1.5 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] rounded-md font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submittingReturn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submittingReturn ? 'Saving...' : 'Confirm Return'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD LOST / MISSING MODAL */}
      {lossModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => !submittingLoss && setLossModalOpen(false)} />
          <form
            onSubmit={handleSubmitLoss}
            className="relative z-10 w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#d6c7b2] overflow-hidden text-xs"
          >
            <div className="bg-rose-900 px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Missing / Lost Material · {challan.challanNumber}</h3>
                <p className="text-[11px] text-rose-200">Logged separately in loss ledger — NOT added back to warehouse stock</p>
              </div>
              <button
                type="button"
                onClick={() => setLossModalOpen(false)}
                className="p-1 text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {lossError && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-rose-800 font-semibold">
                  {lossError}
                </div>
              )}
              {lossRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-rose-50/60 p-2.5 rounded border border-rose-200">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-rose-950 mb-1">Date</label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        setLossRows(prev => prev.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded font-mono"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block font-semibold text-rose-950 mb-1">Material</label>
                    <select
                      value={row.materialId}
                      onChange={(e) =>
                        setLossRows(prev => prev.map((r, i) => (i === idx ? { ...r, materialId: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded font-medium"
                    >
                      {returnableLines.map(l => (
                        <option key={l.materialId} value={l.materialId}>
                          {l.materialName} (Rem: {l.remainingAtSite})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-rose-950 mb-1">Lost Qty</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(e) =>
                        setLossRows(prev => prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded font-mono font-bold text-rose-900"
                    />
                  </div>
                  <div className="sm:col-span-12">
                    <input
                      type="text"
                      value={row.reason}
                      onChange={(e) =>
                        setLossRows(prev => prev.map((r, i) => (i === idx ? { ...r, reason: e.target.value } : r)))
                      }
                      placeholder="Reason / discrepancy note"
                      className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded"
                    />
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 font-semibold text-rose-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveLossOnSubmit}
                  onChange={(e) => setApproveLossOnSubmit(e.target.checked)}
                  className="w-4 h-4 accent-rose-700"
                />
                <span>Approve loss reconciliation immediately</span>
              </label>
            </div>

            <div className="px-5 py-3.5 border-t border-[#e5dac8] flex justify-end gap-2 bg-white">
              <button
                type="button"
                disabled={submittingLoss}
                onClick={() => setLossModalOpen(false)}
                className="px-4 py-1.5 border border-[#d6c7b2] rounded-md font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingLoss}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
              >
                {submittingLoss ? 'Saving...' : 'Record Lost Material'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CLOSE CHALLAN MODAL */}
      {closeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => !closing && setCloseConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[#24160c]">Close Challan {challan.challanNumber}?</h3>
            <p className="text-stone-600">
              All material quantities have 0 remaining at site. Closing marks this challan as <strong>Closed</strong>.
            </p>
            {challan.hasLostMaterials && (
              <label className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded font-semibold text-rose-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveLossOnClose}
                  onChange={(e) => setApproveLossOnClose(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-rose-700"
                />
                <span>
                  I approve the recorded lost/missing material ({challan.totalLostQuantity} unit(s)) and authorize closing this challan.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#f0e8db]">
              <button
                type="button"
                disabled={closing}
                onClick={() => setCloseConfirmOpen(false)}
                className="px-3.5 py-1.5 border border-[#d6c7b2] rounded-md font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closing || (challan.hasLostMaterials && !approveLossOnClose) || !canCloseChallan}
                onClick={handleCloseChallan}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
              >
                {closing ? 'Closing...' : 'Confirm Close Challan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CHALLAN MODAL */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[#24160c]">Delete Challan {challan.challanNumber}?</h3>
            <p className="text-stone-600">
              This will permanently delete the challan and restore any unreturned material allocations back into warehouse stock.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#f0e8db]">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 border border-[#d6c7b2] rounded-md font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteChallan}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

