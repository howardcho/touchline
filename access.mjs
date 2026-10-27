export const PREMIUM_TEAM_MIN = 4;
export const FREE_THREE_TEAM_MS = 30 * 60 * 1000;

export const requiresPremium = teams => teams >= PREMIUM_TEAM_MIN;

export function configureSessionAccess(state, unlocked) {
  state.premiumUnlocked = !!unlocked;
  if (!state.premiumUnlocked && state.teams === 3) {
    state.accessLimitMs = FREE_THREE_TEAM_MS;
    if (!Number.isFinite(state.accessEndAt) && Number.isFinite(state.sessionStartedAt)) {
      state.accessEndAt = state.sessionStartedAt + state.accessLimitMs;
    }
  } else {
    delete state.accessLimitMs;
    delete state.accessEndAt;
  }
  return state;
}

export function armSessionAccess(state, now) {
  if (state.accessLimitMs === FREE_THREE_TEAM_MS && !Number.isFinite(state.accessEndAt)) {
    state.accessEndAt = now + state.accessLimitMs;
  }
  return state;
}
