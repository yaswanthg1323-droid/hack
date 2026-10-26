import React, { useState } from 'react';

export default function AlarmModal({ alertData, onDismiss, onNavigateProfiles }) {
  const [copied, setCopied] = useState(false);

  if (!alertData) return null;

  const { nominee, phone, message, profile } = alertData;
  const hasNominee = !!(profile?.nomineeName || phone);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const smsUrl = phone ? `sms:${phone}?body=${encodeURIComponent(message)}` : '';

  return (
    <div className="alarm-overlay">
      <div className="alarm-card">
        <div className="alarm-header">
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
            🚨 MISSED DOSE ALARM
          </h2>
          <p style={{ margin: 'var(--space-1) 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
            A scheduled medication dose was not taken within the grace period.
          </p>
        </div>

        <div className="alarm-body">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-2)' }}>
            Alert Nominee
          </h3>

          {!hasNominee ? (
            <div className="alert alert-warning">
              <div>
                <strong>No Nominee Configured!</strong>
                <p style={{ marginTop: 'var(--space-1)', fontSize: '0.85rem' }}>
                  Please configure an emergency nominee with a phone number to send alerts.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Nominee: <strong>{nominee}</strong> ({phone || 'No phone number'})
              </p>

              <div className="message-preview">
                {message}
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            {hasNominee && phone && (
              <a
                href={smsUrl}
                className="btn btn-danger btn-lg btn-block"
                style={{ textAlign: 'center' }}
              >
                💬 Send SMS to {nominee}
              </a>
            )}

            {!hasNominee && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  onDismiss();
                  if (onNavigateProfiles) onNavigateProfiles();
                }}
              >
                👤 Add Nominee in Profiles
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={handleCopy}
            >
              {copied ? '✓ Message Copied!' : '📋 Copy Message'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={onDismiss}
            >
              Dismiss Alarm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
