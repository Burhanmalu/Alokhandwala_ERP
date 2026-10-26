'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Filter, 
  FileSpreadsheet, 
  Layers, 
  Calendar, 
  Building2, 
  Boxes,
  ReceiptIndianRupee
} from 'lucide-react';
import { formatINR, formatQuantity, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function ReportsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [selectedReport, setSelectedReport] = useState<'PROJECT_STATUS' | 'ACTIVE_RENTALS' | 'INVENTORY_VALUATION' | 'OUTSTANDING_RECEIVABLES' | 'REMOVAL_DEADLINES'>('PROJECT_STATUS');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/billing/invoices').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([projJson, invJson, invcJson, custJson]) => {
      setData({
        projects: projJson.data || [],
        materials: invJson.data?.materials || [],
        invoices: invcJson.data || [],
        customers: custJson.data || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  const exportCurrentReportCSV = () => {
    if (!data) return;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `alokhandwala_report_${selectedReport.toLowerCase()}.csv`;

    if (selectedReport === 'PROJECT_STATUS') {
      headers = ['Project Code', 'Customer', 'Site', 'Status', 'Supervisor', 'Monthly Rental (INR)'];
      rows = data.projects.map((p: any) => [
        p.projectCode,
        `"${p.customerName}"`,
        `"${p.siteName}"`,
        p.status,
        `"${p.supervisorName}"`,
        p.monthlyRentalRate,
      ]);
    } else if (selectedReport === 'ACTIVE_RENTALS') {
      headers = ['Project Code', 'Customer', 'Rental Start', 'Rental End', 'Monthly Rate (INR)', 'Days Left'];
      rows = data.projects
        .filter((p: any) => ['ACTIVE_RENTAL', 'INSTALLED', 'EXTENDED'].includes(p.status))
        .map((p: any) => [
          p.projectCode,
          `"${p.customerName}"`,
          p.rentalStartDate || '',
          p.rentalEndDate || '',
          p.monthlyRentalRate,
          p.rentalEndDate ? Math.ceil((new Date(p.rentalEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : '-',
        ]);
    } else if (selectedReport === 'INVENTORY_VALUATION') {
      headers = ['SKU', 'Material Name', 'Category', 'Owned Qty', 'Warehouse Usable', 'On Sites', 'Purchase Unit Cost', 'Total Asset Valuation (INR)'];
      rows = data.materials.map((m: any) => [
        m.itemCode,
        `"${m.name}"`,
        `"${m.categoryName}"`,
        m.totalOwnedQty,
        m.usableWarehouseQty,
        m.siteAllocatedQty,
        m.purchaseCost,
        m.totalOwnedQty * m.purchaseCost,
      ]);
    } else if (selectedReport === 'OUTSTANDING_RECEIVABLES') {
      headers = ['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Total Amount (INR)', 'Paid (INR)', 'Outstanding (INR)', 'Status'];
      rows = data.invoices.map((i: any) => [
        i.invoiceNumber,
        `"${i.customerName}"`,
        i.invoiceDate,
        i.dueDate,
        i.totalAmount,
        i.paidAmount,
        i.outstandingAmount,
        i.status,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-500">Generating report tables...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Operational & Financial Reports Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade reporting across assets, active rentals, buffer deadlines, inventory valuation, and receivables.
          </p>
        </div>

        <button
          onClick={exportCurrentReportCSV}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition w-full sm:w-auto min-h-[42px] shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Report to CSV</span>
        </button>
      </div>

      {/* Report Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-medium">
        <button
          onClick={() => setSelectedReport('PROJECT_STATUS')}
          className={`p-3 rounded-xl border text-left transition min-h-[48px] flex items-center ${
            selectedReport === 'PROJECT_STATUS'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-600 ring-1 ring-emerald-600 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Project Status Master
        </button>
        <button
          onClick={() => setSelectedReport('ACTIVE_RENTALS')}
          className={`p-3 rounded-xl border text-left transition min-h-[48px] flex items-center ${
            selectedReport === 'ACTIVE_RENTALS'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-600 ring-1 ring-emerald-600 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Active Rentals & Deadlines
        </button>
        <button
          onClick={() => setSelectedReport('INVENTORY_VALUATION')}
          className={`p-3 rounded-xl border text-left transition min-h-[48px] flex items-center ${
            selectedReport === 'INVENTORY_VALUATION'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-600 ring-1 ring-emerald-600 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Inventory Asset Valuation
        </button>
        <button
          onClick={() => setSelectedReport('OUTSTANDING_RECEIVABLES')}
          className={`p-3 rounded-xl border text-left transition min-h-[48px] flex items-center ${
            selectedReport === 'OUTSTANDING_RECEIVABLES'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-600 ring-1 ring-emerald-600 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Outstanding Receivables
        </button>
      </div>

      {/* Report Display */}
      {selectedReport === 'INVENTORY_VALUATION' ? (
        <>
          {/* Mobile Inventory Valuation Cards */}
          <div className="block md:hidden space-y-3">
            {data.materials.map((m: any) => (
              <div key={m.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{m.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">{m.itemCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-medium">Valuation</div>
                    <div className="font-mono font-bold text-emerald-800 text-sm">{formatINR(m.totalOwnedQty * m.purchaseCost)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-center font-mono text-[11px] border border-slate-100">
                  <div>
                    <div className="text-[9px] text-slate-400 font-sans">Owned</div>
                    <div className="font-bold text-slate-800">{m.totalOwnedQty}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 font-sans">Warehouse</div>
                    <div className="text-slate-600">{m.usableWarehouseQty}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-emerald-600 font-sans">On Sites</div>
                    <div className="font-bold text-emerald-700">{m.siteAllocatedQty}</div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Unit Purchase Cost:</span>
                  <span className="font-mono font-medium text-slate-700">{formatINR(m.purchaseCost)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Inventory Valuation Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">SKU Code</th>
                    <th className="px-4 py-3">Material Name</th>
                    <th className="px-4 py-3 text-center">Owned Qty</th>
                    <th className="px-4 py-3 text-center">Warehouse</th>
                    <th className="px-4 py-3 text-center">On Sites</th>
                    <th className="px-4 py-3 text-right">Unit Purchase Cost</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-900">Total Asset Value (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data.materials.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{m.itemCode}</td>
                      <td className="px-4 py-3 font-sans font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-3 text-center font-bold">{m.totalOwnedQty}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{m.usableWarehouseQty}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-bold">{m.siteAllocatedQty}</td>
                      <td className="px-4 py-3 text-right">{formatINR(m.purchaseCost)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-800">{formatINR(m.totalOwnedQty * m.purchaseCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : selectedReport === 'OUTSTANDING_RECEIVABLES' ? (
        <>
          {/* Mobile Outstanding Receivables Cards */}
          <div className="block md:hidden space-y-3">
            {data.invoices.map((inv: any) => (
              <div key={inv.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 font-mono">{inv.invoiceNumber}</div>
                    <div className="text-slate-700 font-medium">{inv.customerName}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {inv.status}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-rose-50/50 rounded-lg border border-rose-200/60 font-mono">
                  <span className="text-[11px] text-rose-700 font-sans font-medium">Outstanding Balance:</span>
                  <span className="font-bold text-rose-800 text-sm">{formatINR(inv.outstandingAmount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-mono pt-1">
                  <div>Invoiced: <span className="font-bold text-slate-800">{formatINR(inv.totalAmount)}</span></div>
                  <div>Paid: <span className="font-bold text-emerald-700">{formatINR(inv.paidAmount)}</span></div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                  <span>Dated: {formatDate(inv.invoiceDate)}</span>
                  <span>Due: {formatDate(inv.dueDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Outstanding Receivables Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Total Invoiced</th>
                    <th className="px-4 py-3 text-right">Paid Amount</th>
                    <th className="px-4 py-3 text-right font-bold text-rose-700">Outstanding Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-800">{inv.customerName}</td>
                      <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatINR(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                      <td className="px-4 py-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile Project Status Cards */}
          <div className="block md:hidden space-y-3">
            {data.projects.map((p: any) => (
              <div key={p.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 font-mono">{p.projectCode}</div>
                    <div className="font-semibold text-slate-800">{p.customerName}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700">
                    {p.status}
                  </span>
                </div>

                <div className="text-slate-600 text-[11px]">
                  Site: <span className="font-medium text-slate-800">{p.siteName}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-[11px]">Supervisor: {p.supervisorName}</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {p.monthlyRentalRate > 0 ? `${formatINR(p.monthlyRentalRate)}/mo` : 'No Rental'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Project Status Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Project Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Site Location</th>
                    <th className="px-4 py-3">Supervisor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right font-bold">Monthly Rental</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.projects.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.projectCode}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.customerName}</td>
                      <td className="px-4 py-3 text-slate-600">{p.siteName}</td>
                      <td className="px-4 py-3 text-slate-600">{p.supervisorName}</td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold text-slate-700">{p.status}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                        {p.monthlyRentalRate > 0 ? formatINR(p.monthlyRentalRate) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
