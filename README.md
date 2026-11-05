# Stride · Marathon Dashboard

A private, mobile-first marathon journal built with React, TypeScript and Vite. No subscriptions, analytics, accounts, hosted database or third-party API credentials. This first milestone uses manual entries and optional fictional sample data.

## Try it locally

Requires Node.js 22.12+ (tested on 24.22.1) and npm.

```sh
cd /workspace/Eatinghealthy # or your local checkout directory
npm ci
npm run dev
```

Open the address Vite prints in your browser. For the installable, offline-capable version:

```sh
npm run build
npm run preview
```

Open the preview address on the same computer. Offline and installation require localhost or HTTPS. Use the browser's install option, or Safari's Share → Add to Home Screen when served over HTTPS on iPhone. No public deployment has been configured. Do not expose a server as a private remote service without adding authentication and access control. To test the layout without hosting, use your desktop browser's mobile device emulator.

## Five-minute test drive

1. Turn **Sample data** on to explore Today, Training, Weight, Food and Review. All sample records are synthetic and held only in memory. Exit sample mode to use your separate personal journal.
2. Log a weigh-in, a run with distance/duration and a meal. For a meal with 400 kcal and 25 g protein per portion, logging 1.5 portions adds 600 kcal and 37.5 g protein. The UI rounds some displayed figures; exports retain precision.
3. In Food, edit a saved meal with your nutrition label or explicit estimate. Default meal descriptions have no invented nutrition values.
4. Refresh: personal entries persist in IndexedDB. Sample edits reset on reload.
5. In Settings, export a JSON backup. Use **Choose CSV or JSON** to preview it, then merge records or explicitly replace the journal from the backup. Replace restores presets and settings too.
6. Download the fictional CSV template, edit it, preview and confirm an import. Re-importing identical records skips duplicates. Any validation error blocks the entire import.
7. To check offline support, open the production preview online once, wait for the service worker to install (browser developer tools → Application), switch the browser offline, then reload. Your local journal remains usable.

## Features and limits

- Today: selected-day nutrition, steps, hydration, recent weight, trend and user-entered expenditure estimates.
- Training: completed runs/gym, duration, pace, optional HR/effort, weekly chart and conservative volume-change flag. Friday is the preferred rest day. Runna workouts are not fabricated.
- Weight: daily measurements, daily means, calendar 7-day rolling averages and change between adjacent 7-day windows. Missing days are not interpolated. Sparse averages are provisional.
- Food: editable meal presets, portion multiplier and calorie/protein totals. A calorie target appears only when explicitly configured.
- Review: limited daily nutrition feedback and weekly summary with missing-data caveats. No medical diagnosis or claim of verified plan adherence.
- Settings: backup/restore, CSV export/import, provenance, connection status and confirmed data deletion.
- Installable manifest and offline application shell. No automatic integrations, photo analysis or multi-device syncing.

Health Auto Export, COROS and Happy Scale native formats are **not yet supported**. A real, redacted export is needed to implement and test each adapter. Apple Health cannot be read directly by a web app. Existing ChatGPT connections do not supply credentials to this app.

## Common import format

Accepts a CSV with headers or a JSON array of record objects; Stride version-1 JSON backups are also accepted. Max 5 MB / 10,000 records.

Required fields: `kind`, `date` (`YYYY-MM-DD`), `value`. Optional: `unit`, `name`, `timestamp` (ISO), `timezone` (IANA), `source`. Meals require `protein` in grams. Runs require `duration` in minutes; optional `sessionType`, `hr` and `effort` (1–10).

Kinds and canonical units: `weight`/kg, `meal`/kcal, `run`/km, `gym`/min, `steps`/steps, `hydration`/ml, `energy`/kcal. Imports also convert lb→kg, mi→km and l→ml. Export retains timestamp, timezone, source, import batch and deduplication key. Missing timestamps use the time of entry/import; the date remains the selected measurement day. JSON backup restore preserves original provenance.

Dates use Europe/London. Enter source dates explicitly; the adapter does not infer dates from foreign timestamps. Duplicate detection compares kind, date, normalized value, name, duration and protein across sources. Identical same-day entries are considered duplicates on import; review before accepting. Distinct manual meals are allowed. Different weights on one day are retained and averaged, so confirm conflicting sources before importing.

Steps and hydration entries are increments that sum for a day. Enter one daily total or several increments, not both. Energy entries represent **total** daily expenditure; the latest entry for a day overrides the configured estimate. Exercise calories are never added. Deficits are provisional while meals are incomplete; uncertainty in the user-supplied estimate is unknown.

## Privacy

Personal entries stay in the current browser profile's IndexedDB. They are not uploaded or embedded in source/build output. Device-level privacy is required: the app does not encrypt local storage or authenticate someone using the same browser profile. Clearing browser/site data can erase the journal. JSON/CSV backups contain personal information; store them privately and never commit them. Deleting app data does not delete downloaded backups. Synthetic fixtures are not personal health data.

The app makes same-origin static asset requests only. Free hosting could serve the static app later, but remote private access needs authentication before deployment; a secret URL is not sufficient.

## Validation and development

```sh
npm test             # calculation, timezone, conversion, deduplication/import tests
npm run build        # TypeScript check and production bundle
npm run test:e2e      # Chromium mobile workflow and offline smoke tests
```

Browser tests default to `/usr/bin/chromium`. Set `CHROMIUM_PATH` to your installed Chromium executable if different. Playwright starts the preview server on port 4173; build first. Test records are fictional and use isolated browser contexts. Screenshots are written under `/tmp`, not the repository. Browser tests require local server/process permissions.

`src/model.ts` contains pure calculations and import validation; `src/db.ts` provides IndexedDB persistence; `src/App.tsx` contains the screens; `public/sw.js` handles the offline shell. Increment its cache version when changing caching strategy. No server-side services are required. Future import adapters should normalize into the common entry model and reuse validation/preview.
