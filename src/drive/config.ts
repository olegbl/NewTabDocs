// Google OAuth client secret for Drive sync.
//
// For an installed / public client like a browser extension this value is NOT
// confidential: it ships inside the extension and is extractable by anyone.
// That is the standard, Google-sanctioned situation for desktop/mobile/SPA
// clients. PKCE (used in the auth flow) is what actually protects the
// authorization code; the secret only satisfies Google's "Web application"
// token-exchange requirement. See the "Google Drive sync" section in README.
//
// Replace the placeholder with the secret from Google Cloud Console
// (APIs & Services → Credentials → your OAuth 2.0 Client ID).
export const CLIENT_SECRET = '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'
