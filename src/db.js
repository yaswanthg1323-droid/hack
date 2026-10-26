import Dexie from 'dexie';

export const db = new Dexie('AidKitDB');

db.version(1).stores({
  profiles: '++id, name, age, bloodGroup, allergies, conditions, nomineeName, nomineePhone, nomineeRelation',
  medicines: '++id, profileId, name, dose, *times, startDate, endDate, notes',
  doseLogs: '++id, medicineId, profileId, scheduledAt, status, takenAt, [profileId+scheduledAt]',
  alerts: '++id, profileId, medicineId, scheduledAt, sentAt, message',
  settings: 'key, value'
});

export async function isIndexedDBAvailable() {
  try {
    if (!window.indexedDB) return false;
    const testName = '__idb_test__';
    const req = window.indexedDB.open(testName);
    return await new Promise((resolve) => {
      req.onsuccess = () => {
        try {
          req.result.close();
          window.indexedDB.deleteDatabase(testName);
        } catch {}
        resolve(true);
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getActiveProfileId() {
  const setting = await db.settings.get('activeProfileId');
  if (setting && setting.value) {
    const profile = await db.profiles.get(Number(setting.value));
    if (profile) return Number(setting.value);
  }
  const firstProfile = await db.profiles.toCollection().first();
  if (firstProfile) {
    await setActiveProfileId(firstProfile.id);
    return firstProfile.id;
  }
  return null;
}

export async function setActiveProfileId(profileId) {
  await db.settings.put({ key: 'activeProfileId', value: Number(profileId) });
}

export async function initStoragePersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      const val = isPersisted ? 'Yes' : 'No';
      await db.settings.put({ key: 'storagePersisted', value: val });
      return val;
    } catch {
      await db.settings.put({ key: 'storagePersisted', value: 'No' });
      return 'No';
    }
  } else {
    await db.settings.put({ key: 'storagePersisted', value: 'No' });
    return 'No';
  }
}

export async function exportBackup() {
  const [profiles, medicines, doseLogs, alerts, settings] = await Promise.all([
    db.profiles.toArray(),
    db.medicines.toArray(),
    db.doseLogs.toArray(),
    db.alerts.toArray(),
    db.settings.toArray()
  ]);

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    medicines,
    doseLogs,
    alerts,
    settings
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `aidkit-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Invalid backup file: not a JSON object.');
  }

  if (!Array.isArray(jsonData.profiles) || !Array.isArray(jsonData.medicines)) {
    throw new Error('Invalid backup structure: missing profiles or medicines arrays.');
  }

  await db.transaction('rw', [db.profiles, db.medicines, db.doseLogs, db.alerts, db.settings], async () => {
    await db.profiles.clear();
    await db.medicines.clear();
    await db.doseLogs.clear();
    await db.alerts.clear();
    await db.settings.clear();

    if (jsonData.profiles?.length) await db.profiles.bulkAdd(jsonData.profiles);
    if (jsonData.medicines?.length) await db.medicines.bulkAdd(jsonData.medicines);
    if (jsonData.doseLogs?.length) await db.doseLogs.bulkAdd(jsonData.doseLogs);
    if (jsonData.alerts?.length) await db.alerts.bulkAdd(jsonData.alerts);
    if (jsonData.settings?.length) await db.settings.bulkAdd(jsonData.settings);
  });
}

export async function deleteAllData() {
  await db.transaction('rw', [db.profiles, db.medicines, db.doseLogs, db.alerts, db.settings], async () => {
    await db.profiles.clear();
    await db.medicines.clear();
    await db.doseLogs.clear();
    await db.alerts.clear();
    await db.settings.clear();
  });
}
