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
    reason?: string;
    additionalCharges?: number;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; bufferRequest: BufferRequest }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId || p.projectCode === data.projectId);
      if (!project) throw new Error('Project not found');

      if (project.status === 'BUFFER_PERIOD' || Boolean(project.bufferEndDate)) {
        throw new Error('Buffer period is already active for this project.');
      }

      if (!['INSTALLED', 'ACTIVE_RENTAL', 'EXTENDED'].includes(project.status)) {
        throw new Error(`Cannot apply buffer period to project in status ${project.status}`);
      }

      const configuredDefault =
        Number(state.companySettings?.bufferDaysDefault) > 0
          ? Math.trunc(Number(state.companySettings.bufferDaysDefault))
          : initialCompanySettings.bufferDaysDefault;

      const bufferDays =
        data.requestedBufferDays !== undefined && Number(data.requestedBufferDays) > 0
          ? Math.trunc(Number(data.requestedBufferDays))
          : configuredDefault;

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

      const bufferDeadlineStr = calculateExtendedRemovalDate(previousRemovalStr, bufferDays, 'DAYS');
      const now = new Date().toISOString();
      const reasonText = (data.reason || '').trim() || `Configured ${bufferDays}-day rental buffer period activated`;

      project.status = 'BUFFER_PERIOD';
      project.bufferEndDate = bufferDeadlineStr;
      project.removalDate = bufferDeadlineStr;
      project.bufferDaysApplied = bufferDays;
      project.bufferActivatedAt = now;
      project.updatedAt = now;

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
        id: `rh-buf-${Date.now()}`,
        projectId: project.id,
        projectCode: project.projectCode,
        actionType: 'BUFFER_PERIOD',
        originalRemovalDate: project.originalRemovalDate,
        previousRemovalDate: previousRemovalStr,
        newRemovalDate: bufferDeadlineStr,
        addedValue: bufferDays,
        addedUnit: 'DAYS',
        reason: reasonText,
        changedAt: now,
        changedById: data.actorId,
        changedByName: data.actorName,
      };
      if (!project.rentalHistory) project.rentalHistory = [];
      project.rentalHistory.unshift(historyEntry);

      const bufferRequest: BufferRequest = {
        id: `buf-${Date.now()}`,
        projectId: project.id,
        projectCode: project.projectCode,
        currentRentalEndDate: previousRemovalStr,
        requestedBufferDays: bufferDays,
        proposedRemovalDeadline: bufferDeadlineStr,
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
        eventTitle: `Buffer Period Active (+${bufferDays} Days)`,
        eventDescription: `Removal date updated from ${previousRemovalStr} to ${bufferDeadlineStr} (Original: ${project.originalRemovalDate}). Reason: ${reasonText}`,
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
        oldState: { removalDate: previousRemovalStr, status: 'ACTIVE_RENTAL' },
        newState: { removalDate: bufferDeadlineStr, bufferEndDate: bufferDeadlineStr, bufferDays, status: 'BUFFER_PERIOD' },
        createdAt: now,
      });

      // Notification
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'SUPERVISOR',
        title: `Buffer Period Active: ${project.projectCode}`,
        message: `${bufferDays} buffer day(s) applied. Updated removal deadline: ${bufferDeadlineStr}.`,
        type: 'WARNING',
        entityType: 'RENTAL',
        entityId: project.id,
        isRead: false,
        createdAt: now,
      });

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
        id: `rh-ext-${Date.now()}`,
        projectId: project.id,
        projectCode: project.projectCode,
        actionType: 'EXTEND_RENTAL',
        originalRemovalDate: project.originalRemovalDate,
        previousRemovalDate: previousEndStr,
        newRemovalDate: newEndStr,
        addedValue,
        addedUnit: unit,
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
        id: `ext-${Date.now()}`,
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
        additionalCharges: data.additionalCharges || 0,
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
        eventDescription: `Effective removal date updated from ${previousEndStr} to ${newEndStr} (Original: ${project.originalRemovalDate}). Reason: ${reasonText}`,
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
        oldState: { removalDate: previousEndStr, status: oldStatus },
        newState: { removalDate: newEndStr, addedValue, addedUnit: unit, status: 'EXTENDED' },
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

      return { project, rentalExtension };
    });
  }
}
