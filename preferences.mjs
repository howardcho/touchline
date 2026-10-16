import {END_MODES,validEndTime} from './session.mjs';
import {GAME_MS, CHANGE_MS, validColors, TEAM_COUNTS, completeColors} from './engine.mjs';
export const AUDIO_CUES = Object.freeze(['start','minute','whistle','countdown','lineup']);
export function soundEnabled(preferences,cue) {
  if(!preferences.sounds)return false;
  if(cue==='crowd')return preferences.crowd===true;
  return AUDIO_CUES.includes(cue) && preferences.audioCues?.[cue]!==false;
}
export const PREF_KEY = 'touchline-preferences-v1';
export const durationOK = value => Number.isInteger(value) && value >= 1000 && value <= 3600000 && value % 1000 === 0;
export function loadPreferences(storage) {
  let raw = {}, legacy;
  try { raw = JSON.parse(storage.getItem(PREF_KEY)) || {}; legacy = Number(storage.getItem('touchline-game-duration')); } catch {}
  const setupTeams=TEAM_COUNTS.includes(raw.setupTeams) ? raw.setupTeams : 4;
  const older=raw.colorsByTeams?.[setupTeams] || raw.colorsByTeams?.[5] || {};
  return {
    setupTeams: TEAM_COUNTS.includes(raw.setupTeams) ? raw.setupTeams : 4,
    gameMs: durationOK(raw.gameMs) ? raw.gameMs : durationOK(legacy) ? legacy : GAME_MS,
    changeMs: durationOK(raw.changeMs) ? raw.changeMs : CHANGE_MS,
    sounds: typeof raw.sounds === 'boolean' ? raw.sounds : true,
    crowd: typeof raw.crowd === 'boolean' ? raw.crowd : true,
    startCountdown: typeof raw.startCountdown==='boolean'?raw.startCountdown:true,
    keepAwake: typeof raw.keepAwake==='boolean'?raw.keepAwake:true,
    audioCues: Object.fromEntries(AUDIO_CUES.map(cue=>[cue,typeof raw.audioCues?.[cue]==='boolean' ? raw.audioCues[cue] : true])),
    endEnabled: typeof raw.endEnabled==='boolean'?raw.endEnabled:true,
    endTime: validEndTime(raw.endTime)?raw.endTime:'23:59',
    endMode: END_MODES.includes(raw.endMode)?raw.endMode:'hard',
    minGameMs: durationOK(raw.minGameMs)?raw.minGameMs:120000,
    colors: validColors(5,raw.colors) ? {...raw.colors} : completeColors(older)
  };
}
export function savePreferences(storage, preferences) {
  try {storage.setItem(PREF_KEY, JSON.stringify(preferences)); return true;} catch {return false;}
}
