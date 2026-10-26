import React from 'react';

export default function PrivacyNoticeModal({ isOpen, onAcknowledge }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="privacy-notice-title">
        <div className="modal-header">
          <h3 id="privacy-notice-title" className="modal-title">
            🔒 Privacy Notice
          </h3>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📱</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.6 }}>
            Your health data is stored only on this phone. Nothing is uploaded.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            AidKit works 100% offline with local IndexedDB storage. No servers, no tracking, and no external data sync.
          </p>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={onAcknowledge}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
