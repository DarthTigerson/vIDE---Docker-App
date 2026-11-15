# vIDE Docker app

The Docker panel for [vIDE](https://github.com/DarthTigerson/vIDE), packaged as a
vSuite Store app on vIDE's app API v1. It lists containers (grouped by Compose
project), starts/stops/restarts/removes them singly or in batches, shows optional
per-container memory, opens `docker logs -f` in a tab, and adds a running-count
badge plus a "Docker isn't running" notification. Uninstalling the app is the
off switch.

Layout:

- `src/main/` becomes `main.js` (CommonJS, runs in vIDE's main process; talks to the `docker` CLI through `vide.process`, never imports `electron`).
- `src/renderer/` becomes `renderer.js` (ES module; React comes from `globalThis.__videShared`, never bundled) plus a scoped `style.css`.
- `src/vide.d.ts` is a copy of vIDE's app API types (renderer and main side).

Settings keep their built-in keys (`vide:docker:showBadge`, `badgeMode`, `showMemory`, `memoryFormat`), so existing preferences carry over.

## Dev loop

```bash
npm install
npm run build        # writes dist/ (renderer.js, main.js, style.css, manifest.json, assets/)
npm test             # parsing + main handler tests with a fake `vide`
npx tsc --noEmit     # type check
```

In a dev vIDE run the palette command **Load app from folder…** and pick `dist/`.
Rebuild and reload the app after changes.

## Packaging

```bash
npm run build && npm run package
```

Writes `release/docker-1.0.0.zip` (files at the zip root) and prints its sha256
and size. The zip is reproducible: the same sources give the same hash.

## registry.json entry

```json
{
  "id": "docker",
  "name": "Docker",
  "description": "Start, stop and clean up containers from the sidebar.",
  "repo": "DarthTigerson/vIDE---Docker-App",
  "firstParty": true,
  "latest": {
    "version": "1.0.0",
    "commit": "<full 40-char SHA of the release commit>",
    "url": "https://github.com/DarthTigerson/vIDE---Docker-App/releases/download/v1.0.0/docker-1.0.0.zip",
    "sha256": "767f0711cdcaa247174f9cfd605ec9d2b0f4f4bf70affa4d8048d0e366cb966b",
    "minVide": "0.4.0",
    "notesUrl": "https://github.com/DarthTigerson/vIDE---Docker-App/releases/tag/v1.0.0"
  },
  "replacesBuiltIn": "docker"
}
```

Recompute the sha256 with `npm run package` whenever the sources change.
