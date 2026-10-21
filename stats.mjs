const finiteTime = value => Number.isFinite(value) && value >= 0;

export function beginSessionTracking(state, at) {
  if (!finiteTime(state.sessionStartedAt)) state.sessionStartedAt = at;
  state.sessionResults ??= {};
  state.sessionTeamOrder ??= [];
}

export function registerSessionTeams(state, colors) {
  state.sessionResults ??= {};
  state.sessionTeamOrder ??= [];
  for (const color of colors) {
    if (!state.sessionResults[color]) state.sessionResults[color] = {games:0, playingMs:0};
    if (!state.sessionTeamOrder.includes(color)) state.sessionTeamOrder.push(color);
  }
}

export function beginGameTracking(state, at, colors) {
  beginSessionTracking(state, at);
  registerSessionTeams(state, colors);
  const identity = `${state.segment || 1}:${state.game}`;
  if (!state.currentGameStat || state.currentGameStat.identity !== identity) {
    state.currentGameStat = {identity, colors:[...colors], playedMs:0, activeSince:at};
  } else {
    state.currentGameStat.activeSince = at;
  }
}

export function accrueGameTracking(state, at) {
  const current = state.currentGameStat;
  if (!current || !finiteTime(current.activeSince)) return;
  if (at > current.activeSince) current.playedMs += at - current.activeSince;
  current.activeSince = at;
}

export function pauseGameTracking(state, at) {
  accrueGameTracking(state, at);
  if (state.currentGameStat) state.currentGameStat.activeSince = null;
}

export function completeGameTracking(state, at) {
  accrueGameTracking(state, at);
  const current = state.currentGameStat;
  if (!current) return;
  if (current.playedMs > 0) {
    state.sessionGameCount = (state.sessionGameCount || 0) + 1;
    state.sessionResults ??= {};
    state.sessionTeamOrder ??= [];
    for (const color of current.colors) {
      if (!state.sessionResults[color]) {
        state.sessionResults[color] = {games:0, playingMs:0};
        state.sessionTeamOrder.push(color);
      }
      state.sessionResults[color].games += 1;
      state.sessionResults[color].playingMs += current.playedMs;
    }
  }
  delete state.currentGameStat;
}

export function discardGameTracking(state) {
  delete state.currentGameStat;
}

export function finishSessionTracking(state, at) {
  if (state.currentGameStat) completeGameTracking(state, at);
  state.sessionElapsedMs = finiteTime(state.sessionStartedAt) ? Math.max(0, at - state.sessionStartedAt) : 0;
}

export function summarizeSession(state) {
  const order = Array.isArray(state.sessionTeamOrder) ? state.sessionTeamOrder : [];
  const teams = order.map(color => ({color, games:state.sessionResults?.[color]?.games || 0, playingMs:state.sessionResults?.[color]?.playingMs || 0}));
  const totalPlayingMs = teams.reduce((sum, team) => sum + team.playingMs, 0);
  return {
    teams,
    averagePlayingMs: teams.length ? totalPlayingMs / teams.length : 0,
    totalSessionMs: Math.max(0, state.sessionElapsedMs || 0),
    totalGames: Math.max(0, state.sessionGameCount || 0)
  };
}
