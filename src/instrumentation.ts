export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const globalForReminders = globalThis as unknown as {
      __alokhandwalaReminderTimer?: ReturnType<typeof setInterval>;
    };

    if (!globalForReminders.__alokhandwalaReminderTimer) {
      import('@/lib/services/reminder-service')
        .then(({ ReminderService }) => {
          ReminderService.syncAllAndProcessDueReminders().catch((err) => {
            console.error('[ReminderScheduler] Startup sync error:', err);
          });

          globalForReminders.__alokhandwalaReminderTimer = setInterval(() => {
            Promise.all([
              ReminderService.processDueInstallationReminders(),
              ReminderService.processDueRentalExpiryReminders(),
            ]).catch((err) => {
              console.error('[ReminderScheduler] Interval check error:', err);
            });
          }, 60_000);

          if (typeof globalForReminders.__alokhandwalaReminderTimer.unref === 'function') {
            globalForReminders.__alokhandwalaReminderTimer.unref();
          }
        })
        .catch((err) => {
          console.error('[ReminderScheduler] Failed to load ReminderService:', err);
        });
    }
  }
}

