import {loadPreferences, savePreferences, durationOK} from './preferences.mjs';
import {MatchSounds, timerCue, changeoverCount} from './sounds.mjs';
import {SCHEDULES, PALETTE, validColors, applySettings, assignColors, GAME_MS, CHANGE_MS, matchup, audit, fresh, settle, toggle, move} from './engine.mjs';
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
    preferences.colorsByTeams[state.teams]={...state.colors};
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
    if(s && [4,5].includes(s.teams) && Number.isSafeInteger(s.game) && s.game>0 && ['game','changeover'].includes(s.phase) && typeof s.running==='boolean' && Number.isFinite(s.remaining) && s.remaining>0 && s.remaining<=(s.phase==='game'?s.gameMs:s.changeMs) && (!s.running || Number.isFinite(s.deadline))) { s.colors = validColors(s.teams, s.colors) ? s.colors : assignColors(s.teams); state=s; preferences.gameMs=s.gameMs; preferences.changeMs=s.changeMs; preferences.colorsByTeams[s.teams]={...s.colors}; }
  } catch {}
}
function colorName(t) { return state.colors[t]; }
function matchHTML(m) { return `<span class="team-letter" data-color="${colorName(m[0])}">${colorName(m[0])}</span><span class="versus">vs</span><span class="team-letter" data-color="${colorName(m[1])}">${colorName(m[1])}</span>`; }
function render() {
  $('setup-time').textContent = formatTime(preferences.gameMs);
  $('setup-changeover').textContent = formatTime(preferences.changeMs);
  $('setup').hidden = !!state; $('board').hidden = !state;
  if(!state) return;
  const {teams,game,phase,running,remaining,gameMs,changeMs} = state, changing=phase==='changeover';
  $('team-summary').textContent = `${teams} TEAMS · ${SCHEDULES[teams].length}-GAME ROTATION`;
  $('game-number').textContent = `GAME ${game}`;
  for(const [id,offset] of [['now',0],['next',1],['deck',2]]) { $(''+id+'-match').innerHTML=matchHTML(matchup(teams,game+offset)); $(id+'-match').setAttribute('aria-label',`${colorName(matchup(teams,game+offset)[0])} versus ${colorName(matchup(teams,game+offset)[1])}`); }
  $('next-number').textContent=`GAME ${game+1}`; $('deck-number').textContent=`GAME ${game+2}`;
  const secs=Math.max(0,Math.ceil(remaining/1000)); $('timer').textContent=`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  $('timer').setAttribute('aria-label',`${changing?'Changeover':'Game'} countdown`);
  $('phase-label').textContent=changing?'CHANGEOVER TIMER':'GAME TIMER';
  $('timer-status').textContent=running?(changing?'SWITCH TEAMS':'IN PLAY'):(remaining===(changing?changeMs:gameMs)?'READY WHEN YOU ARE':'PAUSED');
  if(changing && running && remaining<=5000) $('timer-status').textContent=`NEXT GAME IN ${Math.ceil(remaining/1000)}`;
  $('start').innerHTML=`${running?'Ⅱ':'▶'} <span>${running?'Pause':remaining===(changing?changeMs:gameMs)?(changing?'Start changeover':'Start game'):'Resume'}</span>`;
  $('timer-help').textContent=changing?`Game ${game} finished · Game ${game+1} starts after the changeover`:'Timer optional · Or just tap Next game';
  $('progress-fill').style.width=`${Math.max(0,Math.min(100,remaining/(changing?changeMs:gameMs)*100))}%`;
  $('previous').disabled=game===1;
  $('loop-note').textContent=`Loop ${Math.floor((game-1)/SCHEDULES[teams].length)+1} · Game ${(game-1)%SCHEDULES[teams].length+1} of ${SCHEDULES[teams].length}`;
  const shared=[...matchup(teams,game)].filter(t=>matchup(teams,game+1).includes(t));
  $('transition').textContent=shared.length?`Back-to-back: ${shared.map(colorName).join(' & ')} plays again next game. Allow the full changeover.`:'';
}
function announce(text) { $('announcement').textContent=text; }
function playCue(cue) { if(cue && preferences.sounds && document.visibilityState==='visible') sounds.play(cue); }
function tick() {
  if(!state?.running) return;
  const before={...state}, now=Date.now();settle(state,now);
  const cue=timerCue(before,state,now);
  playCue(cue);
  if(cue==='minute')announce('One minute remaining.');
  const count=changeoverCount(before,state,now);
  if(count!==null) {
    if(preferences.sounds && document.visibilityState==='visible')sounds.sayCount(count);
    announce(`${count}. Next game starts soon.`);
  }
  if(before.game!==state.game || before.phase!==state.phase) {
    announce(state.phase==='changeover'?`Game ${state.game} finished. Changeover: ${formatTime(state.changeMs)}.`:`Game ${state.game}. ${[...matchup(state.teams,state.game)].map(colorName).join(' versus ')}.`);persist();
  }
  render();
}
for(const b of document.querySelectorAll('[data-teams]')) b.addEventListener('click',()=> {
  const teams=Number(b.dataset.teams);
  state=fresh(teams, preferences.colorsByTeams[teams], preferences.gameMs, preferences.changeMs);
  persist();render();$('start').focus();
});
$('start').onclick=async()=> {
  sounds.stop();
  // Unlock audio directly from the tap; browsers require a user gesture.
  const ready=preferences.sounds?sounds.unlock():Promise.resolve(false);
  tick();
  const beginning=!state.running && state.phase==='game' && state.remaining===state.gameMs;
  toggle(state,Date.now());if(!state.running)sounds.stop();persist();render();
  if(await ready) {if(beginning && state.running)playCue('start');}
};
for(const [id,delta] of [['previous',-1],['next',1]]) $(id).onclick=()=>{sounds.stop();move(state,delta);persist();render();announce(`Game ${state.game}. Timer paused.`);};
function formatTime(ms) { const sec = Math.ceil(ms/1000); return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`; }
$('settings').onclick=()=> {
  $('color-fields').innerHTML = 'ABCDE'.slice(0,state.teams).split('').map((t,i) => `<label class="color-field">Team ${i+1}<select name="color-${t}" aria-label="Team ${i+1} color">${PALETTE.map(c=>`<option value="${c}" ${state.colors[t]===c?'selected':''}>${c}</option>`).join('')}</select></label>`).join('');
  $('game-minutes').value=Math.floor(state.gameMs/60000);
  $('game-seconds').value=(state.gameMs/1000)%60;
  $('change-minutes').value=Math.floor(state.changeMs/60000);
  $('change-seconds').value=(state.changeMs/1000)%60;
  $('sounds-enabled').checked=preferences.sounds;
  $('sound-status').textContent='';
  $('settings-error').textContent='';
  $('options-dialog').showModal();
};
$('settings-form').onsubmit=event=>{
  event.preventDefault();
  const colors = Object.fromEntries('ABCDE'.slice(0,state.teams).split('').map(t=>[t,document.querySelector(`[name="color-${t}"]`).value]));
  const gameMs = (Number($('game-minutes').value)*60+Number($('game-seconds').value))*1000;
  const changeMs=(Number($('change-minutes').value)*60+Number($('change-seconds').value))*1000;
  try {
    const changed = gameMs!==state.gameMs || changeMs!==state.changeMs;
    applySettings(state,colors,gameMs,Date.now(),changeMs);
    preferences.sounds=$('sounds-enabled').checked;
    if(changed || !preferences.sounds)sounds.stop();
    persist(); render(); $('options-dialog').close();
    announce(changed?'Settings saved. Current game timer reset and paused.':'Settings saved.');
  } catch(error) { $('settings-error').textContent=error.message; }
};
$('restart').onclick=()=>{sounds.stop();state=fresh(state.teams, state.colors, state.gameMs, state.changeMs);persist();render();$('options-dialog').close();$('start').focus();};
$('change-teams').onclick=()=>{sounds.stop();state=null;persist();render();$('options-dialog').close();document.querySelector('[data-teams]').focus();};
$('schedule-button').onclick=()=>{
  const a=audit(state.teams), s=SCHEDULES[state.teams];
  $('schedule-title').textContent=`${state.teams} teams. ${s.length} games. Repeat.`;
  $('audit-summary').textContent=`Each team plays ${a.counts.A} games (${Number((a.counts.A*state.gameMs/60000).toFixed(2))} minutes) per loop. Every pairing appears ${state.teams===4?'once':'twice'}. Maximum rest: ${Math.max(...Object.values(a.maxRest))} games.`;
  $('schedule-list').innerHTML=s.map((m,i)=>`<div class="schedule-row ${i===(state.game-1)%s.length?'active':''}"><span>Game ${i+1}</span><span>${colorName(m[0])} vs ${colorName(m[1])}</span></div>`).join('');
  $('audit-details').textContent=a.conflicts.length?'Exact supplied schedule: consecutive appearances at '+a.conflicts.map(c=>`${colorName(c.team)}, ${c.from}→${c.to}`).join('; ')+'. Four teams cannot play all six unique matchups without consecutive appearances: after any pairing, the only disjoint pairing is its complement.':'Verified across the loop boundary: no consecutive appearances. Every team rests at most two games.';
  $('schedule-dialog').showModal();
};
for(const button of document.querySelectorAll('[data-sound]')) button.onclick=async()=>{
  const ready=await sounds.unlock();
  $('sound-status').textContent=ready ? 'Preview playing. Check your device volume.' : 'Audio unavailable. Check browser and device sound settings.';
  if(ready){sounds.stop();if(button.dataset.sound==='countdown')sounds.previewCountdown();else sounds.play(button.dataset.sound);}
};
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
