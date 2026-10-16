export const SCHEDULES = {
  4: 'AB CD AC BD AD BC'.split(' '),
  5: 'AB CD AE BD CE AD BE AC DE BC AE BD AC BE CD AB DE BC AD CE'.split(' ')
};
export const COLORS = ['Red', 'Blue', 'Green', 'Black', 'Yellow'];
export const PALETTE = [...COLORS, 'Orange', 'Purple', 'Pink', 'White', 'Gray'];
export function validColors(teams, colors) {
  const names = 'ABCDE'.slice(0, teams).split('').map(t => colors?.[t]);
  return new Set(names).size === teams && names.every(c => PALETTE.includes(c));
}
export function assignColors(teams, random = Math.random) {
  const colors = COLORS.slice(0, teams);
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return Object.fromEntries('ABCDE'.slice(0, teams).split('').map((t,i) => [t, colors[i]]));
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
    return [t, Math.max(...indices.map((p,i) => (indices[(i+1)%indices.length] - p + s.length)%s.length - 1))];
  }));
  return {counts,pairs,conflicts,maxRest};
}
export function fresh(teams, colors = assignColors(teams), gameMs = GAME_MS, changeMs = CHANGE_MS) { return {teams, colors, gameMs, changeMs, game:1, phase:'game', remaining:gameMs, running:false, deadline:null}; }
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
  }
  state.remaining = left;
  return state;
}
export function toggle(state, now) {
  settle(state, now);
  state.running = !state.running;
  state.deadline = state.running ? now + state.remaining : null;
  return state;
}
export function move(state, delta) {
  state.game = Math.max(1, state.game + delta);
  state.phase = 'game'; state.remaining = state.gameMs ?? GAME_MS; state.running = false; state.deadline = null;
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
    state.phase = 'game'; state.remaining = gameMs; state.running = false; state.deadline = null;
  }
  return state;
}
