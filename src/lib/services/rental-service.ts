// ALOKHANDWALA - Rental Lifecycle, Extension & Buffer Service

import { dbStore } from '../db/store';
import { initialCompanySettings } from '../db/seed-data';
import { Project, BufferRequest, RentalExtension, RentalHistoryEntry } from '../schema';
import {
  calculateExtendedRemovalDate,
  calculateRentalDurationBreakdown,
  getEffectiveRemovalDate,
  getProjectInstallDateStr,
  toDateOnlyString,
} from '../formatters';

import { RENTAL_CONSTANTS } from '../constants/terms-and-conditions';
import { ReminderService } from './reminder-service';

export class RentalService {
  /**
   * Apply configured Rental Buffer Period to a project's removal date.
   * Uses state.companySettings.bufferDaysDefault unless explicitly overridden,
   * prevents duplicate activation while a buffer is already active,
   * updates Effective Removal Date, recalculates duration, and appends rentalHistory.
   */
  public static async applyBufferPeriod(data: {
    projectId: string;
    requestedBufferDays?: number;
    bufferEndDate?: string;
    paymentStatus?: 'PAID' | 'UNPAID';
    totalAmount?: number;
    paymentReceived?: number;
    balanceAmount?: number;
    reason?: string;
    additionalCharges?: number;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; bufferRequest: BufferRequest }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId || p.projectCode === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED', 'REMOVAL_PENDING'].includes(project.status)) {
        throw new Error(`Cannot apply buffer period to project in status ${project.status}`);
      }

      const paymentStatus: 'PAID' | 'UNPAID' = data.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';

      const configuredDefault =
        Number(state.companySettings?.bufferDaysDefault) > 0
          ? Math.trunc(Number(state.companySettings.bufferDaysDefault))
          : initialCompanySettings.bufferDaysDefault;

      const previousRemovalStr =
        toDateOnlyString(getEffectiveRemovalDate(project)) || toDateOnlyString(new Date());

      if (!project.originalRemovalDate) {
        project.originalRemovalDate = project.originalRentalEndDate || previousRemovalStr;
      }
      if (!project.originalRentalEndDate) {
        project.originalRentalEndDate = project.originalRemovalDate;
      }
      if (!project.rentalEndDate) {
        project.rentalEndDate = previousRemovalStr;
      }

      let bufferDays: number;
      let bufferDeadlineStr: string;

      if (data.bufferEndDate && data.bufferEndDate.trim()) {
        bufferDeadlineStr = toDateOnlyString(data.bufferEndDate);
        if (!bufferDeadlineStr) {
          throw new Error('Invalid Buffer Period End Date.');
        }
        const prevDate = new Date(previousRemovalStr + 'T00:00:00Z');
        const nextDate = new Date(bufferDeadlineStr + 'T00:00:00Z');
        const diffDays = Math.round((nextDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 1) {
          throw new Error('Buffer Period End Date must be at least 1 day after the current removal date.');
        }
        bufferDays = diffDays;
      } else {
        bufferDays =
          data.requestedBufferDays !== undefined && Number(data.requestedBufferDays) > 0
            ? Math.trunc(Number(data.requestedBufferDays))
            : configuredDefault;
        bufferDeadlineStr = calculateExtendedRemovalDate(previousRemovalStr, bufferDays, 'DAYS');
      }

      const now = new Date().toISOString();
      const reasonText =
        (data.reason || '').trim() ||
        `Configured ${bufferDays}-day rental buffer period (${paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}) activated`;

      const oldStatus = project.status;
      project.status = 'BUFFER_PERIOD';
      project.bufferEndDate = bufferDeadlineStr;
      project.removalDate = bufferDeadlineStr;
      project.bufferDaysApplied = bufferDays;
      project.bufferActivatedAt = now;
      project.updatedAt = now;

      // Financial update ONLY when Paid is selected
      if (paymentStatus === 'PAID') {
        const currentTotal = Number(project.totalAmount ?? project.agreedProjectPrice ?? 0);
        const currentReceived = Number(project.paymentReceived ?? project.advancePaidAmount ?? 0);
        const currentBalance = Number(
          project.balanceAmount ?? Math.round((currentTotal - currentReceived) * 100) / 100
        );

        const nextTotal =
          data.totalAmount !== undefined ? Number(data.totalAmount) : currentTotal;
        const nextReceived =
          data.paymentReceived !== undefined ? Number(data.paymentReceived) : currentReceived;

        if (isNaN(nextTotal) || nextTotal < 0) {
          throw new Error('Total Agreed Price cannot be negative.');
        }
        if (isNaN(nextReceived) || nextReceived < 0) {
          throw new Error('Payment Received cannot be negative.');
        }

        const nextBalance = Math.round((nextTotal - nextReceived) * 100) / 100;

        project.totalAmount = nextTotal;
        project.agreedProjectPrice = nextTotal;
        project.paymentReceived = nextReceived;
        project.advancePaidAmount = nextReceived;
        project.balanceAmount = nextBalance;
        project.completionDueAmount = nextBalance;

        const customer = state.customers.find(c => c.id === project.customerId);
        if (customer) {
          const balanceDelta = nextBalance - currentBalance;
          customer.outstandingBalance = Math.max(
            0,
            Math.round(((customer.outstandingBalance || 0) + balanceDelta) * 100) / 100
          );
          customer.updatedAt = now;
        }
      }

      const installDate = getProjectInstallDateStr(project);
      if (installDate) {
        const dur = calculateRentalDurationBreakdown(installDate, bufferDeadlineStr);
        if (!dur.isInvalid) {
          project.rentalDurationMonths = dur.months;
          project.rentalDurationDays = dur.days;
          project.rentalDurationDisplay = dur.display;
          project.durationMonths = Math.max(1, dur.months || project.durationMonths || 1);
        }
      }

      const historyEntry: RentalHistoryEntry = {
        id: `rh-buf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId: project.id,
        projectCode: project.projectCode,
        actionType: 'BUFFER_PERIOD',
        originalRemovalDate: project.originalRemovalDate,
        previousRemovalDate: previousRemovalStr,
        newRemovalDate: bufferDeadlineStr,
        addedValue: bufferDays,
        addedUnit: 'DAYS',
        paymentStatus,
        totalAgreedPrice: paymentStatus === 'PAID' ? project.totalAmount : undefined,
        paymentReceived: paymentStatus === 'PAID' ? project.paymentReceived : undefined,
        balanceAmount: paymentStatus === 'PAID' ? project.balanceAmount : undefined,
        reason: reasonText,
        changedAt: now,
        changedById: data.actorId,
        changedByName: data.actorName,
      };
      if (!project.rentalHistory) project.rentalHistory = [];
      project.rentalHistory.unshift(historyEntry);

      const bufferRequest: BufferRequest = {
        id: `buf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId: project.id,
        projectCode: project.projectCode,
        currentRentalEndDate: previousRemovalStr,
        requestedBufferDays: bufferDays,
        proposedRemovalDeadline: bufferDeadlineStr,
        bufferEndDate: bufferDeadlineStr,
        paymentStatus,
        totalAgreedPrice: paymentStatus === 'PAID' ? project.totalAmount : undefined,
        paymentReceived: paymentStatus === 'PAID' ? project.paymentReceived : undefined,
        balanceAmount: paymentStatus === 'PAID' ? project.balanceAmount : undefined,
        reason: reasonText,
        additionalCharges: data.additionalCharges || 0,
        approvalStatus: 'APPROVED',
        approvedBy: data.actorId,
        approverName: data.actorName,
        approvedAt: now,
        createdBy: data.actorId,
        creatorName: data.actorName,
        createdAt: now,
      };
      state.bufferRequests.unshift(bufferRequest);

      // Record Activity & Audit
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'BUFFER_APPROVED',
        eventTitle: `Buffer Period Active (+${bufferDays} Days · ${paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'})`,
        eventDescription: `Removal date updated from ${previousRemovalStr} to ${bufferDeadlineStr} (Original: ${project.originalRemovalDate}). Payment Status: ${paymentStatus}. Reason: ${reasonText}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'BUFFER_PERIOD_ACTIVATED',
        entityTable: 'projects',
        entityId: project.id,
        oldState: { removalDate: previousRemovalStr, status: oldStatus },
        newState: {
          removalDate: bufferDeadlineStr,
          bufferEndDate: bufferDeadlineStr,
          bufferDays,
          paymentStatus,
          totalAmount: project.totalAmount,
          paymentReceived: project.paymentReceived,
          balanceAmount: project.balanceAmount,
          status: 'BUFFER_PERIOD',
        },
        createdAt: now,
      });

      // Notification
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'SUPERVISOR',
        title: `Buffer Period Active: ${project.projectCode}`,
        message: `${bufferDays} buffer day(s) (${paymentStatus}) applied. Updated removal deadline: ${bufferDeadlineStr}.`,
        type: 'WARNING',
        entityType: 'RENTAL',
        entityId: project.id,
        isRead: false,
        createdAt: now,
      });

      ReminderService.syncProjectRentalExpiryInState(state, project);

      return { project, bufferRequest };
    });
  }

  /**
   * Request / Approve Rental Extension (Days or Calendar Months)
   * Updates Effective Removal Date = Current Effective Removal Date + Extension Duration,
   * recalculates rental duration, clears superseded buffer state, and appends rentalHistory.
   */
  public static async extendRental(data: {
    projectId: string;
    extensionType?: 'DAYS' | 'MONTHS';
    extensionValue?: number;
    durationMonths?: number;
    extensionReason?: string;
    monthlyRentalRate?: number;
    extensionAmount?: number;
    paymentReceived?: number;
    projectTotalAmount?: number;
    projectPaymentReceived?: number;
    projectBalanceAmount?: number;
    additionalCharges?: number;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; rentalExtension: RentalExtension }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId || p.projectCode === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED', 'REMOVAL_PENDING'].includes(project.status)) {
        throw new Error(`Cannot extend project in status ${project.status}`);
      }

      const unit: 'DAYS' | 'MONTHS' = data.extensionType === 'DAYS' ? 'DAYS' : 'MONTHS';
      const addedValue = Math.trunc(Number(data.extensionValue ?? data.durationMonths ?? 0));
      if (!Number.isFinite(addedValue) || addedValue < 1) {
        throw new Error('Extension duration must be a positive integer.');
      }

      const hasDirectProjectTotals = data.projectTotalAmount !== undefined;
      let extAmount = Number(data.extensionAmount ?? data.additionalCharges ?? 0);
      let extPaymentReceived = Number(data.paymentReceived ?? 0);
      if (!hasDirectProjectTotals) {
        if (!Number.isFinite(extAmount) || extAmount <= 0) {
          throw new Error('Extension Amount must be greater than zero.');
        }
        if (!Number.isFinite(extPaymentReceived) || extPaymentReceived < 0) {
          throw new Error('Payment Received cannot be negative.');
        }
        if (extPaymentReceived > extAmount) {
          throw new Error('Payment Received cannot exceed Extension Amount.');
        }
      }

      const previousEndStr =
        toDateOnlyString(getEffectiveRemovalDate(project)) || toDateOnlyString(new Date());

      // Preserve original removal dates before overwriting
      if (!project.originalRemovalDate) {
        project.originalRemovalDate = project.originalRentalEndDate || previousEndStr;
      }
      if (!project.originalRentalEndDate) {
        project.originalRentalEndDate = project.originalRemovalDate;
      }

      const newEndStr = calculateExtendedRemovalDate(previousEndStr, addedValue, unit);
      const now = new Date().toISOString();
      const extensionNumber = `EXT-${new Date().getFullYear()}-${(state.rentalExtensions.length + 1).toString().padStart(6, '0')}`;
      const rate = data.monthlyRentalRate !== undefined ? data.monthlyRentalRate : project.monthlyRentalRate;
      const reasonText =
        (data.extensionReason || '').trim() ||
        `Extended by ${addedValue} ${unit === 'DAYS' ? (addedValue === 1 ? 'Day' : 'Days') : (addedValue === 1 ? 'Month' : 'Months')}`;

      const oldStatus = project.status;
      project.status = 'EXTENDED';
      project.rentalEndDate = newEndStr;
      project.removalDate = newEndStr;
      project.bufferEndDate = undefined;
      project.bufferDaysApplied = undefined;
      project.bufferActivatedAt = undefined;
      project.updatedAt = now;

      // Update project financial totals (Total + Extension Amount, Received + New Payment Received, or edited overrides)
      const prevTotal = Number(project.totalAmount ?? project.agreedProjectPrice ?? 0);
      const prevReceived = Number(project.paymentReceived ?? project.advancePaidAmount ?? 0);
      const prevBalance = Number(
        project.balanceAmount ?? Math.round((prevTotal - prevReceived) * 100) / 100
      );

      const nextTotal =
        data.projectTotalAmount !== undefined
          ? Math.round(Number(data.projectTotalAmount) * 100) / 100
          : Math.round((prevTotal + extAmount) * 100) / 100;
      const nextReceived =
        data.projectPaymentReceived !== undefined
          ? Math.round(Number(data.projectPaymentReceived) * 100) / 100
          : Math.round((prevReceived + extPaymentReceived) * 100) / 100;

      if (isNaN(nextTotal) || nextTotal < 0) {
        throw new Error('Total Agreed Price cannot be negative.');
      }
      if (isNaN(nextReceived) || nextReceived < 0) {
        throw new Error('Total Payment Received cannot be negative.');
      }

      const nextBalance =
        data.projectBalanceAmount !== undefined
          ? Math.round(Number(data.projectBalanceAmount) * 100) / 100
          : Math.round((nextTotal - nextReceived) * 100) / 100;

      if (isNaN(nextBalance) || nextBalance < 0) {
        throw new Error('Balance Amount cannot be negative.');
      }
      if (Math.abs((nextTotal - nextReceived) - nextBalance) > 0.01) {
        throw new Error('Balance Amount must equal Total Agreed Price − Total Payment Received.');
      }

      if (hasDirectProjectTotals) {
        extAmount = Math.max(0, Math.round((nextTotal - prevTotal) * 100) / 100);
        extPaymentReceived = Math.max(0, Math.round((nextReceived - prevReceived) * 100) / 100);
      }
      const extBalance = Math.max(0, Math.round((extAmount - extPaymentReceived) * 100) / 100);

      project.totalAmount = nextTotal;
      project.agreedProjectPrice = nextTotal;
      project.paymentReceived = nextReceived;
      project.advancePaidAmount = nextReceived;
      project.balanceAmount = nextBalance;
      project.completionDueAmount = nextBalance;

      const customer = state.customers.find(c => c.id === project.customerId);
      if (customer) {
        const balanceDelta = nextBalance - prevBalance;
        customer.outstandingBalance = Math.max(
          0,
          Math.round(((customer.outstandingBalance || 0) + balanceDelta) * 100) / 100
        );
        customer.updatedAt = now;
      }

      const installDate = getProjectInstallDateStr(project);
      if (installDate) {
        const dur = calculateRentalDurationBreakdown(installDate, newEndStr);
        if (!dur.isInvalid) {
          project.rentalDurationMonths = dur.months;
          project.rentalDurationDays = dur.days;
          project.rentalDurationDisplay = dur.display;
          project.durationMonths = Math.max(1, dur.months || project.durationMonths || 1);
        }
      }

      const historyEntry: RentalHistoryEntry = {
        id: `rh-ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId: project.id,
        projectCode: project.projectCode,
        actionType: 'EXTEND_RENTAL',
        originalRemovalDate: project.originalRemovalDate,
        previousRemovalDate: previousEndStr,
        newRemovalDate: newEndStr,
        addedValue,
        addedUnit: unit,
        extensionAmount: extAmount,
        paymentReceived: extPaymentReceived,
        balanceAmount: extBalance,
        totalAgreedPrice: nextTotal,
        reason: reasonText,
        changedAt: now,
        changedById: data.actorId,
        changedByName: data.actorName,
      };
      if (!project.rentalHistory) project.rentalHistory = [];
      project.rentalHistory.unshift(historyEntry);

      const durationMonthsEquivalent =
        unit === 'MONTHS'
          ? addedValue
          : Math.max(1, Math.ceil(addedValue / RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH));

      const rentalExtension: RentalExtension = {
        id: `ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        extensionNumber,
        projectId: project.id,
        projectCode: project.projectCode,
        originalRentalEndDate: project.originalRemovalDate,
        previousRentalEndDate: previousEndStr,
        newRentalEndDate: newEndStr,
        durationMonths: durationMonthsEquivalent,
        extensionUnit: unit,
        extensionValue: addedValue,
        extensionReason: reasonText,
        monthlyRentalRate: rate,
        additionalCharges: extAmount,
        extensionAmount: extAmount,
        paymentReceived: extPaymentReceived,
        balanceAmount: extBalance,
        approvalStatus: 'APPROVED',
        approvedBy: data.actorId,
        approverName: data.actorName,
        approvedAt: now,
        createdBy: data.actorId,
        creatorName: data.actorName,
        createdAt: now,
      };
      state.rentalExtensions.unshift(rentalExtension);

      const unitLabel = unit === 'DAYS' ? (addedValue === 1 ? 'Day' : 'Days') : (addedValue === 1 ? 'Month' : 'Months');

      // Record Activity & Audit
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'RENTAL_EXTENDED',
        eventTitle: `Rental Extended by ${addedValue} ${unitLabel}`,
        eventDescription: `Effective removal date updated from ${previousEndStr} to ${newEndStr} (Original: ${project.originalRemovalDate}). Extension Charge: ₹${extAmount.toLocaleString('en-IN')}, Payment Received: ₹${extPaymentReceived.toLocaleString('en-IN')}. Reason: ${reasonText}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'RENTAL_EXTENDED',
        entityTable: 'projects',
        entityId: project.id,
        oldState: {
          removalDate: previousEndStr,
          status: oldStatus,
          totalAmount: prevTotal,
          paymentReceived: prevReceived,
        },
        newState: {
          removalDate: newEndStr,
          addedValue,
          addedUnit: unit,
          extensionAmount: extAmount,
          extPaymentReceived,
          totalAmount: nextTotal,
          paymentReceived: nextReceived,
          balanceAmount: nextBalance,
          status: 'EXTENDED',
        },
        createdAt: now,
      });

      // Notification to Admin to bill extension
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'ADMIN',
        title: `Rental Extension Approved: ${project.projectCode}`,
        message: `Project extended by ${addedValue} ${unitLabel} until ${newEndStr}.`,
        type: 'INFO',
        entityType: 'RENTAL',
        entityId: project.id,
        isRead: false,
        createdAt: now,
      });

      ReminderService.syncProjectRentalExpiryInState(state, project);

      return { project, rentalExtension };
    });
  }
}
