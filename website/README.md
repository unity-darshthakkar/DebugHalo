# DebugHalo website

The official static product website is an isolated React, TypeScript, and Vite application. It has
no backend, analytics, trackers, remote fonts, or runtime dependency on the CLI or extension.

## Development

From the repository root:

```bash
npm ci
npm run website:dev
```

## Validation and build

```bash
npm run website:typecheck
npm run website:test
npm run website:build
```

The production site is written to `website/dist`. Vite uses a relative base path, so the output can
be hosted at a domain root or repository subpath by GitHub Pages, Vercel, Cloudflare Pages, or any
static file host.

Release links are centralized in `src/release.ts`. Update that single object when publishing a new
stable extension release.
