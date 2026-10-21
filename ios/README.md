# Touchline on iPad: development installation

This native iPad host reuses Touchline's web interface, timers, team settings, and bundled recordings. Audio plays through Apple's native audio session with `duckOthers`, so music from another app can become quieter during Touchline cues and return afterward. The public website showcases the native apps; the browser/PWA version is retired.

Requires a Mac with Xcode and an iPad running iPadOS 17 or newer. No App Store submission is required for a development installation.

## What to do first

1. Open **Xcode** on your Mac. Review and accept Apple's agreement yourself, then finish initial setup and any required iOS platform/component installation. Xcode is installed and its initial setup has now been completed on this Mac.
2. In **Xcode → Settings → Accounts** (sometimes labelled Apple Accounts), sign in with your Apple Account. Complete any Apple prompts yourself. A free account is enough for testing on your own iPad.
3. Connect the unlocked iPad to your Mac using a data-capable USB cable. Tap **Trust** on the iPad if asked and enter its passcode there.
4. When prompted, enable **Settings → Privacy & Security → Developer Mode** on the iPad. Restart and confirm. If the setting is missing, pair with Xcode first and try again.

## Build and install

1. Open `Touchline.xcodeproj` inside the repository's `ios` folder. Its full path on this Mac is `/Users/howardcho/Code/external/touchline/ios/Touchline.xcodeproj`.
2. Select the blue **Touchline** project in Xcode's sidebar, then the **Touchline** app target. Under **Signing & Capabilities**, leave **Automatically manage signing** enabled and choose your team (a free account appears as **Personal Team**). If the bundle identifier is unavailable, replace `com.agedskaters.touchline` with a unique identifier for your account.
3. Choose your connected iPad as the run destination in Xcode's toolbar and click **Run ▶**. Xcode installs the app. If the iPad asks you to trust the developer, follow its prompt under **Settings → General → VPN & Device Management**.
4. Once installed, open **Touchline** from its iPad Home Screen icon. The app's interface and recordings are bundled, so this version does not require a local server or Internet connection during play.

With a free Apple Account, development signing expires after **7 days**. Reconnect the iPad and run the app from Xcode again to renew it. Avoid deleting the app between installs if you want to keep its settings.

## First audio test

1. Start music in Spotify on the same iPad, using the output you intend to use during games. A local Bluetooth speaker is a good test; Spotify Connect playing independently on another device cannot be ducked by this iPad.
2. Open the native Touchline app. In **Settings → Audio**, tap **Test** beside the kickoff whistle, one-minute warning, full-time whistle, team callouts, and countdown.
3. Confirm that Spotify keeps playing, becomes quieter during each cue, and returns to normal after the cue/sequence. A brief release delay bridges countdown gaps. Use a short practice session to check automatic transitions too.
4. Keep Touchline visible during play. This first version does not promise audio or timer callbacks while the iPad is locked or the app is in the background. Switching away cancels pending cues and releases the music.

Ducking depth is controlled by iPadOS, not a percentage slider. Native settings are stored separately from Safari/Home Screen website settings; configure the app's defaults once after installing. The native app includes the Touchline arrow logo as a 1024-pixel opaque app-icon asset. Xcode generates the required device icon sizes from it. To regenerate the icon from its vector drawing, run `swift ios/make_icon.swift ios/Touchline/Assets.xcassets/AppIcon.appiconset/AppIcon.png`.

## Project details and verification

No third-party framework or package installation is needed. Xcode's first build phase runs `prepare_web.py`, packages the shared JavaScript into a classic script for local WKWebView loading, and copies the web assets/recordings. Generated `Touchline/Web/` resources are ignored by Git and rebuilt from the repository, using `native/index.html` as its interface. To prepare them manually after a fresh clone, run `python3 ios/prepare_web.py` from the repository root before opening Xcode.

`npm test` covers the shared app plus the native bridge's command timing, cancellation, bundled-recording metadata, and offline UI packaging. The full iOS device build and development signing succeeded on October 21, 2026. Touchline was installed and launched on the connected iPad mini (A17 Pro), and its process remained running. The native page-loading path check was subsequently corrected for iPadOS container-path aliases. The selection screen, matchup-card jumps, and both new warning previews were checked in an iPad mini simulator; device diagnostics confirmed the corrected selection page loaded on the physical iPad. Actual Spotify/Bluetooth ducking still needs a listening test.

Apple references: [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [running on a physical device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), [free account limits](https://developer.apple.com/help/account/basics/about-your-developer-account), [audio ducking](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/duckothers).

## Moving to TestFlight and the App Store

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/) using your Apple Account. The current membership price is US$99 per year (or local pricing). Apple handles enrollment, identity verification, agreements, and payment; complete these steps yourself. Choose individual versus organization enrollment based on how you want the developer/seller identity represented.
2. After enrollment is active, select the paid team in Xcode and confirm the registered bundle ID matches `com.agedskaters.touchline`. Create the app record in App Store Connect. The app display name/store name must be available; name availability has not been checked.
3. Finish physical iPad testing, especially music ducking with Spotify and the intended Bluetooth output, timing transitions, offline use, settings persistence, and portrait/landscape layout. Use an archive/release build as well as the development build.
4. Archive and upload the signed release build from Xcode's Organizer. Distribute through TestFlight first. This project currently targets iPad; the listing/screenshots should reflect that device support.
5. Complete the store listing: description, screenshots, support URL, public privacy-policy URL and accessible in-app privacy-policy link, App Privacy answers, content rights, age rating, availability/pricing, export-compliance answers, and review notes. Audit the app and bundled assets before answering these; no collection declaration or compliance answer has been submitted on your behalf. Keep the whistle attribution and audio credits included.
6. Submit the selected build for Apple review, then release after approval. Approval is Apple's decision. Explain Touchline's offline soccer rotation/timing utility and native audio ducking in review notes; Apple assesses minimum functionality under guideline 4.2. A full SwiftUI rewrite is not automatically required simply because the interface uses WKWebView.

The present Xcode 26.2 / iOS 26.2 SDK build meets Apple's currently published iOS 26 SDK minimum for submissions; recheck this requirement at upload time. No App Store Connect record, paid enrollment, store upload, or publication has been performed. Development installation can continue while enrollment/release preparation is pending.

Sources: [membership](https://developer.apple.com/programs), [distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [privacy policy requirement](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [review guidelines](https://developer.apple.com/app-store/review/guidelines/), [SDK submission requirements](https://developer.apple.com/news/?id=6lxhtioi).
