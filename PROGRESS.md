# AidKit Progress
## Done
- Shell, PWA, Dexie DB, Profiles, Meds, Today, Missed-dose engine, SOS, Privacy backup/persist, Ask Assistant.
- Voice guide on first-aid cards: reusable `FirstAidCard` (TTS queue, auto-read, highlight/scroll, ListenControls, hands-free 3s pause, wake lock, 110 BPM CPR rhythm) + `cardDoubts.js` DoubtBox (offline, red flags, card quote).
- Integrated across FirstAidScreen, AskScreen, and SosScreen; auto-read & speech speed in SettingsModal.
## File Map
- `src/components/FirstAidCard.jsx`: unified voice guide card, AssistantPanel, TTS controls, DoubtBox.
- `src/cardDoubts.js`: pure functions for card-scoped doubts and emergency red flags.
- `src/screens/`: `FirstAidScreen.jsx`, `AskScreen.jsx`, `SosScreen.jsx`, `TodayScreen.jsx`, `MedsScreen.jsx`, `ProfilesScreen.jsx`.
- `src/components/SettingsModal.jsx`: voice settings (auto-read toggle, speech speed 0.8x/1x/1.2x).
## DB Schema (Dexie 'aidkit')
- `profiles`, `medicines`, `doseLogs`, `alerts`, `settings` (keys: autoReadFirstAid, speechSpeed, etc.).
## Next Step
- Final review and verification complete.
