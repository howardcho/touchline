# Touchline — Soccer Rotation

A dependency-free, iPad-friendly web app for the sideline. All team schedules and session data live on the device. No analytics, external fonts, or backend database.

## Use on an iPad

1. After deploying the source to an HTTPS host, open its URL in Safari. A private hosted copy may ask you to sign in.
2. Tap **Share → Add to Home Screen → Add**. Enable **Open as Web App** if offered. See [Apple’s iPad instructions](https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados).
3. Open Touchline from the Home Screen while online once so its offline assets can finish caching. Choose **Two teams**, **Three teams**, **Four teams**, or **Five teams**. Use **Settings**, beside Continuous rotation at the bottom of the selection screen, to edit game time, changeover time, sounds, and colors before starting. Choose **Defaults for → 2, 3, 4, or 5 teams** to customize each team count independently. Each profile has its own colors, game and changeover times, opening countdown, audio options, and end-time settings. Existing settings seed all four profiles when upgrading. Save defaults, then choose a team card to begin; each card shows its own colors and timing. Settings always contain five unique colors in a fixed order. Two-team sessions use colors 1–2, three-team sessions use colors 1–3, and so on. No colors are shuffled. The first colors in that team-count profile match the session’s initial team order. Older saved colors migrate while preserving the active teams, with unused colors filled in to complete the five slots. All five colors must be unique, even if fewer teams are playing. Colors used in another dropdown are disabled; changing a color makes the previous choice available again.
4. The timer is optional: use **Next game** to run the rotation manually. To use the timer, tap **Start session**. By default, a separate five-second countdown runs before game one, followed by its full game time. Disable **Settings → Game → Start session with a 5-second countdown** to begin immediately. The opening countdown supports pause/resume and remains separate from game and changeover durations. Games default to four minutes (editable in Settings), followed automatically by a changeover (default 30 seconds, also editable). At the end of the changeover, the next game starts automatically. Team matchups show prominent colored flags with readable color names. During changeover, the main card becomes **UP NEXT** and shows the game about to start. The side cards show the following two games as **ON DECK** and **AFTER THAT**. At kickoff, those same matchups stay visible while the titles become **NOW PLAYING**, **UP NEXT**, and **ON DECK**. The initial countdown uses the same waiting titles for games 1–3. With sounds enabled, a single long whistle signals kickoff, a voice says “one minute remaining” when a game crosses one minute remaining, and three slower whistles signal full time (0.4-second blast, 0.45-second gap, 0.45-second blast, 0.45-second gap, then a 1.6-second blast). Changeovers count down aloud from 5 to 1, then the next game begins with the long whistle. Resume does not sound the kickoff whistle, and games of one minute or less skip the one-minute announcement.
5. **Restart game** resets only the current matchup to the full configured game duration (for example, 05:00 for a five-minute game) and pauses it until you tap Start game. It keeps the game number and teams, even during changeover. **−30 sec / +30 sec** adjust the active game or changeover by 30 seconds while preserving its running/paused status. Remaining time is clamped between 1 second and 60 minutes; shortening below 30 seconds leaves 1 second rather than automatically skipping a phase. The five-second opening countdown cannot be extended or shortened with these buttons. Adjustments apply only to the current timer, persist on refresh, and do not change your saved durations for future games.
6. **Pause/Resume** freezes and resumes the current phase. **Next/Previous game** selects a game, resets its timer to the selected game duration, and pauses. Previous is disabled at game 1; future games loop forever.
7. **Back to selection** is available directly above the game board. Tapping the Touchline logo also returns to team selection and ends the current rotation. It ends the current rotation and returns to the splash page, keeping your saved settings. Choosing a team count starts again at game 1.
8. **Restart rotation** on the game board returns to game 1 with a paused timer, keeping colors and both durations. **Restart game** resets only the current matchup. Saved defaults are available on the selection screen. During play, **Session timing** changes game and changeover durations without exiting. It applies only to this session and keeps the active game or changeover’s remaining time and running/paused status unchanged. The next phase uses the new duration; an unstarted game updates immediately. The opening five-second countdown stays five seconds. Use Restart game to apply the new full duration to the current teams. Session timing survives refresh with the current session, but never overwrites saved defaults. Adding or removing teams during a session retains its current timing and audio settings; it does not load another profile.
9. **Settings → Save defaults** lets you choose unique team colors from Red, Blue, Green, Black, Yellow, Orange, Purple, Pink, White, and Gray. Set game and changeover durations with minutes and seconds (each 1 second to 60 minutes). The changes apply to the next rotation you start. The new duration applies to subsequent games in new sessions started with that team count. Other team-count defaults stay independent. Settings use three compact tabs: **Game** for colors and both timers, **Session** for an optional end time, and **Audio** for sounds. Edits stay in place when switching tabs; **Save defaults** saves all tabs and any edited team-count profiles together. Switching profiles retains unsaved edits until you save or close the dialog. Each sound has its own checkbox and compact **Test** button: kickoff whistle, 1 minute warning, full-time whistle, 5-to-1 countdown, team callouts, and stadium crowd. Checkboxes control sounds during play; Test previews work regardless of the checkboxes. **Enable timer sounds** mutes all game audio while keeping your individual choices. All sound options, including stadium crowd, default on for a fresh installation. All choices save on this device. Closing without saving discards edits.
10. **Keep screen awake** requests a screen wake lock when supported. It defaults on when supported, and your on/off choice is saved locally. Its status shows whether it is active, suspended, or unavailable. The browser or operating system may release it for battery or visibility reasons. See [MDN’s API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

Portrait and landscape are supported. The app saves progress on this device and restores it after refresh or reopening, subject to browser storage availability. Running timers use elapsed wall-clock time, so reopening after a background interval catches up to the appropriate game and phase. Pause before leaving if you want play to stop. Manually changing the device clock can affect an active timer. Sounds and continued background execution are not guaranteed by iPadOS. Keep the app visible during play.

Offline operation and wake lock require HTTPS (or localhost on the same device). Offline caching is implemented with a service worker; browser storage eviction or private hosting authentication may require connecting again. Physical iPad installation, offline relaunch, and wake lock should be checked on your device before a session.

## Add or remove teams during a session

Use **+ Team / − Team** on the board (minimum 2, maximum 5). Each button opens a color picker. Add lets you choose any unused color from the palette (saved colors appear first). Remove lists only the currently selected session teams that have not already been queued for removal; it never lists unused defaults or a not-yet-active arrival. Use Cancel change to discard a queued arrival. Remaining teams keep their colors and relative order. Added colors are session-only: they survive refresh and Restart rotation, but never overwrite the saved five-color defaults. Returning to selection and choosing a new session restores those defaults. The caption shows the current or queued roster. You can queue several changes or cancel them.

If the current game has started, changes apply at the next kickoff, after its changeover. NOW PLAYING stays on the current teams; UP NEXT and ON DECK preview the fresh cycle. With manual timing, **Next game** applies the change and leaves the new game paused. Before the first kickoff, a change applies immediately, paused. Restart game retains a queued change; Restart rotation cancels it.

The new count begins at game 1 of its fixed schedule. Equal games are guaranteed over a complete cycle from that point onward; late arrivals never catch up on earlier games. A count-change boundary can have consecutive appearances, which the board flags. Earlier count segments are retained under **View rotation & fairness → Earlier team counts**, recording the last game reached, not an audited record of actual minutes played. Pending changes and history survive refresh. Returning to selection or restarting the whole rotation clears that session history.

## Saved preferences and sound

The app uses `localStorage`, rather than cookies, to keep game duration, changeover duration, sound and crowd preferences, and team colors on this browser and website. Defaults are stored separately for 2-, 3-, 4-, and 5-team sessions and survive refresh and normal browser reopening. Keep screen awake is a shared device preference. Current game, timer progress, and session-only timing overrides are stored separately for refresh recovery. Ending a session and selecting teams again restores that team count’s saved defaults. Clearing website data, private browsing, or browser storage eviction can remove them. Settings do not transfer between devices or between the GitHub Pages address and a custom domain. If storage is blocked, the app displays a message and keeps settings for the current page only. Older saved sessions migrate to a 30-second changeover.

Whistles use a real soccer referee recording. The one-minute warning and countdown use bundled AI-generated sports-announcer clips. All recordings are cached for offline use after the first online load; no API key or external service is needed during play. An optional generated stadium roar, with a distant, muffled TV-broadcast sound, begins after the three full-time blasts (or immediately at full time if that whistle is disabled) and stops for the countdown or kickoff so speech stays clear. Enable it in Settings; the choice is saved locally and the timer sound switch controls it too. If a recording fails to load, whistles fall back to synthesized audio and speech falls back to an installed device voice (or a short tone). The preview reports incomplete audio loading. [Audio credits and licenses](audio/CREDITS.txt) include attribution for the referee recording and generation details.

Changeovers shorter than five seconds begin with the remaining number. Missed countdown numbers are skipped rather than spoken late. Tap Start/Resume or a sound test to enable audio after opening the app. A countdown preview runs 5 to 1, then plays the kickoff whistle. Keep the app visible and check device volume; iPadOS may suspend audio while the app is hidden or the device is locked. Overdue cues are skipped when returning after a long background interval. Sound previews work even when the saved sound toggle is off. The announcer and stadium crowd are AI-generated.

## Session end time and team callouts

In **Settings → Session**, choose an end time for today (using the iPad’s local clock). The time and finish preference are remembered; each new rotation resolves that time for the current day. Past times must be updated before starting. For a fresh installation, all optional switches are enabled: the opening countdown, timer sounds and individual audio cues, screen wake preference, and session end time (initially 23:59 today). Explicit saved off choices are preserved on updates. With the end-time option off, rotations continue indefinitely.

- **Hard stop:** ends at the selected time. A shortened final game is allowed only if its available duration at kickoff meets **Minimum shortened game** (default two minutes, configurable in minutes and seconds). Otherwise that game is skipped. A paused session still ends at the fixed cutoff; pauses may reduce actual playing time below the kickoff minimum.
- **Finish last game:** no kickoff at or after the end time; a game begun before it is allowed to finish, including after a pause.
- **Full games only:** only start games that can fit completely, including the preceding changeover. The session stops after the last qualifying game, without an unnecessary final changeover. If a game is subsequently paused or extended, it can finish even if that pushes it past the cutoff.

The board shows the finish policy and a **Session complete** state, which remains complete after refresh. Restart rotation retains the same end-time limit; return to selection to choose a new session. End-time enforcement also applies in manual mode, but automatic game sequencing requires starting the optional timer. Time adjustments cannot extend a hard cutoff.

In **Settings → Audio**, **Team callouts** announces the teams about to play and the following matchup after each game, using the actual colors, including queued roster changes. Example: “Team Red and team Blue, you’re up! Team Purple and team Black, you’re on deck!” Higher-energy announcer recordings are bundled offline. Each team pairing and its “you’re up” or “you’re on deck” instruction is recorded as one complete sentence, so names and instructions share the same delivery without word-by-word joins. The full-time whistle plays first when enabled; crowd volume is reduced beneath the callout. Countdown and kickoff take priority and cancel unfinished callouts, especially with short changeovers. No teams are announced for a session’s final game. Pause, navigation, and returning to selection cancel pending speech. Manual **Next game** calls out the newly selected matchup and the following game; Previous stays quiet. Use **Test** beside Team callouts to preview the example. The master sound switch and the individual callout checkbox control it independently.

## Run the source locally

Requires Python 3 for serving; Node.js 18+ only for automated tests. No package installation or build is needed.

From this folder:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 in a browser. You can also run `npm start` if Node is installed.

For an iPad on the same Wi-Fi, bind the server to your computer's network interface (the command above does this by default) and open `http://YOUR-COMPUTER-LAN-IP:8080`. The computer firewall must permit the connection. This HTTP preview supports the board and timer; use an HTTPS host for full offline and wake-lock features. `localhost` on the iPad refers to the iPad itself.

## Deploy independently

This repository serves the app directly from its root. For GitHub Pages, choose Settings → Pages → Deploy from a branch → main → /(root). You can also upload the app files to any HTTPS static host. No build command, secrets, APIs, or server framework are needed. The app uses relative paths and works in a subdirectory. Serve `.mjs` files as JavaScript and `manifest.webmanifest` as a web manifest or JSON. Use `index.html` as the entry point.

After editing assets for a new release, increment the `CACHE` version in `sw.js`. Close old app windows and reopen to activate the newly cached version. The supplied source has no runtime dependencies.

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

## Verification

```sh
npm test
# Or, without npm:
node --test tests/*.test.mjs
```

Automated tests cover exact schedules, matchup frequency, appearances, maximum cyclic rest, consecutive appearances, indefinite looping, timer phase boundaries, pause/resume in both phases, navigation resets, recovery after long background intervals, persistent, ordered team colors, custom game durations, settings validation, stored preferences, independent team-count profiles and migration, session-only duration edits with current-phase preservation, hard-stop constraints after timing edits, custom changeover boundaries, audio cue timing, the kickoff and full-time whistle patterns, the spoken one-minute announcement, countdown timing, current-game restart, timer adjustments, queued team-count changes, selected arrivals and departures, new-cycle fairness, and count-change history. UI checks cover selecting teams, starting, pausing/resuming, navigation, persistence, restart, changing teams, fairness view, and portrait/landscape layouts in the desktop browser. Physical iPad behaviors remain device-dependent.

## Files

- `index.html`: accessible app structure and dialogs
- `styles.css`: responsive layout, touch targets, colors
- `engine.mjs`: schedules, validation, timer state transitions
- `app.mjs`: controls, rendering, local persistence, tones, wake lock
- `preferences.mjs`: persistent device preferences and validation
- `sounds.mjs`: recorded sound playback, fallback audio, and cue timing
- `audio/`: bundled whistle, crowd, generated voice clips, and credits
- `sw.js`: offline app-shell cache
- `manifest.webmanifest`, icons: Home Screen installation
- `tests/engine.test.mjs`: automated schedule and timer tests

Set game duration in Settings on the selection screen. `GAME_MS` in `engine.mjs` is the four-minute default; `CHANGE_MS` is the 30-second changeover default. Per-cycle minute totals in the app use the selected game duration; the schedule examples above use the four-minute default.
