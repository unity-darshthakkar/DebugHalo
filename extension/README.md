# DebugHalo browser extension

This directory contains the Chrome/Chromium Manifest V3 extension. It reuses the browser-safe
DebugHalo core and performs all scanning locally.

## Build and load

```bash
npm run typecheck:extension
npm run build:extension
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select
`extension/dist`.

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
