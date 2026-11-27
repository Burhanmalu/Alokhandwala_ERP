export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Vercel serverless containers freeze immediately after returning an HTTP response.
    // Running un-awaited background DB transactions or setInterval timers in serverless
    // leaves PostgreSQL transactions in `idle in transaction`, blocking FOR UPDATE locks.
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return;
    }

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

