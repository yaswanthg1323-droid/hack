import { db, setActiveProfileId } from './db';

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function clearSampleData() {
  await db.transaction('rw', [db.profiles, db.medicines, db.doseLogs, db.alerts, db.settings], async () => {
    await db.profiles.filter((r) => r.sample === true).delete();
    await db.medicines.filter((r) => r.sample === true).delete();
    await db.doseLogs.filter((r) => r.sample === true).delete();
    await db.alerts.filter((r) => r.sample === true).delete();

    const activeSetting = await db.settings.get('activeProfileId');
    if (activeSetting?.value) {
      const exists = await db.profiles.get(Number(activeSetting.value));
      if (!exists) {
        const remaining = await db.profiles.toCollection().first();
        if (remaining) {
          await db.settings.put({ key: 'activeProfileId', value: remaining.id });
        } else {
          await db.settings.delete('activeProfileId');
        }
      }
    }
  });
}

export async function loadSampleData() {
  // Idempotent: clear sample rows first
  await clearSampleData();

  const now = new Date();
  const todayStr = formatDate(now);

  // Compute Ravi's 4 daily dose times relative to current moment
  const amlodipineDate = new Date(now.getTime() - 90 * 60 * 1000);
  const metf1Date = new Date(now.getTime() - 45 * 60 * 1000);
  const atorvaDate = new Date(now.getTime() + 1 * 60 * 1000);
  const metf2Date = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const tAmlodipine = formatTime(amlodipineDate);
  const tMetf1 = formatTime(metf1Date);
  const tAtorva = formatTime(atorvaDate);
  const tMetf2 = formatTime(metf2Date);

  let raviId, lakshmiId, demoId;
  let raviMeds = {}, lakshmiMeds = {}, demoMeds = {};

  await db.transaction('rw', [db.profiles, db.medicines, db.doseLogs, db.alerts, db.settings], async () => {
    // 1. Profiles
    raviId = await db.profiles.add({
      name: 'Ravi Kumar',
      age: 68,
      bloodGroup: 'B+',
      allergies: 'Penicillin',
      conditions: 'Hypertension, Type 2 diabetes',
      nomineeName: 'Anitha Kumar',
      nomineeRelation: 'Daughter',
      nomineePhone: '+91 90000 00001',
      sample: true
    });

    lakshmiId = await db.profiles.add({
      name: 'Lakshmi Devi',
      age: 64,
      bloodGroup: 'O+',
      allergies: 'None known',
      conditions: 'Arthritis',
      nomineeName: 'Suresh Devi',
      nomineeRelation: 'Son',
      nomineePhone: '+91 90000 00002',
      sample: true
    });

    demoId = await db.profiles.add({
      name: 'Demo User',
      age: 21,
      bloodGroup: 'O+',
      allergies: 'None known',
      conditions: 'None',
      nomineeName: 'Friend',
      nomineeRelation: 'Friend',
      nomineePhone: '+91 90000 00003',
      sample: true
    });

    // 2. Medicines
    // Ravi
    raviMeds.amlodipine = await db.medicines.add({
      profileId: raviId,
      name: 'Amlodipine',
      dose: '5 mg (1 tablet)',
      times: [tAmlodipine],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '1x/day, after breakfast',
      sample: true
    });

    raviMeds.metformin = await db.medicines.add({
      profileId: raviId,
      name: 'Metformin',
      dose: '500 mg (1 tablet)',
      times: [tMetf1, tMetf2],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '2x/day, after food',
      sample: true
    });

    raviMeds.atorvastatin = await db.medicines.add({
      profileId: raviId,
      name: 'Atorvastatin',
      dose: '10 mg (1 tablet)',
      times: [tAtorva],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '1x/day, night',
      sample: true
    });

    // Lakshmi
    lakshmiMeds.calcium = await db.medicines.add({
      profileId: lakshmiId,
      name: 'Calcium',
      dose: '500 mg (1 tablet)',
      times: ['09:00', '21:00'],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '',
      sample: true
    });

    lakshmiMeds.paracetamol = await db.medicines.add({
      profileId: lakshmiId,
      name: 'Paracetamol',
      dose: '500 mg (1 tablet)',
      times: ['14:00'],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: 'only if pain',
      sample: true
    });

    // Demo User
    demoMeds.vitaminD = await db.medicines.add({
      profileId: demoId,
      name: 'Vitamin D3',
      dose: '1000 IU (1 capsule)',
      times: ['09:00'],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '',
      sample: true
    });

    demoMeds.cetirizine = await db.medicines.add({
      profileId: demoId,
      name: 'Cetirizine',
      dose: '10 mg (1 tablet)',
      times: ['22:00'],
      startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      endDate: '',
      notes: '',
      sample: true
    });

    // 3. Ravi's Live Demo Schedule for TODAY
    // - Amlodipine = now - 90 min (status taken, takenAt = scheduled + 10 min)
    await db.doseLogs.add({
      profileId: raviId,
      medicineId: raviMeds.amlodipine,
      scheduledAt: `${todayStr}T${tAmlodipine}:00`,
      status: 'taken',
      takenAt: new Date(amlodipineDate.getTime() + 10 * 60 * 1000).toISOString(),
      sample: true
    });

    // - Metformin (first dose) = now - 45 min (status missed)
    const metf1Sched = `${todayStr}T${tMetf1}:00`;
    await db.doseLogs.add({
      profileId: raviId,
      medicineId: raviMeds.metformin,
      scheduledAt: metf1Sched,
      status: 'missed',
      takenAt: null,
      sample: true
    });

    // Create alerts row for Metformin first dose so engine does not alert again
    await db.alerts.add({
      profileId: raviId,
      medicineId: raviMeds.metformin,
      scheduledAt: metf1Sched,
      sentAt: new Date(metf1Date.getTime() + 32 * 60 * 1000).toISOString(),
      message: `Hi Anitha, Ravi Kumar has not taken Metformin (500 mg (1 tablet)) scheduled at ${tMetf1}. Please check on them.`,
      channel: 'sms',
      sample: true
    });

    // - Atorvastatin = now + 1 min (status upcoming / due soon)
    await db.doseLogs.add({
      profileId: raviId,
      medicineId: raviMeds.atorvastatin,
      scheduledAt: `${todayStr}T${tAtorva}:00`,
      status: 'upcoming',
      takenAt: null,
      sample: true
    });

    // - Metformin (second dose) = now + 3 hours (upcoming)
    await db.doseLogs.add({
      profileId: raviId,
      medicineId: raviMeds.metformin,
      scheduledAt: `${todayStr}T${tMetf2}:00`,
      status: 'upcoming',
      takenAt: null,
      sample: true
    });

    // 4. History: past 7 days for every medicine at scheduled times
    const allMedsList = [
      { id: raviMeds.amlodipine, profileId: raviId, times: [tAmlodipine], isMetf: false },
      { id: raviMeds.metformin, profileId: raviId, times: [tMetf1, tMetf2], isMetf: true },
      { id: raviMeds.atorvastatin, profileId: raviId, times: [tAtorva], isMetf: false },
      { id: lakshmiMeds.calcium, profileId: lakshmiId, times: ['09:00', '21:00'], isMetf: false },
      { id: lakshmiMeds.paracetamol, profileId: lakshmiId, times: ['14:00'], isMetf: false },
      { id: demoMeds.vitaminD, profileId: demoId, times: ['09:00'], isMetf: false },
      { id: demoMeds.cetirizine, profileId: demoId, times: ['22:00'], isMetf: false }
    ];

    for (let d = 1; d <= 7; d++) {
      const pastDay = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const pStr = formatDate(pastDay);

      for (const m of allMedsList) {
        for (let idx = 0; idx < m.times.length; idx++) {
          const t = m.times[idx];
          const schedIso = `${pStr}T${t}:00`;
          const schedTime = new Date(`${pStr}T${t}:00`);

          let status = 'taken';
          let takenAt = new Date(schedTime.getTime() + ((d * 5 + idx * 7) % 25) * 60 * 1000).toISOString();

          // Ravi's evening Metformin missed 2 days ago and 5 days ago
          if (m.isMetf && m.profileId === raviId && idx === 1 && (d === 2 || d === 5)) {
            status = 'missed';
            takenAt = null;
          } else if ((d + idx) % 7 === 0) {
            // ~15% missed overall for adherence around 85%
            status = 'missed';
            takenAt = null;
          }

          await db.doseLogs.add({
            profileId: m.profileId,
            medicineId: m.id,
            scheduledAt: schedIso,
            status,
            takenAt,
            sample: true
          });
        }
      }
    }

    // 5. Alert History (3 specified rows)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgoStr = formatDate(twoDaysAgo);
    await db.alerts.add({
      profileId: raviId,
      medicineId: raviMeds.metformin,
      scheduledAt: `${twoDaysAgoStr}T20:30:00`,
      sentAt: new Date(new Date(`${twoDaysAgoStr}T20:30:00`).getTime() + 32 * 60 * 1000).toISOString(),
      message: 'Hi Anitha, Ravi Kumar has not taken Metformin (500 mg, 1 tablet) scheduled at 8:30 PM. Please check on them.',
      channel: 'sms',
      sample: true
    });

    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fiveDaysAgoStr = formatDate(fiveDaysAgo);
    await db.alerts.add({
      profileId: raviId,
      medicineId: raviMeds.metformin,
      scheduledAt: `${fiveDaysAgoStr}T20:30:00`,
      sentAt: new Date(new Date(`${fiveDaysAgoStr}T20:30:00`).getTime() + 32 * 60 * 1000).toISOString(),
      message: 'Hi Anitha, Ravi Kumar has not taken Metformin (500 mg, 1 tablet) scheduled at 8:30 PM. Please check on them.',
      channel: 'sms',
      sample: true
    });

    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDate(yesterday);
    await db.alerts.add({
      profileId: lakshmiId,
      medicineId: lakshmiMeds.calcium,
      scheduledAt: `${yesterdayStr}T09:00:00`,
      sentAt: new Date(new Date(`${yesterdayStr}T09:00:00`).getTime() + 32 * 60 * 1000).toISOString(),
      message: 'Hi Suresh, Lakshmi Devi has not taken Calcium (500 mg, 1 tablet) scheduled at 9:00 AM. Please check on them.',
      channel: 'sms',
      sample: true
    });

    // 6. Settings
    await db.settings.put({ key: 'emergencyNumber', value: '112' });
    await db.settings.put({ key: 'graceMinutes', value: 30 });
    await db.settings.put({ key: 'demoMode', value: false });
  });

  // Set Ravi as active profile after loading
  if (raviId) {
    await setActiveProfileId(raviId);
  }
}
