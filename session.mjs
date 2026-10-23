import {finishSessionTracking} from './stats.mjs';

export const END_MODES = ['hard','soft','full'];
export const validEndTime = value => typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function resolveSessionEnd(preferences, now=Date.now(), allowElapsed=false) {
  if(!preferences.endEnabled)return {};
  if(!validEndTime(preferences.endTime))throw new Error('Choose a session end time.');
  const end=new Date(now),[hours,minutes]=preferences.endTime.split(':').map(Number);
  end.setHours(hours,minutes,0,0);
  if(end.getTime()<=now) {
    if(allowElapsed)return {};
    throw new Error('Choose an end time later today in Session settings.');
  }
  return {endAt:end.getTime(),endMode:preferences.endMode,minGameMs:Math.min(preferences.minGameMs,preferences.gameMs)};
}
export function updateSessionEnd(state, settings, now=Date.now()) {
  if(state.finished)throw new Error('This session has ended. Return to selection to start another.');
  if(settings.endEnabled&&(!END_MODES.includes(settings.endMode)))throw new Error('Choose how the session should finish.');
  if(settings.endEnabled&&(!Number.isInteger(settings.minGameMs)||settings.minGameMs<1000||settings.minGameMs>state.gameMs))throw new Error('Choose a valid minimum shortened game.');
  const ending=settings.endEnabled?resolveSessionEnd({...settings,gameMs:state.gameMs},now):null;
  const wasHard=state.endMode==='hard'&&Number.isFinite(state.endAt);
  if(wasHard&&state.phase==='game'&&state.phaseStarted&&state.phaseMs<state.gameMs) {
    const elapsed=Math.max(0,state.phaseMs-state.remaining);
    state.phaseMs=state.gameMs;state.remaining=Math.max(1000,state.gameMs-elapsed);
    if(state.running)state.deadline=now+state.remaining;
  }
  if(!settings.endEnabled){delete state.endAt;delete state.endMode;delete state.minGameMs;return state;}
  Object.assign(state,ending);
  if(state.endMode==='hard') {
    const available=Math.max(0,state.endAt-now);
    state.remaining=Math.min(state.remaining,available);
    if(state.running)state.deadline=now+state.remaining;
    if(!state.phaseStarted)state.phaseMs=state.remaining;
  }
  return state;
}
export function finishSession(state, at, reason='end-time') {
  finishSessionTracking(state,at);
  state.finished=true;state.finishedAt=at;state.finishReason=reason;
  state.running=false;state.deadline=null;state.remaining=0;
  delete state.pendingTeams;
  return state;
}
export function canStartGame(state, at, duration=state.gameMs) {
  if(!Number.isFinite(state.endAt))return true;
  const available=state.endAt-at;
  if(state.endMode==='full')return available>=duration;
  if(state.endMode==='hard')return available>=Math.min(state.minGameMs??120000,duration);
  return available>0;
}
export function prepareSessionGame(state, now) {
  if(state.finished)return false;
  if(!Number.isFinite(state.endAt))return true;
  const resumed=state.phase==='game' && state.phaseStarted;
  if(!resumed && !canStartGame(state,now,state.remaining)) {
    finishSession(state,now,now>=state.endAt?'end-time':'insufficient-time');return false;
  }
  if(state.endMode==='hard') {
    if(now>=state.endAt){finishSession(state,state.endAt);return false;}
    state.remaining=Math.min(state.remaining,state.endAt-now);
    if(!state.phaseStarted)state.phaseMs=state.remaining;
  }
  return true;
}
// Fixed wall-clock end time: pausing never moves it. Preserve the fast existing
// rotation path when there is no end time; otherwise process exact boundaries.
export function settleSession(state, now, advance) {
  if(state.finished)return state;
  if(!Number.isFinite(state.endAt))return advance(state,now);
  if(!state.running) {
    if(now>=state.endAt && (state.endMode==='hard' || state.phase!=='game' || !state.phaseStarted))finishSession(state,state.endAt);
    return state;
  }
  if(state.endMode==='hard')state.deadline=Math.min(state.deadline,state.endAt);
  while(state.running && state.deadline<=now) {
    const boundary=state.deadline;
    if(state.phase==='game') {
      if(!canStartGame(state,boundary+state.changeMs)) {
        return finishSession(state,boundary,boundary>=state.endAt?'end-time':'insufficient-time');
      }
      advance(state,boundary);
    } else {
      if(!canStartGame(state,boundary))return finishSession(state,boundary,boundary>=state.endAt?'end-time':'insufficient-time');
      advance(state,boundary);
      if(state.endMode==='hard'){state.deadline=Math.min(state.deadline,state.endAt);state.phaseMs=state.deadline-boundary;}
    }
  }
  state.remaining=state.deadline-now;
  return state;
}
