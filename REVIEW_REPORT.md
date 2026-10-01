# OmniBody (`gymapp-v2`) repository review

Review date: 2026-09-30  
Reviewed revision: `ddb6d2c` (`main`, matching `origin/main`)  
Scope: all 192 tracked files, including source, configuration, CI, Android wrapper, static assets, and generated/native resources. Binary PNG, JAR, and GLB files were inventoried and checked structurally; their binary contents were not reverse-engineered.

## Executive summary

OmniBody is a substantial local-first fitness application built with React 19, TypeScript, Vite, Zustand, Dexie/IndexedDB, Three.js, Express, and Capacitor 8. It provides workout planning and logging, nutrition and hydration tracking, measurements and progress photos, injury-aware exercise warnings, gamification, BLE heart-rate monitoring, Health Connect integration, biometric locking, bilingual English/Arabic UI, backup/export, and a 3D muscle map.

The project is feature-rich and TypeScript compilation succeeds, but it is not release-ready. The most urgent problems are:

1. The production web server crashes immediately under Express 5.
2. Normal profile, weight, or supplement updates can erase saved gamification and exercise preferences.
3. The Android app's AI nutrition scan calls a relative Express endpoint that is not present inside the packaged Capacitor app.
4. The server exposes paid AI endpoints without authentication, authorization, rate limiting, or meaningful request validation.
5. There is no application test suite, lint has 108 errors, and CI does not run either lint or tests.
6. Calendar schedules and in-progress workouts are memory-only and disappear after restart.
7. The claimed full backup is incomplete, and restore can overwrite globally keyed records when importing between users.

The best next move is a stabilization pass, not more features. Fix the data-loss and runtime blockers first, add targeted tests around persistence/import, then repair CI and packaging.

## What is in the repository

### Application layer

- `src/App.tsx` wires first-launch language selection, legacy-data migration, local authentication, biometric locking, routing, and walkthrough behavior.
- `src/pages/` contains nine screens: authentication/onboarding, dashboard, workout, calendar, nutrition, profile, progress, device live view, and muscle map.
- `src/components/` contains the lock gate, migration gate, health dashboard, walkthrough, plate calculator, ambient background, 3D muscle renderer, and layout/navigation.
- `src/store/` contains 10 Zustand stores and the cross-store session loader.
- `src/db/db.ts` defines Dexie schema versions 2–5 and nine tables.
- `src/services/` integrates Gemini, BLE, native health data, local notifications, and import/export.
- `src/data/foods.ts` contains 2,351 food records.
- `src/data/exercises.ts` contains 423 exercise records, 56 schedules, and 6 split systems.
- `src/i18n/translations.ts` contains 452 English keys and 456 Arabic keys. Arabic covers every English key; four legacy Arabic navigation keys are extra.

### Platform and delivery layer

- `server.ts` provides four Gemini-backed endpoints and serves the Vite app.
- `vite.config.ts` configures React, relative asset paths, source maps, and a generated PWA service worker.
- `android/` is a Capacitor Android project targeting package `com.omnibody.training`.
- `.github/workflows/android-build.yml` builds a signed release APK.
- `.github/workflows/ios-build.yml` is stale: the repository deliberately removed the `ios/` directory, so this workflow cannot succeed.
- `public/muscles/` contains 23 GLB models totaling roughly 55 MB. The same 23 models are also tracked under `android/app/src/main/assets/public/muscles/`, doubling checkout storage.

### Repository hygiene

- The root `README.md` is still the generic Vite template and does not describe OmniBody, setup, architecture, environment variables, Android signing, data storage, privacy, or known limitations.
- `scan.ps1` contains an obsolete absolute path to `e:\ddddddddddddddddd\proj\gymapp\src`, not this repository.
- `scan_payload2.json` and `scan_payload3.json` appear to be one-off dependency-scanner inputs rather than product files.
- Git LFS is configured for GLB assets and all 46 tracked GLBs are LFS-managed.
- The working tree remained clean after the review. `node_modules/`, `dist/`, and Gradle output are ignored.

## Verification performed

| Check | Result | Notes |
|---|---|---|
| `npm ci` | Pass | 718 packages installed; npm reported 13 vulnerabilities. |
| `npx tsc -b --pretty false` | Pass | TypeScript compilation succeeds. Strict mode is not enabled. |
| `npm run build` | Pass with warnings | Main JS chunk is 2.42 MB minified / 656.9 KB gzip; source map is 9.72 MB. Vite warned about ineffective dynamic import and oversized chunks. |
| `npm run lint` | Fail | 108 errors across 18 files: 87 explicit `any`, 7 unused variables, 4 useless assignments, 3 state-in-effect, 3 static-component, 2 render-purity, 1 empty block, and 1 `prefer-const`. |
| `NODE_ENV=production node dist/server.cjs` | Fail | Express 5 rejects `app.get('*', ...)` with `PathError: Missing parameter name at index 1: *`. |
| `npm audit` | Fail | 13 total: 4 moderate, 8 high, 1 critical. Five affect the production dependency tree (3 moderate, 2 high). |
| Android `test assembleDebug` | Not verified locally | Local JDK 25 is incompatible with the current Gradle/Groovy combination (`Unsupported class file major version 69`). CI requests JDK 21, so this is an environment mismatch, not proof the CI build fails. |
| Translation key parity | Pass | No English translation key is missing in Arabic. |
| Data ID uniqueness | Fail | Four duplicate food IDs and one duplicate exercise ID were found. |

## Critical and high-priority findings

### P0 — production server cannot start

`server.ts:173` uses `app.get('*', ...)`. With the installed Express 5.2.1/router stack, the application throws during route registration and exits before listening. `npm run build` passing does not detect this runtime failure.

What to do:

- Replace the catch-all with an Express 5-compatible route or middleware fallback.
- Add a smoke test that builds, starts the production server, and requests `/` and one client-side route.
- Read `PORT` from the environment rather than hard-coding 3000.

### P0 — user updates can erase other user-record fields

`src/store/useUserStore.ts:91-99` saves the user with `db.users.put(...)` but only writes `id`, `profile`, `supplements`, and `weightHistory`. Dexie `put` replaces the stored object. The same user record also stores `gamification` and `exercisePrefs`, so calls such as `updateProfile`, `logWeight`, `addSupplement`, or `deleteSupplement` can silently remove badges, XP, favorites, and templates.

What to do:

- Use `db.users.update(...)` for partial changes, or read/merge the full existing record inside a transaction.
- Add regression tests proving profile and supplement updates preserve `gamification` and `exercisePrefs`.
- Avoid splitting unrelated domains into one replaceable record, or centralize all writes through a repository layer.

### P0 — packaged Android AI scan has no reachable backend

`src/pages/Nutrition.tsx:449` posts to `/api/ai/nutrition`. In the Vite/Express web deployment that can reach `server.ts`; in a Capacitor APK it resolves against the app's local WebView origin. The Node/Express process is not packaged into the APK and `capacitor.config.ts` does not configure a remote server URL. The photo-based AI scan therefore cannot work in the Android release as currently assembled.

What to do:

- Deploy the AI API to an authenticated HTTPS backend and configure an environment-specific absolute API base URL.
- Do not embed `GEMINI_API_KEY` in the client or APK.
- Add a native-device integration test for the scan flow and a clear offline/unavailable UI state.

### P0/P1 — AI API is open to abuse if deployed

All four `/api/ai/*` routes in `server.ts` are unauthenticated. The server binds to `0.0.0.0`, accepts JSON bodies up to 10 MB, and has no rate limit, quota, origin control, schema validation, timeout, or per-user authorization. Anyone who can reach it can consume the configured Gemini quota. Raw upstream error messages are also returned to clients.

Only `/api/ai/nutrition` is referenced by the frontend; coach, workout-analysis, and daily-plan are currently dead endpoints.

What to do:

- Require authenticated requests and enforce per-user/per-IP rate and size limits.
- Validate MIME type, base64 size, string lengths, and request shapes.
- Add timeouts, structured logging, safe client errors, and cost/usage monitoring.
- Remove unused endpoints until their UI and security model exist.

### P1 — persistence is incomplete and inconsistent

`scheduledSessions`, `activeSession`, and warning flags in `useWorkoutStore.ts` exist only in memory. Scheduled calendar entries and workouts in progress are lost when the app reloads or the OS kills it.

The device, health, language, onboarding, and app-lock stores use global localStorage keys rather than per-user storage. This is inconsistent with the Dexie per-user model and would leak state between profiles if multi-user support is added.

What to do:

- Persist scheduled workouts in Dexie with user and date indexes.
- Autosave active workouts after every meaningful edit and offer resume/discard after restart.
- Decide explicitly whether the product is single-user or multi-user; remove misleading abstractions or scope every store consistently.

### P1 — “full backup” is not full, and restore keys are unsafe

`buildUserDataExport` exports the nine Dexie tables but omits device sessions, health snapshots, scheduled workouts, active workouts, language, onboarding, and app-lock state. Calling it “every table, round-trippable” is only true for Dexie and not for the user's complete app data.

`importUserDataJSON` remaps `userId` but preserves global primary keys such as `sessionId`, injury ID, custom exercise ID, measurement ID, photo ID, and recipe ID. Importing another profile can overwrite another user's record if IDs collide. Validation only checks that three properties are arrays; it does not validate `formatVersion`, object shapes, sizes, dates, or numeric ranges. Import merges with existing rows, leaving stale records that are absent from the backup.

What to do:

- Define backup semantics: replace versus merge.
- Validate the complete schema and supported format version before opening a write transaction.
- Remap every globally keyed record and all cross-references, or change schemas to compound `[userId+id]` keys.
- Include all user-owned persisted domains or rename the feature to clarify its scope.
- Add round-trip, corrupt-file, oversized-file, and cross-user collision tests.

### P1 — duplicate catalog IDs produce ambiguous behavior

The food catalog duplicates `kfc_twister`, `raw_edamame`, `raw_sweet_potato`, and `raw_chia_seeds`. Some duplicates disagree materially—for example, the two chia records use different serving sizes and nutrient values. The exercise catalog defines `chin_up` both as a back exercise and a biceps-focused exercise.

IDs are used as React keys, lookup-map keys, recipe references, history references, and removal identifiers. Duplicates therefore cause inconsistent display, lookup, macro calculations, exercise classification, and deletion behavior.

What to do:

- Assign unique, stable IDs and write a catalog-invariant test that fails on duplicates.
- Add data validation for required names, positive serving sizes, finite nutrient values, and known categories.
- Version catalog migrations so historical logs retain their intended identity.

### P1 — workout ordering is not guaranteed

`loadUserWorkouts` retrieves all rows with `where('userId').equals(userId).toArray()` and stores them without sorting. Several methods iterate backward and assume the final entry is the latest session (`getSuggestedWeight`, `getProgressionSuggestion`, volume-spike comparison). IndexedDB does not promise date ordering for rows sharing the same `userId` index.

What to do:

- Sort by date after loading or query a compound `[userId+date]` index.
- Add tests with out-of-order session IDs and dates.

### P1 — no application tests or enforced quality gate

The only tests are Capacitor's generated Java examples. There is no Vitest/Jest/React Testing Library setup, no test script, and no end-to-end suite. Android CI builds without running ESLint or application tests. The TypeScript config explicitly permits unused locals/parameters for app code and does not enable `strict`.

What to do:

- Start with unit tests for stores, database migrations, health-score calculations, data import/export, and catalog invariants.
- Add component tests for onboarding, lock behavior, workout completion, and nutrition logging.
- Add one web smoke/e2e path and one native integration checklist.
- Make `typecheck`, `lint`, `test`, and production-server smoke checks required in CI.

## Medium-priority findings

### Lint and React correctness

- 87 `any` usages defeat a large part of TypeScript's value, especially around imports, BLE data, calendar callbacks, and database entities.
- `Profile.tsx` defines `TabBtn` inside the component render, so React treats it as a new component type on every render and can reset subtree state.
- `Dashboard.tsx` and `Progress.tsx` call `Date.now()` during render, which violates React render purity and makes output time-dependent.
- `Walkthrough.tsx`, `Nutrition.tsx`, and `Workout.tsx` synchronously set state inside effects.
- `foods.ts` has four unused assignments and emits three console messages whenever the module loads, including production.

### Authentication and lock semantics

- “Authentication” is a local profile selector, not identity verification. `Auth.tsx` always loads `default_user`; for a returning user, any non-empty name is accepted and the typed name is ignored.
- There is no UI call to `logout()` even though the store provides it.
- After three biometric errors, `AppLockGate.tsx:65-68` offers a button that disables the lock and enters the app without authentication. That prevents lockout but means the feature cannot be described as protecting sensitive health data. A recovery flow should require the device credential or an explicit destructive reset.
- IndexedDB, localStorage, and exported JSON contain health/profile data and base64 progress photos in plaintext. The README and UI provide no privacy/security explanation.

### Import, IDs, and deletion behavior

- Most IDs use seven characters from `Math.random()`. Collisions are unlikely for small data sets but can silently overwrite primary-keyed records. Use `crypto.randomUUID()`.
- `removeFood` filters by `foodId`, so removing one logged item removes every occurrence of that food within the meal. Logged entries need their own unique ID.
- Import accepts arbitrary object shapes and potentially huge base64 progress photos, creating memory and storage-exhaustion risk.
- Migration failure sets `dexie_v2_migration_complete=true`, permanently suppressing retry even though the user was told migration failed.
- `MigrationGate` begins with `migrating=false` and only enables the gate in an effect, allowing children and `App`'s auto-load effect to run during the initial migration window.
- Legacy migration does not carry every old-store field, including gamification and exercise preferences.

### PWA and offline behavior

- The manifest references `pwa-192x192.png` and `pwa-512x512.png`; `includeAssets` references `favicon.ico`, `apple-touch-icon.png`, and `masked-icon.svg`. None of these files exists.
- `index.html` and `index.css` load Google Fonts; workout alarm audio comes from Mixkit; dashboard avatar comes from DiceBear; barcode lookup uses Open Food Facts. These features degrade offline.
- The generated service worker reported only 27 precache entries totaling 2.8 MB, so the 55 MB GLB muscle set is not proven available offline despite the 60 MB Workbox size cap.
- There is no offline-status UI or explicit caching strategy for external data.

### Performance and maintainability

- All pages are eagerly imported in `App.tsx`; the main bundle is 2.42 MB minified. Route-level lazy loading would substantially improve startup.
- `foods.ts` (2,538 lines), `Profile.tsx` (1,360), `Nutrition.tsx` (1,139), `Workout.tsx` (1,069), `translations.ts` (966), and the global CSS (1,135) are difficult to review and test safely.
- The food database is bundled into the main client path and transformed at module load. Consider a validated data artifact loaded on demand or a compact indexed data file.
- The `sessionLoader` dynamic import in `Profile.tsx` cannot split because `App.tsx` imports it statically.
- Source maps are enabled for production, adding a 9.72 MB main map and exposing readable implementation details if deployed with `dist` unchanged.

### Notifications and localization

- Water and supplement notification text is hard-coded in Arabic even when English is selected.
- Water reminders are scheduled only for remaining hours on the current day and do not repeat the next day.
- Custom channel IDs are used without an explicit `createChannel` call in application code; verify behavior on Android 8+ devices.
- Reminder scheduling errors are logged but not surfaced to the user.

### Health and fitness product risk

- The app provides health scores, macro/micronutrient targets, injury substitutions, workout-load warnings, and AI nutrition estimates without a visible medical/nutrition disclaimer.
- Much of the large nutrient catalog appears hand-assembled or generated and has no provenance, units documentation, validation suite, or source citations. The duplicate records already demonstrate inconsistency.
- AI image nutrition values are estimates but are inserted into the same flow as database values without a confidence indicator.

Before presenting these outputs as health guidance, document sources and units, add explicit estimate labels and limitations, and have the formulas/content reviewed by a qualified domain expert.

## CI, Android, and release engineering

### Android workflow

Good points:

- Uses Git LFS checkout, Node 22, JDK 21, Gradle cache, Capacitor sync, secret-based signing, and artifact upload.

Problems:

- `npm ci || npm install` hides lockfile failures. CI should fail if `npm ci` fails.
- It does not run lint, tests, a server smoke check, dependency policy checks, or Android lint.
- After `cap sync android`, it manually copies `public/muscles` into a destination that Capacitor already populates. Because the destination exists, the command risks creating a nested `muscles/muscles` directory.
- Release minification/resource shrinking are disabled.
- Version code/name are fixed at `1`/`1.0`.
- Signing secret presence and decoded keystore integrity are not checked before Gradle.

### iOS workflow

The project history says iOS was removed and Android is the sole target, but `.github/workflows/ios-build.yml` still calls `npx cap sync ios` and enters `./ios/App`. Delete the workflow if iOS is intentionally unsupported, or restore the platform before retaining it.

### Android project

- Package and namespace are consistently `com.omnibody.training`.
- BLE permissions are declared, with legacy permissions capped at API 30 and BLE hardware optional.
- `android:allowBackup="true"` permits platform backup of app data; confirm that this matches the privacy model for sensitive fitness data.
- The generated placeholder Java unit/instrumentation tests do not test OmniBody behavior.
- The same GLBs are tracked both in `public/` and generated Android assets; choose one source of truth and let Capacitor copy assets during sync.

## Dependency status

The full npm audit reported 13 vulnerabilities: 4 moderate, 8 high, and 1 critical. The production-only tree has 5: 3 moderate and 2 high. The direct production issue is `react-router-dom`/`react-router`; other production findings are transitive (`fflate`, `protobufjs`, and `qs`). Development/build tooling contains the remaining findings, including the critical `tar` advisory.

Do not blindly run a force update. Update the direct packages within compatible ranges, regenerate the lockfile, rerun the full test/build matrix, and confirm whether all transitive advisories clear. `npm outdated` also shows many compatible updates, notably Capacitor packages, `@google/genai`, React Router, Vite, Dexie, and testing/lint tooling.

## Recommended execution plan

### Phase 1 — stop data loss and restore runnable releases

- [ ] Fix Express 5 fallback routing and add a production startup smoke test.
- [ ] Replace destructive user-record `put` calls with safe partial/transactional writes.
- [ ] Deploy/configure a real AI backend for native builds or disable the native AI scan until one exists.
- [ ] Add API authentication, validation, request limits, rate limits, and safe errors.
- [ ] Remove the stale iOS workflow.
- [ ] Remove duplicate catalog IDs and add uniqueness validation.
- [ ] Sort workout history by date before any “latest session” logic.

### Phase 2 — make persistence and recovery trustworthy

- [ ] Persist schedules and active workouts.
- [ ] Redesign backup validation, ID remapping, and replace/merge semantics.
- [ ] Include or explicitly exclude every persisted domain in backup documentation.
- [ ] Fix migration gating and make failed migration retryable/recoverable.
- [ ] Give each logged food occurrence its own ID.
- [ ] Replace random IDs with UUIDs.

### Phase 3 — establish a quality gate

- [ ] Add Vitest plus IndexedDB test support and React Testing Library.
- [ ] Test the data-loss regression, catalog invariants, workout ordering, import collisions, nutrition mutations, and health-score boundaries.
- [ ] Resolve the 21 non-`any` lint errors first, then type the 87 `any` sites incrementally.
- [ ] Enable TypeScript `strict` in stages and restore unused-code checks.
- [ ] Require typecheck, lint, tests, build, server smoke, and Android lint in CI.
- [ ] Update vulnerable dependencies and commit the refreshed lockfile.

### Phase 4 — improve product quality and maintainability

- [ ] Replace the template README with real setup, architecture, privacy, backup, AI-backend, and Android-release documentation.
- [ ] Split large pages into feature components/hooks and split data from executable code.
- [ ] Lazy-load routes, 3D code, scanner code, and large catalogs; set a bundle budget.
- [ ] Add valid PWA icons and test install/offline behavior, including GLB availability.
- [ ] Localize notifications and bundle critical offline assets such as timer audio.
- [ ] Clarify single-user versus multi-user behavior and make authentication/lock wording accurate.
- [ ] Add health/nutrition disclaimers, source documentation, confidence labels, and domain review.
- [ ] Remove or update stale scanner artifacts and duplicated Android assets.

## Suggested definition of “ready”

The next release candidate should not ship until all of the following are true:

- Production server starts and serves both `/` and a client-side route.
- Profile/supplement edits cannot erase gamification or exercise preferences.
- A started workout and a scheduled workout survive process death/restart.
- Backup round-trip is tested and cannot overwrite another user's globally keyed data.
- The Android AI scan either reaches an authenticated backend or is clearly unavailable.
- Catalog uniqueness tests pass.
- Typecheck, lint, tests, production build, and server smoke checks pass in CI.
- Production dependency audit has no known high/critical findings, or each exception is documented with impact and mitigation.
- A signed APK is tested on at least one current Android device for BLE, notifications, Health Connect, biometric lock, camera/barcode scan, import/export, RTL layout, offline startup, and 3D asset loading.

## Overall assessment

The codebase has a strong breadth of features and several thoughtful recent fixes, particularly around session hydration, lock-overlay mounting, BLE cleanup, health-data availability, and bilingual onboarding. Its primary weakness is that product scope has grown faster than persistence boundaries, automated verification, and release engineering. The architecture is recoverable without a rewrite: a focused stabilization cycle around database writes, API deployment/security, persistence, catalog validation, and CI would produce a much safer foundation for further feature work.
