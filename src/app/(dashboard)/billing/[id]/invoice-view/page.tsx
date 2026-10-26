'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, Building2, CheckCircle2 } from 'lucide-react';
import { Invoice } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';

export default function InvoicePrintViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const inv = json.data.find((i: Invoice) => i.id === id || i.invoiceNumber === id);
          if (inv) setInvoice(inv);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !invoice) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading invoice document...</div>;
  }

  const isIntraState = !invoice.igstAmount || invoice.igstAmount === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Bar for Action (Hidden on Print) */}
      <div className="flex items-center justify-between no-print">
        <Link href="/billing" className="text-xs text-[#5c3c26] hover:text-[#2d1b0f] flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices</span>
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#322016] hover:bg-[#4d3221] text-[#fdf8f4] rounded-lg text-xs font-bold shadow-xs transition"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Tax Invoice Paper Layout */}
      <div className="bg-white p-8 rounded-2xl border border-[#ebdcc9] shadow-md print:border-none print:shadow-none print:p-0 space-y-6 text-[#24160c] text-xs">
        {/* Letterhead */}
        <div className="flex justify-between items-start border-b-2 border-[#322016] pb-5">
          <div>
            <div className="flex items-center gap-3.5">
              <img 
                src="/logo.png" 
                alt="Alokhandwala" 
                className="h-16 w-auto object-contain print:h-14"
              />
              <div className="border-l border-[#d8c3ae] pl-3.5">
                <div className="text-[11px] font-bold tracking-widest text-[#24160c] uppercase">
                  Scaffolding Division
                </div>
                <div className="text-[10px] text-[#8c5e39] font-medium">
                  Leading Scaffolding Rental, Shifting & Heavy Shoring Solutions
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-600 space-y-0.5">
              <div>Office: 4th Floor, Office No. 401 Sapphire Square Tower, Square Indore, Madhya Pradesh (MP), India</div>
              <div>Phone: 8818852722 | Email: alokhandwala.sh@gmail.com</div>
              <div className="font-mono font-bold text-slate-800">
                GSTIN: 23AABCA1234F1Z5 | PAN: AABCA1234F | State: Madhya Pradesh (23)
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-[#322016] uppercase tracking-wider font-mono">
              TAX INVOICE
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-1">
              {invoice.invoiceNumber}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Date: {formatDate(invoice.invoiceDate)}</div>
            <div className="text-[11px] text-rose-700 font-semibold">Due: {formatDate(invoice.dueDate)}</div>
          </div>
        </div>

        {/* Bill To & Project Info */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Bill To Customer</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{invoice.customerName}</div>
            <div className="text-slate-600 mt-1 whitespace-pre-line">{invoice.customerAddress}</div>
            {invoice.customerGstin && (
              <div className="font-mono font-bold text-slate-800 mt-1">
                Customer GSTIN: {invoice.customerGstin}
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Project Reference</div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
              {invoice.projectCode || 'General Contract'}
            </div>
            <div className="text-slate-600 mt-1">Type: {invoice.invoiceType.replace(/_/g, ' ')}</div>
            <div className="text-slate-600">Place of Supply: Maharashtra (State Code 27)</div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Service Description</th>
              <th className="p-3 text-center">HSN/SAC</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Unit Rate (INR)</th>
              <th className="p-3 text-right">Taxable Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {invoice.lines.map((l, idx) => (
              <tr key={l.id}>
                <td className="p-3 text-slate-400">{idx + 1}</td>
                <td className="p-3 font-sans font-medium text-slate-900">{l.description}</td>
                <td className="p-3 text-center text-slate-600">{l.hsnSacCode}</td>
                <td className="p-3 text-center text-slate-800">{l.quantity}</td>
                <td className="p-3 text-right">{formatINR(l.rate)}</td>
                <td className="p-3 text-right font-bold text-slate-900">{formatINR(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculations & GST Breakdown */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 font-mono text-xs border-t border-slate-200 pt-3">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Subtotal:</span>
              <span>{formatINR(invoice.taxableValue)}</span>
            </div>

            {isIntraState ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST @ 9%:</span>
                  <span>{formatINR(invoice.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST @ 9%:</span>
                  <span>{formatINR(invoice.sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>IGST @ 18%:</span>
                <span>{formatINR(invoice.igstAmount)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-900 pt-1.5">
              <span>Invoice Total (INR):</span>
              <span>{formatINR(invoice.totalAmount)}</span>
            </div>

            <div className="flex justify-between text-emerald-700 font-semibold pt-1">
              <span>Amount Paid:</span>
              <span>{formatINR(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-rose-700 font-bold border-t border-slate-200 pt-1">
              <span>Balance Due:</span>
              <span>{formatINR(invoice.outstandingAmount)}</span>
            </div>
          </div>
        </div>

        {/* Bank NEFT Details & Terms */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-[11px] text-slate-600">
          <div>
            <div className="font-bold text-slate-800 mb-1">Bank Payment Details (NEFT / RTGS):</div>
            <div>Bank: HDFC Bank Ltd.</div>
            <div>A/C Name: Alokhandwala</div>
            <div>A/C Number: 50200012345678 (Current Account)</div>
            <div>IFSC Code: HDFC0000123</div>
            <div>Branch: Sapphire Square, Indore Branch</div>
          </div>

          <div className="text-right flex flex-col justify-end items-end">
            <div className="text-[10px] text-slate-400">For Alokhandwala</div>
            <div className="my-1 opacity-75">
              <img src="/logo-icon.png" alt="Company Seal" className="h-8 w-auto object-contain mx-auto print:opacity-90" />
            </div>
            <div className="font-bold text-[#24160c]">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
