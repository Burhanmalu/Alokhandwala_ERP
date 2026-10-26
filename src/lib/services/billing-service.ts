// ALOKHANDWALA - Billing, GST & Payment Service

import { dbStore } from '../db/store';
import { Invoice, Payment } from '../schema';
import { calculateGST } from '../formatters';

export class BillingService {
  /**
   * Generate next sequential invoice number (e.g. INV-2026-0003)
   */
  private static generateInvoiceNumber(existingInvoices: Invoice[]): string {
    const year = new Date().getFullYear();
    const count = existingInvoices.length + 1;
    return `INV-${year}-${count.toString().padStart(4, '0')}`;
  }

  /**
   * Generate next sequential payment receipt number (e.g. RCP-2026-0002)
   */
  private static generateReceiptNumber(existingPayments: Payment[]): string {
    const year = new Date().getFullYear();
    const count = existingPayments.length + 1;
    return `RCP-${year}-${count.toString().padStart(4, '0')}`;
  }

  /**
   * Create a GST Tax Invoice for project rental, transport, or charges
   */
  public static async createInvoice(data: {
    customerId: string;
    projectId?: string;
    invoiceType: 'RENTAL_CHARGE' | 'TRANSPORT' | 'LABOUR' | 'SHIFTING' | 'DAMAGE_PENALTY';
    invoiceDate: string;
    dueDate: string;
    notes?: string;
    lines: {
      description: string;
      hsnSacCode?: string;
      quantity: number;
      rate: number;
    }[];
    actorId: string;
    actorName: string;
  }): Promise<Invoice> {
    return await dbStore.transaction(async (state) => {
      const customer = state.customers.find(c => c.id === data.customerId);
      if (!customer) throw new Error('Customer not found');

      const project = data.projectId ? state.projects.find(p => p.id === data.projectId) : undefined;
      const invoiceNumber = this.generateInvoiceNumber(state.invoices);

      const computedLines = data.lines.map((line, idx) => ({
        id: `inv-line-${Date.now()}-${idx}`,
        description: line.description,
        hsnSacCode: line.hsnSacCode || '997312',
        quantity: line.quantity,
        rate: line.rate,
        amount: Math.round(line.quantity * line.rate * 100) / 100,
      }));

      const subtotal = computedLines.reduce((sum, l) => sum + l.amount, 0);
      const taxCalc = calculateGST(
        subtotal,
        customer.state || 'Maharashtra',
        state.companySettings.state || 'Maharashtra',
        state.companySettings.defaultGstRate || 18
      );

      const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.companyName,
        customerGstin: customer.gstin,
        customerAddress: customer.billingAddress,
        projectId: project?.id,
        projectCode: project?.projectCode,
        invoiceType: data.invoiceType,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        subtotal: subtotal,
        discountAmount: 0,
        taxableValue: subtotal,
        cgstRate: taxCalc.cgstRate,
        cgstAmount: taxCalc.cgstAmount,
        sgstRate: taxCalc.sgstRate,
        sgstAmount: taxCalc.sgstAmount,
        igstRate: taxCalc.igstRate,
        igstAmount: taxCalc.igstAmount,
        totalAmount: taxCalc.totalAmount,
        paidAmount: 0,
        outstandingAmount: taxCalc.totalAmount,
        status: 'ISSUED',
        notes: data.notes,
        lines: computedLines,
        createdAt: new Date().toISOString(),
      };

      state.invoices.unshift(invoice);
      customer.outstandingBalance = (customer.outstandingBalance || 0) + invoice.totalAmount;

      // Activity log
      if (project) {
        state.activityEvents.unshift({
          id: `act-${Date.now()}`,
          projectId: project.id,
          eventType: 'INVOICE_GENERATED',
          eventTitle: `Invoice ${invoiceNumber} Generated`,
          eventDescription: `Tax invoice issued for ₹${invoice.totalAmount} (${data.invoiceType.replace(/_/g, ' ')}).`,
          actorId: data.actorId,
          actorName: data.actorName,
          createdAt: new Date().toISOString(),
        });
      }

      return invoice;
    });
  }

  /**
   * Record a Customer Payment and allocate towards invoice & balance
   */
  public static async recordPayment(data: {
    invoiceId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: 'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH';
    transactionReference: string;
    bankName?: string;
    remarks?: string;
    actorId: string;
    actorName: string;
  }): Promise<{ payment: Payment; invoice: Invoice }> {
    return await dbStore.transaction(async (state) => {
      const invoice = state.invoices.find(i => i.id === data.invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const customer = state.customers.find(c => c.id === invoice.customerId);
      if (!customer) throw new Error('Customer not found');

      if (data.amount <= 0) throw new Error('Payment amount must be greater than zero');
      if (data.amount > invoice.outstandingAmount) {
        throw new Error(`Payment cannot exceed invoice outstanding balance of ₹${invoice.outstandingAmount}`);
      }

      const receiptNumber = this.generateReceiptNumber(state.payments);

      const payment: Payment = {
        id: `pay-${Date.now()}`,
        receiptNumber,
        customerId: customer.id,
        customerName: customer.companyName,
        projectId: invoice.projectId,
        projectCode: invoice.projectCode,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paymentDate: data.paymentDate,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference,
        bankName: data.bankName,
        receivedBy: data.actorId,
        receiverName: data.actorName,
        remarks: data.remarks,
        createdAt: new Date().toISOString(),
      };

      state.payments.unshift(payment);

      // Update invoice balances
      invoice.paidAmount += data.amount;
      invoice.outstandingAmount = Math.max(0, invoice.outstandingAmount - data.amount);
      if (invoice.outstandingAmount === 0) {
        invoice.status = 'PAID';
      } else {
        invoice.status = 'PARTIALLY_PAID';
      }

      // Update customer balance
      customer.outstandingBalance = Math.max(0, (customer.outstandingBalance || 0) - data.amount);

      return { payment, invoice };
    });
  }
}
