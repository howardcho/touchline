import {settleSession,prepareSessionGame,canStartGame,finishSession} from './session.mjs';
import {beginSessionTracking,registerSessionTeams,beginGameTracking,accrueGameTracking,pauseGameTracking,completeGameTracking,discardGameTracking} from './stats.mjs';
export const TEAM_COUNTS = [2,3,4,5];
export const SCHEDULES = {
  2: ['AB'],
  3: ['AB','AC','BC'],
  4: 'AB CD AC BD AD BC'.split(' '),
  5: 'AB CD AE BD CE AD BE AC DE BC AE BD AC BE CD AB DE BC AD CE'.split(' ')
};
export const COLORS = ['Red', 'Blue', 'Green', 'Black', 'Yellow'];
export const PALETTE = [...COLORS, 'Orange', 'Purple', 'Pink', 'White', 'Gray'];
export function validColors(teams, colors) {
  const names = 'ABCDE'.slice(0, teams).split('').map(t => colors?.[t]);
  return new Set(names).size === teams && names.every(c => PALETTE.includes(c));
}
export function colorsForTeams(teams, colors = Object.fromEntries(COLORS.map((c,i)=>['ABCDE'[i],c]))) {
  return Object.fromEntries('ABCDE'.slice(0,teams).split('').map(t=>[t,colors[t]]));
}
export function assignColors(teams) { return colorsForTeams(teams); }
// Preserve the existing ordered prefix when migrating an older session.
export function completeColors(partial = {}) {
  const used=new Set();
  return Object.fromEntries('ABCDE'.split('').map(t=>{
    const preferred=partial[t];
    const color=PALETTE.includes(preferred) && !used.has(preferred) ? preferred : PALETTE.find(c=>!used.has(c));
    used.add(color);return [t,color];
  }));
}
export const GAME_MS = 240000;
export const CHANGE_MS = 30000;
export const MAX_DURATION_MS = 24*60*60*1000;
export const matchup = (teams, game) => SCHEDULES[teams][(game - 1) % SCHEDULES[teams].length];
const playingColors = state => [...matchup(state.teams,state.game)].map(team=>state.colors[team]);
export function audit(teams) {
  const s = SCHEDULES[teams], labels = 'ABCDE'.slice(0, teams).split('');
  const counts = Object.fromEntries(labels.map(t => [t, s.filter(m => m.includes(t)).length]));
  const pairs = Object.fromEntries([...new Set(s)].map(m => [m, s.filter(x => x === m).length]));
  const conflicts = s.flatMap((m, i) => [...m].filter(t => s[(i + 1) % s.length].includes(t)).map(team => ({team, from:i+1, to:(i+1)%s.length+1})));
  const maxRest = Object.fromEntries(labels.map(t => {
    const indices = s.flatMap((m,i) => m.includes(t) ? [i] : []);
    return [t, Math.max(...indices.map((p,i) => ((indices[(i+1)%indices.length] - p + s.length)%s.length || s.length) - 1))];
  }));
  return {counts,pairs,conflicts,maxRest};
}
export function fresh(teams, colors = assignColors(teams), gameMs = GAME_MS, changeMs = CHANGE_MS) { return {teams, colors, gameMs, changeMs, game:1, phase:'game', phaseStarted:false, phaseMs:gameMs, remaining:gameMs, running:false, deadline:null}; }
export function settle(state, now) {
  if(state.phase==='countdown' && !state.finished) {
    if(!state.running)return settleSession(state,now,settleRotation);
    if(state.deadline>now){
      if(Number.isFinite(state.endAt)&&now>=state.endAt)return finishSession(state,state.endAt);
      state.remaining=state.deadline-now;return state;
    }
    const kickoff=state.deadline,duration=state.openingGameMs??state.gameMs;
    if(!canStartGame(state,kickoff,duration))return finishSession(state,kickoff,kickoff>=state.endAt?'end-time':'insufficient-time');
    if(state.pendingTeams){const pending=state.pendingTeams;beginTeamCycle(state,pending.teams,pending.colors);}
    state.phase='game';state.phaseStarted=false;state.remaining=duration;state.phaseMs=duration;
    state.countdownDone=true;delete state.openingGameMs;
    if(!prepareSessionGame(state,kickoff))return state;
    state.running=true;state.phaseStarted=true;state.deadline=kickoff+state.remaining;
    beginGameTracking(state,kickoff,playingColors(state));
  }
  return settleSession(state,now,settleRotation);
}
function settleRotation(state, now) {
  if (!state.running) return state;
  const gameMs = state.gameMs ?? GAME_MS, changeMs = state.changeMs ?? CHANGE_MS;
  if(state.phase==='game' && !state.currentGameStat)beginGameTracking(state,state.deadline-(state.phaseMs??gameMs),playingColors(state));
  while (state.deadline <= now) {
    const boundary=state.deadline;
    if (state.phase === 'game') {
      completeGameTracking(state,boundary);
      state.phase='changeover';state.phaseStarted=true;state.phaseMs=changeMs;state.deadline=boundary+changeMs;
    } else if(state.pendingTeams) {
      const pending=state.pendingTeams;
      beginTeamCycle(state,pending.teams,pending.colors,true,boundary);
    } else {
      state.game++;state.phase='game';state.phaseStarted=true;state.phaseMs=gameMs;state.deadline=boundary+gameMs;
      beginGameTracking(state,boundary,playingColors(state));
    }
  }
  if(state.phase==='game')accrueGameTracking(state,now);
  state.remaining = state.deadline-now;
  return state;
}
export function toggle(state, now) {
  settle(state, now);
  if(state.finished)return state;
  if(!state.running && state.phase==='game' && state.game===1 && !state.phaseStarted && state.startCountdown && !state.countdownDone){
    if(!prepareSessionGame(state,now+5000))return state;
    state.openingGameMs=state.remaining;state.phase='countdown';state.phaseStarted=true;state.phaseMs=5000;state.remaining=5000;
  } else if(!state.running && state.phase==='countdown'){
    if(!canStartGame(state,now+state.remaining,state.openingGameMs??state.gameMs))return finishSession(state,now,now>=state.endAt?'end-time':'insufficient-time');
  } else if(!state.running && !prepareSessionGame(state,now))return state;
  const wasRunning=state.running;
  state.running = !state.running;
  if(state.running && state.phase==='game') state.phaseStarted=true;
  state.deadline = state.running ? now + state.remaining : null;
  if(state.running && !wasRunning) {
    beginSessionTracking(state,now);
    registerSessionTeams(state,Object.values(state.colors));
    if(state.phase==='game')beginGameTracking(state,now,playingColors(state));
  } else if(!state.running && wasRunning && state.phase==='game')pauseGameTracking(state,now);
  return state;
}
export function move(state, delta, now=null, recordCurrent=true) {
  if(state.finished)return state;
  if(state.phase==='game') {
    if(Number.isFinite(now))accrueGameTracking(state,now);
    if(recordCurrent)completeGameTracking(state,Number.isFinite(now)?now:(state.currentGameStat?.activeSince??0));
    else discardGameTracking(state);
  }
  if(delta>0 && state.pendingTeams) {
    const pending=state.pendingTeams;
    beginTeamCycle(state,pending.teams,pending.colors,false,null,true);
    return state;
  }
  if(state.phase==='countdown' && delta!==0)state.countdownDone=true;
  delete state.openingGameMs;
  state.game = Math.max(1, state.game + delta);
  state.phase = 'game'; state.phaseStarted=false; state.remaining = state.gameMs ?? GAME_MS; state.phaseMs = state.remaining; state.running = false; state.deadline = null;
  return state;
}

export function applySettings(state, colors, gameMs, now, changeMs = state.changeMs ?? CHANGE_MS) {
  if (!validColors(state.teams, colors)) throw new Error('Choose a different color for each team.');
  if (!Number.isInteger(gameMs) || gameMs < 1000 || gameMs > MAX_DURATION_MS || gameMs % 1000 !== 0) throw new Error('Choose a game time between 1 second and 24 hours.');
  if (!Number.isInteger(changeMs) || changeMs < 1000 || changeMs > MAX_DURATION_MS || changeMs % 1000 !== 0) throw new Error('Choose a changeover time between 1 second and 24 hours.');
  settle(state, now);
  state.colors = {...colors};
  if (gameMs !== (state.gameMs ?? GAME_MS) || changeMs !== (state.changeMs ?? CHANGE_MS)) {
    state.gameMs = gameMs;
    state.changeMs = changeMs;
    state.phase = 'game'; state.phaseStarted=false; state.remaining = gameMs; state.phaseMs = gameMs; state.running = false; state.deadline = null;
  }
  return state;
}

// New durations affect future phases without moving an active phase's deadline.
export function updateSessionTiming(state, gameMs, changeMs, now) {
  for(const [label,value] of [['game',gameMs],['changeover',changeMs]]) {
    if(!Number.isInteger(value)||value<1000||value>MAX_DURATION_MS||value%1000!==0)
      throw new Error(`Choose a ${label} time between 1 second and 24 hours.`);
  }
  settle(state,now);
  if(state.finished)throw new Error('This session has ended. Return to selection to start another.');
  state.gameMs=gameMs;state.changeMs=changeMs;
  if(state.phase==='game' && !state.phaseStarted)state.remaining=state.phaseMs=gameMs;
  if(state.phase==='countdown')state.openingGameMs=gameMs;
  return state;
}

// Reset the current matchup, including from its changeover, without advancing it.
export function restartGame(state) { return move(state, 0, null, false); }
export function adjustTime(state, delta, now) {
  if(state.finished || state.phase==='countdown')return state;
  if(delta !== 30000 && delta !== -30000) throw new Error('Time adjustments must be 30 seconds.');
  settle(state, now);
  if(state.finished)return state;
  state.remaining = Math.max(1000, Math.min(MAX_DURATION_MS, state.remaining + delta));
  const duration = state.phase==='game' ? state.gameMs : state.changeMs;
  state.phaseMs = Math.max(state.phaseMs ?? duration, state.remaining);
  if(state.endMode==='hard' && Number.isFinite(state.endAt))state.remaining=Math.min(state.remaining,Math.max(0,state.endAt-now));
  if(state.running) state.deadline = now + state.remaining;
  return state;
}

export function beginTeamCycle(state, teams, colors, running=false, kickoff=null, manual=false) {
  if(!TEAM_COUNTS.includes(teams) || !validColors(teams,colors)) throw new Error('Choose between 2 and 5 teams with unique colors.');
  const history=[...(state.teamHistory || [])];
  const completed=state.phase==='changeover' || manual ? state.game : Math.max(0,state.game-1);
  if(completed>0) history.push({teams:state.teams,colors:{...state.colors},lastGame:completed});
  const segment=(state.segment || 1)+1;
  const next=fresh(teams,colors,state.gameMs,state.changeMs);
  delete state.pendingTeams;
  Object.assign(state,next,{teamHistory:history,segment,sessionRoster:true});
  registerSessionTeams(state,Object.values(colors));
  if(running){state.running=true;state.phaseStarted=true;state.deadline=kickoff+state.gameMs;beginGameTracking(state,kickoff,playingColors(state));}
  return state;
}
export function changeTeamRoster(state, action, color, now) {
  if(!['add','remove'].includes(action) || !PALETTE.includes(color))throw new Error('Choose a team color.');
  settle(state,now);
  if(state.finished)throw new Error('This session has ended. Return to selection to start another.');
  const current=Object.values(state.pendingTeams?.colors || state.colors);
  let next;
  if(action==='add') {
    if(current.length>=5)throw new Error('Maximum five teams.');
    if(current.includes(color))throw new Error('That color is already playing.');
    next=[...current,color];
  } else {
    if(current.length<=2)throw new Error('Minimum two teams.');
    if(!current.includes(color))throw new Error('Choose a team in this session.');
    next=current.filter(c=>c!==color);
  }
  const colors=Object.fromEntries(next.map((c,i)=>['ABCDE'[i],c]));
  if(JSON.stringify(next)===JSON.stringify(Object.values(state.colors))) {delete state.pendingTeams;return state;}
  if(state.phase==='game' && !state.phaseStarted)return beginTeamCycle(state,next.length,colors);
  state.pendingTeams={teams:next.length,colors};
  return state;
}
// Convenience API for count-only callers; the UI always asks which color.
export function changeTeamCount(state, delta, allColors, now) {
  if(delta!==1 && delta!==-1)throw new Error('Add or remove one team at a time.');
  settle(state,now);
  if(state.finished)throw new Error('This session has ended. Return to selection to start another.');
  const current=Object.values(state.pendingTeams?.colors || state.colors);
  const color=delta===1 ? Object.values(allColors).find(c=>!current.includes(c)) : current.at(-1);
  return changeTeamRoster(state,delta===1?'add':'remove',color,now);
}
export function upcomingGame(state, offset=0) {
  if(offset>0 && state.pendingTeams) return {teams:state.pendingTeams.teams,game:offset,colors:state.pendingTeams.colors};
  return {teams:state.teams,game:state.game+offset,colors:state.colors};
}

export function consecutiveColors(state) {
  const next=upcomingGame(state,1);
  const nextColors=[...matchup(next.teams,next.game)].map(t=>next.colors[t]);
  return [...matchup(state.teams,state.game)].map(t=>state.colors[t]).filter(c=>nextColors.includes(c));
}

export function rosterColorChoices(state, action, savedColors={}) {
  const planned=Object.values(state.pendingTeams?.colors || state.colors);
  if(action==='remove')return Object.values(state.colors).filter(c=>planned.includes(c));
  return [...new Set([...Object.values(savedColors),...PALETTE])].filter(c=>!planned.includes(c));
}

// Display the imminent kickoff throughout changeover, including a queued roster.
export function boardGames(state) {
  const waiting=!state.finished && ['changeover','countdown'].includes(state.phase);
  const base=waiting && state.phase==='changeover'?1:0;
  const titles=waiting?['UP NEXT','AFTER THAT']:['NOW PLAYING','UP NEXT'];
  return titles.map((title,i)=>{
    const next=waiting && state.phase==='countdown' && state.pendingTeams
      ? {teams:state.pendingTeams.teams,colors:state.pendingTeams.colors,game:i+1}
      : upcomingGame(state,base+i);
    return {...next,title,match:matchup(next.teams,next.game)};
  });
}

export function jumpToBoardGame(state, cardIndex, now=null) {
  if(![0,1].includes(cardIndex))throw new Error('Choose a displayed game.');
  if(state.finished)return state;
  const target=boardGames(state)[cardIndex];
  const pending=state.pendingTeams;
  if(pending && (cardIndex>0 || state.phase==='countdown' || state.phase==='changeover')) {
    beginTeamCycle(state,pending.teams,pending.colors,false,null,state.phase!=='countdown' && state.phaseStarted);
  }
  // Manual selection skips any opening/changeover countdown and pauses at full time.
  state.countdownDone=true;
  move(state,target.game-state.game,now);
  return state;
}

// Future kickoffs for the game picker. Timed sessions end at their configured
// boundary; continuous sessions show one complete rotation.
export function upcomingGames(state, now=Date.now()) {
  if(state.finished)return [];
  const waiting=['changeover','countdown'].includes(state.phase);
  const firstOffset=state.phase==='game'?1:(state.phase==='changeover'?1:0);
  let kickoff=now+Math.max(0,state.remaining)+(state.phase==='game'?state.changeMs:0);
  const continuous=!Number.isFinite(state.endAt);
  const count=continuous
    ? SCHEDULES[state.pendingTeams?.teams??state.teams].length
    : Math.max(0,Math.ceil((state.endAt-kickoff)/Math.max(1,state.gameMs+state.changeMs))+1);
  const games=[];
  for(let i=0;i<count;i++) {
    const offset=firstOffset+i;
    let next;
    if(waiting && state.phase==='countdown' && state.pendingTeams)next={teams:state.pendingTeams.teams,colors:state.pendingTeams.colors,game:i+1};
    else next=upcomingGame(state,offset);
    const duration=state.endMode==='hard'&&Number.isFinite(state.endAt)?Math.min(state.gameMs,state.endAt-kickoff):state.gameMs;
    if(!continuous) {
      const available=state.endAt-kickoff;
      if(state.endMode==='full'&&available<state.gameMs)break;
      if(state.endMode==='hard'&&available<Math.min(state.minGameMs??120000,state.gameMs))break;
      if(state.endMode==='soft'&&available<=0)break;
    }
    games.push({...next,match:matchup(next.teams,next.game),offset,kickoff,duration:Math.max(0,duration)});
    kickoff+=state.gameMs+state.changeMs;
  }
  return games;
}

export function jumpToUpcomingGame(state, offset, now=null) {
  if(!Number.isInteger(offset)||offset<0)throw new Error('Choose an upcoming game.');
  if(state.finished)return state;
  const target=state.phase==='countdown'&&state.pendingTeams&&offset===0
    ? {teams:state.pendingTeams.teams,colors:state.pendingTeams.colors,game:1}
    : upcomingGame(state,offset);
  const pending=state.pendingTeams;
  if(pending && (offset>0 || state.phase!=='game'))beginTeamCycle(state,pending.teams,pending.colors,false,null,state.phase!=='countdown'&&state.phaseStarted);
  state.countdownDone=true;
  move(state,target.game-state.game,now);
  return state;
}

export function endSession(state, now) {
  settle(state,now);
  if(!state.finished)finishSession(state,now,'manual');
  return state;
}
