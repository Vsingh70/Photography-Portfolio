# archive/ — superseded planning docs

These documents describe the **pre-redesign** architecture (Google Drive ingestion + native Tauri/iOS Studio + the original auto-publish refactor). They are kept for historical reference only. The project is migrating to **Supabase + a single web/PWA Studio**, which supersedes the direction described here.

For the current plan, see [`../redesign/`](../redesign/).

| File | What it was | Why archived |
|---|---|---|
| `05-polish-ios.md` | iOS launch screen + bundled-fonts polish | The iOS app is being retired (see redesign roadmap, Track B). |
| `old-drive-native-refactor-history.md` | History of the Drive → auto-publish + native-client refactor | The Drive/native architecture it documents is being replaced by Supabase + web Studio. |
| `vflics-studio.command` | Launcher script for the native desktop Studio | Obsolete once the native clients are deleted (last step of the Studio refactor). |

**Do not build against these.** Anything still valid (e.g. the publish-trigger loop) has been carried into `../ops-autopublish-setup.md` or the redesign refactor plan.
