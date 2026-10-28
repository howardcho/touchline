export const PREMIUM_TEAM_MIN = 4;

export const requiresPremium = teams => teams >= PREMIUM_TEAM_MIN;

export function configureSessionAccess(state, unlocked) {
  state.premiumUnlocked = !!unlocked;
  // Remove limits saved by builds that capped free three-team sessions.
  delete state.accessLimitMs;
  delete state.accessEndAt;
  return state;
}
