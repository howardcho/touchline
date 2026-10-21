# Touchline native app guide

These controls and schedules apply to the iPad and Android apps. Install using the platform guides in `ios/README.md` and `android/README.md`. Device settings are stored locally inside each native app.

## Saved preferences and sound

The app uses `localStorage`, rather than cookies, to keep game duration, changeover duration, sound and crowd preferences, and team colors inside the native app. Defaults are stored separately for 2-, 3-, 4-, and 5-team sessions and survive refresh and normal browser reopening. Keep screen awake is a shared device preference. Current game, timer progress, and session-only timing overrides are stored separately for refresh recovery. Ending a session and selecting teams again restores that team count’s saved defaults. Clearing app storage or uninstalling the native app can remove them. Settings do not transfer between devices or between the native app installations. If storage is blocked, the app displays a message and keeps settings for the current page only. Older saved sessions migrate to a 30-second changeover.

Timer fields accept overflow values. For example, **61 seconds** is saved and shown as **1 minute, 1 second**, while **61 minutes** remains a 61-minute duration. Game, changeover, and shortened-game values can total from one second to 24 hours.

Whistles use a real soccer referee recording. The one-minute warning and countdown use bundled AI-generated sports-announcer clips. All recordings are bundled for immediate offline use; no API key or external service is needed during play. An optional generated stadium roar, with a distant, muffled TV-broadcast sound, begins after the three full-time blasts (or immediately at full time if that whistle is disabled) and stops for the countdown or kickoff so speech stays clear. Enable it in Settings; the choice is saved locally and the timer sound switch controls it too. If a recording cannot load in the native player, the preview reports unavailable audio. [Audio credits and licenses](../audio/CREDITS.txt) include attribution for the referee recording and generation details.

Changeovers shorter than five seconds begin with the remaining number. Missed countdown numbers are skipped rather than spoken late. Tap Start/Resume or a sound test to enable audio after opening the app. A countdown preview runs 5 to 1, then plays the kickoff whistle. Keep the app visible and check device volume; iPadOS may suspend audio while the app is hidden or the device is locked. Overdue cues are skipped when returning after a long background interval. Sound previews work even when the saved sound toggle is off. The announcer and stadium crowd are AI-generated.

## Session end time and team callouts

In **Settings → Session**, choose an end time for today (using the iPad’s local clock). The time and finish preference are remembered; each new rotation resolves that time for the current day. Past times must be updated before starting. For a fresh installation, all optional switches are enabled: the opening countdown, timer sounds and individual audio cues, screen wake preference, and session end time (initially 23:59 today). Explicit saved off choices are preserved on updates. With the end-time option off, rotations continue indefinitely.

- **Hard stop:** ends at the selected time. A shortened final game is allowed only if its available duration at kickoff meets **Minimum shortened game** (default two minutes, configurable in minutes and seconds). Otherwise that game is skipped. A paused session still ends at the fixed cutoff; pauses may reduce actual playing time below the kickoff minimum.
- **Finish last game:** no kickoff at or after the end time; a game begun before it is allowed to finish, including after a pause.
- **Full games only:** only start games that can fit completely, including the preceding changeover. The session stops after the last qualifying game, without an unnecessary final changeover. If a game is subsequently paused or extended, it can finish even if that pushes it past the cutoff.

The board shows the finish policy and a **Session complete** state, which remains complete after refresh. Restart rotation retains the same end-time limit; return to selection to choose a new session. End-time enforcement also applies in manual mode, but automatic game sequencing requires starting the optional timer. Time adjustments cannot extend a hard cutoff.

You can also tap **End session** below the game board at any time. After confirmation, Touchline stops the active game and shows a match report with games played and actual timer-running time for every team, average playing time across all participating teams, and total elapsed session time. Pauses count toward total session time but not team playing time. A restarted game discards its false-start time; a partial game counts when it contains recorded playing time. Close the report to review the finished board, or use **View summary** to reopen it.

In **Settings → Audio**, **Team callouts** announces the teams about to play and the following matchup after each game, using the actual colors, including queued roster changes. Example: “Team Red and team Blue, you’re up! Team Purple and team Black, you’re on deck!” Higher-energy announcer recordings are bundled offline. Each team pairing and its “you’re up” or “you’re on deck” instruction is recorded as one complete sentence, so names and instructions share the same delivery without word-by-word joins. The full-time whistle plays first when enabled; crowd volume is reduced beneath the callout. Countdown and kickoff take priority and cancel unfinished callouts, especially with short changeovers. No teams are announced for a session’s final game. Pause, navigation, and returning to selection cancel pending speech. Manual **Next game** calls out the newly selected matchup and the following game; Previous stays quiet. Use **Test** beside Team callouts to preview the example. The master sound switch and the individual callout checkbox control it independently.

## Exact schedules and validation

**2 teams:** AB repeats. Both teams play every game and rest during changeovers.

**3 teams:** AB, AC, BC repeats. Each team plays twice per loop, each pairing appears once, and the maximum rest is one game. Every transition shares one team, including the loop boundary.


Letters below identify internal schedule slots. The app displays their ordered color names and color markers throughout the board, rotation list, and transition warnings.

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

