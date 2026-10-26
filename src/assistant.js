import firstAidTopics from './data/firstaid.json';

// 1. Red flag keywords and patterns
const SUICIDAL_PATTERNS = [
  'suicid',
  'kill myself',
  'end my life',
  'self-harm',
  'self harm',
  'hurt myself',
  'want to die'
];

const EMERGENCY_RED_FLAGS = [
  { pattern: 'not breathing', topicId: 'cpr-adult' },
  { pattern: 'unconscious', topicId: 'cpr-adult' },
  { pattern: 'unresponsive', topicId: 'cpr-adult' },
  { pattern: 'heart attack', topicId: 'heart-attack-signs' },
  { pattern: 'chest pain', topicId: 'heart-attack-signs' },
  { pattern: 'severe bleeding', topicId: 'severe-bleeding' },
  { pattern: "bleeding won't stop", topicId: 'severe-bleeding' },
  { pattern: 'bleeding wont stop', topicId: 'severe-bleeding' },
  { pattern: 'stroke', topicId: 'stroke-signs-fast' },
  { pattern: 'face drooping', topicId: 'stroke-signs-fast' },
  { pattern: 'face droop', topicId: 'stroke-signs-fast' },
  { pattern: 'seizure', topicId: 'seizure' },
  { pattern: 'choking', topicId: 'choking' },
  { pattern: 'snake bite', topicId: 'snake-bite' },
  { pattern: 'snakebite', topicId: 'snake-bite' },
  { pattern: 'poison', topicId: null },
  { pattern: 'swallowed', topicId: null },
  { pattern: 'overdose', topicId: null },
  { pattern: 'anaphylaxis', topicId: null },
  { pattern: 'allergic swelling', topicId: null },
  { pattern: "can't breathe", topicId: 'choking' },
  { pattern: 'cant breathe', topicId: 'choking' }
];

// Topic synonyms for scoring
const TOPIC_SYNONYMS = {
  'cpr-adult': ['cpr', 'not breathing', 'unresponsive', 'unconscious', 'no pulse', 'cardiac arrest'],
  'choking': ['choke', 'choking', 'cant breathe', "can't breathe", 'stuck in throat', 'strangle'],
  'severe-bleeding': ['bleed', 'bleeding', 'cut', 'blood', 'gash', 'wound', 'hemorrhage', 'artery', 'nose bleed', 'nosebleed'],
  'burns': ['burn', 'burns', 'scald', 'fire', 'hot water', 'blister', 'flame', 'heat', 'sunstroke'],
  'fractures-sprains': ['fracture', 'sprain', 'broken', 'twisted ankle', 'bone', 'dislocation'],
  'fainting': ['faint', 'fainting', 'dizzy', 'pass out', 'blackout', 'lightheaded', 'collapse'],
  'seizure': ['seizure', 'fit', 'convulsion', 'epilepsy', 'jerking'],
  'snake-bite': ['snake', 'snake bite', 'bite', 'venom', 'viper', 'cobra'],
  'heart-attack-signs': ['heart attack', 'chest pain', 'chest pressure', 'tight chest', 'angina'],
  'stroke-signs-fast': ['stroke', 'face droop', 'face drooping', 'slurred speech', 'arm weak', 'fast']
};

/**
 * Returns the top 3 closest first aid topics for unmatched text.
 */
function getClosestTopics(text, limit = 3) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = firstAidTopics.map((topic) => {
    let score = 0;
    const syns = TOPIC_SYNONYMS[topic.id] || [];
    for (const w of words) {
      if (topic.title.toLowerCase().includes(w)) score += 5;
      for (const s of syns) {
        if (s.includes(w) || w.includes(s)) score += 3;
      }
      for (const st of topic.steps) {
        if (st.toLowerCase().includes(w)) score += 1;
      }
    }
    return { topic, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.topic);
}

/**
 * Pure function: processes incoming assistant messages strictly in the order:
 * 1. Red Flags
 * 2. Personal Data
 * 3. First Aid
 * 4. App Help
 * 5. Missed Dose Help
 * 6. Fallback
 */
export function processUserMessage(rawMessage, context = {}) {
  const message = (rawMessage || '').trim();
  const lower = message.toLowerCase();
  const emergencyNum = context.emergencyNumber || '112';

  // Handle empty input
  if (!message) {
    return {
      type: 'empty',
      text: 'Please type a question or choose one of the quick options below.'
    };
  }

  // Handle very long input
  if (message.length > 500) {
    return {
      type: 'fallback',
      text: 'Your question is quite long. Please ask in a few words (e.g. "Bleeding", "What is due today?", or "How do I add a medicine?").',
      suggestions: getClosestTopics(message, 3)
    };
  }

  // ========================================================
  // 1. RED FLAGS (checked first, always)
  // ========================================================
  for (const s of SUICIDAL_PATTERNS) {
    if (lower.includes(s)) {
      return {
        type: 'red_flag_suicidal',
        text: "You're not alone. Please call 112 or a local helpline now, or reach someone you trust.",
        isEmergency: true,
        callNumber: emergencyNum
      };
    }
  }

  for (const flag of EMERGENCY_RED_FLAGS) {
    if (lower.includes(flag.pattern)) {
      const matchedTopic = flag.topicId
        ? firstAidTopics.find((t) => t.id === flag.topicId)
        : null;

      return {
        type: 'red_flag_emergency',
        text: `This may be an emergency. Call 112 now.`,
        isEmergency: true,
        callNumber: emergencyNum,
        matchedTopic: matchedTopic || null
      };
    }
  }

  // ========================================================
  // 2. PERSONAL DATA questions from Dexie for active profile only
  // ========================================================
  const p = context.activeProfile;
  const todayLogs = context.todayLogs || [];
  const meds = context.medicines || [];
  const allLogs = context.allDoseLogs || [];
  const alerts = context.alerts || [];

  // 2a. Doses due today
  if (
    lower.includes("what's due today") ||
    lower.includes("whats due today") ||
    lower.includes('due today') ||
    lower.includes('due doses') ||
    lower.includes('doses due')
  ) {
    if (!p) {
      return {
        type: 'personal_data',
        text: 'No active profile found. Please create or select a profile first.'
      };
    }
    const dueLogs = todayLogs.filter((l) => !l.takenAt && l.dynamicStatus === 'due');
    if (dueLogs.length === 0) {
      return {
        type: 'personal_data',
        text: `You have no doses currently due for ${p.name}.`,
        details: todayLogs.length > 0 ? `Total scheduled doses today: ${todayLogs.length}.` : 'No doses scheduled for today.'
      };
    }
    const list = dueLogs.map((l) => `• ${l.medName} (${l.medDose}) at ${l.timeFormatted}`).join('\n');
    return {
      type: 'personal_data',
      text: `Doses currently due for ${p.name}:\n${list}`,
      cardType: 'due',
      items: dueLogs
    };
  }

  // 2b. Taken today
  if (
    lower.includes('taken today') ||
    lower.includes('what did i take') ||
    lower.includes('doses taken') ||
    lower.includes('medicines taken')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    const takenLogs = todayLogs.filter((l) => !!l.takenAt || l.status === 'taken');
    if (takenLogs.length === 0) {
      return { type: 'personal_data', text: `No doses have been marked as taken yet today for ${p.name}.` };
    }
    const list = takenLogs.map((l) => `• ${l.medName} (${l.medDose}) - Taken at ${l.timeFormatted}`).join('\n');
    return {
      type: 'personal_data',
      text: `Doses taken today for ${p.name}:\n${list}`,
      cardType: 'taken',
      items: takenLogs
    };
  }

  // 2c. Missed today
  if (
    lower.includes('did i miss a dose') ||
    lower.includes('missed today') ||
    lower.includes('missed doses') ||
    lower.includes('doses missed')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    const missedLogs = todayLogs.filter((l) => !l.takenAt && l.dynamicStatus === 'missed');
    if (missedLogs.length === 0) {
      return { type: 'personal_data', text: `Great news! You have no missed doses today for ${p.name}.` };
    }
    const list = missedLogs.map((l) => `• ${l.medName} (${l.medDose}) scheduled at ${l.timeFormatted}`).join('\n');
    return {
      type: 'personal_data',
      text: `Missed doses today for ${p.name}:\n${list}`,
      cardType: 'missed',
      items: missedLogs
    };
  }

  // 2d. Next dose
  if (
    lower.includes('next dose') ||
    lower.includes('when is my next dose') ||
    lower.includes('upcoming dose')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    const upcomingLogs = todayLogs.filter(
      (l) => !l.takenAt && (l.dynamicStatus === 'upcoming' || l.dynamicStatus === 'due')
    );
    if (upcomingLogs.length === 0) {
      return { type: 'personal_data', text: `There are no further upcoming doses scheduled for today for ${p.name}.` };
    }
    const next = upcomingLogs[0];
    return {
      type: 'personal_data',
      text: `Next dose for ${p.name}: ${next.medName} (${next.medDose}) at ${next.timeFormatted} (${next.dynamicStatus}).`,
      cardType: 'next',
      items: [next]
    };
  }

  // 2e. Current medicines list (name, dose, times)
  if (
    lower.includes('current medicines') ||
    lower.includes('my medicines') ||
    lower.includes('my meds') ||
    lower.includes('what medicines am i taking') ||
    lower.includes('list of medicines') ||
    lower.includes('medicines list')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    if (meds.length === 0) {
      return { type: 'personal_data', text: `No medicines currently registered for ${p.name}. Add them in the Meds tab.` };
    }
    const list = meds.map((m) => `• ${m.name} (${m.dose || 'Standard dose'}) - Times: ${(m.times || []).join(', ')}`).join('\n');
    return {
      type: 'personal_data',
      text: `Current medications for ${p.name}:\n${list}`,
      cardType: 'meds',
      items: meds
    };
  }

  // 2f. Nominee name and phone
  if (
    lower.includes('who is my nominee') ||
    lower.includes('my nominee') ||
    lower.includes('nominee details') ||
    lower.includes('nominee phone') ||
    lower.includes('nominee name')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    if (!p.nomineeName && !p.nomineePhone) {
      return { type: 'personal_data', text: `No nominee has been configured for ${p.name} yet. Tap Profiles to add one.` };
    }
    return {
      type: 'personal_data',
      text: `Designated emergency nominee for ${p.name}:\nName: ${p.nomineeName || 'N/A'}\nRelationship: ${p.nomineeRelation || 'N/A'}\nPhone: ${p.nomineePhone || 'No phone number'}`
    };
  }

  // 2g. Last alerts
  if (
    lower.includes('last alerts') ||
    lower.includes('alert history') ||
    lower.includes('recent alerts') ||
    lower.includes('past alerts')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    const pAlerts = alerts.filter((a) => a.profileId === p.id);
    if (pAlerts.length === 0) {
      return { type: 'personal_data', text: `No alerts logged for ${p.name}.` };
    }
    const list = pAlerts.slice(0, 3).map((a) => `• ${new Date(a.sentAt).toLocaleDateString()}: ${a.message}`).join('\n');
    return {
      type: 'personal_data',
      text: `Recent alerts for ${p.name}:\n${list}`
    };
  }

  // 2h. 7-day adherence %
  if (
    lower.includes('adherence') ||
    lower.includes('compliance') ||
    lower.includes('7-day') ||
    lower.includes('7 day') ||
    lower.includes('how am i doing')
  ) {
    if (!p) return { type: 'personal_data', text: 'No active profile found.' };
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const pLogs = allLogs.filter((l) => l.profileId === p.id && l.scheduledAt >= sevenDaysAgo);
    const taken = pLogs.filter((l) => l.takenAt || l.status === 'taken').length;
    const pct = pLogs.length > 0 ? Math.round((taken / pLogs.length) * 100) : 100;
    return {
      type: 'personal_data',
      text: `7-Day Medication Adherence for ${p.name}: ${pct}% (${taken}/${pLogs.length} scheduled doses taken).`
    };
  }

  // ========================================================
  // 3. FIRST AID: match to topics in firstaid.json using keyword & synonym scoring
  // ========================================================
  let bestTopic = null;
  let highestScore = 0;

  for (const topic of firstAidTopics) {
    let score = 0;
    const titleLower = topic.title.toLowerCase();

    // Exact title match or title in query
    if (lower === titleLower || lower.includes(titleLower)) score += 10;

    const syns = TOPIC_SYNONYMS[topic.id] || [];
    for (const s of syns) {
      if (lower.includes(s)) score += 5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestTopic = topic;
    }
  }

  if (bestTopic && highestScore >= 5) {
    return {
      type: 'first_aid',
      topic: bestTopic,
      text: `First aid guidance for ${bestTopic.title}:`
    };
  }

  // ========================================================
  // 4. APP HELP (fixed text answers)
  // ========================================================
  if (
    lower.includes('how do i add a medicine') ||
    lower.includes('add a medicine') ||
    lower.includes('add medicine') ||
    lower.includes('how to add medicine')
  ) {
    return {
      type: 'app_help',
      text: "Go to the Meds tab and tap '+ Add Medicine'. Enter the name, dose, schedule times (HH:mm), and save."
    };
  }

  if (
    lower.includes('nominee') &&
    (lower.includes('add') || lower.includes('change') || lower.includes('update') || lower.includes('edit'))
  ) {
    return {
      type: 'app_help',
      text: "Go to the Profiles tab, tap 'Edit' on your profile, update the Nominee Details section (name, relationship, phone), and save."
    };
  }

  if (lower.includes('demo mode') || lower.includes('turn on demo') || lower.includes('enable demo')) {
    return {
      type: 'app_help',
      text: "Tap ⚙️ Settings in the header, expand 'Demo tools', and check 'Demo Mode (Grace = 1 minute)'."
    };
  }

  if (lower.includes('grace time') || lower.includes('grace period') || lower.includes('change grace')) {
    return {
      type: 'app_help',
      text: "Tap ⚙️ Settings in the header, adjust the 'Normal Grace Period (Minutes)' field, and tap Done."
    };
  }

  if (
    lower.includes('backup') ||
    lower.includes('export') ||
    lower.includes('import')
  ) {
    return {
      type: 'app_help',
      text: "Tap ⚙️ Settings, then scroll to Privacy & Data Storage. Tap 'Export Backup' to download your JSON file, or 'Import Backup' to restore."
    };
  }

  if (
    lower.includes('delete all data') ||
    lower.includes('delete my data') ||
    lower.includes('clear all data') ||
    lower.includes('reset all data')
  ) {
    return {
      type: 'app_help',
      text: "Tap ⚙️ Settings, scroll to Privacy & Data Storage, and tap 'Delete All My Data'."
    };
  }

  if (
    lower.includes('load sample') ||
    lower.includes('sample data') ||
    lower.includes('clear sample')
  ) {
    return {
      type: 'app_help',
      text: "Tap ⚙️ Settings, open 'Demo tools', and tap 'Load sample data'."
    };
  }

  if (
    lower.includes('install') ||
    lower.includes('pwa') ||
    lower.includes('download app')
  ) {
    return {
      type: 'app_help',
      text: "Tap your browser's install or 'Add to Home Screen' option from the browser menu (or the install icon in your address bar)."
    };
  }

  // ========================================================
  // 5. MISSED DOSE HELP (when asked "I missed my dose" / "what should I do")
  // ========================================================
  if (
    lower.includes('i missed my dose') ||
    lower.includes('missed my dose') ||
    lower.includes('what should i do') ||
    lower.includes('what do i do') ||
    lower.includes('forgot to take') ||
    lower.includes('what to do if missed')
  ) {
    return {
      type: 'missed_dose_help',
      text: "Don't take a double dose to catch up unless your doctor or pharmacist told you to. Check the medicine leaflet or ask your pharmacist what to do for this medicine.",
      action: 'alert_nominee',
      nomineePhone: context.activeProfile?.nomineePhone || '',
      nomineeName: context.activeProfile?.nomineeName || ''
    };
  }

  // ========================================================
  // 6. FALLBACK with Did You Mean (top 3 closest topics)
  // ========================================================
  return {
    type: 'fallback',
    text: 'I can help with first aid, your medicine schedule and using this app. For medical advice, please ask a doctor or pharmacist. In an emergency call 112.',
    suggestions: getClosestTopics(message, 3)
  };
}
