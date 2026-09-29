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

## GitHub Pages deployment

The production website is deployed to:

<https://unity-darshthakkar.github.io/DebugHalo/>

The `Deploy website to GitHub Pages` workflow runs automatically after a push to `master`. It can
also be rerun manually from the repository's **Actions** tab by selecting the workflow and choosing
**Run workflow**.

The workflow installs the locked dependencies with `npm ci`, runs `npm run website:build`, uploads
`website/dist` as the Pages artifact, and deploys it to the `github-pages` environment. The relative
Vite base keeps assets working beneath the `/DebugHalo/` repository path as well as during local
development.

Release links are centralized in `src/release.ts`. Update that single object when publishing a new
stable extension release.
