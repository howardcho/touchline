# Touchline native app guide

These controls and schedules apply to the iPad and Android apps. Install using the platform guides in `ios/README.md` and `android/README.md`. Device settings are stored locally inside each native app.

## Saved preferences and sound

The app uses `localStorage`, rather than cookies, to keep game duration, changeover duration, sound and crowd preferences, team naming, and team colors inside the native app. Defaults are stored separately for 2-, 3-, 4-, and 5-team sessions and survive refresh and normal browser reopening. Each team count can use ordered color names or letter names from Team A through Team E. Keep screen awake is a shared device preference. Current game, timer progress, and session-only overrides are stored separately for refresh recovery. Ending a session and selecting teams again restores that team count’s saved defaults. Clearing app storage or uninstalling the native app can remove them. Settings do not transfer between devices or between the native app installations. If storage is blocked, the app displays a message and keeps settings for the current page only. Older saved sessions migrate to a 30-second changeover and color naming.

Timer fields accept overflow values. For example, **61 seconds** is saved and shown as **1 minute, 1 second**, while **61 minutes** remains a 61-minute duration. Game, changeover, and shortened-game values can total from one second to 24 hours.

Whistles use a real soccer referee recording. The one-minute warning and countdown use bundled AI-generated sports-announcer clips. All recordings are bundled for immediate offline use; no API key or external service is needed during play. An optional generated stadium roar, with a distant, muffled TV-broadcast sound, begins after the three full-time blasts (or immediately at full time if that whistle is disabled) and stops for the countdown or kickoff so speech stays clear. Enable it in Settings; the choice is saved locally and the timer sound switch controls it too. If a recording cannot load in the native player, the preview reports unavailable audio. [Audio credits and licenses](../audio/CREDITS.txt) include attribution for the referee recording and generation details.

Changeovers shorter than five seconds begin with the remaining number. Missed countdown numbers are skipped rather than spoken late. Tap Start/Resume or a sound test to enable audio after opening the app. A countdown preview runs 5 to 1, then plays the kickoff whistle. Keep the app visible and check device volume; iPadOS may suspend audio while the app is hidden or the device is locked. Overdue cues are skipped when returning after a long background interval. Sound previews work even when the saved sound toggle is off. The announcer and stadium crowd are AI-generated.

## Session end time and team callouts

In **Settings → Session**, choose one end time for every day or turn on **Use different end times by weekday** and select a compact Monday–Sunday schedule. Each team-count profile keeps its own schedule. A new rotation uses the device’s local day and time; disabling a weekday gives that day continuous rotation. Past times must be updated before starting. For a fresh installation, all optional switches are enabled: the opening countdown, timer sounds and individual audio cues, screen wake preference, and session end time (initially 23:59). Explicit saved off choices are preserved on updates.

- **Hard stop:** ends at the selected time. A shortened final game is allowed only if its available duration at kickoff meets **Minimum shortened game** (default two minutes, configurable in minutes and seconds). Otherwise that game is skipped. A paused session still ends at the fixed cutoff; pauses may reduce actual playing time below the kickoff minimum.
- **Finish last game:** no kickoff at or after the end time; a game begun before it is allowed to finish, including after a pause.
- **Full games only:** only start games that can fit completely, including the preceding changeover. The session stops after the last qualifying game, without an unnecessary final changeover. If a game is subsequently paused or extended, it can finish even if that pushes it past the cutoff.

The board shows the finish policy and a **Session complete** state, which remains complete after refresh. Restart rotation retains the same end-time limit; return to selection to choose a new session. End-time enforcement also applies in manual mode, but automatic game sequencing requires starting the optional timer. Time adjustments cannot extend a hard cutoff.

The compact toolbar is ordered Back, Restart, Session settings, Upcoming games, and Maximize. Session settings remain available in both the regular and maximized clock views. The Previous, Next, and End session controls pair familiar icons with larger text labels. Every control retains a large touch target and an accessibility label for VoiceOver and TalkBack. Session settings can change team naming, game duration, changeover duration, end time, finish rule, hard-stop minimum, and every audio option while play is underway. These changes remain with the active session. Select **Save as the N-team defaults** before applying when the same choices should replace that team count's saved defaults. When weekday scheduling is active, saving during play updates the current weekday in that team count’s schedule.

In the maximized landscape view, Up Next stays in a compact rail to the left of the timer. In portrait, it moves above the full-width clock. The current matchup sits above the clock without the smaller timer-status labels, and the playback and time-adjustment controls remain below the countdown so the entire view fits without scrolling. Tap the list icon in either view, or beside Up Next, to see every game that can start before the configured end time and jump directly to any one. Continuous sessions show the next complete rotation.

On short landscape phone screens, the regular board uses a compact one-screen layout: the current teams sit beside the timer, and Start shares a row with the time controls. Secondary session and roster explanations are hidden there, while roster changes, navigation, End session, and Keep screen awake remain available.

You can also tap the red **stop-square** button below the game board at any time. After confirmation, Touchline stops the active game and shows a match report with games played and actual timer-running time for every team, average playing time across all participating teams, and total elapsed session time. Pauses count toward total session time but not team playing time. A restarted game discards its false-start time; a partial game counts when it contains recorded playing time. Close the report to review the finished board, or use the report icon to reopen it.

In **Settings → Audio**, **Team callouts** enables matchup announcements. Each one-minute, 30-second, and 10-second warning has its own **Team callout** checkbox. By default, the 10-second warning announces the next matchup as “on deck”; the earlier warnings do not. At the final whistle it calls only those same teams “up”; the following matchup is not announced there. Actual session names and queued roster changes are respected. Color callouts use bundled higher-energy announcer recordings; letter callouts use the device's offline English voice so Team A–E are announced correctly. The full-time whistle plays first when enabled; crowd volume is reduced beneath the callout. Countdown and kickoff take priority and cancel unfinished callouts, especially with short changeovers. Two-team sessions omit matchup callouts because the same two teams play every game. No teams are announced after a session’s final game. Pause, navigation, and returning to selection cancel pending speech. Manual **Next game** calls out only the newly selected matchup; Previous stays quiet. Use **Test** beside Team callouts to preview the active naming style. The master sound switch, Team callouts switch, and warning-specific callout checkboxes control them independently.

## Exact schedules and validation

**2 teams:** AB repeats. Both teams play every game and rest during changeovers.

**3 teams:** AB, AC, BC repeats. Each team plays twice per loop, each pairing appears once, and the maximum rest is one game. Every transition shares one team, including the loop boundary.


The letters below identify schedule slots. The app can display them directly as Team A–E or replace them with the selected ordered color names.

**4 teams, 6 games:** AB, CD, AC, BD, AD, BC.

- Every team plays 3 games / 12 minutes per cycle.
- Every one of the 6 pairings occurs once.
- Maximum rest is 2 consecutive games (A's maximum is 1).
- **Consecutive appearances exist:** Team C at 2→3, D at 4→5, and B at 6→1 (the loop boundary).
- With four teams, the only pairing disjoint from AB is CD, and vice versa. Zero consecutive appearances therefore forces repeating the same complementary pairings. Covering all six pairings requires some consecutive appearances. The app preserves the requested schedule and flags the upcoming conflict.

**5 teams, 20 games:** AB, CD, AE, BD, CE, AD, BE, AC, DE, BC, AE, BD, AC, BE, CD, AB, DE, BC, AD, CE.

- Every team plays 8 games / 32 minutes per cycle.
- All 10 pairings occur exactly twice.
- No consecutive appearances, including game 20→1.
- No team rests more than 2 consecutive games, including across the boundary.

Balance is guaranteed over a complete cycle; stopping partway through a cycle may leave unequal play counts.

