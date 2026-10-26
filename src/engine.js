import { db } from './db';

export function playAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playBeep = (time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, time);
      gain.setValueAtTime(0.3, time);
      gain.exponentialRampToValueAtTime(0.01, time + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.25);
    };
    const now = ctx.currentTime;
    playBeep(now);
    playBeep(now + 0.35);
    playBeep(now + 0.7);
  } catch (e) {
    console.warn('Audio play error', e);
  }
}

export async function checkMissedDoses(onAlertTriggered) {
  try {
    const demoSetting = await db.settings.get('demoMode');
    const isDemo = !!(demoSetting && demoSetting.value);
    const graceSetting = await db.settings.get('graceMinutes');
    const graceMinutes = isDemo ? 1 : (graceSetting ? Number(graceSetting.value) || 30 : 30);

    const now = Date.now();
    const allLogs = await db.doseLogs.toArray();

    for (const log of allLogs) {
      if (log.takenAt || log.status === 'taken') continue;

      const schedTime = new Date(log.scheduledAt).getTime();
      const missedThreshold = schedTime + graceMinutes * 60 * 1000;

      if (now > missedThreshold) {
        if (log.status !== 'missed') {
          await db.doseLogs.update(log.id, { status: 'missed' });
        }

        // Never alert twice for the same dose
        const existingAlert = await db.alerts
          .where('medicineId')
          .equals(log.medicineId)
          .and((a) => a.profileId === log.profileId && a.scheduledAt === log.scheduledAt)
          .first();

        if (!existingAlert) {
          const profile = await db.profiles.get(log.profileId);
          const medicine = await db.medicines.get(log.medicineId);

          const nominee = profile?.nomineeName || 'Caregiver';
          const name = profile?.name || 'Patient';
          const medName = medicine?.name || 'Medication';
          const dose = medicine?.dose || '';
          const schedDate = new Date(log.scheduledAt);
          const timeStr = schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

          const message = `Hi ${nominee}, ${name} has not taken ${medName} (${dose}) scheduled at ${timeStr}. Please check on them.`;

          const alertId = await db.alerts.add({
            profileId: log.profileId,
            medicineId: log.medicineId,
            scheduledAt: log.scheduledAt,
            sentAt: new Date().toISOString(),
            message
          });

          playAlarmSound();
          if (navigator.vibrate) {
            navigator.vibrate([400, 200, 400, 200, 600]);
          }
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('AidKit: Missed Dose Alert', {
                body: message,
                icon: '/vite.svg'
              });
            } catch (err) {
              console.warn('Notification error', err);
            }
          }

          if (onAlertTriggered) {
            onAlertTriggered({
              id: alertId,
              profile,
              medicine,
              log,
              message,
              timeStr,
              nominee,
              phone: profile?.nomineePhone || ''
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Check missed doses error:', err);
  }
}

export function startEngine(onAlertTriggered) {
  // Run on start
  checkMissedDoses(onAlertTriggered);

  // Every 30s while open
  const interval = setInterval(() => {
    checkMissedDoses(onAlertTriggered);
  }, 30000);

  // On visibilitychange
  const handleVisibility = () => {
    if (!document.hidden) {
      checkMissedDoses(onAlertTriggered);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
