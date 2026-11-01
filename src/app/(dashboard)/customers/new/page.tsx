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
  UserCheck,
  ShieldCheck,
  CreditCard,
  Check
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { isValidGSTIN } from '@/lib/validations';

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
  const [billingAddress, setBillingAddress] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateGst = (val: string) => {
    if (!val || !val.trim()) {
      setGstError('GSTIN is required when GST Number is selected');
      return false;
    }
    if (!isValidGSTIN(val)) {
      setGstError('Invalid 15-character Indian GSTIN format (e.g. 23AAACG1234F1Z1)');
      return false;
    }
    setGstError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !contactPerson.trim() || !phone.trim() || !billingAddress.trim()) {
      setError('Please fill all mandatory fields marked with an asterisk (*).');
      return;
    }

    if (hasGst) {
      if (!gstin.trim()) {
        setError('Please enter client GST Number or uncheck the GST Number option.');
        return;
      }
      if (!isValidGSTIN(gstin)) {
        setError('Please enter a valid 15-character Indian GSTIN or uncheck the GST Number option.');
        return;
      }
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
          email: '',
          billingAddress: billingAddress.trim(),
          city: 'Indore',
          state: 'Madhya Pradesh',
          gstin: hasGst && gstin.trim() ? gstin.trim().toUpperCase() : 'N/A',
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to register customer');
      }

      router.push('/customers');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/customers" className="hover:text-[#24160c] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Customers & Corporate Accounts</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-stone-800">New Registration Form</span>
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">Commercial Onboarding</span>
            <span className="text-stone-500">|</span>
            <span className="text-xs text-stone-300">Master Record</span>
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#c79e7c]" />
            <span>Customer Registration Form</span>
          </h1>
          <p className="text-xs text-stone-300 mt-1">
            Establish new contractor and developer accounts for formal quotes, dispatch orders, and GST billing.
          </p>
        </div>

        <Link
          href="/sites/new"
          className="px-3.5 py-2 bg-[#c79e7c] hover:bg-[#dfcbab] text-[#1c120c] rounded-md text-xs font-bold transition shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Open Site Form</span>
          <Building2 className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company Identity */}
        <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
            <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#8f6541]" />
              <span>1. Corporate Identity & Reference</span>
            </h2>
            <span className="text-[11px] text-stone-400 font-mono">STEP 1 OF 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Company / Contractor Legal Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Godrej Properties Ltd. / L&T Construction"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full p-2.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none font-semibold text-stone-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Internal Reference / Division Tag
              </label>
              <input
                type="text"
                placeholder="e.g. Western Region Commercial Hub"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
                className="w-full p-2.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Account Status
              </label>
              <input
                type="text"
                disabled
                value="ACTIVE (Pre-Approved Commercial Client)"
                className="w-full p-2.5 bg-[#f7f3ec] border border-[#d6c7b2] rounded-md text-[#714f36] font-semibold text-xs"
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
            <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#8f6541]" />
              <span>2. Commercial Contact Information</span>
            </h2>
            <span className="text-[11px] text-stone-400 font-mono">STEP 2 OF 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Primary Contact Person <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sanjay Deshmukh (Project Director)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
                className="w-full p-2.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Direct Contact Phone / Mobile <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98210 11223"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-2.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Billing Address & GST */}
        <div className="bg-white p-5 rounded-lg border border-[#e8decb] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
            <h2 className="text-sm font-bold text-[#24160c] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#8f6541]" />
              <span>3. Registered Tax Billing Address & GSTIN</span>
            </h2>
            <span className="text-[11px] text-stone-400 font-mono">STEP 3 OF 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Registered Corporate Billing Address <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Full official registered address for GST tax invoices..."
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                required
                className="w-full p-2.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md focus:bg-white focus:border-[#8f6541] focus:outline-none"
              />
            </div>

            {/* GST Number Checkbox & Conditional Input */}
            <div className="sm:col-span-2 p-3 bg-[#faf6ee]/70 border border-[#ebdcc9] rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasGst}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasGst(checked);
                      if (!checked) {
                        setGstError(null);
                      } else if (gstin && gstin !== 'N/A') {
                        validateGst(gstin);
                      }
                    }}
                    className="w-4 h-4 rounded border-[#d6c7b2] text-[#8f6541] focus:ring-[#8f6541] accent-[#8f6541]"
                  />
                  <span className="text-xs font-bold text-[#4a3525] uppercase tracking-wider">
                    GST Number
                  </span>
                </label>
                <span className="text-[11px] font-mono font-medium text-[#7d6553]">
                  {hasGst ? 'Client has GST registration' : 'GST: N/A'}
                </span>
              </div>

              {hasGst && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-2xs font-bold text-[#5c3e24] uppercase tracking-wider">
                    Customer GSTIN (15 Alphanumeric Characters) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 23AAACG1234F1Z1"
                    value={gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                      setGstin(val);
                      validateGst(val);
                    }}
                    maxLength={15}
                    className={`w-full p-2.5 bg-white border rounded-md uppercase font-mono font-bold text-stone-900 focus:outline-none ${
                      gstError ? 'border-rose-400 focus:border-rose-500' : 'border-[#d6c7b2] focus:border-[#8f6541]'
                    }`}
                  />
                  {gstError && (
                    <span className="text-[11px] text-rose-600 font-medium block">
                      {gstError}
                    </span>
                  )}
                  {gstin && isValidGSTIN(gstin) && (
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid 15-character Indian GSTIN
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/customers"
            className="px-4 py-2 text-xs font-medium text-stone-700 bg-white border border-[#d6c7b2] rounded-md hover:bg-[#fbf9f5] transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-[#24160c] hover:bg-[#382315] border border-[#19100a] rounded-md shadow-xs transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#c79e7c]" />
            <span>{loading ? 'Registering Account...' : 'Confirm & Save Account'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
