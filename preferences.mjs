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
function normalize(raw, legacy) {
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
const PROFILE_KEYS = ['gameMs','changeMs','colors','sounds','crowd','audioCues','startCountdown','endEnabled','endTime','endMode','minGameMs'];
export function profileFor(preferences, teams) {
  const source=preferences.profiles?.[teams] ?? preferences;
  return structuredClone(Object.fromEntries(PROFILE_KEYS.map(key=>[key,source[key]])));
}
export function selectProfile(preferences, teams) {
  if(!TEAM_COUNTS.includes(teams))throw new Error('Choose 2 to 5 teams.');
  Object.assign(preferences,profileFor(preferences,teams),{setupTeams:teams});
  return preferences;
}
export function loadPreferences(storage) {
  let raw={},legacy;
  try {raw=JSON.parse(storage.getItem(PREF_KEY))||{};legacy=Number(storage.getItem('touchline-game-duration'));}catch{}
  const preferences=normalize(raw,legacy);
  // Seed every profile from the existing settings on upgrade; edits are independent.
  preferences.profiles=Object.fromEntries(TEAM_COUNTS.map(teams=>{
    const source=normalize({...preferences,...raw.profiles?.[teams]},legacy);
    return [teams,profileFor(source,teams)];
  }));
  return selectProfile(preferences,preferences.setupTeams);
}
export function savePreferences(storage, preferences) {
  // The flat fields are the selected setup profile, never the active session.
  if(preferences.profiles)preferences.profiles[preferences.setupTeams]=profileFor({...preferences,profiles:undefined},preferences.setupTeams);
  try {storage.setItem(PREF_KEY, JSON.stringify(preferences)); return true;} catch {return false;}
}
