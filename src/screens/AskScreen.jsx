import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { processUserMessage } from '../assistant';
import FirstAidCard from '../components/FirstAidCard';

const QUICK_CHIPS = [
  'Someone is choking',
  'Bleeding',
  'Burn',
  "What's due today?",
  'Did I miss a dose?',
  'Next dose?',
  'Who is my nominee?',
  'How do I add a medicine?'
];

export default function AskScreen({
  activeProfile,
  onNavigateFirstAid,
  onOpenTopicCard
}) {
  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      response: {
        type: 'greeting',
        text: 'Hello! I am AidKit Assistant. I can help with first-aid steps, your daily medicine schedule, and using this app.'
      }
    }
  ]);

  const messagesEndRef = useRef(null);

  // Read live data from Dexie for active profile only
  const medicines = useLiveQuery(
    () => (activeProfile?.id ? db.medicines.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const rawLogs = useLiveQuery(
    () => (activeProfile?.id ? db.doseLogs.where('profileId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  const alerts = useLiveQuery(
    () =>
      activeProfile?.id
        ? db.alerts.where('profileId').equals(activeProfile.id).reverse().sortBy('sentAt')
        : [],
    [activeProfile?.id]
  );

  const emergencySetting = useLiveQuery(() => db.settings.get('emergencyNumber'), []);
  const emergencyNumber = emergencySetting?.value || '112';

  const graceSetting = useLiveQuery(() => db.settings.get('gracePeriodMinutes'), []);
  const demoSetting = useLiveQuery(() => db.settings.get('demoMode'), []);
  const isDemo = !!demoSetting?.value;
  const graceMinutes = isDemo ? 1 : Number(graceSetting?.value) || 30;

  // Enrich today's dose logs for active profile
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();

  const enrichedTodayLogs = (rawLogs || [])
    .filter((l) => l.scheduledAt && l.scheduledAt.startsWith(todayStr))
    .map((log) => {
      const med = (medicines || []).find((m) => m.id === log.medicineId);
      const schedDate = new Date(log.scheduledAt);
      const missedThreshold = new Date(schedDate.getTime() + graceMinutes * 60 * 1000);

      let dynamicStatus = log.status || 'upcoming';
      if (log.takenAt || log.status === 'taken') {
        dynamicStatus = 'taken';
      } else if (now > missedThreshold) {
        dynamicStatus = 'missed';
      } else if (now >= schedDate) {
        dynamicStatus = 'due';
      } else {
        dynamicStatus = 'upcoming';
      }

      return {
        ...log,
        medName: med ? med.name : 'Unknown Medicine',
        medDose: med ? med.dose : '',
        medNotes: med ? med.notes : '',
        dynamicStatus,
        timeFormatted: schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (textToSend) => {
    const query = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!query) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query
    };

    const context = {
      activeProfile,
      medicines: medicines || [],
      todayLogs: enrichedTodayLogs,
      allDoseLogs: rawLogs || [],
      alerts: alerts || [],
      emergencyNumber
    };

    const assistantResponse = processUserMessage(query, context);

    const botMsg = {
      id: Date.now() + 1,
      sender: 'assistant',
      response: assistantResponse
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputVal('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Ask AidKit</h2>
          {activeProfile && <span className="badge badge-primary">{activeProfile.name}</span>}
        </div>
        <span className="badge badge-neutral">Offline 100%</span>
      </div>

      {/* Persistent Disclaimer */}
      <div className="alert alert-warning" style={{ fontSize: '0.825rem', marginBottom: 'var(--space-3)' }}>
        ⚠️ <strong>General guidance only, not a substitute for professional care. In an emergency call 112.</strong>
      </div>

      {/* Quick-reply chips */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <span className="meta-label" style={{ marginBottom: 'var(--space-1)', display: 'block' }}>
          Suggested Questions:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
          {QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.8rem', padding: 'var(--space-1) var(--space-2)' }}
              onClick={() => handleSend(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log (In-Memory Only) */}
      <div
        style={{
          minHeight: '320px',
          maxHeight: '52vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-3)'
        }}
      >
        {messages.map((m) => {
          if (m.sender === 'user') {
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: 'flex-end',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 var(--radius-md)',
                  maxWidth: '85%',
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  wordBreak: 'break-word'
                }}
              >
                {m.text}
              </div>
            );
          }

          const resp = m.response || {};
          return (
            <div
              key={m.id}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md) var(--radius-md) var(--radius-md) 0',
                padding: 'var(--space-3)',
                maxWidth: '92%',
                boxShadow: 'var(--shadow-sm)',
                width: '100%'
              }}
            >
              {/* Emergency Banner */}
              {resp.isEmergency && (
                <div
                  className="alert alert-danger"
                  style={{
                    margin: '0 0 var(--space-3)',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch'
                  }}
                >
                  <div style={{ fontSize: '1.05rem', marginBottom: 'var(--space-2)' }}>
                    🚨 {resp.text}
                  </div>
                  <a
                    href={`tel:${resp.callNumber || emergencyNumber}`}
                    className="btn btn-danger btn-block"
                    style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', padding: 'var(--space-3)' }}
                  >
                    📞 Call {resp.callNumber || emergencyNumber} Now
                  </a>

                  {resp.matchedTopic && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-block"
                      style={{ marginTop: 'var(--space-2)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      onClick={() => {
                        if (onOpenTopicCard) onOpenTopicCard(resp.matchedTopic.id);
                        else if (onNavigateFirstAid) onNavigateFirstAid();
                      }}
                    >
                      🩹 View {resp.matchedTopic.title} First-Aid Steps
                    </button>
                  )}
                </div>
              )}

              {/* Standard text response */}
              {!resp.isEmergency && resp.text && (
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {resp.text}
                </div>
              )}

              {/* Small brand cards for personal data queries */}
              {resp.cardType && resp.items && resp.items.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {resp.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        margin: 0,
                        backgroundColor: 'var(--color-surface-hover)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.875rem' }}>{item.medName || item.name}</strong>
                        <span
                          className={`badge ${
                            item.dynamicStatus === 'missed'
                              ? 'badge-danger'
                              : item.dynamicStatus === 'taken'
                              ? 'badge-success'
                              : 'badge-primary'
                          }`}
                        >
                          {item.dynamicStatus || item.dose || 'Scheduled'}
                        </span>
                      </div>
                      {item.timeFormatted && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                          Time: {item.timeFormatted} {item.medDose ? `• Dose: ${item.medDose}` : ''}
                        </div>
                      )}
                      {item.times && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                          Daily Schedule: {item.times.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Missed dose nominee alert action */}
              {resp.action === 'alert_nominee' && resp.nomineePhone && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <a
                    href={`sms:${resp.nomineePhone}?body=${encodeURIComponent(
                      `Notice from ${activeProfile?.name || 'patient'}: I missed my medication dose and am checking in.`
                    )}`}
                    className="btn btn-primary btn-sm btn-block"
                    style={{ textAlign: 'center' }}
                  >
                    💬 Alert Nominee ({resp.nomineeName || resp.nomineePhone})
                  </a>
                </div>
              )}

              {/* First Aid card detail (for first aid matches) */}
              {!resp.isEmergency && resp.topic && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <FirstAidCard topic={resp.topic} isEmbedded={true} />
                </div>
              )}

              {/* Suggestions for Fallback ("Did you mean") */}
              {resp.suggestions && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <span className="meta-label">Did you mean:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                    {resp.suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleSend(s.title)}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Ask AidKit anything..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSend()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
