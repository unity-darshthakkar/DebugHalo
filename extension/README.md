# DebugHalo browser extension

This directory contains the Chrome/Chromium Manifest V3 extension. It reuses the browser-safe
DebugHalo core and performs all scanning locally.

## Build and load

```bash
npm ci
npm run typecheck:extension
npm run build:extension
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select
`extension/dist`.

## Package a release ZIP

```bash
npm run package:extension
```

This rebuilds the extension and writes `artifacts/debughalo-extension-<version>.zip`. The archive
contains only the eight runtime files at its root. Development source maps remain in `extension/dist`
for unpacked debugging and are intentionally excluded from the ZIP. The package version and manifest
version must match or the build fails.

## Demo walkthrough

Use fake credentials only.

1. Open ChatGPT and enter a realistic fake AWS credential.
2. Attempt to send and observe DebugHalo block the original message.
3. Choose **Sanitize** and review the alias-based replacement.
4. Choose **Confirm Sanitized Send** and verify it sends exactly once.
5. Open the popup and verify the scanned, blocked, and sanitized counters incremented.

## Manual site validation

Use only fake/test credentials.

1. Open the popup and confirm ChatGPT, Claude, and Gemini are listed, protection is ON, and all
   session counters are numeric.
2. On `https://chatgpt.com/`, send a clean message and confirm the scanned count increments.
3. Enter a realistic fake credential, attempt to send it, and confirm both scanned and blocked counts
   increment.
4. Choose **Sanitize**, confirm the sanitized preview, send it, and confirm the sanitized count
   increments.
5. Trigger another review, choose **Send Anyway**, and confirm that count increments.
6. Turn protection OFF in the popup and confirm a sensitive test message is neither scanned nor
   intercepted.
7. Turn protection ON and confirm protection resumes without refreshing the page.
8. Select **Automatically sanitize and preview** and confirm a sensitive submission opens directly to
   a local sanitized preview but is not sent until confirmed.
9. Select **Block sending** and confirm a sensitive submission offers only a return to editing, not
   Send Anyway.
10. Repeat protection OFF/ON and one sensitive submission on `https://claude.ai/` and
    `https://gemini.google.com/`.
11. Close and reopen the popup and confirm preferences remain correct and session counters remain.
12. Inspect extension storage and confirm it contains only `protectionEnabled`, `onDetection`, and the
    four numeric counters—never message text, findings, secrets, or composer snapshots.

For each site, also verify the submission safety workflow:

1. Confirm a clean message sends normally.
2. Enter a message containing a realistic DebugHalo test credential and attempt to send it.
3. Add a second fake sensitive value and confirm both findings appear in one review surface.
4. Confirm the review shows category, detector, severity, confidence, and safe explanations without
   either raw value.
5. Choose **Cancel** and confirm the composer remains editable with its text unchanged.
6. Attempt submission again, choose **Send Anyway**, and confirm it sends exactly once.
7. Enter another sensitive message and confirm protection is active again.
8. Choose **Sanitize** and confirm aliases appear in a preview without submitting the message.
9. Choose **Back to editing** and confirm the original message remains unchanged and unsent.
10. Sanitize again, choose **Confirm Sanitized Send**, and confirm the composer is replaced and sent
    exactly once.
11. Confirm protection is active again after the sanitized send.
12. While review is open, change the composer and confirm no stale message is sent.
13. Repeat while the sanitized preview is open and confirm newer edits are not overwritten.
14. Confirm Shift+Enter creates a newline without opening the review.
15. Navigate to another or new conversation and repeat a protected submission.

ChatGPT-specific release checks:

1. Create a new Project and confirm DebugHalo does not intercept the dialog, button, or form and
   does not change counters.
2. Send a harmless image with an empty composer, then a harmless document with an empty composer;
   confirm both native attachment-only submissions work and are not counted as scanned.
3. Attach a harmless file with clean text; confirm the text is scanned once and the attachment sends
   intact.
4. Attach a harmless file with a fake credential; test Cancel, Send Anyway, and Sanitize → Preview →
   Confirm, verifying the attachment remains attached and each approved submission occurs once.

## Current scope

ChatGPT, Claude, and Gemini text submission through their normal Send button or Enter key is
covered. Site-specific selectors live in `src/adapters/`, shared submission protection lives in
`src/adapters/siteProtection.ts`, extension-only state lives in `src/state/`, and the review UI lives
in `src/ui/review.ts`.

Preferences are stored in `chrome.storage.local`. The four safe numeric counters are stored in
`chrome.storage.session`, so they describe the current browser session and reset when that session
ends. A minimal extension service worker enables Chrome's required content-script access to session
storage before protection initializes; it does not process or retain message content. Storage updates
are observed live by all supported-site content scripts. DebugHalo never stores raw or sanitized
messages, secrets, findings, or composer snapshots and makes no network requests.

Credential- and PII-specific toggles are not exposed because the current browser/core API does not
provide clean category-selective execution; the popup does not present controls it cannot enforce.
File attachments, restoration, an extension vault, other AI sites, and persistent statistics are
intentionally deferred.

## Known limitations

- Chrome and Chromium browsers are the supported browser targets.
- Protection covers text submitted through the supported site composers only.
- File and image attachments are not scanned.
- Only ChatGPT, Claude, and Gemini are supported.
- Upstream site DOM changes may require adapter selector updates.

## Release checklist

- Confirm the working tree contains only intended release changes.
- Run `npm ci` and the complete format, lint, typecheck, test, build, package-smoke, and audit suite.
- Run `npm run package:extension` and inspect the ZIP contents and version.
- Load `extension/dist` unpacked without manifest or service-worker errors.
- Run clean, sensitive, sanitize-confirm, and Send Anyway checks on ChatGPT, Claude, and Gemini.
- Verify SPA navigation, Protection OFF/ON, all detection modes, and popup counters.
- Inspect local/session extension storage and confirm only preferences and numeric counters exist.
