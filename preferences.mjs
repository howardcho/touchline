import {END_MODES,validEndTime} from './session.mjs';
import {GAME_MS, CHANGE_MS, MAX_DURATION_MS, validColors, TEAM_COUNTS, completeColors} from './engine.mjs';
export const AUDIO_CUES = Object.freeze(['start','minute','thirty','ten','whistle','countdown','lineup']);
export const WARNING_CUES = Object.freeze(['minute','thirty','ten']);
export const LABEL_MODES = Object.freeze(['colors','letters']);
export const labelModeFor = source => LABEL_MODES.includes(source?.labelMode) ? source.labelMode : 'colors';
const DEFAULT_WARNING_CALLOUTS = Object.freeze({minute:false,thirty:false,ten:true});
export function soundEnabled(preferences,cue) {
  if(!preferences.sounds)return false;
  if(cue==='crowd')return preferences.crowd===true;
  return AUDIO_CUES.includes(cue) && preferences.audioCues?.[cue]!==false;
}
export function audioFor(source={}) {
  return {
    sounds: typeof source.sounds==='boolean'?source.sounds:true,
    crowd: typeof source.crowd==='boolean'?source.crowd:true,
    audioCues:Object.fromEntries(AUDIO_CUES.map(cue=>[cue,typeof source.audioCues?.[cue]==='boolean'?source.audioCues[cue]:true])),
    warningCallouts:Object.fromEntries(WARNING_CUES.map(cue=>[cue,typeof source.warningCallouts?.[cue]==='boolean'?source.warningCallouts[cue]:DEFAULT_WARNING_CALLOUTS[cue]]))
  };
}
export function warningCalloutEnabled(settings,cue) {
  return WARNING_CUES.includes(cue) && soundEnabled(settings,'lineup') && settings.warningCallouts?.[cue]===true;
}
export const PREF_KEY = 'touchline-preferences-v1';
export const durationOK = value => Number.isInteger(value) && value >= 1000 && value <= MAX_DURATION_MS && value % 1000 === 0;
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
    labelMode: labelModeFor(raw),
    ...audioFor(raw),
    endEnabled: typeof raw.endEnabled==='boolean'?raw.endEnabled:true,
    endTime: validEndTime(raw.endTime)?raw.endTime:'23:59',
    endMode: END_MODES.includes(raw.endMode)?raw.endMode:'hard',
    minGameMs: durationOK(raw.minGameMs)?raw.minGameMs:120000,
    colors: validColors(5,raw.colors) ? {...raw.colors} : completeColors(older)
  };
}
const PROFILE_KEYS = ['gameMs','changeMs','colors','labelMode','sounds','crowd','audioCues','warningCallouts','startCountdown','endEnabled','endTime','endMode','minGameMs'];
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
