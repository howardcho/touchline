import {loadPreferences, savePreferences, durationOK, AUDIO_CUES, soundEnabled} from './preferences.mjs';
import {MatchSounds, timerCue, changeoverCount} from './sounds.mjs';
import {SCHEDULES, TEAM_COUNTS, PALETTE, validColors, applySettings, colorsForTeams, completeColors, GAME_MS, CHANGE_MS, matchup, audit, fresh, settle, toggle, move, restartGame, adjustTime, changeTeamRoster, upcomingGame, consecutiveColors, rosterColorChoices} from './engine.mjs';
const $ = id => document.getElementById(id);
let state = null, wakeLock = null, wantWake = false;
const KEY = 'touchline-session-v1';
const sounds = new MatchSounds();
let preferences;
try { preferences=loadPreferences(localStorage); } catch { preferences=loadPreferences({getItem:()=>null}); }
function storageWarning() { $('save-note').textContent='Browser storage is unavailable. Settings will last only while this page stays open.'; }
function persist() {
  if(state) {
    preferences.gameMs=state.gameMs; preferences.changeMs=state.changeMs;
  }
  try {
    if(state) localStorage.setItem(KEY,JSON.stringify(state)); else localStorage.removeItem(KEY);
    if(!savePreferences(localStorage,preferences)) storageWarning();
  } catch {storageWarning();}
}
function restore() {
  try { const s = JSON.parse(localStorage.getItem(KEY));
    if(s) s.changeMs = durationOK(s.changeMs) ? s.changeMs : CHANGE_MS;
    if(s) s.gameMs = Number.isInteger(s.gameMs) && s.gameMs>=1000 && s.gameMs<=3600000 && s.gameMs%1000===0 ? s.gameMs : GAME_MS;
    if(s && TEAM_COUNTS.includes(s.teams) && Number.isSafeInteger(s.game) && s.game>0 && ['game','changeover'].includes(s.phase) && typeof s.running==='boolean' && Number.isFinite(s.remaining) && s.remaining>0 && s.remaining<=3600000 && (!s.running || Number.isFinite(s.deadline))) { s.colors = validColors(s.teams, s.colors) ? s.colors : colorsForTeams(s.teams,preferences.colors); s.phaseMs=Math.max(s.remaining,durationOK(s.phaseMs)?s.phaseMs:(s.phase==='game'?s.gameMs:s.changeMs)); s.phaseStarted=typeof s.phaseStarted==='boolean'?s.phaseStarted:(s.running||s.remaining<s.gameMs); if(s.pendingTeams && (!TEAM_COUNTS.includes(s.pendingTeams.teams) || !validColors(s.pendingTeams.teams,s.pendingTeams.colors))) delete s.pendingTeams;
      s.teamHistory=Array.isArray(s.teamHistory)?s.teamHistory.filter(h=>TEAM_COUNTS.includes(h.teams)&&Number.isSafeInteger(h.lastGame)&&h.lastGame>0&&validColors(h.teams,h.colors)):[];
      s.segment=Number.isSafeInteger(s.segment)&&s.segment>0?s.segment:1;
      state=s; preferences.gameMs=s.gameMs; preferences.changeMs=s.changeMs; if(!s.sessionRoster)preferences.colors=completeColors({...preferences.colors,...s.colors}); }
  } catch {}
}
function colorName(t) { return state.colors[t]; }
function teamHTML(color) {
  return `<span class="team-letter" data-color="${color}"><svg class="team-flag" viewBox="0 0 80 64" aria-hidden="true" focusable="false"><path class="flag-pole" d="M12 7v51"/><path class="flag-cloth" d="M13 10C32 0 48 20 69 9v33C48 53 32 33 13 43Z"/><path class="flag-fold" d="M41 11c9 3 18 4 28-2v33c-10 6-19 5-28 2Z"/></svg>${color}</span>`;
}
function matchHTML(m, colors=state.colors) { return `${teamHTML(colors[m[0]])}<span class="versus">vs</span>${teamHTML(colors[m[1]])}`; }
function render() {
  $('setup-time').textContent = formatTime(preferences.gameMs);
  $('setup-changeover').textContent = formatTime(preferences.changeMs);
  $('setup').hidden = !!state; $('board').hidden = !state;
  for(const button of document.querySelectorAll('[data-teams]')) {
    const count=Number(button.dataset.teams), colors=colorsForTeams(count,preferences.colors);
    button.querySelector('small').textContent=colors ? Object.values(colors).join(' · ') : ['Red','Blue','Green','Black','Yellow'].slice(0,count).join(' · ');
  }
  if(!state) return;
  const {teams,game,phase,running,remaining,gameMs,changeMs} = state, changing=phase==='changeover';
  $('team-summary').textContent = `${teams} TEAMS · ${SCHEDULES[teams].length}-GAME ROTATION`;
  $('game-number').textContent = `GAME ${game}`;
  for(const [id,offset] of [['now',0],['next',1],['deck',2]]) {
    const upcoming=upcomingGame(state,offset), m=matchup(upcoming.teams,upcoming.game);
    $(id+'-match').innerHTML=matchHTML(m,upcoming.colors);
    $(id+'-match').setAttribute('aria-label',`${upcoming.colors[m[0]]} versus ${upcoming.colors[m[1]]}`);
    if(offset>0) $(id+'-number').textContent=`${state.pendingTeams?'NEW CYCLE · ':''}GAME ${upcoming.game}`;
  }
  const planned=state.pendingTeams?.teams ?? teams;
  $('add-team').disabled=planned===5;$('remove-team').disabled=planned===2;
  $('roster-count').textContent=state.pendingTeams?(teams===planned?`${teams} teams · queued`:`${teams} → ${planned} teams`):`${teams} teams`;
  const roster=state.pendingTeams?.colors || state.colors;
  $('roster-help').textContent=`${state.pendingTeams?'Next roster':'Playing'}: ${Object.values(roster).join(', ')}. Added colors are for this session only.`;
  $('team-change-status').textContent=state.pendingTeams?`${planned} teams queued: ${Object.values(roster).join(', ')}. Current game and changeover finish first, then a fresh cycle. No catch-up games.`:'';
  $('cancel-team-change').hidden=!state.pendingTeams;
  const secs=Math.max(0,Math.ceil(remaining/1000)); $('timer').textContent=`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  $('timer').setAttribute('aria-label',`${changing?'Changeover':'Game'} countdown`);
  $('phase-label').textContent=changing?'CHANGEOVER TIMER':'GAME TIMER';
  $('timer-status').textContent=running?(changing?'SWITCH TEAMS':'IN PLAY'):(remaining===(changing?changeMs:gameMs)?'READY WHEN YOU ARE':'PAUSED');
  if(changing && running && remaining<=5000) $('timer-status').textContent=`NEXT GAME IN ${Math.ceil(remaining/1000)}`;
  $('start').innerHTML=`${running?'Ⅱ':'▶'} <span>${running?'Pause':(changing?remaining===changeMs:!state.phaseStarted)?(changing?'Start changeover':'Start game'):'Resume'}</span>`;
  $('timer-help').textContent=changing?`Game ${game} finished · Game ${game+1} starts after the changeover`:'Timer optional · Or just tap Next game';
  $('progress-fill').style.width=`${Math.max(0,Math.min(100,remaining/(state.phaseMs ?? (changing?changeMs:gameMs))*100))}%`;
  $('previous').disabled=game===1;
  $('subtract-time').disabled=remaining<=1000;
  $('add-time').disabled=remaining>=3600000;
  $('loop-note').textContent=`Loop ${Math.floor((game-1)/SCHEDULES[teams].length)+1} · Game ${(game-1)%SCHEDULES[teams].length+1} of ${SCHEDULES[teams].length}`;
  const shared=consecutiveColors(state);
  $('transition').textContent=shared.length?`Back-to-back: ${shared.join(' & ')} ${shared.length===1?'plays':'play'} again next game. Allow the full changeover.`:'';
}
function announce(text) { $('announcement').textContent=text; }
function playCue(cue) {
  if(!cue || document.visibilityState!=='visible')return;
  // Kickoff clears any remaining celebration even when its whistle is muted.
  if(cue==='start')sounds.stop();
  if(soundEnabled(preferences,cue))sounds.play(cue,{crowd:soundEnabled(preferences,'crowd')});
  else if(cue==='whistle' && soundEnabled(preferences,'crowd'))sounds.play('crowd');
}
function tick() {
  if(!state?.running) return;
  const before={...state}, now=Date.now();settle(state,now);
  const cue=timerCue(before,state,now);
  playCue(cue);
  if(cue==='minute')announce('One minute remaining.');
  const count=changeoverCount(before,state,now);
  if(count!==null) {
    if(soundEnabled(preferences,'countdown') && document.visibilityState==='visible')sounds.sayCount(count);
    announce(`${count}. Next game starts soon.`);
  }
  if(before.game!==state.game || before.phase!==state.phase || before.segment!==state.segment) {
    announce(state.phase==='changeover'?`Game ${state.game} finished. Changeover: ${formatTime(state.changeMs)}.`:`Game ${state.game}. ${[...matchup(state.teams,state.game)].map(colorName).join(' versus ')}.`);persist();
  }
  render();
}
for(const b of document.querySelectorAll('[data-teams]')) b.addEventListener('click',()=> {
  const teams=Number(b.dataset.teams);
  preferences.setupTeams=teams;
  state=fresh(teams, colorsForTeams(teams,preferences.colors), preferences.gameMs, preferences.changeMs);
  persist();render();$('start').focus();
});
$('start').onclick=async()=> {
  sounds.stop();
  // Unlock audio directly from the tap; browsers require a user gesture.
  const ready=preferences.sounds?sounds.unlock():Promise.resolve(false);
  tick();
  const beginning=!state.running && state.phase==='game' && !state.phaseStarted;
  toggle(state,Date.now());if(!state.running)sounds.stop();persist();render();
  const startedState=state,startedGame=state.game;
  if(await ready) {if(beginning && state===startedState && state.running && state.phase==='game' && state.game===startedGame)playCue('start');}
};
let rosterAction='add';
function openRosterPicker(action) {
  tick();
  const current=Object.values(state.pendingTeams?.colors || state.colors);
  if((action==='add' && current.length>=5)||(action==='remove' && current.length<=2))return;
  rosterAction=action;
  const candidates=rosterColorChoices(state,action,preferences.colors);
  $('roster-title').textContent=action==='add'?'Add a team':'Remove a team';
  $('roster-description').textContent=action==='add'?'Choose the arriving team’s color. This changes only the current session; your saved five colors stay the same.':'Choose one of the teams currently in this session. Only selected teams are listed. The remaining teams keep their colors, and the next cycle starts fresh.';
  $('roster-color').innerHTML='<option value="" disabled selected>Choose a color</option>'+candidates.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('roster-confirm').textContent=action==='add'?'Add team':'Remove team';
  $('roster-error').textContent='';$('roster-dialog').showModal();
}
$('add-team').onclick=()=>openRosterPicker('add');
$('remove-team').onclick=()=>openRosterPicker('remove');
$('roster-form').onsubmit=event=>{
  event.preventDefault();
  try {
    tick();sounds.stop();changeTeamRoster(state,rosterAction,$('roster-color').value,Date.now());
    persist();render();$('roster-dialog').close();
    announce(state.pendingTeams?'Roster change queued for next game.':`${state.teams} teams. Fresh cycle ready.`);
  } catch(error){$('roster-error').textContent=error.message;}
};
$('cancel-team-change').onclick=()=>{delete state.pendingTeams;persist();render();announce('Team-count change canceled.');};
$('restart-game').onclick=()=>{
  sounds.stop();restartGame(state);persist();render();
  announce(`Game ${state.game} restarted with ${formatTime(state.gameMs)}. Timer paused.`);
  $('start').focus();
};
for(const [id,delta] of [['subtract-time',-30000],['add-time',30000]]) $(id).onclick=()=>{
  sounds.stop();adjustTime(state,delta,Date.now());persist();render();
  announce(`${state.phase==='game'?'Game':'Changeover'} timer: ${formatTime(state.remaining)}. ${state.running?'Running':'Paused'}.`);
};
for(const [id,delta] of [['previous',-1],['next',1]]) $(id).onclick=()=>{sounds.stop();move(state,delta);persist();render();announce(`Game ${state.game}. Timer paused.`);};
function formatTime(ms) { const sec = Math.ceil(ms/1000); return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`; }
function renderColorFields(colors) {
  $('color-fields').innerHTML = 'ABCDE'.split('').map((t,i) => `<label class="color-field">Team ${i+1}<select name="color-${t}" aria-label="Team ${i+1} color">${PALETTE.map(c=>`<option value="${c}" ${colors[t]===c?'selected':''}>${c}</option>`).join('')}</select></label>`).join('');
}
function syncColorOptions() {
  const selects=[...$('color-fields').querySelectorAll('select')];
  for(const select of selects) {
    const used=new Set(selects.filter(other=>other!==select).map(other=>other.value));
    for(const option of select.options) option.disabled=used.has(option.value);
  }
}
$('color-fields').addEventListener('change',()=>{syncColorOptions();$('settings-error').textContent='';});
function selectSettingsTab(name,focus=false) {
  for(const tab of document.querySelectorAll('[data-settings-tab]')) {
    const selected=tab.dataset.settingsTab===name;
    tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    $(tab.getAttribute('aria-controls')).hidden=!selected;
    if(selected && focus)tab.focus();
  }
  if(name!=='audio')sounds.stop();
}
for(const tab of document.querySelectorAll('[data-settings-tab]')) {
  tab.onclick=()=>selectSettingsTab(tab.dataset.settingsTab);
  tab.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const name=event.key==='Home'?'game':event.key==='End'?'audio':tab.dataset.settingsTab==='game'?'audio':'game';
    selectSettingsTab(name,true);
  };
}
// Reveal invalid timer fields before native validation tries to focus them.
$('settings-form').addEventListener('invalid',event=>{
  if($('settings-game-panel').contains(event.target))selectSettingsTab('game');
},true);
function openSettings() {
  if(state)return;
  selectSettingsTab('game');
  const source=preferences;
  renderColorFields(preferences.colors);
  syncColorOptions();
  $('game-minutes').value=Math.floor(source.gameMs/60000);
  $('game-seconds').value=(source.gameMs/1000)%60;
  $('change-minutes').value=Math.floor(source.changeMs/60000);
  $('change-seconds').value=(source.changeMs/1000)%60;
  $('sounds-enabled').checked=preferences.sounds;
  $('crowd-enabled').checked=preferences.crowd;
  for(const cue of AUDIO_CUES)$(`${cue}-enabled`).checked=preferences.audioCues[cue];
  $('sound-status').textContent='';$('settings-error').textContent='';
  $('options-dialog').showModal();
}
$('setup-settings').onclick=openSettings;
$('settings-form').onsubmit=event=>{
  event.preventDefault();
  if(state)return;
  const colors = Object.fromEntries('ABCDE'.split('').map(t=>[t,document.querySelector(`[name="color-${t}"]`).value]));
  const gameMs = (Number($('game-minutes').value)*60+Number($('game-seconds').value))*1000;
  const changeMs=(Number($('change-minutes').value)*60+Number($('change-seconds').value))*1000;
  try {
    if(!validColors(5,colors))throw new Error('Choose five different team colors.');
    const target=fresh(5);
    applySettings(target,colorsForTeams(target.teams,colors),gameMs,Date.now(),changeMs);
    preferences.gameMs=gameMs;preferences.changeMs=changeMs;
    preferences.colors={...colors};
    preferences.sounds=$('sounds-enabled').checked;
    preferences.crowd=$('crowd-enabled').checked;
    preferences.audioCues=Object.fromEntries(AUDIO_CUES.map(cue=>[cue,$(`${cue}-enabled`).checked]));
    if(!preferences.sounds)sounds.stop();
    persist(); render(); $('options-dialog').close();
    announce('Settings saved.');
  } catch(error) { $('settings-error').textContent=error.message; }
};
$('restart').onclick=()=>{sounds.stop();state={...fresh(state.teams, state.colors, state.gameMs, state.changeMs),sessionRoster:!!state.sessionRoster};persist();render();$('options-dialog').close();$('start').focus();announce('Rotation restarted at game 1. Timer paused.');};
function backToSelection(){sounds.stop();state=null;persist();render();$('options-dialog').close();$('setup-settings').focus();}
$('back-to-selection').onclick=backToSelection;
$('home-link').onclick=event=>{event.preventDefault();backToSelection();};
$('schedule-button').onclick=()=>{
  const a=audit(state.teams), s=SCHEDULES[state.teams];
  $('schedule-title').textContent=`${state.teams} teams. ${s.length} ${s.length===1?'game':'games'}. Repeat.`;
  $('audit-summary').textContent=`Each team plays ${a.counts.A} ${a.counts.A===1?'game':'games'} (${Number((a.counts.A*state.gameMs/60000).toFixed(2))} minutes) per loop. Every pairing appears ${state.teams===5?'twice':'once'}. Maximum rest: ${Math.max(...Object.values(a.maxRest))} ${Math.max(...Object.values(a.maxRest))===1?'game':'games'}.`;
  $('schedule-list').innerHTML=s.map((m,i)=>`<div class="schedule-row ${i===(state.game-1)%s.length?'active':''}"><span>Game ${i+1}</span><span>${colorName(m[0])} vs ${colorName(m[1])}</span></div>`).join('');
  $('audit-details').textContent=a.conflicts.length?(state.teams>=4?'Exact supplied schedule: consecutive appearances at ':'Repeating schedule: consecutive appearances at ')+a.conflicts.map(c=>`${colorName(c.team)}, ${c.from}→${c.to}`).join('; ')+(state.teams===4 ? '. Four teams cannot play all six unique matchups without consecutive appearances: after any pairing, the only disjoint pairing is its complement.' : state.teams===3 ? '. With three teams, every two matchups share one team. Each team plays twice per loop and rests at most one game.' : '. With two teams, both teams play every game. Use the changeover for a break.'):'Verified across the loop boundary: no consecutive appearances. Every team rests at most two games.';
  $('team-history').replaceChildren();
  for(const item of state.teamHistory || []) {
    const row=document.createElement('p');row.textContent=`${item.teams} teams · ended after game ${item.lastGame} · ${Object.values(item.colors).join(', ')}`;
    $('team-history').append(row);
  }
  $('team-history-section').hidden=!(state.teamHistory?.length);
  $('schedule-dialog').showModal();
};
for(const button of document.querySelectorAll('[data-sound]')) button.onclick=async()=>{
  $('sound-status').textContent='Preparing audio…';
  const ready=await sounds.unlock();
  if(!$('options-dialog').open || $('settings-audio-panel').hidden)return;
  $('sound-status').textContent=ready ? 'Preview playing. Check your device volume.' : 'Audio unavailable. Check browser and device sound settings.';
  if(ready){sounds.stop();if(button.dataset.sound==='countdown')sounds.previewCountdown();else sounds.play(button.dataset.sound,{crowd:$('sounds-enabled').checked && $('crowd-enabled').checked});
    if(sounds.failedAssets.length)$('sound-status').textContent='Some recordings could not load. Available fallback cues will play. Reopen online to reload audio.';}
};
$('options-dialog').addEventListener('close',()=>sounds.stop());
$('install-button').onclick=()=> $('install-dialog').showModal();
async function acquireWake() {
  if(!wantWake || document.visibilityState!=='visible') return;
  try {wakeLock=await navigator.wakeLock.request('screen');$('wake-status').textContent='Active';wakeLock.addEventListener('release',()=>{$('wake-status').textContent=wantWake?'Suspended':'';wakeLock=null;});}
  catch { $('wake-status').textContent='Unavailable — check display settings'; }
}
$('wake').onchange=async()=>{wantWake=$('wake').checked;if(wantWake)await acquireWake();else {await wakeLock?.release();$('wake-status').textContent='';}};
if(!('wakeLock' in navigator)) { $('wake').disabled=true; $('wake-status').textContent='Not supported in this browser'; }
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')sounds.stop();if(document.visibilityState==='visible'){tick();if(wantWake&&!wakeLock)acquireWake();}persist();});
window.addEventListener('pagehide',persist);
restore();if(state)settle(state,Date.now());persist();render();setInterval(tick,200);setInterval(()=>{if(state?.running)persist();},5000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
