import {resolveSessionEnd,END_MODES,prepareSessionGame} from './session.mjs';
import {loadPreferences, savePreferences, durationOK, profileFor, selectProfile, AUDIO_CUES, soundEnabled} from './preferences.mjs';
import {createMatchSounds} from './native-audio.mjs';
import {timerCue, changeoverCount, lineupFor} from './sounds.mjs';
import {summarizeSession} from './stats.mjs';
import {SCHEDULES, TEAM_COUNTS, PALETTE, validColors, applySettings, colorsForTeams, completeColors, GAME_MS, CHANGE_MS, MAX_DURATION_MS, matchup, audit, fresh, settle, toggle, move, restartGame, adjustTime, updateSessionTiming, jumpToBoardGame, changeTeamRoster, upcomingGame, boardGames, consecutiveColors, rosterColorChoices, endSession} from './engine.mjs';
const $ = id => document.getElementById(id);
let state = null, wakeLock = null, wantWake = false, preparingStart = false;
const KEY = 'touchline-session-v1';
const sounds = createMatchSounds();
const nativeHost=globalThis.touchlineNative ?? globalThis.webkit?.messageHandlers?.touchlineHost;
let preferences;
try { preferences=loadPreferences(localStorage); } catch { preferences=loadPreferences({getItem:()=>null}); }
wantWake=preferences.keepAwake;$('wake').checked=wantWake;
function storageWarning() { $('save-note').textContent='Browser storage is unavailable. Settings will last only while this page stays open.'; }
function persist() {
  try {
    if(state) localStorage.setItem(KEY,JSON.stringify(state)); else localStorage.removeItem(KEY);
    if(!savePreferences(localStorage,preferences)) storageWarning();
  } catch {storageWarning();}
}
function restore() {
  try { const s = JSON.parse(localStorage.getItem(KEY));
    if(s) s.changeMs = durationOK(s.changeMs) ? s.changeMs : CHANGE_MS;
    if(s) s.gameMs = durationOK(s.gameMs) ? s.gameMs : GAME_MS;
    if(s && TEAM_COUNTS.includes(s.teams) && Number.isSafeInteger(s.game) && s.game>0 && ['game','changeover','countdown'].includes(s.phase) && typeof s.running==='boolean' && Number.isFinite(s.remaining) && (s.remaining>0 || (s.finished===true && s.remaining===0)) && s.remaining<=MAX_DURATION_MS && (!s.running || Number.isFinite(s.deadline))) { s.colors = validColors(s.teams, s.colors) ? s.colors : colorsForTeams(s.teams,preferences.colors); s.phaseMs=Math.max(s.remaining,(Number.isFinite(s.phaseMs)&&s.phaseMs>0&&s.phaseMs<=MAX_DURATION_MS)?s.phaseMs:(s.phase==='game'?s.gameMs:s.changeMs)); s.phaseStarted=typeof s.phaseStarted==='boolean'?s.phaseStarted:(s.running||s.remaining<s.gameMs); if(s.pendingTeams && (!TEAM_COUNTS.includes(s.pendingTeams.teams) || !validColors(s.pendingTeams.teams,s.pendingTeams.colors))) delete s.pendingTeams;
      s.teamHistory=Array.isArray(s.teamHistory)?s.teamHistory.filter(h=>TEAM_COUNTS.includes(h.teams)&&Number.isSafeInteger(h.lastGame)&&h.lastGame>0&&validColors(h.teams,h.colors)):[];
      s.segment=Number.isSafeInteger(s.segment)&&s.segment>0?s.segment:1;
      if(!Number.isFinite(s.endAt) || !END_MODES.includes(s.endMode)){delete s.endAt;delete s.endMode;}
      s.startCountdown=typeof s.startCountdown==='boolean'?s.startCountdown:preferences.startCountdown;
      s.openingGameMs=Number.isFinite(s.openingGameMs)&&s.openingGameMs>0&&s.openingGameMs<=MAX_DURATION_MS?s.openingGameMs:s.gameMs;
      s.countdownDone=typeof s.countdownDone==='boolean'?s.countdownDone:s.phase!=='countdown'&&s.phaseStarted;
      s.minGameMs=durationOK(s.minGameMs)?s.minGameMs:Math.min(120000,s.gameMs);
      s.clockView=s.clockView===true;state=s; }
  } catch {}
}
function colorName(t) { return state.colors[t]; }
function teamHTML(color) {
  return `<span class="team-letter" data-color="${color}"><svg class="team-flag" viewBox="0 0 80 64" aria-hidden="true" focusable="false"><path class="flag-pole" d="M12 7v51"/><path class="flag-cloth" d="M13 10C32 0 48 20 69 9v33C48 53 32 33 13 43Z"/><path class="flag-fold" d="M41 11c9 3 18 4 28-2v33c-10 6-19 5-28 2Z"/></svg>${color}</span>`;
}
function matchHTML(m, colors=state.colors) { return `${teamHTML(colors[m[0]])}<span class="versus">vs</span>${teamHTML(colors[m[1]])}`; }
function render() {
  const clockView=!!state?.clockView;
  nativeHost?.setClockView?.(clockView);
  $('board').className=clockView?'clock-view':'';
  $('clock-view-toggle').setAttribute('aria-pressed',String(clockView));
  $('clock-view-toggle').textContent=clockView?'↙ Full board':'⛶ Maximize clock';
  $('defaults-count').textContent=`${preferences.setupTeams}-team defaults`;
  $('setup-time').textContent = formatTime(preferences.gameMs);
  $('setup-changeover').textContent = formatTime(preferences.changeMs);
  $('setup').hidden = !!state; $('board').hidden = !state;
  for(const button of document.querySelectorAll('[data-teams]')) {
    const count=Number(button.dataset.teams), profile=profileFor(preferences,count), colors=colorsForTeams(count,profile.colors);
    button.querySelector('small').textContent=colors ? Object.values(colors).join(' · ') : ['Red','Blue','Green','Black','Yellow'].slice(0,count).join(' · ');
    button.querySelector('.option-timing').textContent=`${formatTime(profile.gameMs)} game · ${formatTime(profile.changeMs)} changeover`;
  }
  $('setup-end-note').textContent=preferences.endEnabled?`Session end: ${preferences.endTime} · ${{hard:'Hard stop',soft:'Finish last game',full:'Full games only'}[preferences.endMode]}`:'';
  if(!state) return;
  const {teams,game,phase,running,remaining,gameMs,changeMs} = state, changing=phase==='changeover',opening=phase==='countdown';
  const displayed=boardGames(state),main=displayed[0];
  $('team-summary').textContent = `${teams} TEAMS · ${SCHEDULES[teams].length}-GAME ROTATION`;
  $('game-number').textContent = `GAME ${main.game}`;
  for(const [i,id] of ['now','next','deck'].entries()) {
    const upcoming=displayed[i],m=upcoming.match;
    $(id+'-title').textContent=upcoming.title;
    $(id+'-match').innerHTML=matchHTML(m,upcoming.colors);
    $(id+'-match').setAttribute('aria-label',`${upcoming.colors[m[0]]} versus ${upcoming.colors[m[1]]}`);
    if(i>0) {
      $(id+'-card').disabled=!!state.finished;
      $(id+'-card').setAttribute('aria-label',`Jump to game ${upcoming.game}: ${upcoming.colors[m[0]]} versus ${upcoming.colors[m[1]]}. Timer resets and pauses.`);
    }
    if(i>0) $(id+'-number').textContent=`${state.pendingTeams?'NEW CYCLE · ':''}GAME ${upcoming.game}`;
  }
  $('session-timing').disabled=!!state.finished;
  const planned=state.pendingTeams?.teams ?? teams;
  $('add-team').disabled=planned===5;$('remove-team').disabled=planned===2;
  $('roster-count').textContent=state.pendingTeams?(teams===planned?`${teams} teams · queued`:`${teams} → ${planned} teams`):`${teams} teams`;
  const roster=state.pendingTeams?.colors || state.colors;
  $('roster-help').textContent=`${state.pendingTeams?'Next roster':'Playing'}: ${Object.values(roster).join(', ')}. Added colors are for this session only.`;
  $('team-change-status').textContent=state.pendingTeams?`${planned} teams queued: ${Object.values(roster).join(', ')}. Current game and changeover finish first, then a fresh cycle. No catch-up games.`:'';
  $('cancel-team-change').hidden=!state.pendingTeams;
  const secs=Math.max(0,Math.ceil(remaining/1000)); $('timer').textContent=`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  $('timer').setAttribute('aria-label',`${opening?'Session start':changing?'Changeover':'Game'} countdown`);
  $('phase-label').textContent=opening?'SESSION STARTS IN':changing?'CHANGEOVER TIMER':'GAME TIMER';
  $('timer-status').textContent=running?(changing?'SWITCH TEAMS':'IN PLAY'):(remaining===(changing?changeMs:gameMs)?'READY WHEN YOU ARE':'PAUSED');
  if(opening)$('timer-status').textContent=running?`STARTING IN ${Math.ceil(remaining/1000)}`:'COUNTDOWN PAUSED';
  if(changing && running && remaining<=5000) $('timer-status').textContent=`NEXT GAME IN ${Math.ceil(remaining/1000)}`;
  $('start').innerHTML=`${running?'Ⅱ':'▶'} <span>${running?'Pause':(changing?remaining===changeMs:!state.phaseStarted)?(changing?'Start changeover':'Start game'):'Resume'}</span>`;
  if(!running && phase==='game' && game===1 && !state.phaseStarted && state.startCountdown && !state.countdownDone)$('start').innerHTML='▶ <span>Start session</span>';
  $('timer-help').textContent=opening?'Get ready · First game starts after the countdown':changing?`Game ${game} finished · Game ${main.game} starts after the changeover`:'Timer optional · Or just tap Next game';
  $('progress-fill').style.width=`${Math.max(0,Math.min(100,remaining/(state.phaseMs ?? (changing?changeMs:gameMs))*100))}%`;
  $('previous').disabled=game===1;
  $('subtract-time').disabled=opening||remaining<=1000;
  $('add-time').disabled=opening||remaining>=MAX_DURATION_MS;
  $('loop-note').textContent=`Loop ${Math.floor((main.game-1)/SCHEDULES[main.teams].length)+1} · Game ${(main.game-1)%SCHEDULES[main.teams].length+1} of ${SCHEDULES[main.teams].length}`;
  const shared=consecutiveColors(state);
  $('session-end-note').textContent=state.finished?(state.finishReason==='insufficient-time'?'Session complete · Not enough time for another game.':'Session complete · End time reached.'):Number.isFinite(state.endAt)?`Ends ${new Date(state.endAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} · ${{hard:'Hard stop',soft:'Finish last game',full:'Full games only'}[state.endMode]}`:'';
  if(state.finished){
    $('end-session').textContent='View summary';
    $('end-session-clock').textContent='View summary';
    $('timer-status').textContent='SESSION COMPLETE';$('phase-label').textContent='FINAL WHISTLE';$('start').innerHTML='Session finished';
    $('timer-help').textContent='Return to selection to start another session.';
    for(const id of ['start','next','previous','next-card','deck-card','add-time','subtract-time','restart-game','add-team','remove-team'])$(id).disabled=true;
    $('transition').textContent='';
    for(const id of ['next','deck']){$(id+'-match').textContent='Session complete';$(id+'-match').setAttribute('aria-label','Session complete');$(id+'-number').textContent='';}
    return;
  }
  $('end-session').textContent='End session';
  $('end-session-clock').textContent='End session';
  $('start').disabled=preparingStart;$('next').disabled=false;$('restart-game').disabled=false;
  if(preparingStart)$('start').textContent='Preparing audio…';
  $('transition').textContent=shared.length?`Back-to-back: ${shared.join(' & ')} ${shared.length===1?'plays':'play'} again next game. Allow the full changeover.`:'';
}
function announce(text) { $('announcement').textContent=text; }
function playCue(cue) {
  if(!cue || document.visibilityState!=='visible')return;
  // Kickoff clears any remaining celebration even when its whistle is muted.
  if(cue==='start')sounds.stop();
  if(soundEnabled(preferences,cue))sounds.play(cue,{crowd:soundEnabled(preferences,'crowd'),crowdVolume:soundEnabled(preferences,'lineup')?0.15:0.45});
  else if(cue==='whistle' && soundEnabled(preferences,'crowd'))sounds.play('crowd');
  if(cue==='whistle' && !state.finished && soundEnabled(preferences,'lineup')){
    const lineup=lineupFor(state);sounds.sayTeams(lineup.up,lineup.deck,{delay:soundEnabled(preferences,'whistle')?3.55:0});announce(lineup.text);
  }
}
function tick() {
  if(!state || state.finished || (!state.running && !Number.isFinite(state.endAt))) return;
  const before={...state}, now=Date.now();settle(state,now);
  const cue=timerCue(before,state,now);
  if(!state.finished)playCue(cue);
  if(['minute','thirty','ten'].includes(cue))announce({minute:'One minute remaining.',thirty:'Thirty seconds remaining.',ten:'Ten seconds remaining.'}[cue]);
  const count=changeoverCount(before,state,now);
  if(count!==null) {
    if(soundEnabled(preferences,'countdown') && document.visibilityState==='visible')sounds.sayCount(count);
    announce(`${count}. Next game starts soon.`);
  }
  if(!before.finished && state.finished){sounds.stop();playCue(cue);announce('Session complete.');persist();render();openSessionSummary();return;}
  if(before.game!==state.game || before.phase!==state.phase || before.segment!==state.segment) {
    announce(state.phase==='changeover'?`Game ${state.game} finished. Changeover: ${formatTime(state.changeMs)}.`:`Game ${state.game}. ${[...matchup(state.teams,state.game)].map(colorName).join(' versus ')}.`);persist();
  }
  render();
}
for(const b of document.querySelectorAll('[data-teams]')) b.addEventListener('click',()=> {
  const teams=Number(b.dataset.teams);
  selectProfile(preferences,teams);
  let ending;try{ending=resolveSessionEnd(preferences);}catch(error){$('setup-error').textContent=error.message;$('setup-settings').focus();return;}
  $('setup-error').textContent='';
  state={...fresh(teams, colorsForTeams(teams,preferences.colors), preferences.gameMs, preferences.changeMs),...ending,startCountdown:preferences.startCountdown};
  persist();render();$('start').focus();
});
$('start').onclick=async()=> {
  if(preparingStart)return;
  sounds.stop();
  const ready=preferences.sounds?sounds.unlock():Promise.resolve(false);
  tick();
  if(wantWake&&!wakeLock)acquireWake();
  const initial=!state.running && state.phase==='game' && state.game===1 && !state.phaseStarted && state.startCountdown && !state.countdownDone;
  const resumeOpening=!state.running && state.phase==='countdown';
  if(initial || resumeOpening){
    preparingStart=true;const original=state,generation=sounds.generation;render();
    const audioReady=await ready;preparingStart=false;
    if(state!==original || sounds.generation!==generation || state.finished){render();return;}
    toggle(state,Date.now());persist();render();
    if(initial && audioReady && state.running && state.phase==='countdown' && soundEnabled(preferences,'countdown'))sounds.sayCount(5);
    announce(state.finished?'Session complete.':initial?'Five-second countdown.':'Countdown resumed.');return;
  }
  const beginning=!state.running && state.phase==='game' && !state.phaseStarted;
  toggle(state,Date.now());if(!state.running)sounds.stop();persist();render();
  const startedState=state,startedGame=state.game,generation=sounds.generation;
  if(await ready) {if(generation===sounds.generation && beginning && state===startedState && state.running && state.phase==='game' && state.game===startedGame)playCue('start');}
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
async function selectGame(delta,cardIndex=null) {
  sounds.stop();const ready=delta>0&&soundEnabled(preferences,'lineup')?sounds.unlock():Promise.resolve(false);
  const audioGeneration=sounds.generation;
  const now=Date.now();if(cardIndex===null)move(state,delta,now);else jumpToBoardGame(state,cardIndex,now);if(delta>0&&Number.isFinite(state.endAt))prepareSessionGame(state,now);persist();render();announce(state.finished?'Session complete.':`Game ${state.game}. Timer paused.`);
  const movedState=state,movedGame=state.game;
  if(await ready && sounds.generation===audioGeneration && state===movedState && state.game===movedGame && !state.finished && document.visibilityState==='visible'){
    const lineup=lineupFor(state,0);sounds.sayTeams(lineup.up,lineup.deck);announce(lineup.text);
  }
}
for(const [id,delta] of [['previous',-1],['next',1]])$(id).onclick=()=>selectGame(delta);
for(const [id,index] of [['next-card',1],['deck-card',2]])$(id).onclick=()=>selectGame(1,index);
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
    const names=['game','session','audio'],index=names.indexOf(tab.dataset.settingsTab);
    const name=event.key==='Home'?names[0]:event.key==='End'?names.at(-1):names[(index+(event.key==='ArrowRight'?1:2))%names.length];
    selectSettingsTab(name,true);
  };
}
// Reveal invalid timer fields before native validation tries to focus them.
$('settings-form').addEventListener('invalid',event=>{
  const panel=event.target.closest('[role=tabpanel]');
  if(panel)selectSettingsTab(panel.id==='settings-session-panel'?'session':'game');
},true);
let settingsDrafts,settingsTeam;
function openSettings() {
  if(state)return;
  settingsDrafts=structuredClone(preferences.profiles);settingsTeam=preferences.setupTeams;
  $('defaults-teams').value=settingsTeam;
  selectSettingsTab('game');fillSettings();$('options-dialog').showModal();
}
function fillSettings() {
  const source=settingsDrafts[settingsTeam];
  renderColorFields(source.colors);
  syncColorOptions();
  $('game-minutes').value=Math.floor(source.gameMs/60000);
  $('game-seconds').value=(source.gameMs/1000)%60;
  $('change-minutes').value=Math.floor(source.changeMs/60000);
  $('change-seconds').value=(source.changeMs/1000)%60;
  $('sounds-enabled').checked=source.sounds;
  $('crowd-enabled').checked=source.crowd;
  $('start-countdown-enabled').checked=source.startCountdown;
  $('end-enabled').checked=source.endEnabled;$('end-time').value=source.endTime;$('end-mode').value=source.endMode;
  $('min-game-minutes').value=Math.floor(source.minGameMs/60000);$('min-game-seconds').value=source.minGameMs/1000%60;
  syncEndFields();
  $('end-time-now').textContent=`Local time now: ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  for(const cue of AUDIO_CUES)$(`${cue}-enabled`).checked=source.audioCues[cue];
  $('sound-status').textContent='';$('settings-error').textContent='';
}
function syncEndFields(){
  const enabled=$('end-enabled').checked,hard=$('end-mode').value==='hard';
  $('end-time').disabled=!enabled;$('end-mode').disabled=!enabled;
  $('min-game-minutes').disabled=!enabled||!hard;$('min-game-seconds').disabled=!enabled||!hard;
}
$('end-enabled').onchange=syncEndFields;$('end-mode').onchange=syncEndFields;
$('setup-settings').onclick=openSettings;
function readSettingsDraft() {
  const colors = Object.fromEntries('ABCDE'.split('').map(t=>[t,document.querySelector(`[name="color-${t}"]`).value]));
  const gameMs = (Number($('game-minutes').value)*60+Number($('game-seconds').value))*1000;
  const changeMs=(Number($('change-minutes').value)*60+Number($('change-seconds').value))*1000;
  if(!validColors(5,colors))throw new Error('Choose five different team colors.');
  const target=fresh(5);
  applySettings(target,colorsForTeams(target.teams,colors),gameMs,Date.now(),changeMs);
  const minGameMs=(Number($('min-game-minutes').value)*60+Number($('min-game-seconds').value))*1000;
  if($('end-enabled').checked && $('end-mode').value==='hard' && (!durationOK(minGameMs)||minGameMs>gameMs)){selectSettingsTab('session');throw new Error('Minimum final game must be at least 1 second and no longer than a full game.');}
  const draft=settingsDrafts[settingsTeam];
  draft.startCountdown=$('start-countdown-enabled').checked;
  draft.endEnabled=$('end-enabled').checked;draft.endTime=$('end-time').value;draft.endMode=$('end-mode').value;
  draft.minGameMs=durationOK(minGameMs)?minGameMs:120000;
  draft.gameMs=gameMs;draft.changeMs=changeMs;
  $('setup-error').textContent='';
  draft.colors={...colors};
  draft.sounds=$('sounds-enabled').checked;
  draft.crowd=$('crowd-enabled').checked;
  draft.audioCues=Object.fromEntries(AUDIO_CUES.map(cue=>[cue,$(`${cue}-enabled`).checked]));
  return draft;
}
$('defaults-teams').onchange=()=>{
  const next=Number($('defaults-teams').value);
  try {
    if(!$('settings-form').reportValidity())throw new Error('Check the highlighted fields before changing profiles.');
    readSettingsDraft();settingsTeam=next;fillSettings();sounds.stop();
  } catch(error){$('defaults-teams').value=settingsTeam;$('settings-error').textContent=error.message;}
};
$('settings-form').onsubmit=event=>{
  event.preventDefault();if(state)return;
  try {
    readSettingsDraft();preferences.profiles=structuredClone(settingsDrafts);
    selectProfile(preferences,settingsTeam);
    if(!preferences.sounds)sounds.stop();
    persist();render();$('options-dialog').close();announce('Team-count defaults saved.');
  }catch(error){$('settings-error').textContent=error.message;}
};
$('session-timing').onclick=()=>{
  tick();if(state.finished)return;
  for(const [prefix,value] of [['session-game',state.gameMs],['session-change',state.changeMs]]){
    $(prefix+'-minutes').value=Math.floor(value/60000);$(prefix+'-seconds').value=value/1000%60;
  }
  $('timing-error').textContent='';$('timing-dialog').showModal();
};
$('cancel-timing').onclick=()=>$('timing-dialog').close();
$('timing-form').onsubmit=event=>{
  event.preventDefault();
  try {
    tick();
    const duration=prefix=>(Number($(prefix+'-minutes').value)*60+Number($(prefix+'-seconds').value))*1000;
    updateSessionTiming(state,duration('session-game'),duration('session-change'),Date.now());
    persist();render();$('timing-dialog').close();announce('Session timing updated. Saved defaults unchanged.');
  }catch(error){$('timing-error').textContent=error.message;}
};
function toggleClockView() {
  if(!state)return;
  state.clockView=!state.clockView;persist();render();$('clock-view-toggle').focus();
}
$('clock-view-toggle').onclick=toggleClockView;
function summaryTime(ms) {
  const seconds=Math.max(0,Math.round(ms/1000)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
  return hours?`${hours}h ${minutes}m ${rest}s`:minutes?`${minutes}m ${rest}s`:`${rest}s`;
}
function openSessionSummary() {
  const summary=summarizeSession(state);
  $('summary-total-time').textContent=summaryTime(summary.totalSessionMs);
  $('summary-average-time').textContent=summaryTime(summary.averagePlayingMs);
  $('summary-games').textContent=String(summary.totalGames);
  const rows=summary.teams.map(team=>{
    const row=document.createElement('div');row.className='summary-row';row.setAttribute('role','row');
    const name=document.createElement('span');name.setAttribute('role','cell');const color=document.createElement('i');color.className='summary-color';color.dataset.color=team.color;name.append(color,team.color);
    const games=document.createElement('strong');games.setAttribute('role','cell');games.textContent=team.games;
    const time=document.createElement('strong');time.setAttribute('role','cell');time.textContent=summaryTime(team.playingMs);row.append(name,games,time);return row;
  });
  $('summary-team-rows').replaceChildren(...rows);
  $('summary-empty').hidden=summary.teams.length>0;
  if(!$('session-summary-dialog').open)$('session-summary-dialog').showModal();
}
const requestSessionEnd=()=>state.finished?openSessionSummary():$('end-session-dialog').showModal();
$('end-session').onclick=requestSessionEnd;$('end-session-clock').onclick=requestSessionEnd;
$('cancel-end-session').onclick=()=>$('end-session-dialog').close();
$('confirm-end-session').onclick=()=>{sounds.stop();endSession(state,Date.now());persist();render();$('end-session-dialog').close();openSessionSummary();announce('Session complete.');};
$('summary-back-to-selection').onclick=()=>{$('session-summary-dialog').close();backToSelection();};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && state?.clockView && !document.querySelector('dialog[open]')){event.preventDefault();toggleClockView();}
});
$('restart').onclick=()=>{sounds.stop();state={...fresh(state.teams, state.colors, state.gameMs, state.changeMs),sessionRoster:!!state.sessionRoster,clockView:!!state.clockView,startCountdown:preferences.startCountdown,...(Number.isFinite(state.endAt)?{endAt:state.endAt,endMode:state.endMode,minGameMs:state.minGameMs}:{})};persist();render();$('options-dialog').close();$('start').focus();announce('Rotation restarted at game 1. Timer paused.');};
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
  if(ready){sounds.stop();if(button.dataset.sound==='countdown')sounds.previewCountdown();else if(button.dataset.sound==='lineup')sounds.sayTeams(['Red','Blue'],['Purple','Black']);else sounds.play(button.dataset.sound,{crowd:$('sounds-enabled').checked && $('crowd-enabled').checked});
    if(sounds.failedAssets.length)$('sound-status').textContent='Some recordings could not load. Available fallback cues will play. Reopen online to reload audio.';}
};
$('options-dialog').addEventListener('close',()=>sounds.stop());
$('install-button').onclick=()=> $('install-dialog').showModal();
async function acquireWake() {
  if(!wantWake || document.visibilityState!=='visible') return;
  if(nativeHost){nativeHost.postMessage({keepAwake:true});$('wake-status').textContent='Active';return;}
  try {wakeLock=await navigator.wakeLock.request('screen');$('wake-status').textContent='Active';wakeLock.addEventListener('release',()=>{$('wake-status').textContent=wantWake?'Suspended':'';wakeLock=null;});}
  catch { $('wake-status').textContent='Unavailable — check display settings'; }
}
$('wake').onchange=async()=>{wantWake=$('wake').checked;preferences.keepAwake=wantWake;persist();if(wantWake)await acquireWake();else {nativeHost?.postMessage({keepAwake:false});await wakeLock?.release();$('wake-status').textContent='';}};
if(!nativeHost && !('wakeLock' in navigator)) { $('wake').disabled=true; $('wake-status').textContent='Not supported in this browser'; }
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')sounds.stop();if(document.visibilityState==='visible'){tick();if(wantWake&&!wakeLock)acquireWake();}persist();});
window.addEventListener('pagehide',persist);
restore();if(state)settle(state,Date.now());persist();render();setInterval(tick,200);setInterval(()=>{if(state?.running)persist();},5000);
if(nativeHost)$('install-button').hidden=true;
if(!nativeHost && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
