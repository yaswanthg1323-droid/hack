import React from 'react';

const TABS = [
  { id: 'today', label: 'Today', icon: '📅' },
  { id: 'meds', label: 'Meds', icon: '💊' },
  { id: 'ask', label: 'Ask', icon: '💬' },
  { id: 'firstaid', label: 'First Aid', icon: '🩹' },
  { id: 'sos', label: 'SOS', icon: '🚨' },
  { id: 'profiles', label: 'Profiles', icon: '👤' }
];

export default function Nav({ activeTab, onSelectTab }) {
  return (
    <nav className="app-nav" id="app-nav">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
