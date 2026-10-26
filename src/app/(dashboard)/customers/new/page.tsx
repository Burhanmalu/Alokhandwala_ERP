'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  ReceiptIndianRupee, 
  FileText,
  UserCheck
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export default function NewCustomerPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace('/projects?denied=customer_create');
    }
  }, [currentUser, router]);

  const [companyName, setCompanyName] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [state, setState] = useState('Maharashtra');
  const [gstin, setGstin] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(1000000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !contactPerson.trim() || !phone.trim() || !email.trim() || !billingAddress.trim()) {
      setError('Please fill all mandatory fields marked with an asterisk (*).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          referenceName: referenceName.trim() || undefined,
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          billingAddress: billingAddress.trim(),
          city,
          state,
          gstin: gstin.trim().toUpperCase() || undefined,
          creditLimit: Number(creditLimit),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to register customer');
      }

      // Redirect to Customers directory or Site Inspection
      router.push('/customers');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/customers" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Customers & Sites</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Customer Registration Form</span>
      </div>

      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Customer Registration Form</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register new builders, general contractors, developers, and infrastructure partners.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sites/new"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <span>Open Site Form</span>
            <Building2 className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Identity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>1. Corporate Identity & Reference</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Company / Contractor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Godrej Properties Ltd. / L&T Construction"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Internal Reference / Project Division
              </label>
              <input
                type="text"
                placeholder="e.g. B&F Division / Western Region"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Customer Status
              </label>
              <input
                type="text"
                disabled
                value="ACTIVE (New Account)"
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-emerald-800 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Contact Persons */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>2. Key Contact & Commercial Communication</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Primary Contact Person <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sanjay Deshmukh (Project Director)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Phone / Mobile <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98210 11223"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address (For Tax Invoices & Notices) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. billing@godrejproperties.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Credit Limit (INR)
              </label>
              <input
                type="number"
                step="50000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono font-bold text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Billing Address & GST */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>3. Registered Billing Address & GSTIN</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Registered Corporate Billing Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Full registered address for GST invoicing..."
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Customer GSTIN (15 Digits)
              </label>
              <input
                type="text"
                placeholder="e.g. 27AAACG1234F1Z1 (For Intra-State CGST+SGST or Inter-State IGST)"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                maxLength={15}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono font-bold text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/customers"
            className="px-5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Registering Customer...' : 'Register Customer'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
