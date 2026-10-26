import React from 'react';

export default function Header({ profiles = [], activeProfileId, onSelectProfile, onOpenSettings }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <h1 className="header-title">
          <span>🩺</span> AidKit
        </h1>
      </div>
      <div className="header-actions" id="header-actions">
        {profiles.length > 0 && (
          <div className="profile-select-wrapper">
            <select
              className="profile-select-header"
              value={activeProfileId || ''}
              onChange={(e) => onSelectProfile(Number(e.target.value))}
              aria-label="Switch Active Profile"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onOpenSettings}
          title="Settings & Testing"
          aria-label="Settings"
          style={{ padding: 'var(--space-1) var(--space-2)' }}
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
