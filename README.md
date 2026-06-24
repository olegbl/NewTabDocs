# New Tab Docs

A Chrome extension that replaces the new tab page with a pseudo-WYSIWYG markdown editor. Notes are saved locally and optionally synced to Google Drive.

![New Tab Docs screenshot](docs/screenshot.png)

## Features

- Markdown editor with live syntax highlighting (headings, bold, italic, code, links)
- Multiple tabs, sorted by last edited
- Ctrl+click (or Cmd+click) to open links in a new tab
- Instant local save via `chrome.storage.local`
- Optional Google Drive sync with conflict detection and resolution
- Persisted Drive connection — stays connected across browser restarts

## Install

[**Chrome Web Store →**](https://chrome.google.com/webstore/detail/mopgmbfgiiphfankboijlehiekcpogmm)

Or load unpacked from `dist/` after building locally (see below).

## Development

**Requirements:** Node.js 18+, Yarn

```bash
yarn install
yarn build      # outputs to dist/
yarn test       # run tests
```

Load the extension in Vivaldi/Chrome: go to `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select the `dist/` folder.

## Google Drive sync

Drive sync uses OAuth 2.0 via `chrome.identity.launchWebAuthFlow`, which works in any Chromium-based browser. Click **Connect Drive** in the sidebar footer to authenticate. The connection persists across restarts and auto-refreshes when the token expires.

## Tech stack

- React 18 + TypeScript + Vite
- CodeMirror 6 with GFM markdown extensions
- Google Drive REST API v3
- Vitest + Testing Library

## License

MIT — see [LICENSE](LICENSE)

## Privacy

See [Privacy Policy](https://olegbl.github.io/NewTabDocs/privacy.html)
