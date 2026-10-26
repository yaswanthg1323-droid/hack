import React, { useState, useEffect } from 'react';
import { db, setActiveProfileId, initStoragePersistence, isIndexedDBAvailable } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import Header from './components/Header';
import Nav from './components/Nav';
import TodayScreen from './screens/TodayScreen';
import MedsScreen from './screens/MedsScreen';
import FirstAidScreen from './screens/FirstAidScreen';
import SosScreen from './screens/SosScreen';
import ProfilesScreen from './screens/ProfilesScreen';
import AskScreen from './screens/AskScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import AlarmModal from './components/AlarmModal';
import SettingsModal from './components/SettingsModal';
import PrivacyNoticeModal from './components/PrivacyNoticeModal';
import { startEngine, checkMissedDoses } from './engine';

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selectedFirstAidTopic, setSelectedFirstAidTopic] = useState(null);

  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const activeSetting = useLiveQuery(() => db.settings.get('activeProfileId'), []);

  const activeProfileId = activeSetting ? Number(activeSetting.value) : null;
  const activeProfile = profiles?.find((p) => p.id === activeProfileId) || profiles?.[0] || null;

  // On first launch: check IndexedDB availability, storage persistence & privacy acknowledgement
  useEffect(() => {
    isIndexedDBAvailable().then((avail) => {
      setStorageAvailable(avail);
      if (avail) {
        initStoragePersistence();
      }
    });

    const checkPrivacy = async () => {
      const ack = await db.settings.get('privacyAcknowledged');
      if (!ack || !ack.value) {
        setShowPrivacyNotice(true);
      }
    };
    checkPrivacy();
  }, []);

  // Initialize active profile if none set
  useEffect(() => {
    if (profiles && profiles.length > 0 && !activeProfileId) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  // Start background monitoring engine
  useEffect(() => {
    const cleanup = startEngine((alertData) => {
      setActiveAlarm(alertData);
    });
    return cleanup;
  }, []);

  const handleSelectProfile = async (id) => {
    await setActiveProfileId(id);
  };

  const handleAcknowledgePrivacy = async () => {
    await db.settings.put({ key: 'privacyAcknowledged', value: true });
    setShowPrivacyNotice(false);
  };

  if (!storageAvailable) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="header-brand">
            <h1 className="header-title"><span>🩺</span> AidKit</h1>
          </div>
        </header>
        <main className="app-main">
          <div className="container">
            <div className="card card-accent-danger" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>⚠️</div>
              <h2 className="card-title" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
                Storage Unavailable
              </h2>
              <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '1rem' }}>
                Storage isn't available, so your data can't be saved in this mode.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                Please disable private browsing mode or allow local storage for AidKit.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasProfiles = profiles && profiles.length > 0;

  return (
    <div className="app-shell">
      <Header
        profiles={profiles || []}
        activeProfileId={activeProfile?.id}
        onSelectProfile={handleSelectProfile}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="app-main">
        <div className="container" id="content-area">
          {profiles === undefined ? (
            <div className="empty-state" role="status" aria-live="polite">
              <div className="empty-state-icon">⏳</div>
              <h3 className="empty-state-title">Loading AidKit...</h3>
              <p className="empty-state-text">Initializing offline database.</p>
            </div>
          ) : !hasProfiles ? (
            <WelcomeScreen
              onComplete={(newId) => {
                setActiveTab('today');
              }}
            />
          ) : (
            <>
              {activeTab === 'today' && (
                <TodayScreen
                  activeProfile={activeProfile}
                  onNavigateAsk={() => setActiveTab('ask')}
                />
              )}
              {activeTab === 'meds' && <MedsScreen activeProfile={activeProfile} />}
              {activeTab === 'ask' && (
                <AskScreen
                  activeProfile={activeProfile}
                  onOpenTopicCard={(topicId) => {
                    setSelectedFirstAidTopic(topicId);
                    setActiveTab('firstaid');
                  }}
                  onNavigateFirstAid={() => setActiveTab('firstaid')}
                />
              )}
              {activeTab === 'firstaid' && (
                <FirstAidScreen
                  selectedTopicProp={selectedFirstAidTopic}
                  onClearTopic={() => setSelectedFirstAidTopic(null)}
                />
              )}
              {activeTab === 'sos' && (
                <SosScreen
                  activeProfile={activeProfile}
                  onNavigateProfiles={() => setActiveTab('profiles')}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onNavigateAsk={() => setActiveTab('ask')}
                />
              )}
              {activeTab === 'profiles' && (
                <ProfilesScreen
                  profiles={profiles}
                  activeProfileId={activeProfile?.id}
                  onActiveChange={handleSelectProfile}
                />
              )}
            </>
          )}
        </div>
      </main>

      {hasProfiles && <Nav activeTab={activeTab} onSelectTab={setActiveTab} />}

      <AlarmModal
        alertData={activeAlarm}
        onDismiss={() => setActiveAlarm(null)}
        onNavigateProfiles={() => setActiveTab('profiles')}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProfile={activeProfile}
        onTriggerCheck={() => checkMissedDoses((alertData) => setActiveAlarm(alertData))}
        onDataReset={() => {
          setActiveTab('today');
        }}
      />

      <PrivacyNoticeModal
        isOpen={showPrivacyNotice}
        onAcknowledge={handleAcknowledgePrivacy}
      />
    </div>
  );
}
