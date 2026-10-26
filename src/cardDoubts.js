// Pure functions for answering doubts scoped strictly to an open first-aid card.
// No network calls, no storage, no external APIs.

const EMERGENCY_RED_FLAGS = [
  'not breathing',
  'unconscious',
  'unresponsive',
  "can't breathe",
  'cant breathe',
  'chest pain',
  'severe bleeding',
  "bleeding won't stop",
  'bleeding wont stop',
  'seizure',
  'choking',
  'poison',
  'overdose',
  'suicidal',
  'suicide',
  'self-harm',
  'self harm',
  'snake bite',
  'snakebite'
];

const SYNONYMS = [
  { match: ['water', 'drink', 'drinking', 'food', 'eat', 'swallow', 'fluid', 'hydrate'], terms: ['water', 'drink', 'fluid', 'food'] },
  { match: ['ice', 'cold', 'cool', 'freeze', 'tap water', 'running water'], terms: ['water', 'ice', 'cold', 'cool', 'running'] },
  { match: ['move', 'walk', 'walking', 'movement', 'shift', 'exert'], terms: ['move', 'walk', 'still', 'immobilize'] },
  { match: ['finger', 'fingers', 'mouth', 'tongue', 'sweep', 'teeth'], terms: ['mouth', 'tongue', 'finger', 'sweep'] },
  { match: ['tourniquet', 'tie', 'strap', 'band', 'tight'], terms: ['tourniquet', 'bandage', 'pressure'] },
  { match: ['blister', 'blisters', 'pop', 'break', 'peel', 'skin'], terms: ['blister', 'skin', 'peel', 'break'] },
  { match: ['clothes', 'clothing', 'jewelry', 'tight', 'belt', 'collar'], terms: ['clothing', 'jewelry', 'collar', 'belt', 'tight'] },
  { match: ['lay', 'sit', 'flat', 'elevate', 'legs', 'back', 'position'], terms: ['flat', 'elevate', 'sit', 'lie', 'position'] },
  { match: ['time', 'how long', 'minutes', 'duration', 'when to stop', 'seconds'], terms: ['minutes', 'seconds', 'time', 'duration', '10', '20'] },
  { match: ['bleed', 'blood', 'cloth', 'pressure', 'cut', 'gash', 'wound'], terms: ['pressure', 'cloth', 'dressing', 'wound', 'bleeding'] },
  { match: ['chest', 'compressions', 'push', 'rate', 'cpr', 'hard and fast'], terms: ['compress', 'chest', 'push', 'rate', 'hard'] }
];

/**
 * Checks if raw text contains any emergency red flag.
 */
export function checkEmergencyRedFlag(rawText) {
  const lower = (rawText || '').toLowerCase();
  for (const flag of EMERGENCY_RED_FLAGS) {
    if (lower.includes(flag)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates a user doubt against the current card.
 * @param {string} question - The user query.
 * @param {object} topic - The active topic from firstaid.json.
 * @param {string} emergencyNumber - Default '112'.
 * @returns {object} Response object.
 */
export function answerCardDoubt(question, topic, emergencyNumber = '112') {
  const query = (question || '').trim();
  const lower = query.toLowerCase();

  // 1. Red Flag check
  if (checkEmergencyRedFlag(lower)) {
    return {
      isEmergency: true,
      text: 'This may be an emergency. Call 112 now.',
      callNumber: emergencyNumber
    };
  }

  if (!topic) {
    return {
      isEmergency: false,
      text: "I don't have guidance on that for this topic. If you're unsure or it's getting worse, call 112.",
      callNumber: emergencyNumber
    };
  }

  // 2. Chip / direct query matches
  if (lower === 'repeat step' || lower.includes('repeat step') || lower.includes('repeat current step')) {
    return {
      isEmergency: false,
      action: 'repeat_step',
      text: 'Repeating current step.'
    };
  }

  if (lower === 'read do' || lower === 'do' || lower.includes('what should i do') || lower.includes('what to do')) {
    const list = (topic.do || []).map((d) => `• ${d}`).join('\n');
    const quote = `From this card (DO):\n${list}`;
    return {
      isEmergency: false,
      text: quote,
      readText: `Recommended actions for ${topic.title}: ${(topic.do || []).join('. ')}.`,
      canReadAloud: true
    };
  }

  if (lower === "read don't" || lower === "read dont" || lower === "don't" || lower.includes('what not to do') || lower.includes('avoid')) {
    const list = (topic.dont || []).map((d) => `• ${d}`).join('\n');
    const quote = `From this card (DON'T):\n${list}`;
    return {
      isEmergency: false,
      text: quote,
      readText: `Things to avoid for ${topic.title}: ${(topic.dont || []).join('. ')}.`,
      canReadAloud: true
    };
  }

  if (lower === 'when should i call 112?' || lower.includes('call 112') || lower.includes('when to call') || lower.includes('emergency when')) {
    const quote = `From this card (When to call 112):\n"${topic.callEmergencyWhen}"`;
    return {
      isEmergency: false,
      text: quote,
      readText: `Call 112 when: ${topic.callEmergencyWhen}`,
      callNumber: emergencyNumber,
      canReadAloud: true
    };
  }

  // 3. Line-by-line matching within the open card
  const candidateLines = [];

  // Steps
  (topic.steps || []).forEach((st, idx) => {
    candidateLines.push({
      label: `Step ${idx + 1}`,
      text: st,
      type: 'step'
    });
  });

  // Dos
  (topic.do || []).forEach((d) => {
    candidateLines.push({
      label: 'DO',
      text: d,
      type: 'do'
    });
  });

  // Don'ts
  (topic.dont || []).forEach((d) => {
    candidateLines.push({
      label: "DON'T",
      text: d,
      type: 'dont'
    });
  });

  // Call emergency
  if (topic.callEmergencyWhen) {
    candidateLines.push({
      label: 'Emergency criterion',
      text: topic.callEmergencyWhen,
      type: 'emergency'
    });
  }

  // Tokenize question
  const qWords = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Expand with synonyms
  const searchTerms = new Set(qWords);
  for (const s of SYNONYMS) {
    if (s.match.some((m) => lower.includes(m))) {
      s.terms.forEach((t) => searchTerms.add(t));
    }
  }

  // Score each line
  const scoredLines = candidateLines.map((cand) => {
    const lineLower = cand.text.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      if (lineLower.includes(term)) {
        score += term.length > 4 ? 3 : 2;
      }
    }

    return { ...cand, score };
  });

  scoredLines.sort((a, b) => b.score - a.score);

  const topMatches = scoredLines.filter((l) => l.score > 2).slice(0, 2);

  if (topMatches.length > 0) {
    const linesText = topMatches.map((m) => `• [${m.label}] ${m.text}`).join('\n');
    const quote = `From this card:\n${linesText}`;
    const readText = topMatches.map((m) => `${m.label}: ${m.text}`).join('. ');

    return {
      isEmergency: false,
      text: quote,
      readText,
      canReadAloud: true
    };
  }

  // 4. Fallback if nothing matches
  return {
    isEmergency: false,
    text: "I don't have guidance on that for this topic. If you're unsure or it's getting worse, call 112.",
    callNumber: emergencyNumber
  };
}
