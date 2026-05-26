# vflics Studio — iOS

SwiftUI app for staging photo sets and pushing them to Google Drive folders, talking to your Vercel `/api/studio/upload-remote` endpoint.

## First-time setup

1. **Create the Xcode project**
   - Open Xcode → File → New → Project → iOS → App
   - Product Name: `vflics-studio`
   - Team: your Apple Developer team
   - Interface: SwiftUI
   - Language: Swift
   - Save the project inside this directory (`ios/vflics-studio/`)

2. **Add the Swift source files**
   - Drag every `.swift` file from `ios/vflics-studio/vflics-studio/` into the Xcode project navigator, into the target group.
   - Make sure "Copy items if needed" is NOT checked (we want them to stay version-controlled in this repo).
   - Check the box that adds them to the `vflics-studio` target.

3. **Add the fonts**
   - In Xcode, drag both `Canela-LightItalic.otf` and any Cormorant Garamond + DM Mono `.ttf` files from `app/public/fonts/` into the project (target: `vflics-studio`).
   - Open `Info.plist` → add a new array key `UIAppFonts` listing each font's filename as a string.

4. **Configure the endpoint + token**
   - First launch presents a settings sheet asking for two values:
     - **Endpoint URL** — `https://your-vercel-domain.vercel.app/api/studio/upload-remote`
     - **Auth token** — must exactly match `STUDIO_UPLOAD_TOKEN` set in your Vercel project env vars.
   - These persist in the iOS keychain.

5. **Run on your phone via TestFlight**
   - Set the bundle identifier to something you own (e.g. `com.virajsingh.vflics-studio`).
   - Archive → Distribute App → App Store Connect → upload to TestFlight.
   - Install via the TestFlight app on your phone.

## Vercel setup

Add to your Vercel project's Production environment (Settings → Environment Variables):

```
STUDIO_UPLOAD_TOKEN=<a long random string you generate>
GOOGLE_DRIVE_CLIENT_EMAIL=<from .env.local>
GOOGLE_DRIVE_PRIVATE_KEY=<from .env.local>
GOOGLE_DRIVE_EDITORIAL_FOLDER_ID=<from .env.local>
GOOGLE_DRIVE_PORTRAITS_FOLDER_ID=<from .env.local>
GOOGLE_DRIVE_GRADUATION_FOLDER_ID=<from .env.local>
GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID=<from .env.local>
GOOGLE_DRIVE_EVENTS_FOLDER_ID=<from .env.local>
GOOGLE_DRIVE_ABOUT_FOLDER_ID=<from .env.local>
```

Redeploy after setting. The same token goes in the iOS app's settings sheet.

## File map

| File | Purpose |
|---|---|
| `vflicsStudioApp.swift` | App entry point, environment setup |
| `Models.swift` | `UploadSet`, `UploadFile`, `Destination` types |
| `Store.swift` | `@Observable` central store: sets, destinations, selection, persistence |
| `Theme.swift` | Color, typography, spacing constants (mirrors web's editorial vocabulary) |
| `UploadClient.swift` | Talks to `/api/studio/upload-remote` |
| `KeychainStorage.swift` | Stores endpoint + token securely |
| `Views/ContentView.swift` | Root: shows either SettingsSheet (first run) or MainTabs |
| `Views/SetsView.swift` | List of sets in the left tab; tap to edit |
| `Views/SetEditorView.swift` | Edit a single set (name, destination, photos) |
| `Views/PhotoPickerSheet.swift` | Wraps PHPicker for choosing photos |
| `Views/DestinationPickerView.swift` | Chip row of destinations |
| `Views/ThumbView.swift` | Single photo tile |
| `Views/PushSheet.swift` | Confirm-and-upload modal |
| `Views/SettingsSheet.swift` | Endpoint URL + token entry |

## Architectural notes

- **No drag-to-reorder** like the web. iOS uses native list `.onMove` (long-press the row, drag, drop).
- **Multi-select** uses the system "Select" toolbar pattern.
- **Photos** come from PHPicker, which gives `PHPickerResult.itemProvider`. The app loads the original-quality image data into memory only at push time to avoid blowing RAM on large sets.
- **Drafts** persist via `@AppStorage` for set metadata; photo data is *not* persisted (would balloon storage). After force-quit, sets reappear with empty photo grids — same "re-attach" pattern as the web.
- **Push** uploads sets sequentially, one multipart `POST` per set. Progress updates after each set completes.
