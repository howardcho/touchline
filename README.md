# Aged Athletics / Touchline

Aged Athletics is the single-page public site at **agedathletics.com**. It showcases Touchline, the native soccer rotation app for **iPad and Android**. The former public browser/PWA app is retired.

## Install Touchline

- **Android:** open `android/` in Android Studio, connect a phone with USB debugging enabled, and Run. See [Android installation and build instructions](android/README.md).
- **iPad:** open `ios/Touchline.xcodeproj` in Xcode, select your signing team and connected iPad, and Run. See [iPad installation instructions](ios/README.md). Free Apple development signing expires after seven days.

Both apps bundle the interface and all audio for offline use. Native audio ducks other music during cues; Android Spotify ducking has been confirmed on Pixel. Neither app is listed in a public app store yet.

## What Touchline does

- Repeating rotations for two to five teams, with unique, ordered team colors.
- Large now-playing and up-next matchups, plus a tappable list of every game that fits before the session ends.
- Optional game/changeover timers, a five-second opening countdown, pause/resume, restart, and ±30-second controls.
- Full-screen match clock; portrait and landscape layouts.
- Referee whistles, spoken warnings, team callouts, and optional stadium crowd.
- Saved defaults for each team count, plus session-only timing and roster changes.
- Optional session end time with hard stop, finish-last-game, or full-games-only rules.

See the [app behavior and schedule guide](native/USER_GUIDE.md) and [audio credits](audio/CREDITS.txt). Complete rotations give equal game counts; two-, three-, and four-team schedules include consecutive appearances, while the five-team loop avoids them.

## Public website

Only **`docs/`** is deployed. GitHub Pages must use **Deploy from a branch → main → /docs**. Do not publish the repository root: it contains the native app's shared implementation.

The site is plain HTML/CSS with screenshots, native installation links, and expandable FAQs. No runtime dependencies, analytics, public browser app, or store download badges. `docs/CNAME` sets `agedathletics.com`; GoDaddy DNS must point the domain at GitHub Pages. See [domain setup](docs/DOMAIN-SETUP.md).

Preview the website:

```sh
npm start
```

Open http://localhost:8080. Website edits do not change installed native apps.

## Shared native app source

- `native/index.html`: app structure and dialogs, packaged only into the native apps.
- Root `.mjs` files and `styles.css`: shared schedules, timers, rendering, settings, and native audio adapter.
- `audio/`: 100 bundled recordings and credits.
- `ios/`: native iPad host and audio ducking.
- `android/`: native Android host, audio focus, screen wake, and immersive mode.
- `docs/`: public Aged Athletics website and screenshot assets.
- `tests/`: shared app and native packaging checks.

The native build scripts package `native/index.html` as the bundled `index.html`. Shared code remains separate from the marketing page. Rebuild and reinstall iPad/Android apps after modifying their shared source. Native app settings do not transfer to the website or across devices.

## Verify

```sh
npm test
python3 ios/prepare_web.py
python3 android/prepare_web.py
```

No JavaScript dependencies need installing. Python 3 and Node.js are needed for packaging/tests; Xcode or Android Studio builds the corresponding app. Keep signing keys, local SDK paths, generated assets, and build output out of Git.
