# Task 05 — Polish (optional)

**Status**: items A, B, E, F, G, H done; C and D still open.
**Blocks**: nothing. These are cosmetic improvements you can do whenever.

## Done (in commit `58c8136` and subsequent commits)

- **A**: Visual drag-from-OS overlay in `StudioApp.tsx` — fullscreen dashed-border message while dragging from Finder
- **B**: OAuth error UX — inline banner in Tauri TopBar (replaces `window.alert`) + SwiftUI `.alert()` in iOS `SettingsSheet`
- **E**: Reorder feedback — drop-target thumbs get a solid 3px cream outline; dragged thumb fades to 0.4 opacity
- **F**: README + Tauri README updates to reflect the OAuth-only architecture (later supplemented by the docs sweep that produced this file)
- **G**: Empty-state for non-Tauri browsers — `/studio` shows "Use the desktop app" if `isTauri()` returns false
- **H**: Per-file push progress in both clients — `pushProgress = { setIdx, setTotal, fileIdx, fileTotal }`, displayed in PushModal (Tauri) and PushSheet (iOS)

## Open

### C — Custom iOS launch screen

Currently `Info.plist` has an empty `UILaunchScreen` dict, which gets you a plain white-on-cream default. For a more polished first-launch feel, add an actual launch screen — the cream VS logo on the cream background, matching the app icon.

Implementation:

1. In Xcode, create a `LaunchScreen.storyboard` (or use `UILaunchScreen` dict-style config with image references)
2. Either:
   - Add a centered `ImageView` referencing the existing app-icon asset
   - Or use the dict-style `UILaunchScreen` with `UIImageName` set to a launch-image asset
3. Verify on a real device that there's no flash between launch screen and `ContentView`

Reference: Apple's [Launch screen](https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen) docs. If you go the storyboard route, set `UILaunchStoryboardName` in `Info.plist`.

### D — Custom fonts in iOS

The iOS `Theme.swift` falls back to system serif + monospace because the bundled fonts aren't actually included. To match the web's Cormorant Garamond (display, italic) + DM Mono (small-caps) typography:

1. Download the font files (`.otf` or `.ttf`) — both are available on Google Fonts
2. Drag the files into the Xcode project (target = `vflics-studio`)
3. In `Info.plist`, add:
   ```xml
   <key>UIAppFonts</key>
   <array>
       <string>CormorantGaramond-Italic.ttf</string>
       <string>CormorantGaramond-Regular.ttf</string>
       <string>DMMono-Regular.ttf</string>
   </array>
   ```
4. Update `Theme.Fonts` to use the registered family names instead of `.custom(...)` fallbacks

The exact PostScript names matter — check Font Book after installing to find them. Wrong name silently falls back to system; check on a real device, not just preview.
