import React, { useState, useEffect, useRef } from 'react';
import { db, exportBackup, importBackup, deleteAllData } from '../db';
import { loadSampleData, clearSampleData } from '../seed';

export default function SettingsModal({ isOpen, onClose, activeProfile, onTriggerCheck, onDataReset }) {
  const [demoMode, setDemoMode] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState(30);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [testStatus, setTestStatus] = useState('');
  const [emergencyNumber, setEmergencyNumber] = useState('112');
  const [storagePersisted, setStoragePersisted] = useState('Checking...');
  const [backupStatus, setBackupStatus] = useState('');
  const [sampleStatus, setSampleStatus] = useState('');
  const [autoReadFirstAid, setAutoReadFirstAid] = useState(true);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadSettings = async () => {
      const demo = await db.settings.get('demoMode');
      setDemoMode(!!(demo && demo.value));

      const grace = await db.settings.get('graceMinutes');
      setGraceMinutes(grace ? Number(grace.value) : 30);

      const emNum = await db.settings.get('emergencyNumber');
      setEmergencyNumber(emNum?.value || '112');

      const autoRead = await db.settings.get('autoReadFirstAid');
      setAutoReadFirstAid(autoRead ? autoRead.value !== false : true);

      const spd = await db.settings.get('speechSpeed');
      setSpeechSpeed(spd ? Number(spd.value) || 1.0 : 1.0);

      const persistedSetting = await db.settings.get('storagePersisted');
      if (persistedSetting) {
        setStoragePersisted(persistedSetting.value);
      } else if (navigator.storage && navigator.storage.persisted) {
        const isP = await navigator.storage.persisted();
        setStoragePersisted(isP ? 'Yes' : 'No');
      } else {
        setStoragePersisted('No');
      }
    };
    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDemo = async (checked) => {
    setDemoMode(checked);
    await db.settings.put({ key: 'demoMode', value: checked });
    if (onTriggerCheck) onTriggerCheck();
  };

  const handleSaveGrace = async (val) => {
    const num = Math.max(1, Number(val) || 1);
    setGraceMinutes(num);
    await db.settings.put({ key: 'graceMinutes', value: num });
  };

  const handleRequestNotif = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const handleAddTestDose = async () => {
    if (!activeProfile?.id) {
      setTestStatus('Please create or select an active profile first.');
      return;
    }

    try {
      let testMed = await db.medicines
        .where('profileId')
        .equals(activeProfile.id)
        .and((m) => m.name === 'Test Medication')
        .first();

      if (!testMed) {
        const medId = await db.medicines.add({
          profileId: activeProfile.id,
          name: 'Test Medication',
          dose: '1 Test Dose',
          times: ['12:00'],
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          notes: 'Auto-generated for alert testing'
        });
        testMed = await db.medicines.get(medId);
      }

      const currentGrace = demoMode ? 1 : graceMinutes;
      const scheduledMs = Date.now() + 60 * 1000 - currentGrace * 60 * 1000;
      const scheduledIso = new Date(scheduledMs).toISOString();

      await db.doseLogs.add({
        medicineId: testMed.id,
        profileId: activeProfile.id,
        scheduledAt: scheduledIso,
        status: 'upcoming',
        takenAt: null
      });

      setTestStatus('✓ Test dose added! Will trigger missed alert in 1 minute.');
      if (onTriggerCheck) onTriggerCheck();
      setTimeout(() => setTestStatus(''), 4000);
    } catch (e) {
      console.error(e);
      setTestStatus('Failed to add test dose.');
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportBackup();
      setBackupStatus('✓ Backup downloaded successfully!');
      setTimeout(() => setBackupStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setBackupStatus('Export failed.');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!window.confirm('Importing this backup will restore all profiles, medicines, and logs. Existing data will be replaced. Proceed?')) {
        e.target.value = '';
        return;
      }

      await importBackup(json);
      setBackupStatus('✓ Backup restored successfully!');
      if (onDataReset) onDataReset();
      setTimeout(() => setBackupStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Error importing backup: ' + (err.message || 'Invalid format'));
    } finally {
      e.target.value = '';
    }
  };

  const handleLoadSample = async () => {
    try {
      await loadSampleData();
      setSampleStatus('✓ Sample dataset loaded successfully!');
      if (onDataReset) onDataReset();
      if (onTriggerCheck) onTriggerCheck();
      setTimeout(() => setSampleStatus(''), 3000);
    } catch (e) {
      console.error(e);
      setSampleStatus('Failed to load sample data.');
    }
  };

  const handleClearSample = async () => {
    try {
      await clearSampleData();
      setSampleStatus('✓ Sample data removed.');
      if (onDataReset) onDataReset();
      setTimeout(() => setSampleStatus(''), 3000);
    } catch (e) {
      console.error(e);
      setSampleStatus('Failed to clear sample data.');
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to permanently delete ALL profiles, medicines, logs, and settings from this device? This action cannot be undone.'
    );
    if (!confirmed) return;

    await deleteAllData();
    if (onDataReset) onDataReset();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">⚙️ AidKit Settings</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label="Close Settings">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Privacy Section (Mandatory Brand Card) */}
          <div className="card card-accent-primary" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="card-header">
              <h4 className="card-title" style={{ fontSize: '1rem' }}>
                🔒 Privacy & Data Storage
              </h4>
              <span className="badge badge-success">Local Only</span>
            </div>
            <div className="card-body">
              <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
                Your health data is stored only on this phone. Nothing is uploaded.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                AidKit operates 100% offline using IndexedDB on your device. No cloud storage, tracking, or network transmission.
              </p>
              <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem' }}>
                Storage Persisted:{' '}
                <strong style={{ color: storagePersisted === 'Yes' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {storagePersisted}
                </strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleExportBackup}
                >
                  📥 Export Backup
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📤 Import Backup
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />

              {backupStatus && (
                <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  {backupStatus}
                </p>
              )}

              <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm btn-block"
                  onClick={handleDeleteAll}
                >
                  🗑️ Delete All My Data
                </button>
              </div>
            </div>
          </div>

          {/* Demo tools (collapsed section) */}
          <details className="card" style={{ marginBottom: 'var(--space-3)' }}>
            <summary style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, cursor: 'pointer', listStyle: 'revert' }}>
              🧪 Demo tools
            </summary>
            <div className="card-body" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
              <div className="alert alert-warning" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
                ⚠️ <strong>Sample data is fake and only for demos.</strong>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                Populates Ravi Kumar (active), Lakshmi Devi, Demo User, 7-day adherence logs, and 4 today dose states.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleLoadSample}
                >
                  Load sample data
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleClearSample}
                >
                  Clear sample data
                </button>
              </div>

              {sampleStatus && (
                <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  {sampleStatus}
                </p>
              )}

              <div className="divider-top" style={{ marginTop: 'var(--space-3)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={demoMode}
                    onChange={(e) => handleToggleDemo(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Demo Mode (Grace = 1 minute)</span>
                </label>
                <p className="form-hint">
                  Alerts fire after just 1 minute of a missed dose instead of the standard grace period.
                </p>

                <div style={{ marginTop: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-block"
                    onClick={handleAddTestDose}
                  >
                    ⏱ Add Test Dose Due in 1 Minute
                  </button>
                  {testStatus && (
                    <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                      {testStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </details>

          <div className="form-group">
            <label className="form-label">Emergency Call Number</label>
            <input
              type="text"
              className="form-control"
              value={emergencyNumber}
              onChange={async (e) => {
                setEmergencyNumber(e.target.value);
                await db.settings.put({ key: 'emergencyNumber', value: e.target.value });
              }}
              placeholder="e.g. 112 or 911"
            />
            <p className="form-hint">
              Number dialed by the prominent SOS button (default 112).
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Normal Grace Period (Minutes)</label>
            <input
              type="number"
              min="1"
              max="180"
              disabled={demoMode}
              className="form-control"
              value={graceMinutes}
              onChange={(e) => handleSaveGrace(e.target.value)}
            />
            <p className="form-hint">
              Minutes after scheduled time before a dose is marked missed and alerts nominee (default 30).
            </p>
          </div>

          {/* First-Aid Voice Guide */}
          <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="card-header">
              <h4 className="card-title" style={{ fontSize: '1rem' }}>
                🔊 First-Aid Voice Guide
              </h4>
              <span className="badge badge-primary">On-Device TTS</span>
            </div>
            <div className="card-body">
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={autoReadFirstAid}
                  onChange={async (e) => {
                    setAutoReadFirstAid(e.target.checked);
                    await db.settings.put({ key: 'autoReadFirstAid', value: e.target.checked });
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Read aloud automatically</span>
              </label>
              <p className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
                Automatically reads step-by-step instructions aloud when opening a first-aid guide card.
              </p>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.875rem' }}>Default Speech Speed</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[0.8, 1.0, 1.2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      className={`btn btn-sm ${speechSpeed === spd ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1 }}
                      onClick={async () => {
                        setSpeechSpeed(spd);
                        await db.settings.put({ key: 'speechSpeed', value: spd });
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Push Notifications</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem' }}>
                Status: <strong>{notifPermission}</strong>
              </span>
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleRequestNotif}
                >
                  Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
