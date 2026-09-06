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

Only ChatGPT text submission through the normal Send button or Enter key is covered. Site-specific
selectors live in `src/adapters/chatgpt.ts`, while the review UI lives in `src/ui/review.ts`. File
attachments, other AI sites, restoration, and persistent extension preferences are intentionally
deferred.
