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
    return <div className="p-8 text-center text-xs text-stone-500">Generating report tables...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">Business Intelligence</span>
            <span className="text-stone-500">|</span>
            <span className="text-xs text-stone-300">Audits & Analytics</span>
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#c79e7c]" />
            <span>Operational & Financial Reports Hub</span>
          </h1>
          <p className="text-xs text-stone-300 mt-1">
            Audit-grade reporting across physical assets, active rentals, inventory valuation, and client receivables.
          </p>
        </div>

        <button
          onClick={exportCurrentReportCSV}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-200 bg-[#382315] hover:bg-[#4a301e] border border-[#523622] rounded-md transition shadow-xs w-full sm:w-auto shrink-0"
        >
          <Download className="w-4 h-4 text-[#c79e7c]" />
          <span>Export Report to CSV</span>
        </button>
      </div>

      {/* Report Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-medium">
        <button
          onClick={() => setSelectedReport('PROJECT_STATUS')}
          className={`p-3 rounded-lg border text-left transition flex items-center ${
            selectedReport === 'PROJECT_STATUS'
              ? 'bg-[#24160c] text-[#c79e7c] border-[#19100a] font-bold shadow-xs'
              : 'bg-white text-stone-700 border-[#e8decb] hover:bg-[#fbf9f5]'
          }`}
        >
          Project Status Master
        </button>
        <button
          onClick={() => setSelectedReport('ACTIVE_RENTALS')}
          className={`p-3 rounded-lg border text-left transition flex items-center ${
            selectedReport === 'ACTIVE_RENTALS'
              ? 'bg-[#24160c] text-[#c79e7c] border-[#19100a] font-bold shadow-xs'
              : 'bg-white text-stone-700 border-[#e8decb] hover:bg-[#fbf9f5]'
          }`}
        >
          Active Rentals & Deadlines
        </button>
        <button
          onClick={() => setSelectedReport('INVENTORY_VALUATION')}
          className={`p-3 rounded-lg border text-left transition flex items-center ${
            selectedReport === 'INVENTORY_VALUATION'
              ? 'bg-[#24160c] text-[#c79e7c] border-[#19100a] font-bold shadow-xs'
              : 'bg-white text-stone-700 border-[#e8decb] hover:bg-[#fbf9f5]'
          }`}
        >
          Inventory Asset Valuation
        </button>
        <button
          onClick={() => setSelectedReport('OUTSTANDING_RECEIVABLES')}
          className={`p-3 rounded-lg border text-left transition flex items-center ${
            selectedReport === 'OUTSTANDING_RECEIVABLES'
              ? 'bg-[#24160c] text-[#c79e7c] border-[#19100a] font-bold shadow-xs'
              : 'bg-white text-stone-700 border-[#e8decb] hover:bg-[#fbf9f5]'
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
              <div key={m.id} className="p-4 bg-white rounded-lg border border-[#e8decb] shadow-2xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-stone-900">{m.name}</div>
                    <div className="text-[10px] font-mono text-stone-500">{m.itemCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-stone-400 font-medium">Valuation</div>
                    <div className="font-mono font-bold text-[#714f36] text-sm">{formatINR(m.totalOwnedQty * m.purchaseCost)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2 bg-[#fbf9f5] rounded-md text-center font-mono text-[11px] border border-[#ede3d4]">
                  <div>
                    <div className="text-[9px] text-stone-400 font-sans">Owned</div>
                    <div className="font-bold text-stone-800">{m.totalOwnedQty}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-stone-400 font-sans">Warehouse</div>
                    <div className="text-stone-600">{m.usableWarehouseQty}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#714f36] font-sans">On Sites</div>
                    <div className="font-bold text-[#714f36]">{m.siteAllocatedQty}</div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-stone-500 pt-1 border-t border-[#f0e8db]">
                  <span>Unit Purchase Cost:</span>
                  <span className="font-mono font-medium text-stone-700">{formatINR(m.purchaseCost)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Inventory Valuation Table */}
          <div className="hidden md:block bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                  <tr>
                    <th className="px-4 py-3">SKU Code</th>
                    <th className="px-4 py-3">Material Name</th>
                    <th className="px-4 py-3 text-center">Owned Qty</th>
                    <th className="px-4 py-3 text-center">Warehouse</th>
                    <th className="px-4 py-3 text-center">On Sites</th>
                    <th className="px-4 py-3 text-right">Unit Purchase Cost</th>
                    <th className="px-4 py-3 text-right font-bold text-stone-900">Total Asset Value (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8db] font-mono">
                  {data.materials.map((m: any) => (
                    <tr key={m.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-bold text-[#24160c]">{m.itemCode}</td>
                      <td className="px-4 py-3 font-sans font-medium text-stone-800">{m.name}</td>
                      <td className="px-4 py-3 text-center font-bold text-stone-900">{m.totalOwnedQty}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{m.usableWarehouseQty}</td>
                      <td className="px-4 py-3 text-center text-[#714f36] font-bold">{m.siteAllocatedQty}</td>
                      <td className="px-4 py-3 text-right">{formatINR(m.purchaseCost)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#714f36]">{formatINR(m.totalOwnedQty * m.purchaseCost)}</td>
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
              <div key={inv.id} className="p-4 bg-white rounded-lg border border-[#e8decb] shadow-2xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-stone-900 font-mono">{inv.invoiceNumber}</div>
                    <div className="text-stone-700 font-medium">{inv.customerName}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {inv.status}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#fbf7f0] rounded-md border border-[#ebdcc9] font-mono">
                  <span className="text-[11px] text-[#714f36] font-sans font-medium">Outstanding Balance:</span>
                  <span className="font-bold text-rose-700 text-sm">{formatINR(inv.outstandingAmount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-500 font-mono pt-1">
                  <div>Invoiced: <span className="font-bold text-stone-800">{formatINR(inv.totalAmount)}</span></div>
                  <div>Paid: <span className="font-bold text-[#714f36]">{formatINR(inv.paidAmount)}</span></div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono pt-1 border-t border-[#f0e8db]">
                  <span>Dated: {formatDate(inv.invoiceDate)}</span>
                  <span>Due: {formatDate(inv.dueDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Outstanding Receivables Table */}
          <div className="hidden md:block bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
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
                <tbody className="divide-y divide-[#f0e8db] font-mono">
                  {data.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-bold text-[#24160c]">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-stone-800">{inv.customerName}</td>
                      <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right">{formatINR(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-[#714f36]">{formatINR(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                      <td className="px-4 py-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
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
              <div key={p.id} className="p-4 bg-white rounded-lg border border-[#e8decb] shadow-2xs space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#24160c] font-mono">{p.projectCode}</div>
                    <div className="font-semibold text-stone-800">{p.customerName}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#fbf9f5] border border-[#ede3d4] text-stone-700">
                    {p.status}
                  </span>
                </div>

                <div className="text-stone-600 text-[11px]">
                  Site: <span className="font-medium text-stone-800">{p.siteName}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#f0e8db]">
                  <span className="text-stone-400 text-[11px]">Supervisor: {p.supervisorName}</span>
                  <span className="font-mono font-bold text-[#714f36]">
                    {p.monthlyRentalRate > 0 ? `${formatINR(p.monthlyRentalRate)}/mo` : 'No Rental'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Project Status Table */}
          <div className="hidden md:block bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto responsive-table-container">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                  <tr>
                    <th className="px-4 py-3">Project Code</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Site Location</th>
                    <th className="px-4 py-3">Supervisor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right font-bold text-stone-900">Monthly Rental</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8db]">
                  {data.projects.map((p: any) => (
                    <tr key={p.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-4 py-3 font-mono font-bold text-[#24160c]">{p.projectCode}</td>
                      <td className="px-4 py-3 font-semibold text-stone-800">{p.customerName}</td>
                      <td className="px-4 py-3 text-stone-600">{p.siteName}</td>
                      <td className="px-4 py-3 text-stone-600">{p.supervisorName}</td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold text-stone-700">{p.status}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#714f36]">
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
