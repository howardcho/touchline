import {GAME_MS, CHANGE_MS, validColors} from './engine.mjs';
export const PREF_KEY = 'touchline-preferences-v1';
export const durationOK = value => Number.isInteger(value) && value >= 1000 && value <= 3600000 && value % 1000 === 0;
export function loadPreferences(storage) {
  let raw = {}, legacy;
  try { raw = JSON.parse(storage.getItem(PREF_KEY)) || {}; legacy = Number(storage.getItem('touchline-game-duration')); } catch {}
  return {
    gameMs: durationOK(raw.gameMs) ? raw.gameMs : durationOK(legacy) ? legacy : GAME_MS,
    changeMs: durationOK(raw.changeMs) ? raw.changeMs : CHANGE_MS,
    sounds: typeof raw.sounds === 'boolean' ? raw.sounds : true,
    colorsByTeams: Object.fromEntries([4,5].filter(t=>validColors(t,raw.colorsByTeams?.[t])).map(t=>[t,{...raw.colorsByTeams[t]}]))
  };
}
export function savePreferences(storage, preferences) {
  try {storage.setItem(PREF_KEY, JSON.stringify(preferences)); return true;} catch {return false;}
}
