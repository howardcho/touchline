# Touchline for Android

An offline Android app sharing Touchline's web interface, schedules, saved defaults, session controls, and 100 recorded audio clips. Supports Android 8.0 (API 26) and later. Android Studio project: open this `android` directory.

## Install on a Pixel or another Android device

1. Enable Developer options on the phone (Settings → About phone → tap Build number seven times), then enable USB debugging under Developer options.
2. Connect by USB and accept the phone's USB debugging prompt for your Mac.
3. In Android Studio, open this directory, select the phone, and click Run. Keep the phone unlocked during installation.
4. Open **Touchline** from the app drawer. Choose 2–5 teams, then use Start session or advance games manually. The bundled interface and recordings work without an internet connection.

The app stores its preferences and active session separately from the website and iPad app. Installing an update with the same signing key preserves that data. Uninstalling or clearing app storage removes it. An installed Android build does not have the iPad's seven-day free provisioning limit.

## Build from the command line on macOS

Requirements: Android Studio (bundled Java 17 or newer), Android SDK Platform 35, Android SDK Build Tools 34.0.0 or newer, Platform Tools, Python 3, and Node.js. Android Studio's SDK Manager installs the Android components. No JavaScript dependencies are required.

From the repository root:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
./android/gradlew -p android assembleDebug lintDebug
npm test
```

The Gradle wrapper and Android Gradle plugin download from their official repositories on the first build. Once dependencies are cached, `--offline` can be added. The build runs `android/prepare_web.py` to package current shared source and audio; generated assets are ignored by Git.

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Install and launch:

```sh
"$ANDROID_HOME/platform-tools/adb" devices
"$ANDROID_HOME/platform-tools/adb" install -r android/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/platform-tools/adb" shell am start -n com.agedskaters.touchline/.MainActivity
```

Use `adb -s SERIAL ...` if more than one device is attached. The development APK uses the standard local Android debug signing key. Keep the same debug key for updates; use a dedicated protected release key for distribution. Do not commit private signing keys or `local.properties`.

## Music and audio ducking

The native player requests `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` immediately before a cue, plays the bundled recording, and abandons focus after the final cue and a 1.1-second gap. This keeps music reduced through closely spaced countdown/whistle/callout clips. It cancels queued audio and releases focus when Touchline leaves the foreground or loses audio focus. Android 15+ requires Touchline to be visible for these focus requests; there is no background service.

Music apps decide how they respond to audio focus. Most music playback can duck; spoken-word apps or calls can pause or deny focus instead. Test with your actual music app and Bluetooth speaker. Touchline does not change the system media volume.

To verify: start music, open Touchline, go to selection → Settings → Audio, then test a whistle, voice warning, countdown, and team callout. Listen for the music dropping and returning after each cue sequence. Settings and test controls match the iPad app. Keep Touchline visible for game audio; elapsed time is reconciled when returning from another app.

## Android-specific behavior

- The app has an adaptive Touchline launcher icon, supports portrait/landscape, and keeps controls clear of system bars and the camera cutout.
- Tall phone screens use a compact session board; smaller windows can scroll. Maximize clock enters immersive full-screen mode with a continuous green background, hiding Android’s status and navigation bars. Controls stay clear of the camera cutout. Swipe from an edge to reveal system bars temporarily; Full board or Android Back restores the normal screen.
- Android Back closes a dialog, returns from the large clock to the board, then returns to team selection. From selection it leaves the app.
- Keep screen awake uses the native Android screen flag while the app is visible. Turning it off restores the device's normal timeout.
- The WebView serves only packaged resources at a fixed local HTTPS origin. The app requests no internet, microphone, storage, notification, or account permissions. Debug builds allow WebView inspection; release builds disable it.
- External credit links open in the device browser. No store upload or public publishing is part of this project setup.

## Project layout

- `app/src/main/java/.../MainActivity.java`: offline WebView, native bridge, Android lifecycle, Back handling, screen awake, and safe insets.
- `app/src/main/java/.../DuckingAudio.java`: native clip scheduling, cancellation, audio focus, and release.
- `host.js`: Android adapter for the shared native audio/host interfaces.
- `prepare_web.py`: packages shared web source and derives the audio catalog from `sounds.mjs`.
- `../ios/prepare_web.py`: shared script bundler, also used by the iPad build.

Continue to edit the web source at the repository root. Rebuild Android to include those changes; the native app does not pull updates from the website.

## Verified build

The development build was installed and launched on a Pixel 10. Offline startup and native audio were checked, and Spotify ducking/restoration was confirmed on the device. The shared automated suite passes 105 tests; Android debug assembly and lint complete successfully.
