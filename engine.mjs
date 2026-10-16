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
export const GAME_MS = 240000, CHANGE_MS = 30000;
export const matchup = (teams, game) => SCHEDULES[teams][(game - 1) % SCHEDULES[teams].length];
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
  if (!state.running) return state;
  const gameMs = state.gameMs ?? GAME_MS, changeMs = state.changeMs ?? CHANGE_MS;
  let left = state.deadline - now;
  if (left <= 0) {
    if (state.phase === 'changeover') { state.game++; state.phase = 'game'; left += gameMs; }
    else { state.phase = 'changeover'; left += changeMs; }
    if (left <= 0) {
      const cycles = Math.floor(-left / (gameMs + changeMs));
      state.game += cycles;
      left += cycles * (gameMs + changeMs);
      while (left <= 0) {
        if (state.phase === 'game') { state.phase = 'changeover'; left += changeMs; }
        else { state.phase = 'game'; state.game++; left += gameMs; }
      }
    }
    state.deadline = now + left;
    state.phaseStarted = true;
    state.phaseMs = state.phase==='game' ? gameMs : changeMs;
  }
  state.remaining = left;
  return state;
}
export function toggle(state, now) {
  settle(state, now);
  state.running = !state.running;
  if(state.running && state.phase==='game') state.phaseStarted=true;
  state.deadline = state.running ? now + state.remaining : null;
  return state;
}
export function move(state, delta) {
  state.game = Math.max(1, state.game + delta);
  state.phase = 'game'; state.phaseStarted=false; state.remaining = state.gameMs ?? GAME_MS; state.phaseMs = state.remaining; state.running = false; state.deadline = null;
  return state;
}

export function applySettings(state, colors, gameMs, now, changeMs = state.changeMs ?? CHANGE_MS) {
  if (!validColors(state.teams, colors)) throw new Error('Choose a different color for each team.');
  if (!Number.isInteger(gameMs) || gameMs < 1000 || gameMs > 3600000 || gameMs % 1000 !== 0) throw new Error('Choose a game time between 1 second and 60 minutes.');
  if (!Number.isInteger(changeMs) || changeMs < 1000 || changeMs > 3600000 || changeMs % 1000 !== 0) throw new Error('Choose a changeover time between 1 second and 60 minutes.');
  settle(state, now);
  state.colors = {...colors};
  if (gameMs !== (state.gameMs ?? GAME_MS) || changeMs !== (state.changeMs ?? CHANGE_MS)) {
    state.gameMs = gameMs;
    state.changeMs = changeMs;
    state.phase = 'game'; state.phaseStarted=false; state.remaining = gameMs; state.phaseMs = gameMs; state.running = false; state.deadline = null;
  }
  return state;
}

// Reset the current matchup, including from its changeover, without advancing it.
export function restartGame(state) { return move(state, 0); }
export function adjustTime(state, delta, now) {
  if(delta !== 30000 && delta !== -30000) throw new Error('Time adjustments must be 30 seconds.');
  settle(state, now);
  state.remaining = Math.max(1000, Math.min(3600000, state.remaining + delta));
  const duration = state.phase==='game' ? state.gameMs : state.changeMs;
  state.phaseMs = Math.max(state.phaseMs ?? duration, state.remaining);
  if(state.running) state.deadline = now + state.remaining;
  return state;
}
