'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Camera, 
  UploadCloud, 
  Trash2, 
  Building2, 
  Calendar,
  UserCheck,
  Shield,
  Ruler,
  Users,
  Plus,
  X,
  Scale
} from 'lucide-react';
import { Project } from '@/lib/schema';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

interface WorkerEntry {
  id: string;
  name: string;
  role: string;
}

const COMMON_ROLES = [
  'Lead Rigger / Fitter',
  'Scaffolder',
  'Helper / Labour',
  'Safety Marshal / Signalman',
  'Crane / Winch Operator',
];

export default function ProjectInstallationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser, availableUsers } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Installation Date & Time
  const [actualInstallationDate, setActualInstallationDate] = useState('');

  // Supervisor in Charge state
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [selectedSupervisorName, setSelectedSupervisorName] = useState('');
  const [supervisorDelegationRemarks, setSupervisorDelegationRemarks] = useState('');
  const [supervisorDelegationConfirmed, setSupervisorDelegationConfirmed] = useState(false);

  // Workers on Site
  const [workersList, setWorkersList] = useState<WorkerEntry[]>([]);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState(COMMON_ROLES[1]); // Default: Scaffolder

  // Scaffolding Dimensions & Actual Size Verification
  const [plannedLength, setPlannedLength] = useState<number>(0);
  const [plannedWidth, setPlannedWidth] = useState<number>(0);
  const [plannedHeight, setPlannedHeight] = useState<number>(0);
  const [dimUnit, setDimUnit] = useState<'METERS' | 'FEET'>('METERS');
  const [structureType, setStructureType] = useState<string>('FAÇADE_SCAFFOLD');

  const [actualLength, setActualLength] = useState<number>(0);
  const [actualWidth, setActualWidth] = useState<number>(0);
  const [actualHeight, setActualHeight] = useState<number>(0);
  const [sizeVarianceReason, setSizeVarianceReason] = useState('');
  const [sizeVarianceConfirmed, setSizeVarianceConfirmed] = useState(false);

  // Client Sign-off & Remarks
  const [clientRepresentativeName, setClientRepresentativeName] = useState('');
  const [clientSignOff, setClientSignOff] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Material actual installation table & verification
  const [materialUsage, setMaterialUsage] = useState<
    { materialId: string; materialName: string; itemCode: string; reserved: number; installedQuantity: number; unusedReturnedQty: number }[]
  >([]);
  const [materialVarianceReason, setMaterialVarianceReason] = useState('');
  const [materialVarianceConfirmed, setMaterialVarianceConfirmed] = useState(false);

  // After Photos
  const [afterPhotoUrls, setAfterPhotoUrls] = useState<string[]>([]);
  const [customPhotoInput, setCustomPhotoInput] = useState('');

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const p: Project = json.data;
          setProject(p);

          // Initialize supervisor
          const initialSupId = p.assignedSupervisorId || currentUser.id;
          setSelectedSupervisorId(initialSupId);
          setSelectedSupervisorName(p.supervisorName || currentUser.fullName);

          // Initialize dimensions from project measurements if available
          const meas = p.measurements;
          const pLen = meas?.length || 0;
          const pWid = meas?.width || 0;
          const pHgt = meas?.height || 0;
          const unit = meas?.unit || 'METERS';
          const type = meas?.measurementType || 'FAÇADE_SCAFFOLD';

          setPlannedLength(pLen);
          setPlannedWidth(pWid);
          setPlannedHeight(pHgt);
          setDimUnit(unit);
          setStructureType(type);

          // Auto-prefill actual dimensions with planned dimensions as initial baseline
          setActualLength(pLen);
          setActualWidth(pWid);
          setActualHeight(pHgt);

          if (p.materials && p.materials.length > 0) {
            setMaterialUsage(
              p.materials.map(m => ({
                materialId: m.materialId,
                materialName: m.materialName,
                itemCode: m.itemCode,
                reserved: m.reservedQuantity || m.requiredQuantity,
                installedQuantity: m.reservedQuantity || m.requiredQuantity,
                unusedReturnedQty: 0,
              }))
            );
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id, currentUser]);

  // Supervisor matching check
  const assignedSupName = project?.supervisorName?.trim().toLowerCase() || '';
  const executingSupName = selectedSupervisorName.trim().toLowerCase();
  const isSupervisorSame = 
    Boolean(project?.assignedSupervisorId && selectedSupervisorId && project.assignedSupervisorId === selectedSupervisorId) ||
    Boolean(assignedSupName && executingSupName && assignedSupName === executingSupName);

  // Dimension comparison calculations
  const plannedArea = plannedLength * plannedHeight;
  const actualArea = actualLength * actualHeight;
  const lengthDiff = Math.abs(actualLength - plannedLength);
  const widthDiff = Math.abs(actualWidth - plannedWidth);
  const heightDiff = Math.abs(actualHeight - plannedHeight);
  
  // Exact match tolerance (within 0.05m or 5cm)
  const isExactSizeMatch = lengthDiff < 0.05 && widthDiff < 0.05 && heightDiff < 0.05;
  const variancePercentage = plannedArea > 0 ? ((actualArea - plannedArea) / plannedArea) * 100 : 0;

  const handleSupervisorChange = (userId: string) => {
    setSelectedSupervisorId(userId);
    const foundUser = availableUsers.find(u => u.id === userId);
    if (foundUser) {
      setSelectedSupervisorName(foundUser.fullName);
    }
  };

  const handleAddWorker = () => {
    if (!newWorkerName.trim()) return;
    const newEntry: WorkerEntry = {
      id: `wrk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newWorkerName.trim(),
      role: newWorkerRole,
    };
    setWorkersList([...workersList, newEntry]);
    setNewWorkerName('');
  };

  const handleRemoveWorker = (workerId: string) => {
    setWorkersList(workersList.filter(w => w.id !== workerId));
  };

  const handleMaterialChange = (idx: number, field: 'installedQuantity' | 'unusedReturnedQty', val: number) => {
    const updated = [...materialUsage];
    updated[idx][field] = val;
    setMaterialUsage(updated);
  };

  const handleSetAllInstalled = () => {
    setMaterialUsage(materialUsage.map(m => ({
      ...m,
      installedQuantity: m.reserved,
      unusedReturnedQty: 0,
    })));
  };

  const handleAutoBalanceUnused = () => {
    setMaterialUsage(materialUsage.map(m => ({
      ...m,
      unusedReturnedQty: Math.max(0, m.reserved - m.installedQuantity),
    })));
  };

  const handleAddPhoto = () => {
    if (!customPhotoInput.trim()) return;
    setAfterPhotoUrls([...afterPhotoUrls, customPhotoInput.trim()]);
    setCustomPhotoInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate Supervisor Mismatch Acknowledgment
    if (!isSupervisorSame && !supervisorDelegationConfirmed) {
      setError(
        `Supervisor in charge differs from assigned site supervisor (${project?.supervisorName || 'Assigned'}). Please confirm delegation authorization before proceeding.`
      );
      return;
    }

    // Validate Actual Size Variance Acknowledgment
    if (!isExactSizeMatch && !sizeVarianceConfirmed) {
      setError(
        `Actual installed size differs from the planned site inspection dimensions (${variancePercentage > 0 ? '+' : ''}${variancePercentage.toFixed(1)}% variance). Please provide the justification reason and confirm the variance checkbox.`
      );
      return;
    }

    // Validate Material Discrepancy Acknowledgment
    const hasDiscrepancy = materialUsage.some(m => 
      (Number(m.installedQuantity || 0) + Number(m.unusedReturnedQty || 0)) !== Number(m.reserved || 0)
    );
    if (hasDiscrepancy && !materialVarianceConfirmed) {
      setError(
        'Material quantity discrepancy detected (some items are less or more than reserved). Please provide an explanation in the variance note and check the confirmation box.'
      );
      return;
    }

    if (workersList.length === 0) {
      setError('Please add at least one worker or rigger who worked on erecting this project.');
      return;
    }

    // Compile worker names string for backward compatibility
    const teamSummary = workersList.map(w => `${w.name} (${w.role})`).join(', ');

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualInstallationDate,
          supervisorId: selectedSupervisorId || currentUser.id,
          executingSupervisorName: selectedSupervisorName || currentUser.fullName,
          isSameSupervisor: isSupervisorSame,
          supervisorDelegationRemarks: !isSupervisorSame ? supervisorDelegationRemarks : undefined,
          teamMembers: teamSummary,
          workersList: workersList.map(w => ({ id: w.id, name: w.name, role: w.role })),
          actualMeasurements: {
            length: actualLength,
            width: actualWidth,
            height: actualHeight,
            unit: dimUnit,
            isCorrect: isExactSizeMatch,
            variancePercentage: Math.round(variancePercentage * 10) / 10,
            remarks: !isExactSizeMatch ? sizeVarianceReason : 'Dimensions match planned inspection',
          },
          safetyChecklistCompleted: true,
          clientRepresentativeName,
          clientSignOff,
          remarks: [
            remarks,
            !isSupervisorSame ? `[Supervisor Note]: Delegated to ${selectedSupervisorName}. Reason: ${supervisorDelegationRemarks || 'Authorized on site'}` : '',
            !isExactSizeMatch ? `[Dimension Note]: Installed ${actualLength}m x ${actualWidth}m x ${actualHeight}m (${variancePercentage > 0 ? '+' : ''}${variancePercentage.toFixed(1)}%). Reason: ${sizeVarianceReason}` : '',
            hasDiscrepancy ? `[Material Variance Note]: ${materialVarianceReason || 'Material variance verified on site'}` : '',
          ].filter(Boolean).join('\n'),
          afterPhotoUrls,
          materialsUsed: materialUsage.map(m => ({
            materialId: m.materialId,
            installedQuantity: Number(m.installedQuantity),
            unusedReturnedQty: Number(m.unusedReturnedQty),
          })),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit installation');
      }

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading installation workspace...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/projects/${id}`} className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Workspace</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Installation & Rental Activation</span>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Installation Report & Rental Commissioning</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verify supervisor in charge, register site workers, validate actual installed dimensions, and activate the rental cycle.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">Project Code</div>
          <div className="font-mono font-bold text-slate-900">{project.projectCode}</div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Installation Submission Incomplete</div>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ======================================================== */}
        {/* 1. TIMESTAMPS & SUPERVISOR IN CHARGE VERIFICATION        */}
        {/* ======================================================== */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>1. Installation Timestamps & Supervisor in Charge Check</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Actual Installation Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={actualInstallationDate}
                onChange={(e) => setActualInstallationDate(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-1">Rental billing start date will commence from this date.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assigned Site Supervisor (From Project Record)
              </label>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 flex items-center justify-between">
                <span className="font-semibold">{project.supervisorName || 'Not Assigned'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                  Site Assigned
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Supervisor in Charge (Executing Installation) <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSupervisorId}
                onChange={(e) => handleSupervisorChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
              >
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} — {u.role.replace('_', ' ')} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {/* LIVE SUPERVISOR MATCH CHECK RESULT */}
            <div className="sm:col-span-2">
              {isSupervisorSame ? (
                <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-800">Supervisor Verified (Same Supervisor): </span>
                    <span>The Supervisor in Charge matches the assigned site supervisor ({project.supervisorName || selectedSupervisorName}).</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Supervisor in Charge Mismatch Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    The assigned Project Supervisor is <strong>{project.supervisorName || 'Unassigned'}</strong>, but <strong>{selectedSupervisorName}</strong> is conducting and reporting this installation.
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Reason for Supervisor Delegation / Handover <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={supervisorDelegationRemarks}
                      onChange={(e) => setSupervisorDelegationRemarks(e.target.value)}
                      placeholder="e.g. Assigned supervisor attending BKC structural audit; substitute authorized by PM"
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supervisorDelegationConfirmed}
                      onChange={(e) => setSupervisorDelegationConfirmed(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="font-semibold text-amber-950">
                      Confirm supervisor delegation / substitute authorized on site
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. WORKERS WORKING ON THE PROJECT                        */}
        {/* ======================================================== */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>2. Workers & Erection Crew on Site</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {workersList.length} Worker{workersList.length === 1 ? '' : 's'} Registered
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Specify the names of riggers, fitters, and helpers actively working on the installation of this project.
          </p>

          {/* Add Worker Row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Worker Full Name (e.g. Ramesh Kumar, Suresh Yadav)..."
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddWorker();
                  }
                }}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="w-full sm:w-56">
              <select
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                {COMMON_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddWorker}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Worker</span>
            </button>
          </div>

          {/* Added Workers List */}
          {workersList.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {workersList.map((worker, index) => (
                <div key={worker.id} className="p-3 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">{worker.name}</span>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                        {worker.role}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveWorker(worker.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                    title="Remove worker"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              No workers added yet. Type worker names above to add them to this project's erection crew.
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. SCAFFOLDING DIMENSIONS & ACTUAL SIZE VERIFICATION     */}
        {/* ======================================================== */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span>3. Scaffolding Dimensions & Actual Size Verification</span>
            </h2>
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {structureType.replace('_', ' ')}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Compare the physical erected scaffolding dimensions on site against the approved site inspection measurements.
          </p>

          {/* Planned vs Actual Dimension Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Planned Dimensions (Read-only reference) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-slate-500" />
                <span>Planned Inspection Dimensions</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-sans">Length</div>
                  <div className="font-bold text-slate-800 text-sm">{plannedLength} {dimUnit === 'METERS' ? 'm' : 'ft'}</div>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-sans">Width</div>
                  <div className="font-bold text-slate-800 text-sm">{plannedWidth} {dimUnit === 'METERS' ? 'm' : 'ft'}</div>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-sans">Height</div>
                  <div className="font-bold text-slate-800 text-sm">{plannedHeight} {dimUnit === 'METERS' ? 'm' : 'ft'}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200">
                <span>Planned Surface Area ($L \times H$):</span>
                <span className="font-mono font-bold text-slate-700">{plannedArea.toFixed(1)} {dimUnit === 'METERS' ? 'sq.m' : 'sq.ft'}</span>
              </div>
            </div>

            {/* Actual Installed Dimensions Inputs */}
            <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3 text-xs">
              <div className="font-bold text-emerald-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                <span>Actual Installed Dimensions On Site *</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Actual Length</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={actualLength}
                    onChange={(e) => setActualLength(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-emerald-300 rounded font-mono font-bold text-slate-900 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Actual Width</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={actualWidth}
                    onChange={(e) => setActualWidth(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-emerald-300 rounded font-mono font-bold text-slate-900 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Actual Height</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={actualHeight}
                    onChange={(e) => setActualHeight(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-emerald-300 rounded font-mono font-bold text-slate-900 text-center"
                    required
                  />
                </div>
              </div>
              <div className="text-[11px] text-emerald-800 flex justify-between pt-1 border-t border-emerald-200">
                <span>Actual Surface Area ($L \times H$):</span>
                <span className="font-mono font-bold text-emerald-900">{actualArea.toFixed(1)} {dimUnit === 'METERS' ? 'sq.m' : 'sq.ft'}</span>
              </div>
            </div>
          </div>

          {/* LIVE SIZE VERIFICATION RESULT */}
          <div>
            {isExactSizeMatch ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-800">Actual Size Verified: Dimensions Correct (100% Match)</div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Physical erected structure ({actualLength}m length × {actualWidth}m width × {actualHeight}m height = {actualArea.toFixed(1)} sq.m) matches the approved site inspection dimensions precisely.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Actual Size Variance Detected</span>
                </div>
                <div className="text-[11px] text-amber-800 space-y-1">
                  <div>
                    Planned: <strong>{plannedLength}m × {plannedWidth}m × {plannedHeight}m</strong> ({plannedArea.toFixed(1)} sq.m)
                  </div>
                  <div>
                    Actual Installed: <strong>{actualLength}m × {actualWidth}m × {actualHeight}m</strong> ({actualArea.toFixed(1)} sq.m)
                  </div>
                  <div>
                    Variance: <strong className={variancePercentage > 0 ? "text-blue-800 font-bold" : "text-amber-800 font-bold"}>
                      {variancePercentage > 0 ? `+${variancePercentage.toFixed(1)}% (Area Enlarged)` : `${variancePercentage.toFixed(1)}% (Area Reduced)`}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Reason for Size Difference on Site <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sizeVarianceReason}
                    onChange={(e) => setSizeVarianceReason(e.target.value)}
                    placeholder="e.g. Parapet height increased by 2m as requested by client engineer"
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sizeVarianceConfirmed}
                    onChange={(e) => setSizeVarianceConfirmed(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="font-semibold text-amber-950">
                    Confirm actual installed dimensions inspected and approved on site
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. ACTUAL MATERIALS ISSUED & INSTALLED (ACCURACY CHECK)  */}
        {/* ======================================================== */}
        {(() => {
          const totalReserved = materialUsage.reduce((acc, m) => acc + Number(m.reserved || 0), 0);
          const totalInstalled = materialUsage.reduce((acc, m) => acc + Number(m.installedQuantity || 0), 0);
          const totalUnused = materialUsage.reduce((acc, m) => acc + Number(m.unusedReturnedQty || 0), 0);
          const totalAccounted = totalInstalled + totalUnused;

          const lessMaterialsCount = materialUsage.filter(m => (Number(m.installedQuantity || 0) + Number(m.unusedReturnedQty || 0)) < Number(m.reserved || 0)).length;
          const moreMaterialsCount = materialUsage.filter(m => (Number(m.installedQuantity || 0) + Number(m.unusedReturnedQty || 0)) > Number(m.reserved || 0)).length;
          const hasMaterialDiscrepancy = lessMaterialsCount > 0 || moreMaterialsCount > 0;

          return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>4. Actual Materials Issued & Installed (Accuracy & Variance Check)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Verify whether the issued material is accurate or if there is any shortage (less) or surplus (more).
                  </p>
                </div>

                {/* Quick 1-Click Balance Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSetAllInstalled}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
                    title="Set actual installed quantity equal to reserved quantity for all items"
                  >
                    Set 100% Installed
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoBalanceUnused}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition"
                    title="Automatically fill unused returned quantity to balance reserved"
                  >
                    Auto-Balance Unused
                  </button>
                </div>
              </div>

              {/* Material Accuracy Summary KPI Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Reserved</div>
                  <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">{totalReserved} <span className="text-[10px] text-slate-400 font-normal">Nos</span></div>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Actual Installed</div>
                  <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">{totalInstalled} <span className="text-[10px] text-emerald-700 font-normal">Nos</span></div>
                </div>

                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">Unused Returning</div>
                  <div className="text-lg font-bold font-mono text-blue-900 mt-0.5">{totalUnused} <span className="text-[10px] text-blue-700 font-normal">Nos</span></div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  !hasMaterialDiscrepancy 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider">
                    {!hasMaterialDiscrepancy ? 'Stock Accuracy' : 'Discrepancy'}
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5 flex items-center justify-center gap-1">
                    {!hasMaterialDiscrepancy ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        <span>100% Accurate</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 inline" />
                        <span>
                          {lessMaterialsCount > 0 ? `${lessMaterialsCount} Less` : ''}
                          {lessMaterialsCount > 0 && moreMaterialsCount > 0 ? ', ' : ''}
                          {moreMaterialsCount > 0 ? `${moreMaterialsCount} More` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Material Accuracy & Quantity Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Material Description</th>
                      <th className="px-3 py-2.5">SKU Code</th>
                      <th className="px-3 py-2.5 text-center">Reserved Qty</th>
                      <th className="px-3 py-2.5 text-center font-bold text-emerald-800">Actual Installed Qty *</th>
                      <th className="px-3 py-2.5 text-center font-bold text-blue-800">Unused Returned Qty</th>
                      <th className="px-3 py-2.5 text-center font-bold text-slate-700">Accounted Total</th>
                      <th className="px-3 py-2.5 text-center font-bold">Accuracy / Variance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {materialUsage.map((row, idx) => {
                      const reserved = Number(row.reserved || 0);
                      const installed = Number(row.installedQuantity || 0);
                      const unused = Number(row.unusedReturnedQty || 0);
                      const accounted = installed + unused;
                      const diff = accounted - reserved;

                      const isExact = diff === 0;
                      const isLess = diff < 0;
                      const isMore = diff > 0;

                      return (
                        <tr key={idx} className={`transition ${
                          isLess ? 'bg-red-50/30 hover:bg-red-50/50' : 
                          isMore ? 'bg-blue-50/30 hover:bg-blue-50/50' : 
                          'hover:bg-slate-50'
                        }`}>
                          <td className="px-3 py-2.5 font-sans font-medium text-slate-900">{row.materialName}</td>
                          <td className="px-3 py-2.5 text-slate-500 text-[11px]">{row.itemCode}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 font-bold">{reserved}</td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.installedQuantity}
                              onChange={(e) => handleMaterialChange(idx, 'installedQuantity', Number(e.target.value))}
                              className="w-20 p-1.5 border border-emerald-300 rounded font-mono font-bold text-emerald-800 text-center bg-emerald-50/50"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.unusedReturnedQty}
                              onChange={(e) => handleMaterialChange(idx, 'unusedReturnedQty', Number(e.target.value))}
                              className="w-20 p-1.5 border border-blue-300 rounded font-mono font-bold text-blue-800 text-center bg-blue-50/50"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                            {accounted}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {isExact && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Accurate (Exact)</span>
                              </span>
                            )}
                            {isLess && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                <span>Less (-{Math.abs(diff)} Short)</span>
                              </span>
                            )}
                            {isMore && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                                <Plus className="w-3 h-3 text-blue-600" />
                                <span>More (+{diff} Extra)</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* DISCREPANCY WARNING & EXPLANATION NOTE */}
              {hasMaterialDiscrepancy && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Material Quantity Discrepancy Detected (Less / More than Reserved)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Some items do not match the reserved quantities ({lessMaterialsCount > 0 ? `${lessMaterialsCount} item(s) are LESS than reserved` : ''}{lessMaterialsCount > 0 && moreMaterialsCount > 0 ? '; ' : ''}{moreMaterialsCount > 0 ? `${moreMaterialsCount} item(s) are MORE than reserved` : ''}).
                    Please verify if materials were damaged in transit, left on the truck, or extra pieces were utilized from site storage.
                  </p>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Reason for Material Shortage / Surplus on Site <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={materialVarianceReason}
                      onChange={(e) => setMaterialVarianceReason(e.target.value)}
                      placeholder="e.g. 2 vertical standards damaged in transit, returning to yard under inspection; 5 extra ledgers added for extra bracing"
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={materialVarianceConfirmed}
                      onChange={(e) => setMaterialVarianceConfirmed(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="font-semibold text-amber-950">
                      Confirm material variance and physical counts inspected on site
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* 5. AFTER-INSTALLATION PHOTOGRAPHS & CLIENT CLEARANCE     */}
        {/* ======================================================== */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>5. After-Installation Completed Photographs & Sign-off</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {afterPhotoUrls.map((url, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video group bg-slate-900">
                <img src={url} alt={`Installed ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setAfterPhotoUrls(afterPhotoUrls.filter((_, i) => i !== idx))}
                    className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 aspect-video bg-slate-50">
              <UploadCloud className="w-6 h-6 text-slate-400" />
              <input
                type="text"
                placeholder="Paste after-work image URL..."
                value={customPhotoInput}
                onChange={(e) => setCustomPhotoInput(e.target.value)}
                className="w-full text-[11px] p-1.5 border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition"
              >
                Add Photograph
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Client Site Representative Name</label>
              <input
                type="text"
                placeholder="e.g. Mahesh Jadhav (Site Engineer)"
                value={clientRepresentativeName}
                onChange={(e) => setClientRepresentativeName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="signoff"
                checked={clientSignOff}
                onChange={(e) => setClientSignOff(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="signoff" className="font-semibold text-slate-800">
                Client representative verbal / signed clearance received
              </label>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href={`/projects/${id}`}
            className="px-5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Commissioning...' : 'Submit Installation & Activate 1-Month Rental'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
