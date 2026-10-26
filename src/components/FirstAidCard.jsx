import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { answerCardDoubt } from '../cardDoubts';

const DOUBT_CHIPS = [
  'Repeat step',
  'Read Do',
  "Read Don't",
  'When should I call 112?'
];

export default function FirstAidCard({ topic, onBack, isEmbedded = false }) {
  // Read voice settings from Dexie
  const autoReadSetting = useLiveQuery(() => db.settings.get('autoReadFirstAid'), []);
  const speedSetting = useLiveQuery(() => db.settings.get('speechSpeed'), []);
  const emergencySetting = useLiveQuery(() => db.settings.get('emergencyNumber'), []);

  const emergencyNumber = emergencySetting?.value || '112';
  const autoReadDefault = autoReadSetting ? autoReadSetting.value !== false : true;
  const initialSpeed = speedSetting ? Number(speedSetting.value) || 1 : 1;

  // Speech synthesis state
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isNetworkVoice, setIsNetworkVoice] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [speechSpeed, setSpeechSpeed] = useState(initialSpeed);
  const [handsFree, setHandsFree] = useState(false);

  // CPR Metronome state
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [metronomePulse, setMetronomePulse] = useState(false);

  // Doubt Box state (strictly in-memory)
  const [doubtInput, setDoubtInput] = useState('');
  const [doubtMessages, setDoubtMessages] = useState([]);

  // Refs for tracking async speech & timeouts
  const queueRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const handsFreeRef = useRef(false);
  const speechSpeedRef = useRef(initialSpeed);
  const selectedVoiceRef = useRef(null);
  const handsFreeTimeoutRef = useRef(null);
  const wakeLockRef = useRef(null);
  const itemRefs = useRef({});

  // Sync refs
  currentIndexRef.current = currentIndex;
  isPlayingRef.current = isPlaying;
  handsFreeRef.current = handsFree;
  speechSpeedRef.current = speechSpeed;
  selectedVoiceRef.current = selectedVoice;

  // Build speech queue strictly in specified order:
  // 1. title
  // 2. Call 112 now if: <callEmergencyWhen>
  // 3. "Steps."
  // 4. Step 1: ..., Step 2: ...
  // 5. "Do."
  // 6. each Do item
  // 7. "Don't."
  // 8. each Don't item
  useEffect(() => {
    if (!topic) return;
    const q = [];

    // 1. Title
    q.push({ id: 'title', label: 'Title', text: `${topic.title}.` });

    // 2. Emergency warning
    if (topic.callEmergencyWhen) {
      q.push({
        id: 'emergency',
        label: 'Emergency Alert',
        text: `Call 112 now if: ${topic.callEmergencyWhen}`
      });
    }

    // 3. Steps header
    q.push({ id: 'steps-header', label: 'Steps Header', text: 'Steps.' });

    // 4. Each step
    (topic.steps || []).forEach((st, idx) => {
      q.push({
        id: `step-${idx}`,
        label: `Step ${idx + 1}`,
        text: `Step ${idx + 1}: ${st}`
      });
    });

    // 5. Do header
    q.push({ id: 'do-header', label: 'Do Header', text: 'Do.' });

    // 6. Each do item
    (topic.do || []).forEach((d, idx) => {
      q.push({
        id: `do-${idx}`,
        label: `Do ${idx + 1}`,
        text: `Do: ${d}`
      });
    });

    // 7. Don't header
    q.push({ id: 'dont-header', label: "Don't Header", text: "Don't." });

    // 8. Each don't item
    (topic.dont || []).forEach((d, idx) => {
      q.push({
        id: `dont-${idx}`,
        label: `Don't ${idx + 1}`,
        text: `Don't: ${d}`
      });
    });

    queueRef.current = q;
  }, [topic]);

  // Wake Lock helpers
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        // Ignore wakeLock errors
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {}
      wakeLockRef.current = null;
    }
  };

  // Voice loading & detection
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceAvailable(false);
      return;
    }

    const selectBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) {
        setVoiceAvailable(false);
        return;
      }
      setVoiceAvailable(true);

      // Prefer localService === true and lang en-IN, then en-GB, en-US
      const localIN = voices.find((v) => v.localService && (v.lang === 'en-IN' || v.lang.startsWith('en-IN')));
      const localGB = voices.find((v) => v.localService && (v.lang === 'en-GB' || v.lang.startsWith('en-GB')));
      const localUS = voices.find((v) => v.localService && (v.lang === 'en-US' || v.lang.startsWith('en-US')));
      const anyLocalEn = voices.find((v) => v.localService && v.lang.startsWith('en'));
      const anyIN = voices.find((v) => v.lang === 'en-IN' || v.lang.startsWith('en-IN'));
      const anyGB = voices.find((v) => v.lang === 'en-GB' || v.lang.startsWith('en-GB'));
      const anyUS = voices.find((v) => v.lang === 'en-US' || v.lang.startsWith('en-US'));
      const anyEn = voices.find((v) => v.lang.startsWith('en'));

      const best = localIN || localGB || localUS || anyLocalEn || anyIN || anyGB || anyUS || anyEn || voices[0];
      setSelectedVoice(best);
      setIsNetworkVoice(best ? !best.localService : false);
    };

    selectBestVoice();
    window.speechSynthesis.onvoiceschanged = selectBestVoice;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Speak single item from queue at index
  const speakItemAtIndex = (index) => {
    if (!('speechSynthesis' in window)) return;
    const queue = queueRef.current;
    if (index < 0 || index >= queue.length) {
      handleStop();
      return;
    }

    window.speechSynthesis.cancel();
    if (handsFreeTimeoutRef.current) {
      clearTimeout(handsFreeTimeoutRef.current);
      handsFreeTimeoutRef.current = null;
    }

    const item = queue[index];
    setCurrentIndex(index);
    setIsPlaying(true);
    setIsPaused(false);
    requestWakeLock();

    // Scroll into view
    const el = itemRefs.current[item.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    }
    utterance.rate = speechSpeedRef.current;

    utterance.onend = () => {
      if (!isPlayingRef.current) return;

      if (handsFreeRef.current) {
        // Hands-free mode: auto advance after 3 seconds
        handsFreeTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current) {
            speakItemAtIndex(index + 1);
          }
        }, 3000);
      } else {
        // Standard queue progression
        speakItemAtIndex(index + 1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.error('TTS error:', e);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Play / Resume
  const handlePlay = () => {
    if (!('speechSynthesis' in window)) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      requestWakeLock();
    } else {
      const startIdx = currentIndexRef.current >= 0 ? currentIndexRef.current : 0;
      speakItemAtIndex(startIdx);
    }
  };

  // Pause
  const handlePause = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    releaseWakeLock();
  };

  // Stop
  const handleStop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (handsFreeTimeoutRef.current) {
      clearTimeout(handsFreeTimeoutRef.current);
      handsFreeTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    releaseWakeLock();
  };

  // Previous Step
  const handlePrev = () => {
    const queue = queueRef.current;
    let target = currentIndexRef.current - 1;
    // Find previous step if possible
    while (target > 0 && !queue[target].id.startsWith('step-') && queue[target].id !== 'title') {
      target--;
    }
    speakItemAtIndex(Math.max(0, target));
  };

  // Next Step
  const handleNext = () => {
    const queue = queueRef.current;
    let target = currentIndexRef.current + 1;
    while (target < queue.length - 1 && !queue[target].id.startsWith('step-')) {
      target++;
    }
    if (target < queue.length) {
      speakItemAtIndex(target);
    } else {
      handleStop();
    }
  };

  // Repeat current step
  const handleRepeat = () => {
    const idx = currentIndexRef.current >= 0 ? currentIndexRef.current : 0;
    speakItemAtIndex(idx);
  };

  // Change speed
  const handleSpeedChange = (spd) => {
    setSpeechSpeed(spd);
    speechSpeedRef.current = spd;
    db.settings.put({ key: 'speechSpeed', value: spd }).catch(() => {});
    if (isPlayingRef.current) {
      // Re-trigger current utterance with new speed
      handleRepeat();
    }
  };

  // Auto-read on open if setting is ON
  useEffect(() => {
    let timer = null;
    if (autoReadDefault && voiceAvailable && topic) {
      // Small delay to allow audio gesture and DOM rendering
      timer = setTimeout(() => {
        speakItemAtIndex(0);
      }, 400);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [topic?.id, autoReadDefault, voiceAvailable]);

  // Cancel on unmount, page hide, or visibilitychange
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        handleStop();
        setMetronomeActive(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      handleStop();
      setMetronomeActive(false);
      releaseWakeLock();
    };
  }, []);

  // CPR Metronome: WebAudio 110 BPM beep
  useEffect(() => {
    if (!metronomeActive) return;

    let audioCtx = null;
    let intervalId = null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    } catch (e) {}

    const playClick = () => {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);

        setMetronomePulse(true);
        setTimeout(() => setMetronomePulse(false), 160);
      } catch (err) {}
    };

    playClick();
    // 110 BPM = 60000 / 110 = 545.45 ms
    intervalId = setInterval(playClick, 545.45);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      setMetronomePulse(false);
    };
  }, [metronomeActive]);

  // Doubt submission
  const handleAskDoubt = (textToSend) => {
    const q = (textToSend !== undefined ? textToSend : doubtInput).trim();
    if (!q) return;

    const answer = answerCardDoubt(q, topic, emergencyNumber);

    if (answer.action === 'repeat_step') {
      handleRepeat();
    }

    const newMsg = {
      id: Date.now(),
      question: q,
      answer
    };

    setDoubtMessages((prev) => [...prev, newMsg]);
    setDoubtInput('');
  };

  // Speak doubt answer aloud
  const handleReadDoubtAloud = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    if (selectedVoiceRef.current) utt.voice = selectedVoiceRef.current;
    utt.rate = speechSpeedRef.current;
    window.speechSynthesis.speak(utt);
  };

  const isCurrentActive = (id) => {
    if (currentIndex < 0 || !queueRef.current[currentIndex]) return false;
    return queueRef.current[currentIndex].id === id;
  };

  if (!topic) return null;

  return (
    <div className={`card ${isEmbedded ? '' : 'card-accent-primary'}`} style={{ margin: 0 }}>
      {/* Card Header with back navigation if available */}
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="card-title" ref={(el) => (itemRefs.current['title'] = el)}>
          🩹 {topic.title}
        </h3>
        {onBack && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onBack}>
            ← All Topics
          </button>
        )}
      </div>

      <div className="card-body">
        {/* 1. ASSISTANT PANEL */}
        <div
          className="alert alert-info"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            marginBottom: 'var(--space-3)',
            fontSize: '0.875rem'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🩺</span>
          <div>
            <strong>AidKit Assistant:</strong> I'll read this out. Ask me if you have a doubt.
          </div>
        </div>

        {/* 2. TEXT-TO-SPEECH CONTROLS */}
        {voiceAvailable ? (
          <div
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="meta-label">Audio Guide Controls:</span>
              {isNetworkVoice && (
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  🌐 Voice may need internet
                </span>
              )}
            </div>

            {/* Primary Action Buttons (Large tap targets) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {!isPlaying ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minWidth: '6.5rem', fontWeight: 700 }}
                  onClick={handlePlay}
                >
                  ▶ {isPaused ? 'Resume' : 'Listen'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ minWidth: '6.5rem', fontWeight: 700 }}
                  onClick={handlePause}
                >
                  ⏸ Pause
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleStop}
                disabled={!isPlaying && !isPaused && currentIndex === -1}
              >
                ⏹ Stop
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handlePrev}
                title="Previous Step"
              >
                ⏮ Prev
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleRepeat}
                title="Repeat Current Step"
              >
                ↺ Repeat
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleNext}
                title="Next Step"
              >
                Next ⏭
              </button>
            </div>

            {/* Secondary Controls: Speed, Hands-free, & Metronome */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-1)' }}>Speed:</span>
                {[0.8, 1.0, 1.2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    className={`btn btn-sm ${speechSpeed === spd ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                    onClick={() => handleSpeedChange(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={handsFree}
                  onChange={(e) => setHandsFree(e.target.checked)}
                />
                <span>Hands-free (3s pause)</span>
              </label>

              {/* CPR Metronome option */}
              {topic.id === 'cpr-adult' && (
                <button
                  type="button"
                  className={`btn btn-sm ${metronomeActive ? 'btn-danger' : 'btn-outline'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    transform: metronomePulse ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.1s ease'
                  }}
                  onClick={() => setMetronomeActive(!metronomeActive)}
                >
                  <span>🫀</span>
                  <span>{metronomeActive ? 'Stop Rhythm' : '110 BPM Rhythm'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="alert alert-warning" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
            ℹ️ Voice isn't available on this phone. You can read the steps on screen.
          </div>
        )}

        {/* 3. CARD CONTENT (Always visible on screen) */}
        {/* Emergency Alert Banner */}
        {topic.callEmergencyWhen && (
          <div
            ref={(el) => (itemRefs.current['emergency'] = el)}
            className={`alert alert-danger ${isCurrentActive('emergency') ? 'card-accent-danger' : ''}`}
            aria-live="polite"
            style={{
              marginBottom: 'var(--space-3)',
              fontSize: isCurrentActive('emergency') ? '1rem' : '0.875rem',
              fontWeight: isCurrentActive('emergency') ? 800 : 600,
              border: isCurrentActive('emergency') ? '2px solid var(--color-danger)' : undefined,
              boxShadow: isCurrentActive('emergency') ? 'var(--shadow-md)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <strong>Call 112 now if:</strong> {topic.callEmergencyWhen}
          </div>
        )}

        {/* Steps Section */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h4
            ref={(el) => (itemRefs.current['steps-header'] = el)}
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              marginBottom: 'var(--space-2)'
            }}
          >
            📋 Steps
          </h4>
          <ol style={{ paddingLeft: 'var(--space-4)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {(topic.steps || []).map((step, idx) => {
              const active = isCurrentActive(`step-${idx}`);
              return (
                <li
                  key={idx}
                  ref={(el) => (itemRefs.current[`step-${idx}`] = el)}
                  aria-live={active ? 'polite' : 'off'}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: active ? 'var(--color-primary-light, rgba(26, 86, 219, 0.1))' : 'transparent',
                    borderLeft: active ? '4px solid var(--color-primary)' : '4px solid transparent',
                    fontSize: active ? '1.05rem' : '0.9rem',
                    fontWeight: active ? 700 : 400,
                    lineHeight: 1.5,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {step}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Do & Don't Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}
        >
          {/* DO */}
          <div
            style={{
              backgroundColor: 'var(--color-success-light, rgba(16, 185, 129, 0.1))',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)'
            }}
          >
            <h5
              ref={(el) => (itemRefs.current['do-header'] = el)}
              style={{ color: 'var(--color-success)', fontWeight: 700, margin: '0 0 var(--space-2) 0' }}
            >
              ✓ DO
            </h5>
            <ul style={{ paddingLeft: 'var(--space-3)', margin: 0, fontSize: '0.85rem' }}>
              {(topic.do || []).map((d, idx) => {
                const active = isCurrentActive(`do-${idx}`);
                return (
                  <li
                    key={idx}
                    ref={(el) => (itemRefs.current[`do-${idx}`] = el)}
                    aria-live={active ? 'polite' : 'off'}
                    style={{
                      marginBottom: 'var(--space-1)',
                      fontWeight: active ? 800 : 400,
                      fontSize: active ? '0.95rem' : '0.85rem',
                      color: active ? 'var(--color-success)' : 'inherit'
                    }}
                  >
                    {d}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* DON'T */}
          <div
            style={{
              backgroundColor: 'var(--color-danger-light, rgba(239, 68, 68, 0.1))',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)'
            }}
          >
            <h5
              ref={(el) => (itemRefs.current['dont-header'] = el)}
              style={{ color: 'var(--color-danger)', fontWeight: 700, margin: '0 0 var(--space-2) 0' }}
            >
              ✕ DON'T
            </h5>
            <ul style={{ paddingLeft: 'var(--space-3)', margin: 0, fontSize: '0.85rem' }}>
              {(topic.dont || []).map((d, idx) => {
                const active = isCurrentActive(`dont-${idx}`);
                return (
                  <li
                    key={idx}
                    ref={(el) => (itemRefs.current[`dont-${idx}`] = el)}
                    aria-live={active ? 'polite' : 'off'}
                    style={{
                      marginBottom: 'var(--space-1)',
                      fontWeight: active ? 800 : 400,
                      fontSize: active ? '0.95rem' : '0.85rem',
                      color: active ? 'var(--color-danger)' : 'inherit'
                    }}
                  >
                    {d}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 4. DOUBT BOX (Offline, scoped to this card) */}
        <div
          style={{
            borderTop: '2px solid var(--color-border)',
            paddingTop: 'var(--space-3)',
            marginTop: 'var(--space-4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.1rem' }}>💬</span>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Doubt Box (Ask about this guide)
            </h4>
          </div>

          {/* Quick chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
            {DOUBT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() => handleAskDoubt(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Doubt Conversation List (Memory only) */}
          {doubtMessages.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                maxHeight: '16rem',
                overflowY: 'auto',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-2)',
                border: '1px solid var(--color-border)'
              }}
            >
              {doubtMessages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {/* User doubt */}
                  <div
                    style={{
                      alignSelf: 'flex-end',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      maxWidth: '85%'
                    }}
                  >
                    {msg.question}
                  </div>

                  {/* Assistant response */}
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      maxWidth: '92%',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {msg.answer.isEmergency ? (
                      <div className="alert alert-danger" style={{ margin: 0, padding: 'var(--space-2)' }}>
                        <div style={{ fontWeight: 800, marginBottom: 'var(--space-1)' }}>
                          🚨 {msg.answer.text}
                        </div>
                        <a
                          href={`tel:${msg.answer.callNumber || emergencyNumber}`}
                          className="btn btn-danger btn-sm btn-block"
                          style={{ textAlign: 'center', fontWeight: 800 }}
                        >
                          📞 Call {msg.answer.callNumber || emergencyNumber} Now
                        </a>
                      </div>
                    ) : (
                      <>
                        <div>{msg.answer.text}</div>
                        {msg.answer.callNumber && (
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            <a
                              href={`tel:${msg.answer.callNumber}`}
                              className="btn btn-danger btn-sm"
                            >
                              📞 Call {msg.answer.callNumber}
                            </a>
                          </div>
                        )}
                        {msg.answer.canReadAloud && msg.answer.readText && (
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => handleReadDoubtAloud(msg.answer.readText)}
                            >
                              🔊 Read Answer Aloud
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Text Input */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Ask a question about this topic..."
              value={doubtInput}
              onChange={(e) => setDoubtInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAskDoubt();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleAskDoubt()}
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
