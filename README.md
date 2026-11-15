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

Writes `release/docker-<version>.zip` (files at the zip root) and prints its sha256
and size. The zip is reproducible: the same sources give the same hash.

## Releasing

Push a tag like `v0.1.3`. The Release workflow takes the version from the tag, runs the tests, builds `docker-<version>.zip` and publishes a GitHub release with it. The vSuite catalog picks it up within the hour (or at once, if the `VSUITE_STORE_TOKEN` secret is set).

## Store page content

- `manifest.json` `description`: the one-line summary on the Store card.
- `store/README.md`: the About text on the Store page (shipped in the zip as `README.md`).
- `assets/icon.svg`: the app icon.
- Screenshots: put PNG/JPG/WebP files in `assets/` and list them in `manifest.json` as `"screenshots": ["assets/shot-1.png"]` (up to 8, 5 MB each). Leave the field out until you have some.

The vSuite catalog rebuilds itself from the latest GitHub release, so publishing a release with `release/docker-<version>.zip` attached is all an update needs.
