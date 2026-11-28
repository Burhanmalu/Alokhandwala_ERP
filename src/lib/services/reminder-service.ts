// ALOKHANDWALA - Automatic Installation Reminder Scheduler (Asia/Kolkata)

import { dbStore, DatabaseState } from '../db/store';
import {
  InstallationReminder,
  Notification,
  Project,
  RentalExpiryMilestone,
} from '../schema';
import {
  formatDate,
  formatINR,
  getEffectiveRemovalDate,
  getProjectInstallDateStr,
  getProjectOutstandingBalance,
  toDateOnlyString,
} from '../formatters';

const ACTIVE_RENTAL_EXPIRY_STATUSES = new Set([
  'INSTALLED',
  'ACTIVE_RENTAL',
  'BUFFER_PERIOD',
  'EXTENSION_REQUESTED',
  'EXTENDED',
  'SHIFTING_PENDING',
  'SHIFTING_IN_PROGRESS',
  'REMOVAL_PENDING',
]);

export class ReminderService {
  /**
   * Extract current date and hour/minute in Asia/Kolkata (IST)
   */
  public static getIstParts(now: Date = new Date()): {
    dateStr: string;
    hour: number;
    minute: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
    const rawHour = Number(get('hour'));
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(get('minute'));
    return { dateStr, hour, minute };
  }

  /**
   * Subtract 1 calendar day from YYYY-MM-DD
   */
  public static subtractOneDay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  }

  /**
   * Sync installation reminder for a single project inside an active dbStore transaction.
   * - Schedules only when status === 'SCHEDULED', installationDate exists, and installationDate >= today (IST).
   * - Cancels any pending reminders when status changes away from SCHEDULED, date is removed, or date changes.
   * - Never creates duplicate reminders for the same project and installationDate.
   */
  public static syncProjectReminderInState(
    state: DatabaseState,
    project: Project,
    now: Date = new Date()
  ): void {
    if (!state.installationReminders) state.installationReminders = [];

    const nowIso = now.toISOString();
    const { dateStr: todayIst } = this.getIstParts(now);
    const installDate = toDateOnlyString(project.installationDate || project.plannedInstallationDate);

    const isEligible =
      project.status === 'SCHEDULED' &&
      Boolean(installDate) &&
      installDate >= todayIst;

    if (!isEligible) {
      for (const rem of state.installationReminders) {
        if (rem.projectId === project.id && rem.status === 'PENDING') {
          rem.status = 'CANCELLED';
          rem.updatedAt = nowIso;
        }
      }
      return;
    }

    const notificationDate = this.subtractOneDay(installDate);
    const scheduledAt = `${notificationDate}T13:00:00+05:30`;

    // Cancel any PENDING reminders for this project with a different installation date
    for (const rem of state.installationReminders) {
      if (
        rem.projectId === project.id &&
        rem.status === 'PENDING' &&
        rem.installationDate !== installDate
      ) {
        rem.status = 'CANCELLED';
        rem.updatedAt = nowIso;
      }
    }

    // Check if an active (PENDING or SENT) reminder already exists for this exact project + installationDate
    const existing = state.installationReminders.find(
      (rem) =>
        rem.projectId === project.id &&
        rem.installationDate === installDate &&
        (rem.status === 'PENDING' || rem.status === 'SENT')
    );

    if (existing) {
      if (existing.status === 'PENDING') {
        existing.projectCode = project.projectCode;
        existing.customerName = project.customerName;
        existing.siteAddress = project.siteAddress || project.siteName;
        existing.supervisorName = project.supervisorName || undefined;
        existing.updatedAt = nowIso;
      }
      return;
    }

    const newReminder: InstallationReminder = {
      id: `rem-inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectId: project.id,
      projectCode: project.projectCode,
      customerName: project.customerName,
      siteAddress: project.siteAddress || project.siteName,
      supervisorName: project.supervisorName || undefined,
      installationDate: installDate,
      notificationDate,
      scheduledTime: '13:00 - 14:00 IST',
      scheduledAt,
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    state.installationReminders.unshift(newReminder);
  }

  /**
   * Process all due PENDING installation reminders.
   * Fires when IST current date/time has reached 1:00 PM IST on notificationDate
   * (or is past notificationDate while installationDate is still upcoming).
   */
  public static async processDueInstallationReminders(now: Date = new Date()): Promise<number> {
    const { dateStr: todayIst, hour: hourIst } = this.getIstParts(now);
    const nowIso = now.toISOString();

    return await dbStore.transaction(async (state) => {
      if (!state.installationReminders) state.installationReminders = [];
      if (!state.notifications) state.notifications = [];

      let sentCount = 0;

      for (const rem of state.installationReminders) {
        if (rem.status !== 'PENDING') continue;

        const project = state.projects.find((p) => p.id === rem.projectId);
        const currentInstallDate = project
          ? toDateOnlyString(project.installationDate || project.plannedInstallationDate)
          : '';

        if (
          !project ||
          project.status !== 'SCHEDULED' ||
          !currentInstallDate ||
          currentInstallDate !== rem.installationDate ||
          currentInstallDate < todayIst
        ) {
          rem.status = 'CANCELLED';
          rem.updatedAt = nowIso;
          continue;
        }

        const isDue =
          todayIst >= rem.notificationDate &&
          todayIst <= rem.installationDate;

        if (!isDue) continue;

        // Duplicate notification guard
        const alreadyNotified = state.notifications.some(
          (n) =>
            n.entityType === 'PROJECT' &&
            n.entityId === project.id &&
            n.title === 'Installation Reminder' &&
            n.installationDate === rem.installationDate
        );

        if (!alreadyNotified) {
          const notifId = `notif-inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const supervisor = project.supervisorName || rem.supervisorName;
          const siteAddr = project.siteAddress || rem.siteAddress || project.siteName;

          const notif: Notification = {
            id: notifId,
            roleTarget: 'ADMIN',
            title: 'Installation Reminder',
            message: `Installation Reminder: Project ${project.projectCode} is scheduled for installation tomorrow.`,
            type: 'INFO',
            entityType: 'PROJECT',
            entityId: project.id,
            projectCode: project.projectCode,
            customerName: project.customerName,
            siteAddress: siteAddr,
            installationDate: rem.installationDate,
            supervisorName: supervisor || undefined,
            notificationDate: rem.notificationDate,
            scheduledTime: rem.scheduledTime,
            isRead: false,
            createdAt: nowIso,
          };

          state.notifications.unshift(notif);
          rem.notificationId = notifId;
          sentCount++;
        }

        rem.status = 'SENT';
        rem.sentAt = nowIso;
        rem.updatedAt = nowIso;
      }

      return sentCount;
    });
  }

  /**
   * Sync all SCHEDULED / active rental projects and immediately process any due reminders.
   */
  public static async syncAllAndProcessDueReminders(now: Date = new Date()): Promise<void> {
    await dbStore.transaction(async (state) => {
      for (const project of state.projects) {
        if (project.status === 'SCHEDULED') {
          this.syncProjectReminderInState(state, project, now);
        }
        this.syncProjectRentalExpiryInState(state, project, now);
        this.syncProjectPaymentReminderInState(state, project, now);
      }
    });
    await this.processDueInstallationReminders(now);
    await this.processDueRentalExpiryReminders(now);
  }

  /**
   * Calculate calendar day difference in Asia/Kolkata: (targetDateStr - todayIstStr)
   */
  public static getRemainingDaysIst(targetDateStr: string, now: Date = new Date()): number {
    const { dateStr: todayIst } = this.getIstParts(now);
    const [ty, tm, td] = todayIst.split('-').map((n) => parseInt(n, 10));
    const [ry, rm, rd] = targetDateStr.split('-').map((n) => parseInt(n, 10));
    const todayUtc = Date.UTC(ty, tm - 1, td);
    const targetUtc = Date.UTC(ry, rm - 1, rd);
    return Math.round((targetUtc - todayUtc) / 86400000);
  }

  public static isRentalExpiryEligible(project: Project): boolean {
    if (!project) return false;
    if (!ACTIVE_RENTAL_EXPIRY_STATUSES.has(project.status)) return false;
    if (project.dismantleStatus === 'COMPLETED' || Boolean(project.actualDismantlingDate)) {
      return false;
    }
    const effectiveRemoval = toDateOnlyString(getEffectiveRemovalDate(project));
    return Boolean(effectiveRemoval);
  }

  public static getRentalExpiryMilestone(remainingDays: number): RentalExpiryMilestone | null {
    if (remainingDays > 7) return null;
    if (remainingDays < 0) return 'OVERDUE';
    if (remainingDays === 0) return '0_DAYS';
    if (remainingDays === 1) return '1_DAY';
    return `${remainingDays}_DAYS` as RentalExpiryMilestone;
  }

  /**
   * Cancel outdated rental expiry reminder records if project becomes ineligible or removalDate changes.
   * Immediately evaluates and sends a due milestone if eligible and remainingDays <= 7.
   */
  public static syncProjectRentalExpiryInState(
    state: DatabaseState,
    project: Project,
    now: Date = new Date()
  ): number {
    if (!state.rentalExpiryReminders) state.rentalExpiryReminders = [];
    if (!state.notifications) state.notifications = [];

    const nowIso = now.toISOString();
    const eligible = this.isRentalExpiryEligible(project);
    const effectiveRemoval = eligible
      ? toDateOnlyString(getEffectiveRemovalDate(project))
      : '';

    for (const rec of state.rentalExpiryReminders) {
      if (
        rec.projectId === project.id &&
        rec.status === 'SENT' &&
        (!eligible || rec.removalDate !== effectiveRemoval)
      ) {
        rec.status = 'CANCELLED';
        rec.updatedAt = nowIso;
      }
    }

    if (!eligible || !effectiveRemoval) {
      return 0;
    }

    const todayIst = this.getIstParts(now).dateStr;
    const remainingDays = this.getRemainingDaysIst(effectiveRemoval, now);
    const milestone = this.getRentalExpiryMilestone(remainingDays);
    if (!milestone) {
      return 0;
    }

    const alreadySentMilestone = state.rentalExpiryReminders.some(
      (rec) =>
        rec.projectId === project.id &&
        rec.removalDate === effectiveRemoval &&
        rec.milestone === milestone &&
        rec.status === 'SENT'
    );

    const alreadySentToday = state.notifications.some(
      (n) =>
        n.entityType === 'PROJECT' &&
        n.entityId === project.id &&
        n.notificationDate === todayIst &&
        (n.title === 'Rental Expiry Alert' || n.title === 'Rental Period Overdue')
    );

    if (alreadySentMilestone || alreadySentToday) {
      return 0;
    }

    const installDate = getProjectInstallDateStr(project) || undefined;
    const siteAddr = project.siteAddress || project.siteName;
    const supervisor = project.supervisorName || undefined;
    const notifId = `notif-exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let title = 'Rental Expiry Alert';
    let message = `Rental Expiry Alert: Project ${project.projectCode} has only ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} remaining. Please coordinate with the customer regarding rental extension or material removal.`;
    let type: Notification['type'] = 'WARNING';

    if (milestone === 'OVERDUE') {
      title = 'Rental Period Overdue';
      message = `Project ${project.projectCode} – ${project.customerName} has exceeded its rental period. Please review the removal date.`;
      type = 'URGENT';
    }

    const notif: Notification = {
      id: notifId,
      roleTarget: 'ADMIN',
      title,
      message,
      type,
      entityType: 'PROJECT',
      entityId: project.id,
      projectCode: project.projectCode,
      customerName: project.customerName,
      siteAddress: siteAddr,
      installationDate: installDate,
      removalDate: effectiveRemoval,
      remainingDays,
      reminderMilestone: milestone,
      supervisorName: supervisor,
      notificationDate: this.getIstParts(now).dateStr,
      isRead: false,
      createdAt: nowIso,
    };

    state.notifications.unshift(notif);
    state.rentalExpiryReminders.unshift({
      id: `rem-exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectId: project.id,
      projectCode: project.projectCode,
      removalDate: effectiveRemoval,
      milestone,
      remainingDays,
      status: 'SENT',
      notificationId: notifId,
      sentAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return 1;
  }

  /**
   * Process all active projects for Rental Expiry milestones (7, 3, 1, 0, Overdue) in Asia/Kolkata.
   */
  public static async processDueRentalExpiryReminders(now: Date = new Date()): Promise<number> {
    return await dbStore.transaction(async (state) => {
      let sent = 0;
      for (const project of state.projects) {
        sent += this.syncProjectRentalExpiryInState(state, project, now);
      }
      return sent;
    });
  }

  /**
   * Generate an expected payment date reminder when todayIst >= expectedPaymentDate
   * and outstanding balance > 0 (one notification per project per IST calendar day).
   */
  public static syncProjectPaymentReminderInState(
    state: DatabaseState,
    project: Project,
    now: Date = new Date()
  ): number {
    if (!state.notifications) state.notifications = [];
    if (!project || project.status === 'CANCELLED') return 0;

    const balance = getProjectOutstandingBalance(project);
    const expectedDate = toDateOnlyString(project.expectedPaymentDate);
    if (balance <= 0 || !expectedDate) {
      return 0;
    }

    const { dateStr: todayIst } = this.getIstParts(now);
    if (todayIst < expectedDate) {
      return 0;
    }

    const alreadySentToday = state.notifications.some(
      (n) =>
        n.entityType === 'PROJECT' &&
        n.entityId === project.id &&
        n.title === 'Payment Reminder' &&
        n.notificationDate === todayIst
    );
    if (alreadySentToday) {
      return 0;
    }

    const isOverdue = todayIst > expectedDate;
    const formattedAmount = formatINR(balance, false);
    const message = isOverdue
      ? `Payment Reminder: The expected outstanding balance payment for Project ${project.projectCode} is overdue (due ${formatDate(expectedDate)}). Outstanding Amount: ${formattedAmount}.`
      : `Payment Reminder: The expected outstanding balance payment for Project ${project.projectCode} is due today. Outstanding Amount: ${formattedAmount}.`;

    const notif: Notification = {
      id: `notif-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      roleTarget: 'ADMIN',
      title: 'Payment Reminder',
      message,
      type: isOverdue ? 'URGENT' : 'WARNING',
      entityType: 'PROJECT',
      entityId: project.id,
      projectCode: project.projectCode,
      customerName: project.customerName,
      siteAddress: project.siteAddress || project.siteName,
      supervisorName: project.supervisorName || undefined,
      notificationDate: todayIst,
      isRead: false,
      createdAt: now.toISOString(),
    };

    state.notifications.unshift(notif);
    return 1;
  }

  /**
   * Process all projects with an expectedPaymentDate and pending balance in Asia/Kolkata.
   */
  public static async processDuePaymentReminders(now: Date = new Date()): Promise<number> {
    return await dbStore.transaction(async (state) => {
      let sent = 0;
      for (const project of state.projects) {
        sent += this.syncProjectPaymentReminderInState(state, project, now);
      }
      return sent;
    });
  }
}

