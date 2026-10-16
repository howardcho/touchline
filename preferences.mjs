import {GAME_MS, CHANGE_MS, validColors, TEAM_COUNTS, completeColors} from './engine.mjs';
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
    colors: validColors(5,raw.colors) ? {...raw.colors} : completeColors(older)
  };
}
export function savePreferences(storage, preferences) {
  try {storage.setItem(PREF_KEY, JSON.stringify(preferences)); return true;} catch {return false;}
}
