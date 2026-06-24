# Privacy Policy — New Tab Docs

**New Tab Docs** is a Chrome extension that provides a markdown note-taking editor on every new tab, with optional Google Drive sync.

_Last updated: June 2026_

## Data stored locally

Your notes are stored on your device using `chrome.storage.local`. This data never leaves your browser unless you explicitly enable Google Drive sync.

## Google Drive sync (optional)

If you choose to connect Google Drive, the extension:

- Requests the `drive.file` OAuth scope, which grants access only to files created by this extension.
- Creates and reads a single file (`newtabdocs-backup.json`) in your Google Drive to store your notes.
- Stores an OAuth access token in `chrome.storage.local` on your device to keep you connected across sessions.

Your notes and OAuth token are never sent to any server other than Google's APIs. The extension has no backend.

## Data sharing

No data is shared with any third party. The developer has no access to your notes or your Google account.

## Permissions

- **storage** — saves your notes locally on your device.
- **identity** — used to authenticate with Google Drive via OAuth when you choose to connect.

## Contact

Questions or concerns: [olegbl@gmail.com](mailto:olegbl@gmail.com)

---

&copy; 2026 Oleg Lokhvitsky
