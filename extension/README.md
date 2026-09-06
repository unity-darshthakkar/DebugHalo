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

## Manual ChatGPT validation

Use only fake/test credentials.

1. Open `https://chatgpt.com/` and confirm a clean message sends normally.
2. Enter a message containing a realistic DebugHalo test credential and attempt to send it.
3. Confirm submission is blocked and the warning shows category, severity, and confidence without
   the raw credential.
4. Choose **Cancel** and confirm the composer remains editable with its text unchanged.
5. Attempt submission again, choose **Send Anyway**, and confirm it sends exactly once.
6. Enter another sensitive message and confirm protection is active again.
7. Confirm Shift+Enter creates a newline without opening the warning.
8. Navigate to another or new conversation and repeat a protected submission.

## Current scope

Only ChatGPT text submission through the normal Send button or Enter key is covered. Site-specific
selectors live in `src/adapters/chatgpt.ts`. File attachments, other AI sites, and richer review or
sanitization workflows are intentionally deferred.
