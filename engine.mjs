export const SCHEDULES = {
  4: 'AB CD AC BD AD BC'.split(' '),
  5: 'AB CD AE BD CE AD BE AC DE BC AE BD AC BE CD AB DE BC AD CE'.split(' ')
};
export const COLORS = ['Red', 'Blue', 'Green', 'Black', 'Yellow'];
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
export function fresh(teams, colors = assignColors(teams)) { return {teams, colors, game:1, phase:'game', remaining:GAME_MS, running:false, deadline:null}; }
export function settle(state, now) {
  if (!state.running) return state;
  let left = state.deadline - now;
  if (left <= 0) {
    if (state.phase === 'changeover') { state.game++; state.phase = 'game'; left += GAME_MS; }
    else { state.phase = 'changeover'; left += CHANGE_MS; }
    if (left <= 0) {
      const cycles = Math.floor(-left / (GAME_MS + CHANGE_MS));
      state.game += cycles;
      left += cycles * (GAME_MS + CHANGE_MS);
      while (left <= 0) {
        if (state.phase === 'game') { state.phase = 'changeover'; left += CHANGE_MS; }
        else { state.phase = 'game'; state.game++; left += GAME_MS; }
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
  state.phase = 'game'; state.remaining = GAME_MS; state.running = false; state.deadline = null;
  return state;
}
