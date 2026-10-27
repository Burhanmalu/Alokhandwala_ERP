// ALOKHANDWALA - Rental Lifecycle, Extension & Buffer Service

import { dbStore } from '../db/store';
import { Project, BufferRequest, RentalExtension } from '../schema';
import { addCalendarMonths, addDays } from '../formatters';

import { RENTAL_CONSTANTS } from '../constants/terms-and-conditions';

export class RentalService {
  /**
   * Request / Apply Buffer Period (2 to 3 days for removal planning)
   */
  public static async applyBufferPeriod(data: {
    projectId: string;
    requestedBufferDays: number;
    reason: string;
    additionalCharges?: number;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; bufferRequest: BufferRequest }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!['INSTALLED', 'ACTIVE_RENTAL', 'EXTENDED'].includes(project.status)) {
        throw new Error(`Cannot apply buffer period to project in status ${project.status}`);
      }

      const currentEnd = project.rentalEndDate ? new Date(project.rentalEndDate) : new Date();
      const bufferDeadline = addDays(currentEnd, data.requestedBufferDays);
      const bufferDeadlineStr = bufferDeadline.toISOString().split('T')[0];

      project.status = 'BUFFER_PERIOD';
      project.bufferEndDate = bufferDeadlineStr;
      project.updatedAt = new Date().toISOString();

      const bufferRequest: BufferRequest = {
        id: `buf-${Date.now()}`,
        projectId: project.id,
        projectCode: project.projectCode,
        currentRentalEndDate: project.rentalEndDate || new Date().toISOString().split('T')[0],
        requestedBufferDays: data.requestedBufferDays,
        proposedRemovalDeadline: bufferDeadlineStr,
        reason: data.reason,
        additionalCharges: data.additionalCharges || 0,
        approvalStatus: 'APPROVED',
        approvedBy: data.actorId,
        approverName: data.actorName,
        approvedAt: new Date().toISOString(),
        createdBy: data.actorId,
        creatorName: data.actorName,
        createdAt: new Date().toISOString(),
      };
      state.bufferRequests.unshift(bufferRequest);

      // Record Activity
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'BUFFER_APPROVED',
        eventTitle: `${data.requestedBufferDays}-Day Removal Buffer Approved`,
        eventDescription: `Buffer period granted until ${bufferDeadlineStr} for removal planning. Reason: ${data.reason}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: new Date().toISOString(),
      });

      // Notification
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'SUPERVISOR',
        title: `Buffer Time Approved: ${project.projectCode}`,
        message: `${data.requestedBufferDays} days granted for site removal. Deadline: ${bufferDeadlineStr}.`,
        type: 'WARNING',
        entityType: 'RENTAL',
        entityId: project.id,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      return { project, bufferRequest };
    });
  }

  /**
   * Request / Approve Rental Extension (Default 1 calendar month)
   * Extends the rental without consuming additional warehouse inventory.
   */
  public static async extendRental(data: {
    projectId: string;
    durationMonths: number;
    extensionReason: string;
    monthlyRentalRate?: number;
    additionalCharges?: number;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; rentalExtension: RentalExtension }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!['INSTALLED', 'ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENDED'].includes(project.status)) {
        throw new Error(`Cannot extend project in status ${project.status}`);
      }

      const currentEnd = project.rentalEndDate ? new Date(project.rentalEndDate) : new Date();
      // Official Term 2: 28 days = 1 rental period month
      const newEnd = addDays(currentEnd, data.durationMonths * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH);
      const newEndStr = newEnd.toISOString().split('T')[0];
      const previousEndStr = project.rentalEndDate || '';

      const extensionNumber = `EXT-${new Date().getFullYear()}-${(state.rentalExtensions.length + 1).toString().padStart(6, '0')}`;
      const rate = data.monthlyRentalRate || project.monthlyRentalRate;

      // Preserve original dates
      if (!project.originalRentalEndDate) {
        project.originalRentalEndDate = previousEndStr;
      }

      project.status = 'EXTENDED';
      project.rentalEndDate = newEndStr;
      project.bufferEndDate = undefined; // clear buffer if extended
      project.updatedAt = new Date().toISOString();

      const rentalExtension: RentalExtension = {
        id: `ext-${Date.now()}`,
        extensionNumber,
        projectId: project.id,
        projectCode: project.projectCode,
        previousRentalEndDate: previousEndStr,
        newRentalEndDate: newEndStr,
        durationMonths: data.durationMonths,
        extensionReason: data.extensionReason,
        monthlyRentalRate: rate,
        additionalCharges: data.additionalCharges || 0,
        approvalStatus: 'APPROVED',
        approvedBy: data.actorId,
        approverName: data.actorName,
        approvedAt: new Date().toISOString(),
        createdBy: data.actorId,
        creatorName: data.actorName,
        createdAt: new Date().toISOString(),
      };
      state.rentalExtensions.unshift(rentalExtension);

      // Record Activity
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'RENTAL_EXTENDED',
        eventTitle: `Rental Extended by ${data.durationMonths} Month(s)`,
        eventDescription: `Contractual rental end date updated from ${previousEndStr} to ${newEndStr}. Reason: ${data.extensionReason}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: new Date().toISOString(),
      });

      // Notification to Admin to bill extension
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'ADMIN',
        title: `Rental Extension Approved: ${project.projectCode}`,
        message: `Project extended until ${newEndStr}. Rental charge ₹${rate}/month applies.`,
        type: 'INFO',
        entityType: 'RENTAL',
        entityId: project.id,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      return { project, rentalExtension };
    });
  }
}
