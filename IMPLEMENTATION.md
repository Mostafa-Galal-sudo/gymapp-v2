# OmniBody stabilization handoff

Completed 2026-10-01. The existing React + TypeScript + Vite + Zustand + Dexie + Capacitor architecture is retained.

## Implemented

- Dexie v8 is the durable user-data layer. It now owns workouts, the active workout, schedules, templates/preferences, nutrition logs and snapshots, food/cache records, measurements, hydration, supplements, weight, progress, preferences, and retained gamification data. Legacy local data and older Dexie versions have idempotent migrations.
- The workout lifecycle creates one active session, serializes meaningful autosaves, restores with Resume/Discard, persists rest timing, commits completion transactionally, completes only the linked schedule, clears the active row, and never advances or mutates tomorrow. History is explicitly date-sorted.
- Gemini, AI APIs, AI UI, AI environment configuration, and the AI dependency are removed. `REVIEW_REPORT.md` is the dated pre-implementation audit, so its descriptions of removed code are historical only.
- Nutrition uses a `FoodRepository` over USDA FoodData Central, Open Food Facts barcodes, editable custom foods, and Dexie cache. Nutrients are normalized in one module. Cache-first search refreshes stale data online and stays usable offline. Every meal occurrence has a UUID and an immutable nutrition snapshot.
- Body Measurements supports full weekly check-ins, extensible value keys, prior/current/difference entry guidance, previous/30-day/90-day/first comparisons, absolute and percentage deltas, paired symmetry trends, edit/delete, history, backup, and an optional native weekly reminder.
- Analytics is computed in a service layer for 7d/30d/90d/6m/1y/all-time ranges. It covers workout frequency/plans/completion/streaks/misses/sets/reps/volume/muscles/exercises/PRs, stored macros and micronutrients, target adherence, body/weight progress, hydration, supplements, and deterministic daily/weekly/monthly summaries.
- Insights includes a selectable GitHub-style activity heatmap and complete per-day drilldown. Missing nutrients remain unknown rather than being synthesized.
- The Android-first journal UI adds five thumb-reachable destinations, safe areas, accessible sheets/dialogs, mobile set entry, offline/loading/empty states, keyboard resize behavior, Android back handling, and English/Arabic RTL layouts.
- Routes and heavy screens are lazy-loaded. Three.js is isolated from startup, models preload in three stages, concurrent loads are deduplicated, loaded models are cached, Canvas uses demand rendering, and shared resources are disposed safely. The 23 full-quality, self-contained source GLBs total about 51.24 MB.
- Backup format v2 validates format, ownership, IDs, dates, numeric ranges, record shapes, workouts, measurements, food occurrences, and preferences before a transaction. Merge retains existing user records and remaps incoming user-owned IDs; replace clears only the selected user's recoverable domains. Device credentials and permissions are excluded.
- CI runs typecheck, lint, unit tests, production build, browser tests, and the Android build job. Production dependencies audit at zero known vulnerabilities.

## Verification completed

- `npm run check`: pass (TypeScript, ESLint, 17 unit tests in 6 files, Vite/PWA production build, production server bundle).
- `npm run test:e2e`: pass (4 Playwright mobile-browser tests).
- `npm audit --omit=dev`: 0 vulnerabilities.
- Runtime AI scan: clean.
- `.env.local` ignore check: pass; the personal USDA key is not in tracked files or backups.
- Live web USDA search was exercised successfully through the server proxy.
- All 23 web and checked Android GLBs match the supplied canonical source files byte-for-byte.
- Android-specific imports, native guards, manifest permissions, RTL support, keyboard resize, back behavior, and plugin registration paths were reviewed statically.

## Device validation checklist

1. Run `npm ci`, then `npm run build:app`. Open `android/` in Android Studio and build/install the debug APK.
2. In Nutrition settings, enter the personal USDA key. Search online, reopen the same query from cache, enable airplane mode, confirm cached/custom foods still work, scan a barcode, and log the same food twice then delete only one occurrence.
3. Start today's scheduled workout, edit sets/notes/rest timing, force-stop the app, reopen, Resume, and verify every value. Finish it and confirm the active prompt disappears, only today is complete, and tomorrow is unchanged. Repeat with Discard.
4. Create two weekly check-ins, confirm live previous/current/difference guidance and saved previous/30d/90d/first comparisons; edit and delete one with confirmation. Enable the weekly reminder and verify notification permission/scheduling.
5. Exercise every Insights range and heatmap metric; tap a populated day and compare workouts, exercises, meals, macros/micros, water, supplements, weight, and measurements with source screens.
6. Export a backup, add a marker record, test Merge, then test Replace on a disposable profile. Confirm workout, active session, schedules, nutrition snapshots, custom foods, measurements, photos, injuries, recipes, preferences, and gamification round-trip.
7. Switch English/Arabic, rotate, open the keyboard on set/food/check-in forms, use the hardware Back button on sheets and routes, and confirm safe-area spacing and one-handed navigation.
8. Grant and exercise camera/barcode, file export/share/import, notifications, Health Connect, BLE heart-rate, and biometric lock. Deny each permission once and verify the app degrades cleanly.
9. Open the 3D map on a mid-range Android device. Confirm visible progress, usable first render, immediate switching for already-loaded muscles, stable memory across repeated switching, and acceptable GPU behavior after background/foreground.
10. Repeat core workout, nutrition, measurement, analytics, backup, RTL, and 3D smoke tests in the production web build.

## Remaining device-dependent risks

- No APK, Gradle build, emulator, or physical-device run was performed in the final phase by request. Health Connect, BLE hardware, biometric prompts, camera behavior, notification delivery, file-provider sharing, process death, WebView GPU/3D behavior, and OEM keyboard/back quirks therefore require the checklist above.
- The lazy Three.js JavaScript chunk is about 795 kB minified (205 kB gzip). It is excluded from initial route startup. The full-quality 51.24 MB model set makes low-memory device performance and APK size important device checks.
- Three.js emits a dependency-level `Clock` deprecation warning during the browser 3D test; it does not fail rendering or caching.
- USDA `DEMO_KEY` remains a deliberately limited fallback. The supplied personal key is local-only and must be entered on each installed device rather than embedded in the APK.
