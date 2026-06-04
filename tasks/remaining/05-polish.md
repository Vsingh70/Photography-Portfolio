# Task 05 — Polish (optional)

**Depends on**: 01–04 (anything that requires the app to be functional)
**Blocks**: nothing
**Estimated effort**: variable per item — each is ~30 min
**Risk**: Low

## When to use this task

After the core OAuth + direct-Drive flow is shipping, work through the items here. None are blockers; each is its own small improvement. Skip any that don't matter to you.

Each item below can be lifted out and handed to Claude individually.

---

## Item A: Visual drag-from-OS indicator (Tauri)

When the user drags a file from Finder over the desktop window, currently there's no visual feedback until they drop. Add a CSS overlay that pulses or highlights the active set's drop zone while dragging is in progress.

The HTML `dragenter`/`dragleave`/`dragover` events are already wired in `StudioApp.tsx`. The `dragActive` state is already toggled on dragover but nothing visual responds to it.

Implementation:

- In `Workspace` (or whichever sub-component holds the drop area), conditionally render a fullscreen overlay when `dragActive` is true:

```tsx
{dragActive && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(245, 243, 238, 0.04)',
      border: '2px dashed rgba(245, 243, 238, 0.4)',
      borderRadius: 4,
      pointerEvents: 'none', // let drop events through to the underlying drop zone
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      color: 'rgba(245, 243, 238, 0.6)',
      fontStyle: 'italic',
    }}
  >
    Drop photos to add to {activeSet?.name || 'this set'}
  </div>
)}
```

---

## Item B: OAuth error UX (both Tauri + iOS)

Currently, an OAuth failure shows a JS `alert()` in Tauri or just sets a state variable in iOS. Replace both with proper in-app error sheets/banners.

**Tauri**: replace the `alert(...)` in `StudioApp.tsx`'s `onSignIn` with a new state variable + an inline banner near the sign-in button. Match the existing visual language (mono small-caps caption, hairline rule, danger color).

**iOS**: add an `Alert` modifier to the `SettingsSheet` that surfaces the `error` state:

```swift
.alert("Sign-in failed", isPresented: .constant(error != nil), actions: {
    Button("OK") { error = nil }
}, message: {
    Text(error ?? "")
})
```

---

## Item C: Custom launch screen (iOS)

The current iOS app uses Xcode's default launch screen (a black or white empty view). Replace with a launch screen that shows the VS logo centered on cream (matching the app icon).

Two approaches:

1. **Storyboard**: create `LaunchScreen.storyboard` with a centered UIImageView pointing at a launch-screen asset.
2. **SwiftUI** (preferred): set `UILaunchScreen` in Info.plist with `Image Name: AppIcon`.

The second is simpler. In `vflics-studio.xcodeproj/project.pbxproj`, find the `INFOPLIST_KEY_UILaunchScreen_Generation = YES` entry and add:

```
INFOPLIST_KEY_UILaunchScreen_Generation = NO;
INFOPLIST_KEY_UILaunchScreen_Image = "AppIcon";
INFOPLIST_KEY_UILaunchScreen_BackgroundColor = "AccentColor";  // or a literal cream color asset
```

---

## Item D: Custom fonts in iOS (Cormorant Garamond + DM Mono)

The iOS `Theme.swift` references `CormorantGaramond-LightItalic` and `DMMono-Regular` as `.custom(...)` fonts, then falls back to system serif/monospace if those aren't found in the bundle. Currently they aren't bundled — the app uses fallbacks.

To add them:

1. Find OTF / TTF files for the two fonts (both are open source — Google Fonts)
2. Drag the files into the Xcode project, target: `vflics-studio`
3. Add the filenames to `Info.plist` under a new `UIAppFonts` array key
4. Confirm the PostScript names match what `Theme.swift` uses — if they differ, update `Theme.swift`

Verify: pick any view that uses `Theme.Fonts.display(...)` and confirm the rendered text is the expected serif italic, not system fallback.

---

## Item E: Reorder feedback (Tauri)

In the desktop app, drag-to-reorder is mostly invisible — the user lifts a thumb, drops it on another, and the order changes without any animation. Add a visual hint:

- When `draggedFileId` is set, the dragged thumbnail's opacity goes to 0.4
- When `dragOverFileId` is set, the hovered thumbnail gets a thick cream border indicating it's the drop target

Both `draggedFileId` and `dragOverFileId` are already state in `StudioApp.tsx`; just need to wire the styles into the thumb component.

---

## Item F: README updates

Both `README.md` (root) and `app/src-tauri/README.md` reference the old `STUDIO_UPLOAD_TOKEN` flow + the `tauri.conf.local.json` placeholder pattern. After task 04 ships, both should be updated to describe the new OAuth-only flow.

**Root README**: in the Studio section, replace the "Endpoint URL + bearer token" description with "Sign in with Google on first launch; token persists in iOS Keychain / macOS app config dir."

**Tauri README**: drop the entire one-time setup section about creating `tauri.conf.local.json` with a token (no token any more). The build command is now just `npm run tauri:build`.

---

## Item G: Empty-state for non-signed-in users (web/Tauri)

Currently, if you open `vflics.com/studio` in a regular browser (not Tauri), the OAuth sign-in button is hidden (because `isTauri()` returns false), and the old `?key=` mechanism is gone (post-task-04). The page would just show the empty studio with no way to push.

Add a friendly empty-state when `!inTauri`:

```tsx
{!inTauri && (
  <div style={{ padding: 40, textAlign: 'center' }}>
    <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
      Use the desktop app
    </h2>
    <p>Upload Studio runs in the vflics Studio desktop app. The web page is for preview only.</p>
  </div>
)}
```

Or just `redirect()` to a marketing page if you'd rather hide the studio entirely.

---

## Item H: Progress indicator for multi-photo push (both platforms)

Currently the push modal shows "Uploading…" without any per-photo progress. For a set with 20 photos uploading one at a time, this can take a minute or two with no feedback.

Add a counter:

- Tauri: track `progress = (currentSet, totalSets, currentFileInSet, totalFilesInSet)` in StudioApp state, update before each `tauriUploadToDrive` call. Display in the push modal.
- iOS: similar in the Store's `pushProgress` (currently exists for set-level progress; extend to file-level).

---

## How to hand any one of these to Claude

```
Implement item A from tasks/remaining/05-polish.md. Don't touch other items.
```

Each item is self-contained.
