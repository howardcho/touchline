import {SCHEDULES, PALETTE, validColors, applySettings, assignColors, GAME_MS, CHANGE_MS, matchup, audit, fresh, settle, toggle, move} from './engine.mjs';
const $ = id => document.getElementById(id);
let state = null, wakeLock = null, wantWake = false, audio;
const KEY = 'touchline-session-v1';
let preferredGameMs = GAME_MS;
try { const saved = Number(localStorage.getItem('touchline-game-duration')); if(Number.isInteger(saved) && saved >= 1000 && saved <= 3600000 && saved%1000===0) preferredGameMs=saved; } catch {}
function persist() { try { if(state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch { $('save-note').textContent = 'Session storage is unavailable. Keep this page open to retain your place.'; } }
function restore() {
  try { const s = JSON.parse(localStorage.getItem(KEY));
    if(s) s.gameMs = Number.isInteger(s.gameMs) && s.gameMs>=1000 && s.gameMs<=3600000 && s.gameMs%1000===0 ? s.gameMs : GAME_MS;
    if(s && [4,5].includes(s.teams) && Number.isSafeInteger(s.game) && s.game>0 && ['game','changeover'].includes(s.phase) && typeof s.running==='boolean' && Number.isFinite(s.remaining) && s.remaining>0 && s.remaining<=(s.phase==='game'?s.gameMs:CHANGE_MS) && (!s.running || Number.isFinite(s.deadline))) { s.colors = validColors(s.teams, s.colors) ? s.colors : assignColors(s.teams); state=s; preferredGameMs=s.gameMs; }
  } catch {}
}
function colorName(t) { return state.colors[t]; }
function matchHTML(m) { return `<span class="team-letter" data-color="${colorName(m[0])}">${colorName(m[0])}</span><span class="versus">vs</span><span class="team-letter" data-color="${colorName(m[1])}">${colorName(m[1])}</span>`; }
function render() {
  $('setup-time').textContent = formatTime(preferredGameMs);
  $('setup').hidden = !!state; $('board').hidden = !state;
  if(!state) return;
  const {teams,game,phase,running,remaining,gameMs} = state, changing=phase==='changeover';
  $('team-summary').textContent = `${teams} TEAMS · ${SCHEDULES[teams].length}-GAME ROTATION`;
  $('game-number').textContent = `GAME ${game}`;
  for(const [id,offset] of [['now',0],['next',1],['deck',2]]) { $(''+id+'-match').innerHTML=matchHTML(matchup(teams,game+offset)); $(id+'-match').setAttribute('aria-label',`${colorName(matchup(teams,game+offset)[0])} versus ${colorName(matchup(teams,game+offset)[1])}`); }
  $('next-number').textContent=`GAME ${game+1}`; $('deck-number').textContent=`GAME ${game+2}`;
  const secs=Math.max(0,Math.ceil(remaining/1000)); $('timer').textContent=`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  $('timer').setAttribute('aria-label',`${changing?'Changeover':'Game'} countdown`);
  $('phase-label').textContent=changing?'CHANGEOVER TIMER':'GAME TIMER';
  $('timer-status').textContent=running?(changing?'SWITCH TEAMS':'IN PLAY'):(remaining===(changing?CHANGE_MS:gameMs)?'READY WHEN YOU ARE':'PAUSED');
  $('start').innerHTML=`${running?'Ⅱ':'▶'} <span>${running?'Pause':remaining===(changing?CHANGE_MS:gameMs)?(changing?'Start changeover':'Start game'):'Resume'}</span>`;
  $('timer-help').textContent=changing?`Game ${game} finished · Game ${game+1} starts after the changeover`:'Timer optional · Or just tap Next game';
  $('progress-fill').style.width=`${Math.max(0,Math.min(100,remaining/(changing?CHANGE_MS:gameMs)*100))}%`;
  $('previous').disabled=game===1;
  $('loop-note').textContent=`Loop ${Math.floor((game-1)/SCHEDULES[teams].length)+1} · Game ${(game-1)%SCHEDULES[teams].length+1} of ${SCHEDULES[teams].length}`;
  const shared=[...matchup(teams,game)].filter(t=>matchup(teams,game+1).includes(t));
  $('transition').textContent=shared.length?`Back-to-back: ${shared.map(colorName).join(' & ')} plays again next game. Allow the full changeover.`:'';
}
function announce(text) { $('announcement').textContent=text; }
function sound() { try { if(!audio) return; const osc=audio.createOscillator(), gain=audio.createGain(); osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=740;gain.gain.setValueAtTime(.15,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.65);osc.start();osc.stop(audio.currentTime+.65); } catch {} }
function tick() {
  if(!state?.running) return;
  const old=`${state.game}-${state.phase}`; settle(state,Date.now());
  if(old!==`${state.game}-${state.phase}`) { sound(); announce(state.phase==='changeover'?`Game ${state.game} finished. Thirty second changeover.`:`Game ${state.game}. ${[...matchup(state.teams,state.game)].map(colorName).join(' versus ')}.`); persist(); }
  render();
}
for(const b of document.querySelectorAll('[data-teams]')) b.addEventListener('click',()=> {state=fresh(Number(b.dataset.teams), undefined, preferredGameMs);persist();render();$('start').focus();});
$('start').onclick=()=> {try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume().catch(()=>{}); }catch{} toggle(state,Date.now());persist();render();};
for(const [id,delta] of [['previous',-1],['next',1]]) $(id).onclick=()=>{move(state,delta);persist();render();announce(`Game ${state.game}. Timer paused.`);};
function formatTime(ms) { const sec = Math.ceil(ms/1000); return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`; }
$('settings').onclick=()=> {
  $('color-fields').innerHTML = 'ABCDE'.slice(0,state.teams).split('').map((t,i) => `<label class="color-field">Team ${i+1}<select name="color-${t}" aria-label="Team ${i+1} color">${PALETTE.map(c=>`<option value="${c}" ${state.colors[t]===c?'selected':''}>${c}</option>`).join('')}</select></label>`).join('');
  $('game-minutes').value=Math.floor(state.gameMs/60000);
  $('game-seconds').value=(state.gameMs/1000)%60;
  $('settings-error').textContent='';
  $('options-dialog').showModal();
};
$('settings-form').onsubmit=event=>{
  event.preventDefault();
  const colors = Object.fromEntries('ABCDE'.slice(0,state.teams).split('').map(t=>[t,document.querySelector(`[name="color-${t}"]`).value]));
  const gameMs = (Number($('game-minutes').value)*60+Number($('game-seconds').value))*1000;
  try {
    const changed = gameMs!==state.gameMs;
    applySettings(state,colors,gameMs,Date.now());
    preferredGameMs=gameMs;
    try {localStorage.setItem('touchline-game-duration',String(gameMs));} catch {}
    persist(); render(); $('options-dialog').close();
    announce(changed?'Settings saved. Current game timer reset and paused.':'Team colors saved.');
  } catch(error) { $('settings-error').textContent=error.message; }
};
$('restart').onclick=()=>{state=fresh(state.teams, state.colors, state.gameMs);persist();render();$('options-dialog').close();$('start').focus();};
$('change-teams').onclick=()=>{state=null;persist();render();$('options-dialog').close();document.querySelector('[data-teams]').focus();};
$('schedule-button').onclick=()=>{
  const a=audit(state.teams), s=SCHEDULES[state.teams];
  $('schedule-title').textContent=`${state.teams} teams. ${s.length} games. Repeat.`;
  $('audit-summary').textContent=`Each team plays ${a.counts.A} games (${Number((a.counts.A*state.gameMs/60000).toFixed(2))} minutes) per loop. Every pairing appears ${state.teams===4?'once':'twice'}. Maximum rest: ${Math.max(...Object.values(a.maxRest))} games.`;
  $('schedule-list').innerHTML=s.map((m,i)=>`<div class="schedule-row ${i===(state.game-1)%s.length?'active':''}"><span>Game ${i+1}</span><span>${colorName(m[0])} vs ${colorName(m[1])}</span></div>`).join('');
  $('audit-details').textContent=a.conflicts.length?'Exact supplied schedule: consecutive appearances at '+a.conflicts.map(c=>`${colorName(c.team)}, ${c.from}→${c.to}`).join('; ')+'. Four teams cannot play all six unique matchups without consecutive appearances: after any pairing, the only disjoint pairing is its complement.':'Verified across the loop boundary: no consecutive appearances. Every team rests at most two games.';
  $('schedule-dialog').showModal();
};
$('install-button').onclick=()=> $('install-dialog').showModal();
async function acquireWake() {
  if(!wantWake || document.visibilityState!=='visible') return;
  try {wakeLock=await navigator.wakeLock.request('screen');$('wake-status').textContent='Active';wakeLock.addEventListener('release',()=>{$('wake-status').textContent=wantWake?'Suspended':'';wakeLock=null;});}
  catch { $('wake-status').textContent='Unavailable — check display settings'; }
}
$('wake').onchange=async()=>{wantWake=$('wake').checked;if(wantWake)await acquireWake();else {await wakeLock?.release();$('wake-status').textContent='';}};
if(!('wakeLock' in navigator)) { $('wake').disabled=true; $('wake-status').textContent='Not supported in this browser'; }
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){tick();if(wantWake&&!wakeLock)acquireWake();}persist();});
window.addEventListener('pagehide',persist);
restore();if(state)settle(state,Date.now());render();setInterval(tick,200);setInterval(()=>{if(state?.running)persist();},5000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
