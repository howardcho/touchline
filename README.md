# Touchline — Soccer Rotation

A dependency-free, iPad-friendly web app for the sideline. All team schedules and session data live on the device. No analytics, external fonts, or backend database.

## Use on an iPad

1. After deploying the source to an HTTPS host, open its URL in Safari. A private hosted copy may ask you to sign in.
2. Tap **Share → Add to Home Screen → Add**. Enable **Open as Web App** if offered. See [Apple’s iPad instructions](https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados).
3. Open Touchline from the Home Screen while online once so its offline assets can finish caching. Choose **Two teams**, **Three teams**, **Four teams**, or **Five teams**. Use **Settings**, beside Continuous rotation at the bottom of the selection screen, to edit game time, changeover time, sounds, and colors before starting. The same five ordered colors apply to every team count. Save, then choose a team card to begin. Settings always contain five unique colors in a fixed order. Two-team sessions use colors 1–2, three-team sessions use colors 1–3, and so on. No colors are shuffled. The first colors in settings match the current session’s team order. Older saved colors migrate while preserving the active teams, with unused colors filled in to complete the five slots. All five colors must be unique, even if fewer teams are playing. Colors used in another dropdown are disabled; changing a color makes the previous choice available again.
4. The timer is optional: use **Next game** to run the rotation manually. To use the timer, tap **Start game**. Games default to four minutes (editable in Settings), followed automatically by a changeover (default 30 seconds, also editable). At the end of the changeover, the next game starts automatically. During changeover, NOW PLAYING remains on the game just finished; UP NEXT is the game about to start. With sounds enabled, a single long whistle signals kickoff, a voice says “one minute remaining” when a game crosses one minute remaining, and three slower whistles signal full time (0.4-second blast, 0.45-second gap, 0.45-second blast, 0.45-second gap, then a 1.6-second blast). Changeovers count down aloud from 5 to 1, then the next game begins with the long whistle. Resume does not sound the kickoff whistle, and games of one minute or less skip the one-minute announcement.
5. **Restart game** resets only the current matchup to the full configured game duration (for example, 05:00 for a five-minute game) and pauses it until you tap Start game. It keeps the game number and teams, even during changeover. **−30 sec / +30 sec** adjust the active game or changeover by 30 seconds while preserving its running/paused status. Remaining time is clamped between 1 second and 60 minutes; shortening below 30 seconds leaves 1 second rather than automatically skipping a phase. Adjustments apply only to the current timer, persist on refresh, and do not change your saved durations for future games.
6. **Pause/Resume** freezes and resumes the current phase. **Next/Previous game** selects a game, resets its timer to the selected game duration, and pauses. Previous is disabled at game 1; future games loop forever.
7. **Back to selection** is available directly above the game board. It ends the current rotation and returns to the splash page, keeping your saved settings. Choosing a team count starts again at game 1.
8. **Restart rotation** on the game board returns to game 1 with a paused timer, keeping colors and both durations. **Restart game** resets only the current matchup. Settings are available only on the selection screen; return there to edit preferences or choose a new team count.
9. **Settings → Save settings** lets you choose unique team colors from Red, Blue, Green, Black, Yellow, Orange, Purple, Pink, White, and Gray. Set game and changeover durations with minutes and seconds (each 1 second to 60 minutes). The changes apply to the next rotation you start. The new duration applies to all subsequent games and is remembered when you choose a new team count. Enable or disable timer sounds, and use Test kickoff, Test 1 minute, Test full time, and Test countdown to preview them. Closing without saving discards edits.
10. **Keep screen awake** requests a screen wake lock when supported. Its status shows whether it is active, suspended, or unavailable. The browser or operating system may release it for battery or visibility reasons. See [MDN’s API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

Portrait and landscape are supported. The app saves progress on this device and restores it after refresh or reopening, subject to browser storage availability. Running timers use elapsed wall-clock time, so reopening after a background interval catches up to the appropriate game and phase. Pause before leaving if you want play to stop. Manually changing the device clock can affect an active timer. Sounds and continued background execution are not guaranteed by iPadOS. Keep the app visible during play.

Offline operation and wake lock require HTTPS (or localhost on the same device). Offline caching is implemented with a service worker; browser storage eviction or private hosting authentication may require connecting again. Physical iPad installation, offline relaunch, and wake lock should be checked on your device before a session.

## Saved preferences and sound

The app uses `localStorage`, rather than cookies, to keep game duration, changeover duration, sound preference, and team colors on this browser and website. They survive refresh, restart, team-count changes, and normal browser reopening. Current game and timer progress are stored separately. Clearing website data, private browsing, or browser storage eviction can remove them. Settings do not transfer between devices or between the GitHub Pages address and a custom domain. If storage is blocked, the app displays a message and keeps settings for the current page only. Older saved sessions migrate to a 30-second changeover.

Whistles are synthesized locally with Web Audio and work offline. The one-minute announcement and spoken countdown use your device’s speech voice (a local English voice is preferred); availability offline depends on installed voices. If speech is unavailable, a short tone accompanies the visible countdown or one-minute announcement. Changeovers shorter than five seconds begin with the remaining number. Missed countdown numbers are skipped rather than spoken late. Tap Start/Resume or a sound test to enable audio after opening the app. A countdown preview runs 5 to 1, then plays the kickoff whistle. Keep the app visible and check device volume; iPadOS may suspend audio while the app is hidden or the device is locked. Overdue cues are skipped when returning after a long background interval. Sound previews work even when the saved sound toggle is off.

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

Thirty-nine automated tests cover exact schedules, matchup frequency, appearances, maximum cyclic rest, consecutive appearances, indefinite looping, timer phase boundaries, pause/resume in both phases, navigation resets, recovery after long background intervals, persistent, ordered team colors, custom game durations, settings validation, stored preferences, custom changeover boundaries, audio cue timing, the kickoff and full-time whistle patterns, the spoken one-minute announcement, countdown timing, current-game restart, and timer adjustments. UI checks cover selecting teams, starting, pausing/resuming, navigation, persistence, restart, changing teams, fairness view, and portrait/landscape layouts in the desktop browser. Physical iPad behaviors remain device-dependent.

## Files

- `index.html`: accessible app structure and dialogs
- `styles.css`: responsive layout, touch targets, colors
- `engine.mjs`: schedules, validation, timer state transitions
- `app.mjs`: controls, rendering, local persistence, tones, wake lock
- `preferences.mjs`: persistent device preferences and validation
- `sounds.mjs`: offline sound synthesis and cue timing
- `sw.js`: offline app-shell cache
- `manifest.webmanifest`, icons: Home Screen installation
- `tests/engine.test.mjs`: automated schedule and timer tests

Set game duration in Settings on the selection screen. `GAME_MS` in `engine.mjs` is the four-minute default; `CHANGE_MS` is the 30-second changeover default. Per-cycle minute totals in the app use the selected game duration; the schedule examples above use the four-minute default.
