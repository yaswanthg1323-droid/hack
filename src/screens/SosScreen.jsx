import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import firstAidTopics from '../data/firstaid.json';
import FirstAidCard from '../components/FirstAidCard';

export default function SosScreen({ activeProfile, onNavigateProfiles, onOpenSettings, onNavigateAsk }) {
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedAlertId, setCopiedAlertId] = useState(null);
  const [activeFirstAidTopic, setActiveFirstAidTopic] = useState(null);

  const emergencySetting = useLiveQuery(() => db.settings.get('emergencyNumber'), []);
  const emergencyNumber = emergencySetting?.value || '112';

  const defaultNumbers = [
    { id: '112', label: 'National emergency', number: '112' },
    { id: '108', label: 'Ambulance', number: '108' }
  ];

  const numbersSetting = useLiveQuery(() => db.settings.get('emergencyNumbersList'), []);
  const emergencyList = numbersSetting?.value || defaultNumbers;

  const [editingNumberId, setEditingNumberId] = useState(null);
  const [editNumberVal, setEditNumberVal] = useState({ label: '', number: '' });

  const handleStartEditNumber = (item) => {
    setEditingNumberId(item.id);
    setEditNumberVal({ label: item.label, number: item.number });
  };

  const handleSaveNumber = async (id) => {
    const updated = emergencyList.map((item) =>
      item.id === id ? { ...item, label: editNumberVal.label, number: editNumberVal.number } : item
    );
    await db.settings.put({ key: 'emergencyNumbersList', value: updated });
    setEditingNumberId(null);
  };

  const medicines = useLiveQuery(
    () => (activeProfile?.id ? db.medicines.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const alerts = useLiveQuery(
    () =>
      activeProfile?.id
        ? db.alerts.where('profileId').equals(activeProfile.id).reverse().sortBy('sentAt')
        : db.alerts.reverse().sortBy('sentAt'),
    [activeProfile?.id]
  );

  const medicinesSummary = medicines && medicines.length > 0
    ? medicines.map((m) => `${m.name} (${m.dose || 'Standard dose'})`).join(', ')
    : 'None recorded';

  const emergencyCardText = activeProfile
    ? `EMERGENCY MEDICAL ID
Name: ${activeProfile.name}
Age: ${activeProfile.age || 'N/A'}
Blood Group: ${activeProfile.bloodGroup || 'Unknown'}
Allergies: ${activeProfile.allergies || 'None declared'}
Medical Conditions: ${activeProfile.conditions || 'None declared'}
Current Medicines: ${medicinesSummary}
Emergency Contact: ${activeProfile.nomineeName || 'N/A'} (${activeProfile.nomineePhone || 'No phone'})`
    : 'No active profile available.';

  const handleShareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Emergency Medical Card - ${activeProfile?.name || 'AidKit'}`,
          text: emergencyCardText
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(emergencyCardText);
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2500);
    } catch (e) {
      console.warn('Share/copy failed', e);
    }
  };

  const handleCopyAlert = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAlertId(id);
      setTimeout(() => setCopiedAlertId(null), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all logged alert history?')) {
      if (activeProfile?.id) {
        await db.alerts.where('profileId').equals(activeProfile.id).delete();
      } else {
        await db.alerts.clear();
      }
    }
  };

  const nomineeSmsText = activeProfile
    ? `EMERGENCY: Urgent message from ${activeProfile.name}. I need immediate medical assistance or help. Please check on me or call right away.`
    : '';

  const nomineeSmsUrl = activeProfile?.nomineePhone
    ? `sms:${activeProfile.nomineePhone}?body=${encodeURIComponent(nomineeSmsText)}`
    : '';

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Emergency SOS</h2>
          {activeProfile && <span className="badge badge-primary">{activeProfile.name}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {onNavigateAsk && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onNavigateAsk}
            >
              💬 Ask AidKit
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenSettings}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Prominent Emergency Dial Button */}
      <div className="card card-accent-danger" style={{ backgroundColor: 'var(--color-danger-light)' }}>
        <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <h3 style={{ color: 'var(--color-danger)', fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            IMMEDIATE EMERGENCY ASSISTANCE
          </h3>
          <p style={{ color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
            One-touch direct dial for ambulance and emergency responders.
          </p>

          <a
            href={`tel:${emergencyNumber}`}
            className="btn btn-danger btn-lg btn-block"
            style={{
              fontSize: '1.35rem',
              padding: 'var(--space-4)',
              fontWeight: 800,
              boxShadow: 'var(--shadow-lg)',
              textDecoration: 'none'
            }}
          >
            🚨 CALL EMERGENCY ({emergencyNumber})
          </a>
        </div>
      </div>

      {/* Emergency First Aid Quick Guides */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🩹 Emergency First Aid Guides</h3>
          <span className="badge badge-primary">Voice Guided</span>
        </div>
        <div className="card-body">
          {activeFirstAidTopic ? (
            <FirstAidCard
              topic={activeFirstAidTopic}
              onBack={() => setActiveFirstAidTopic(null)}
            />
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                Audio-guided instructions to follow while awaiting ambulance or emergency arrival:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                {firstAidTopics.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontWeight: 600, textAlign: 'left', padding: 'var(--space-2)' }}
                    onClick={() => setActiveFirstAidTopic(t)}
                  >
                    🩹 {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Numbers List (Tap-to-call & Editable) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📞 Emergency Numbers</h3>
          <span className="badge badge-primary">Tap to Call</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {emergencyList.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}
              >
                {editingNumberId === item.id ? (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      style={{ flex: 1 }}
                      value={editNumberVal.label}
                      onChange={(e) => setEditNumberVal({ ...editNumberVal, label: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-control"
                      style={{ width: '6rem' }}
                      value={editNumberVal.number}
                      onChange={(e) => setEditNumberVal({ ...editNumberVal, number: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveNumber(item.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setEditingNumberId(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{item.label}</strong>
                      <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                        ({item.number})
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <a
                        href={`tel:${item.number}`}
                        className="btn btn-danger btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        📞 Call {item.number}
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleStartEditNumber(item)}
                      >
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nominee SMS Alert Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📱 Emergency Nominee Contact</h3>
          {activeProfile?.nomineePhone ? (
            <span className="badge badge-success">Configured</span>
          ) : (
            <span className="badge badge-warning">Missing</span>
          )}
        </div>
        <div className="card-body">
          {activeProfile?.nomineePhone ? (
            <div>
              <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
                Nominee: <strong>{activeProfile.nomineeName}</strong> ({activeProfile.nomineeRelation || 'Contact'}) —{' '}
                <a href={`tel:${activeProfile.nomineePhone}`} style={{ color: 'var(--color-primary)' }}>
                  {activeProfile.nomineePhone}
                </a>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <a
                  href={nomineeSmsUrl}
                  className="btn btn-primary btn-block"
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  💬 Send SOS SMS
                </a>
                <a
                  href={`tel:${activeProfile.nomineePhone}`}
                  className="btn btn-outline btn-block"
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  📞 Call Nominee
                </a>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
              <div>
                <strong>No Nominee Set</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 'var(--space-1)' }}>
                  Add a nominee in Profiles to enable one-touch emergency SMS and missed dose alerts.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onNavigateProfiles}
              >
                + Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Card */}
      <div className="card card-accent-primary">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h3 className="card-title">🪪 Emergency Medical ID Card</h3>
            {activeProfile?.bloodGroup && (
              <span className="badge badge-danger">{activeProfile.bloodGroup}</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleShareCard}
          >
            {copiedCard ? '✓ Copied!' : '🔗 Share Card'}
          </button>
        </div>

        <div className="card-body">
          {!activeProfile ? (
            <div className="alert alert-warning">Please select or create an active profile.</div>
          ) : (
            <>
              <div className="profile-meta-grid" style={{ marginTop: 0 }}>
                <div className="meta-item">
                  <span className="meta-label">Full Name</span>
                  <span className="meta-value">{activeProfile.name}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Age</span>
                  <span className="meta-value">{activeProfile.age || '—'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Blood Group</span>
                  <span className="meta-value">{activeProfile.bloodGroup || '—'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Known Allergies</span>
                  <span className="meta-value" style={{ color: activeProfile.allergies ? 'var(--color-danger)' : 'inherit' }}>
                    {activeProfile.allergies || 'None'}
                  </span>
                </div>
              </div>

              <div style={{ margin: 'var(--space-2) 0', fontSize: '0.85rem' }}>
                <span className="meta-label">Medical Conditions:</span>
                <span className="meta-value">{activeProfile.conditions || 'None declared'}</span>
              </div>

              <div style={{ margin: 'var(--space-2) 0', fontSize: '0.85rem' }}>
                <span className="meta-label">Current Medications:</span>
                <span className="meta-value">{medicinesSummary}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alert History */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h3 className="card-title">📋 Alert History</h3>
            <span className="badge badge-primary">{alerts?.length || 0}</span>
          </div>
          {alerts && alerts.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleClearHistory}
            >
              Clear History
            </button>
          )}
        </div>

        <div className="card-body">
          {!alerts || alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
              <div className="empty-state-icon" style={{ fontSize: '1.75rem' }}>📭</div>
              <h4 className="empty-state-title" style={{ fontSize: '0.95rem' }}>No Alerts Dispatched</h4>
              <p className="empty-state-text" style={{ fontSize: '0.8rem', margin: 0 }}>
                Alerts dispatched for missed doses will be logged here.
              </p>
            </div>
          ) : (
            alerts.map((al) => {
              const dateStr = new Date(al.sentAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              const smsUrl = activeProfile?.nomineePhone
                ? `sms:${activeProfile.nomineePhone}?body=${encodeURIComponent(al.message)}`
                : '';

              return (
                <div
                  key={al.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 'var(--space-3)',
                    marginBottom: 'var(--space-3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                    <span className="badge badge-danger">Missed Dose Alert</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {dateStr}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', margin: 'var(--space-1) 0' }}>
                    {al.message}
                  </p>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {smsUrl && (
                      <a href={smsUrl} className="btn btn-outline btn-sm">
                        💬 Resend SMS
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleCopyAlert(al.id, al.message)}
                    >
                      {copiedAlertId === al.id ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
