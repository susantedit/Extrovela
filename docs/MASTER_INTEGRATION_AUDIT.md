# EXTROVELA — Master Integration Audit (Phases 1–14)

**Type:** Read-only audit & hardening assessment. **No application code was modified to produce this report.**
**Date:** 2026-08-24.
**Scope of the directive:** Audit the existing codebase; map the system; find duplicates; verify data-model/userId consistency, AI grounding, security/privacy, performance/scalability, and graceful degradation. Do **not** rebuild working systems, do **not** create duplicates, and do **not** start Phase 15.

---

## Honesty legend

The directive mandates these exact labels. This report uses them literally.

- `✅ IMPLEMENTED` — code exists, is reachable from the running app, and does what it says on-device.
- `⚙️ REQUIRES EXTERNAL CONFIGURATION` — code path is complete and fails safe, but stays inert until a credential/host/dependency is supplied.
- `🧪 MOCKED` — the feature currently returns hardcoded/in-memory data instead of a real integration.
- `🚫 NOT IMPLEMENTED` — the described surface has no working code behind it.
- `🐞 KNOWN BUG` — implemented, wired, but incorrect at runtime.

**Method note (honesty about the audit itself):** Findings are backed by direct file:line reads and by three independent sub-audits (duplicates/wiring, mock inventory, security). The one finding that required runtime reasoning rather than a live browser run — the Firebase double-init bug (§20) — is derived from the code paths and is labelled as such. I did not execute the app in a browser or against live Firebase/Mongo credentials.

---

## 1. Executive verdict

EXTROVELA is a **genuinely engineered, honestly-documented codebase** — not a hollow shell and not something to rebuild. Its *pure core* (quest pipeline, personalization, memory/recap math, feature flags, token security, Firestore rules) is real and, in large part, test-proven. Its *external integrations* are almost entirely **mock or config-gated**: places, weather, events, push, social persistence, and the AI narrative do not perform real-world I/O in the current state.

Three things materially contradict an "everything works" reading and are the headline of this report:

1. **🐞 A Firebase double-initialization bug (§20) breaks the app in its shipped default configuration** — guest/email sign-in throws and persistence silently fails, because a hardcoded-placeholder Firebase app is registered first and defeats both the real-credential path *and* the intended localStorage fallback.
2. **CRITICAL security exposure (§29–§31):** a real MongoDB Atlas credential sits in `server/.env` with no `.gitignore`; the admin API and the Mongo memory/stats API are completely unauthenticated (IDOR + unauth writes + world-readable moderation queue).
3. **"Real-world" is largely aspirational (§7–§13, §18):** the `realPlaces`/`realWeather`/`realLocation` flags read `true` at 100% but are **never consulted**; places/weather are mocked; `nearbyPlaces` is fetched but never used; location is hardcoded to Kathmandu.

None of this means the project is bad. It means the honest status is "**real core, mocked edges, one shipping-config bug, and a handful of server-side security holes**" — all fixable within a bounded hardening pass without rebuilding anything.

---

## 2. Verification gates (typecheck / lint / tests / build)

| Gate | Command | Result |
|---|---|---|
| Typecheck (full) | `tsc -p tsconfig.json --noEmit` | ✅ **0 errors** |
| "Lint" | `npm run lint` → `tsc` | ✅ passes — **but see caveat** |
| Tests | esbuild-bundle each `src/__tests__/phaseN.test.ts`, run under `NODE_ENV=test` | ✅ phase7/9/10 pass; phase11 41/41; phase12 29/29 |
| Production build | `npm run build` → `tsc && vite build` | ✅ succeeds (with warnings, §37) |

**⚙️/caveat — "lint" is not linting.** `package.json` defines `"lint": "tsc"` — there is no ESLint/Biome. Separately, `tsconfig.check.json` only includes ~7 files (`personalization`, `ProfileScreen`, `MemoriesScreen`, `AppStateContext`, `questEngineService`, `phase11.test`, `vite-env`). If any CI uses that config, it type-checks a *subset*. The **full** `tsc -p tsconfig.json` (all of `src`) is green, which is the stronger check and the one relied on here.

---

## 3. Tech-stack reality

The Phase specs assume React Native / Expo. The actual stack is **React 18 + Vite + TypeScript + Capacitor** (native bridge via `@capacitor/*` v8 and `@capacitor-firebase/*`). Backend is **Express + Mongoose + MongoDB** with a **Gemini** AI gateway. Data layer is a **Firestore + localStorage** hybrid on the client and **MongoDB** on the server. Maps are **Leaflet + OpenStreetMap**. Any remediation must respect Capacitor, not RN.

---

## 4. System map (high level)

```
main.tsx ──initFirebase() [lib/firebase.ts]  ← 🐞 registers PLACEHOLDER app first (§20)
        └─ App.tsx
           ThemeProvider → AuthProvider → AppStateProvider → ProtectedAppRouter
              ├─ Auth screens (Welcome/SignIn/SignUp) — real components
              ├─ OnboardingFlow (localStorage gate)
              └─ 6 tabs: home · explore · map · memories · friends · profile

Client services
  services/firebase/*  → getFirebaseApp() [firebaseConfig.ts]  (auth, firestore, storage, analytics, messaging)
  quest-engine/*       → QuestEngine pipeline (Context→Candidates→Constraints→Scoring→Safety→Rank→Fallback)
  services/context/*   → weather/places/events/map/geospatial  (🧪 mostly mock)
  services/intelligence/* → novelty/diversity/experience-graph/memory (real, Firestore-backed)
  services/memories/*  → timeline/recaps/collections/sharing (real, pure core)
  services/social/*    → SocialService → SocialRepository (🧪 in-memory)
  config/featureFlags  → two-gate rollout (real)

Server (Express)
  /api            (quests, memories, stats)      ← ✖ no auth (§31)
  /api/admin      (metrics, reports)             ← ✖ no auth (§30)
  /api/growth     (share codes)
  /api/intelligence (personalization)            ← ✔ requireIdentity + enforceSelfOnly (model to copy)
  services/ai/*   Gemini → fallback → deterministic (real)
```

---

## 5. Six-tab wiring reality (real vs shell)

| Tab | Screen | Backing | Status |
|---|---|---|---|
| home | `HomeScreen.tsx` | `MOCK_TODAY_QUEST/…`; header text hardcoded `"KATHMANDU VALLEY • SATURDAY"` | 🧪 **SHELL** — no service/engine calls |
| explore | `ExploreScreen.tsx` | `MOCK_CATEGORIES/MOCK_QUICK_ESCAPES`; local filter only | 🧪 **SHELL** |
| map | `MapScreen.tsx` | `memoryRepository`, `ExplorationGridService`, `DiscoveryEngine`, `questEngineService` | ✅ **REAL** (mock only as initial state) |
| memories | `MemoriesScreen.tsx` | `memoryRepository`, `ExperienceStatsService`, `groupMemoriesByPeriod`, `shareExperienceCardService` | ✅ **REAL** |
| friends | `FriendsScreen.tsx` | `SocialService` → `socialRepository` (in-memory) | ✅ real UI over 🧪 mock store |
| profile | `ProfileScreen.tsx` | stats = `MOCK_USER_STATS`; settings sub-screens real | ⚠️ **MIXED** — mock stats panel, real settings |

**Two of six primary tabs (home, explore) are static mock shells** and the profile stat header is mock. This is the biggest gap between "looks finished" and "is wired."

---

## 6. Quest Engine pipeline — ✅ real structure

`quest-engine/QuestEngine.ts` is a real, layered pipeline: `buildContextAsync` → `CandidateGenerator` → `ConstraintEngine.validate` (hard filters) → `PersonalizationScorer.score` → `SafetyEngine` (7-stage) → `rankingStrategy.rank` → `whyThisQuest` synthesis → `FallbackQuestGenerator`. Exported as the `questEngine` singleton and reached from the UI via `questEngineService` (used by `MapScreen.tsx:49`). The architecture is sound and worth preserving.

## 7. Candidate generation — ⚠️ static seed library, grounding overstated

`CandidateGenerator.generateCandidates(_context)` (`candidates/CandidateGenerator.ts:164`) **ignores its `context` argument** (underscore-prefixed) and maps over **10 hardcoded `SEED_QUEST_TEMPLATES`**. The header comment claims "15–30 candidates"; there are 10. Templates are generic ("find a teahouse", "find a bookstore") and Kathmandu-flavored. **This is the safe choice for AI-grounding** (quests never name a specific real place, so none can be fabricated — see §28), but it means "context-aware quests generated from nearby places" is **overstated**: candidate *content* is not derived from context.

## 8. `nearbyPlaces` is dead data — 🐞 minor

`ContextBuilder.ts:94` populates `context.nearbyPlaces` (typed at `quest-engine/types/index.ts:55`), but a repo-wide grep shows **no downstream stage reads it** — not CandidateGenerator, ConstraintEngine, PersonalizationScorer, SafetyEngine, or ranking. The (mock) places fetch therefore has **zero influence** on quest output. Either wire it into constraints/scoring or drop the fetch; today it is wasted work.

## 9. Location / ContextBuilder — 🧪 hardcoded Kathmandu

`ContextBuilder.getLocationContext` hardcodes lat `27.7172`, lng `85.3240`, and stamps `city:'Kathmandu', country:'Nepal'` **even when GPS coordinates are supplied** — there is no reverse geocoding. Nepali seasons and a `minutesUntilSunset` heuristic fill the rest. Real location personalization ⚙️ **REQUIRES EXTERNAL CONFIGURATION** (a geocoding provider).

## 10. Places discovery — 🧪 MOCKED

`placesService.getNearbyPlaces` unconditionally calls `mockPlaces.searchNearbyPlaces` (`services/context/placesService.ts:32`), returning one hardcoded Kathmandu teahouse (`providers/mockProviders.ts:31-46`). It bypasses its own `PlacesProvider` abstraction. `evaluateOpeningHours` is a naive heuristic (open if hour 7–21). No real provider exists. ⚙️ Real places **REQUIRES EXTERNAL CONFIGURATION** (Google Places / Foursquare / Overpass).

## 11. Weather — 🧪 MOCKED

`weatherService.getWeatherContext` calls `mockWeather.getWeatherAtCoordinates` (`weatherService.ts:45`) → hardcoded 22°C/clear/golden-hour. The **sunset/golden-hour astronomy math is real** (`weatherService.ts:85-99`; `lib/ai-quest-engine.ts:27-59`). ⚙️ Real weather **REQUIRES EXTERNAL CONFIGURATION** (OpenWeather/Open-Meteo — Open-Meteo needs no key).

## 12. Events — 🚫 NOT IMPLEMENTED (gated off)

`eventsService.getNearbyEvents` returns `[]` unless `realEvents` is enabled (`eventsService.ts:14-17`); the flag is master-**false**/0%. Even enabled, it returns a single hardcoded event. **This is honestly disabled** — the flag correctly reflects the non-implementation.

## 13. Routing / travel-time — ✅ real math, 🚫 real routing not implemented

Haversine distance (`geospatialUtils.ts:15-28`), walking-time heuristic (distance ÷ 75 m/min, `:37-40`), and feasibility checks are real. There is **no routing API** — straight-line only; `realRouting` flag is honestly false/0%.

## 14. Maps rendering — ✅ REAL

`LifeMap.tsx:29-34` builds a real Leaflet `L.map` with live OpenStreetMap tiles (no key needed), real memory markers, and GPS `flyTo`. `mapService.normalizeMarkers` is real pure logic. This is a genuinely working real-world integration.

## 15. AI quest generation (server) — ✅ REAL, works with no key

`server/services/ai/aiProvider.js:158-199` runs primary → fallback → **deterministic** provider; `deterministicProvider.isAvailable()` is always true and builds quests from verified facts — so the server **never fails for lack of a key** and **never fabricates**. Gemini is used only when `GEMINI_API_KEY` is set (`geminiProvider.js:43-45`). ⚙️ Gemini prose **REQUIRES EXTERNAL CONFIGURATION**; deterministic output is ✅.

## 16. AI narrative / recaps — ✅ orchestration real, ⚙️ prose requires Gemini

Recap **statistics are computed on-device with no LLM** (`recapGenerationService.ts:71-107`). Narrative prose is opt-in, gated by `aiMemoryStories` (5%), fetched via `intelligenceClient`, and **double-grounded** (server `hallucinationGuard` + client `assertNarrativeGrounded`). Without Gemini it degrades to stats-only (`narrativeAvailable:false`). This is a model of honest AI grounding.

## 17. Feature-flag system — ✅ REAL and well-designed

`config/featureFlags.ts`: two gates (master toggle + stable FNV-1a rollout bucket on `key:userId`), fail-closed for percentage-gated flags with no `userId`, local QA overrides that cannot switch on an unbuilt feature. No network call; safe during render. Phase 11/12 flags **are** consulted at call sites (per Phase 12 report). This subsystem is production-grade.

## 18. 🐞 The `realPlaces`/`realWeather`/`realLocation` flags are decorative

These three master toggles are `true` at 100% rollout, but a grep for `isFeatureEnabled('realPlaces'|'realWeather'|'realLocation')` finds **zero call sites**. Flipping them changes nothing; the services use mock/hardcoded data regardless. This is the most misleading signal in the repo — a reader sees "real location/places/weather: ON, 100%" and concludes real-world data is live. It is not. (Contrast §12/§13, where `realEvents`/`realRouting` *are* consulted and honestly false.)

## 19. Firebase Auth — ✅ real SDK / ⚙️ requires config; Apple 🚫 not real

Real `firebase/auth` for anonymous/email/Google (`firebaseAuth.ts:132-224`), with a localStorage **simulation** fallback intended for the no-credentials case. **Apple Sign-In is a stub** — `signInWithApple` (`:227-230`) just calls `signInWithGoogle()`; there is no `OAuthProvider('apple.com')`, and it is not even exposed in `AuthContext`. **Note:** the simulation fallback is currently *unreachable* in the default config — see §20.

## 20. 🐞 KNOWN BUG (headline): Firebase double-initialization

**This is the most important finding in the audit.** There are two Firebase initializers:

- `src/lib/firebase.ts` — `initFirebase()` calls `initializeApp({apiKey:'YOUR_API_KEY', projectId:'YOUR_PROJECT_ID', …})` from a **hardcoded placeholder** config (`:15-38`). Called first, at `main.tsx:8`.
- `src/services/firebase/firebaseConfig.ts` — `getFirebaseApp()` is the canonical accessor every service uses. At `:18-22` it returns `getApps()[0]` **if any app already exists**, and only *otherwise* (`:24`) checks whether real env credentials were supplied.

**Sequence at runtime:**
1. `main.tsx:8` runs `initFirebase()`, which registers a Firebase app from the placeholder config. `initializeApp` does not validate the key, so it does **not** throw; `getApps().length` becomes 1.
2. The first service call to `getFirebaseApp()` returns that **placeholder app** via `getApps()[0]` and never reaches the env-credential check.
3. `getDb()` (`firestore.ts:32-36`) and `getAuthInstance()` (`firebaseAuth.ts:75-79`) return `null` **only when `getFirebaseApp()` is null**. It is now non-null → they return real Firestore/Auth bound to project `YOUR_PROJECT_ID`.

**Consequences (deduced from code paths):**
- **Real credentials are silently ignored.** Even with a correct `VITE_FIREBASE_*` config, the placeholder app wins → Firebase never actually works in production.
- **The intended fallback is bypassed in the default config.** Because `db`/`auth` are non-null, the `if (!db)`/`if (!auth)` localStorage & simulation branches (e.g. `firebaseAuth.ts:117-130`, `firestore.ts:41-44`) are **unreachable**. Instead:
  - `signInAsGuest`/`signUpWithEmail` hit the real SDK (`:132`,`:159`) and **reject with an invalid-key `AuthError`** (`:137`) — the user cannot enter as guest or sign up in the shipped config.
  - Firestore **reads** catch the failure and `return null` (`getUserProfile:49-51`) rather than reading localStorage → locally-saved data reads back empty.
  - Some Firestore **writes** only `logger.error` on failure (`saveUserPreferences:100`, `saveQuestSession:121`) → silently lost.

**Corrected degradation verdict:** the app does **not** "run local-first" in its default state (as one sub-audit assumed) — it attempts real Firebase against a fake project and fails. **Fix is small and high-value** (see §40): make `getFirebaseApp()` authoritative (validate the key before honoring `getApps()[0]`, or remove/neuter `lib/firebase.ts`'s placeholder `initFirebase`), which restores *both* the real-credential path and the clean localStorage fallback.

## 21. Firestore reads/writes — ✅ SDK real / ⚙️ requires config

`FirestoreService` (`services/firebase/firestore.ts`) has real queries for the configured case and a localStorage mirror for the null-db case. The abstraction is clean **but is currently short-circuited by §20**. Once §20 is fixed, this is a correct real/fallback data layer. Users are correctly isolated by Firestore rules (§33/§36).

## 22. Storage / media upload — ✅ real / ⚙️ requires config

`mediaStorageService.ts:84-190` implements real resumable upload with retry/backoff; with no Firebase app it keeps an inline `dataUrl` and marks `status:'uploaded'` (`:77-82`). Also gated behind §20.

## 23. Push / notifications — local ✅ (native only) / FCM 🚫 not implemented

Capacitor `LocalNotifications.schedule` is real (`lib/native-device.ts:110-159`) but native-platform only (no-op on web). **FCM push is a stub:** `firebaseMessaging.requestNotificationPermissions` returns `null` (`:9-12`); `notificationManager` uses a `MockFCMProvider` that only logs and seeds a fake device token. No real push send exists. There are also **two competing daily-quest notification paths** (server-simulated budget vs Capacitor local) — see §38.

## 24. MongoDB backend — ⚙️ requires config; partial fallback; 🐞 500 gap

Server starts even if Mongo is unreachable (`server.js:43-57`). `/quests` and admin routes degrade to local JSON / fallback. **But `/memories`, `/memories/sync`, `/stats` have no `readyState` guard** (`api.js:173,199,213`) → **HTTP 500 when Mongo is down** (the client tolerates it via try/catch, but the endpoint is not graceful). Admin metrics are largely **hardcoded constants** (`admin.js:60-92`), not real telemetry.

## 25. Social / group quests / chat — 🧪 MOCKED, no realtime, chat 🚫 not implemented

`SocialService`/`groupQuestSessionService` delegate to `SocialRepository`, which is **pure in-memory `Map`s + `MOCK_USERS_DB`** (`repositories/SocialRepository.ts:12-54`): it seeds a fake friendship, **invents users on handle search** (`:162-172`), and `saveSharedExperience` only logs (`:264-266`). **No `onSnapshot`/WebSocket/socket.io anywhere** → not realtime, and **state is lost on reload** (not even localStorage-backed). **No chat service or feature exists at all.** The real rate-limiter (`socialService` → `rateLimiter`) sits in front of this mock store.

## 26. Moderation / reports / blocks — ⚠️ split & disconnected

Server has a real `Report` Mongoose model and admin GET/POST `/reports` (Mongo-guarded). Client `reportUser`/`blockUser` write to **in-memory arrays only** (`SocialRepository.ts:187,211`) and are **never wired to the server route**. The user-facing safety flow is therefore local-only and non-persistent — and the server side that *would* persist it is itself unauthenticated (§30).

## 27. Data-model & userId consistency

- **Client → intelligence server:** correct. `x-user-id` header + `enforceSelfOnly` (body.userId must equal authenticated id).
- **Client → `/api` (Mongo):** **inconsistent/unsafe** — `userId` is passed in query string / body and trusted verbatim (§31).
- **Firestore:** user data is keyed `users/{uid}/…` and rules enforce `isOwner()` (§33/§36) — consistent and safe for the live collections.
- **`AuthUser.uid` vs `UserProfile.id`:** used interchangeably as the Firestore key (`setDoc(users/{profile.id})`). Confirm these are always the same value across guest→email linking, or profile writes can land under the wrong document id after account linking. (Worth a targeted test; not confirmed broken.)

## 28. AI grounding verdict — ✅ PASS (AI is never the source of truth)

The directive's core rule ("AI must never invent places/weather/events/prices") is **upheld**:
- Quest candidates are a fixed template library with **no place names** — the model cannot fabricate a venue (§7).
- Recap statistics are computed on-device; narrative prose is double-grounded and rejected if it cites unsupported numbers (§16).
- The deterministic server provider builds from verified facts and returns `story:null` rather than inventing (§15).
The *caveat* is the inverse: because real places/weather aren't wired (§10/§11), quests are grounded in **nothing external** rather than in fabricated externals. Safe, but not yet "real-world."

## 29. 🔴 CRITICAL C1 — Live DB credential in-repo, no `.gitignore`

`server/.env:6` contains a **real-looking MongoDB Atlas SRV URI** with embedded username + 16-char password (host `extrovela.*.mongodb.net`). There is **no root `.gitignore`** (only `android/`, `ios/` have one). No git repo exists yet, so nothing is pushed — but the first `git init && git add .`, or any deploy tarball, commits the live password verbatim. **Action:** add `.gitignore` (excluding `.env`, `node_modules`, `dist`, `.tmp`) **before** any `git init`; **rotate** the Atlas password; move real secrets out of the repo tree. This is the most urgent item.

## 30. 🔴 CRITICAL C2 — Admin API is completely unauthenticated

`server/routes/admin.js` mounts with **no auth on any route**. `GET /api/admin/reports` returns **every moderation report** (`reporterId`, `reportedUserId`, harassment `details`); `POST /api/admin/reports` lets anyone inject reports; `GET /api/admin/metrics` is open. `ADMIN_SECRET_KEY` is referenced only in `.env.example` and docs — **never read in code** — yet the docs claim it protects these endpoints, and `server.js:37` advertises the path. Firestore rules deliberately lock `reports` to "backend only," making this open backend the sole (broken) gate. **Action:** enforce an admin auth middleware (verify `ADMIN_SECRET_KEY` / signed token) on all `/api/admin/*` routes.

## 31. 🔴 CRITICAL C3 — Mongo memory/stats API: IDOR + unauth writes

`server/routes/api.js` has no identity check: `GET /api/memories?userId=…` (`:166`) and `GET /api/stats?userId=…` (`:210`) return **any** user's data (including private `reflectionText`) for a caller-supplied id; `POST /api/memories` and `/memories/sync` do `new Memory(req.body)` with no auth, no ownership binding, no validation, at a 15 MB body limit. **Action:** put `requireIdentity` + `enforceSelfOnly` on these routes exactly as `intelligence.js` already does — the correct pattern already exists in the repo (§36).

## 32. 🟠 HIGH H1 — Firestore: any authed user can overwrite any group-quest session

`firestore.rules:503-508`: `allow update: if isAuthenticated()` with no `unchanged()`/participant/creator guard on `groupQuestSessions` (holds `creatorId`, `state`, `participants[].role/status`). An attacker can flip `state:'completed'`, rewrite participants, or inflate capacity. **PLAUSIBLE-live / latent:** the collection isn't written by the current (mock) client, so it is exploitable only once social is Firestore-backed — but **the deployed rule is already unsafe**. Fix before wiring social.

## 33. 🟠 HIGH H2 — User profile world-readable to any signed-in user (LIVE)

`firestore.rules:94` `/users/{userId}`: `allow read: if isAuthenticated()`. The document is the **full `UserProfile`** — `email`, `city`, `displayName`, plus the entire `preferences` psychographic profile — written whole via `setDoc(users/{id}, profile)`. Any registered user can enumerate `/users/{uid}` and harvest every user's email + home city + preference profile. This collection **is live**. **Action:** split public handle/display fields into a `users/{uid}/public` doc (or a `handles` collection) and restrict the main profile to `isOwner()`.

## 34. 🟡 MEDIUM findings

- **M1 — `questInvites` readable by any authed user** (`rules:496-501`), leaking `inviteToken` → invite hijacking. (Latent; mock-backed.)
- **M2 — `sharedExperiences` create unbound** (`rules:510-514`): no check that `creatorId == auth.uid` or creator ∈ participants → forged shared experiences. (Latent.)
- **M3 — `friendships` create/update too weak** (`rules:483-494`): can fabricate friendships between *other* users; update mutates any field (no `unchanged()`). (Latent.)
- **M4 — Dead validator + unauth AI endpoint:** `validateQuestPayload` (`middleware/validator.js`) is never wired; `POST /api/quests/generate-ai` has no identity check (only global per-IP cost middleware) and interpolates unvalidated input into a Gemini prompt → cost-abuse + prompt-injection surface.
- **M5 — Wide-open CORS** (`server.js:18` `app.use(cors())` → `*`), amplifying C2/C3/M4 into browser-drivable attacks.
- **M6 — Logger over-claims PII stripping:** `utils/logger.ts` redacts by key-name substring only — catches `coordinates` but **not** `lat`/`lng`/`latitude`/`longitude`/`geo`/`location`; never sanitizes the `message` string; `info`/`warn`/`error` run in production. The "strips raw coordinates in production" claim is overstated.

## 35. 🟢 LOW findings

- **L1 — Public share-card path embeds UID:** `storage.rules:117-121` `shareCards/{userId}/{token}/…` with `allow read: if true` leaks the owner UID in the public OG-image URL — contradicting the deliberate UID-denylist elsewhere.
- **L2 — Rate limiter keyed on spoofable header** (`rateLimiter.js:18` uses `x-user-id` before `req.ip`); mainly bites in dev/`TRUST_CLIENT_USER_ID`.
- **L3 — Weak growth share codes** (`growth.js:9` `Math.random().toString(36)` 5-char) — low sensitivity.
- **L4 — `VITE_GEMINI_API_KEY` footgun** in root `.env` (placeholder today, nothing reads it, `dist/` scan clean) — but its existence invites bundling a real key. Remove it.

## 36. What's already done well (to avoid over-reporting)

- **Firestore deny-by-default** + `isOwner()` on all `users/{uid}/**`: **user A cannot read user B's memories/reflections/intelligence** — verified. Append-only `experienceEvents` (`update:if false`), frozen `userId`/`source`/`systemGenerated`, monotonic `profileVersion`, `reflectionInsights` field-denylist barring raw text.
- **`shareLinks`** public reads scoped by high-entropy token with an internal-identifier write-denylist + expiry/revocation. `reports` locked to backend-only.
- **Storage** deny-by-default, owner-scoped, content-type allow-list that **excludes `image/svg+xml`** (anti stored-XSS), size caps.
- **No client XSS sinks** — zero `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write`/`javascript:` in `src/**`.
- **`intelligence.js` is the model backend:** `requireIdentity` + `enforceSelfOnly`, per-user cache keys, input re-bounding, coordinate stripping before prompts, **fails closed (501) in production** without `firebase-admin`. Copy this onto `/api` and `/api/admin`.
- **Bundle secret hygiene:** `dist/` scan clean; client uses only public Firebase config; `costProtectionMiddleware` is genuinely wired globally.

## 37. Performance / caching / scalability (100k–1M)

- **Bundle:** single main chunk **~1.36 MB (357 KB gzip)**, no code-splitting. `vite build` also warns of **dynamic/static import conflicts** in `services/intelligence/*` (ContextBuilder, intelligenceFirestore, experienceEventService are both dynamically and statically imported → dynamic import can't split). Fix: consistent import strategy + `manualChunks` / route-level `React.lazy`.
- **Caching:** no canonical cache layer — three offline-queue implementations (`lib/api.ts`, `questSyncService`, orphaned `offline/offlineQueue.ts`) and per-domain caches (weather 5 min, places 1 hr, geospatial LRU). `firestore.ts` and `MemoryRepository` independently mirror to localStorage.
- **Scale:** the pure core is proven on 10k-item sets (Phase 12 L1/L2). Server admin metrics are constants, so there's no real observability at scale yet. Firestore fan-out reads on the world-readable `users` collection (§33) would also be a cost/scale risk once social is live.

## 38. Duplicate / orphaned modules (do not rebuild — consolidate)

- **🐞 Firebase init conflict** (§20): `lib/firebase.ts` vs canonical `firebaseConfig.ts`.
- **Two client quest generators:** canonical `quest-engine/QuestEngine` (mounted) vs `lib/ai-quest-engine.ts` (imported only by `AppStateContext` → consumed only by the **never-rendered** `QuestGenerator`). Dead in the mounted app.
- **Analytics duplication:** `lib/firebase.ts` `ExtravelaEvents`/`logEvent` (0 importers) vs canonical `firebaseAnalytics.analytics`.
- **Orphaned modules:** `lib/firebase-native.ts`; repositories `userRepository`/`questRepository`/`explorationRepository`/`notificationRepository`; context `locationService`/`eventsService`/`mapService`/`mapViewportService`; `offline/offlineQueue.ts`; legacy UI cluster (`QuestGenerator`, `ProfileView`, `RecapsView`, `CoQuestModal`, `LifeMap`, `CalendarJournal`, `OnboardingModal`) re-exported via barrels but never rendered.
- **Two daily-notification paths** (§23).
- **`mockData.ts` is NOT orphaned** — heavily imported by all five screens + three repositories.

**Guidance:** these are consolidation/deletion candidates, not rebuilds. Wire new UI to `questEngineService`, not `ai-quest-engine`.

## 39. Graceful degradation — corrected verdict

- **Server (Gemini absent):** ✅ deterministic provider always available; recaps go stats-only. Correct.
- **Server (Mongo absent):** ⚠️ mostly graceful, but `/memories`/`/stats` return 500 (§24).
- **Client (Firebase absent — default config):** 🐞 **NOT graceful** — due to §20 the localStorage/simulation fallback is bypassed; guest/email sign-in throws and persistence fails. This is the corrected finding versus the initial "degrades cleanly" reading, and it is **the single highest-value fix.**
- **Maps:** ✅ always render via keyless OSM.

## 40. Stop condition + prioritized remediation plan

**Stop condition honored:** no Phase 15 work (payments, subscriptions, ads, marketplace, referral rewards, creator economy) was started. This audit is read-only; no application code was changed.

**Proposed hardening scope — all achievable without external API keys, none a rebuild:**

*Tier 1 — correctness & secret safety (do first):*
1. **§29** Add root `.gitignore` (exclude `.env`, `node_modules`, `dist`, `.tmp`, `android/app/build`, etc.) **before** any `git init`; flag the live Atlas credential for rotation. *(Config only.)*
2. **§20** Fix the Firebase double-init: make `getFirebaseApp()` authoritative (validate `config.firebase.apiKey` before honoring `getApps()[0]`) and stop `lib/firebase.ts` from registering a placeholder app. Restores real-credential path **and** clean localStorage fallback. *(~1 file, plus removing a dead init.)*

*Tier 2 — server security (copy the existing `intelligence.js` pattern):*
3. **§31** `requireIdentity` + `enforceSelfOnly` on `/api/memories`, `/api/memories/sync`, `/api/stats`.
4. **§30** Admin auth middleware on all `/api/admin/*`.
5. **§34 M5** Restrict CORS to known origins. **§34 M4** Wire `validateQuestPayload` / add identity to `/quests/generate-ai`.

*Tier 3 — Firestore rules hardening (before social goes live):*
6. **§33 H2** Split public profile fields; restrict `users/{uid}` reads to owner.
7. **§32 H1, §34 M1–M3** Add participant/creator + `unchanged()` guards to `groupQuestSessions`, `questInvites`, `sharedExperiences`, `friendships`.

*Tier 4 — truthfulness & polish:*
8. **§18** Either consult `realPlaces`/`realWeather`/`realLocation` at the service layer or set them to reflect reality (mock). **§8** Use or drop `nearbyPlaces`.
9. **§36/M6** Tighten `logger` coordinate redaction; gate `info` in prod. **§37** Code-split the 1.36 MB bundle; resolve the intelligence import conflicts.
10. **§19** Implement or clearly disable Apple Sign-In. **§24** Add `readyState` guards to `/memories`/`/stats`.

**Explicitly out of scope (not started):** wiring real Places/Weather/Events/Routing providers, standing up FCM push, building the `/s/:token` unfurl page, server-side account purge (`firebase-admin`), and making home/explore/profile-stats live — these are feature work requiring product decisions and/or external credentials, not part of a hardening pass.

---

## 41. REMEDIATION APPLIED — Tiers 1–4 (2026-08-24)

Scope executed: **All (Tiers 1–4)**, as selected by the user. No rebuilds, no working systems replaced, no new features, no external API keys required. Stop condition honored — **no Phase 15 work** (payments/subscriptions/ads/marketplace/referral/creator economy) was started.

### Verification gates — all green
| Gate | Command | Result |
|---|---|---|
| Typecheck / lint | `tsc -p tsconfig.json --noEmit` | **EXIT 0** |
| Phase test suites | `phase7/9/10/11/12` via `esbuild --bundle --platform=node --format=cjs` → `node` under `NODE_ENV=test` | **all pass, exit 0** (phase12: 29/29) |
| Production build | `vite build` | **EXIT 0** (benign pre-existing warnings — see §41.5) |
| Server parse | `node --check` on `server.js`, `routes/api.js`, `middleware/requireAdmin.js` | **all OK** |

### 41.1 Tier 1 — correctness & secret safety
- **§29 secret safety:** root `.gitignore` already present and comprehensive (excludes `.env`, `server/.env`, `node_modules`, `dist`, native build output). Added `server/.gitignore` as defense-in-depth. **The live Atlas credential in `server/.env` was left untouched and must still be rotated by the user** (it predates this pass). `.env` files were never committed — repo is not yet under git.
- **§20 Firebase double-init (was the highest-value fix — KNOWN BUG, now fixed):** `getFirebaseApp()` is now authoritative — it validates `config.firebase.apiKey` **before** honoring `getApps()[0]`, so a placeholder app can never be returned. `lib/firebase.ts` reduced to a legacy compatibility shim that delegates to `getFirebaseApp()` and no longer registers a placeholder app. `main.tsx` no longer calls the old `initFirebase()`; it initializes the typed analytics layer instead. **Result:** real-credential path works *and* the localStorage/simulation fallback is no longer bypassed — guest/email sign-in and persistence degrade cleanly when Firebase is absent.

### 41.2 Tier 2 — server security
- **§31 IDOR closed:** `/api/memories` (GET/POST), `/api/memories/sync`, `/api/stats` now run `requireIdentity`; `userId` is derived from `req.auth.userId` (server-verified), **never** from `req.query`. Writes force `userId: req.auth.userId`. A `mongoose.connection.readyState !== 1` guard returns **503 `DB_UNAVAILABLE`** (not a 200-empty body), so the client falls back to local rather than overwriting local memories with an empty array (corrects §24).
- **§30 admin auth:** new `server/middleware/requireAdmin.js` guards all `/api/admin/*` with a constant-time (`crypto.timingSafeEqual`) `x-admin-key` check against `ADMIN_SECRET_KEY`. Fail-closed: prod + unset → **503 `ADMIN_AUTH_NOT_CONFIGURED`**; dev + unset → allow with warning; key set + mismatch → **401 `ADMIN_UNAUTHORIZED`**.
- **§34 M5 CORS:** open `cors()` replaced with an allowlist (localhost dev origins + `capacitor://localhost`, `ionic://localhost`; extendable via `ALLOWED_ORIGINS`). No-Origin requests (native/curl) still allowed.
- **§34 M4 generate-ai:** did **not** add `requireIdentity` (would 501 in prod and disable AI) and did **not** wire `validateQuestPayload` (its enum lists don't match the client TS enums → false-reject risk). Instead added an AI rate limiter (20 req/min) and `clampPromptField()` bounding every prompt field (strips newlines, trims, length-caps). AI grounding is unchanged: output stays schema-constrained.

  ⚠️ **REQUIRES EXTERNAL CONFIGURATION (behavior note, not data loss):** the client (`src/lib/api.ts`) sends `userId` as a **query param**, not a verified Bearer token, so the now-identity-gated Mongo memory/stats endpoints operate as a **secured no-op for the current client** until `firebase-admin` + client Bearer-token wiring are added. Because all client REST calls are best-effort with Firestore/localStorage fallback, this causes **no data loss and no user-visible regression** — and the IDOR is closed.

### 41.3 Tier 3 — Firestore rules hardening
- **§33 H2:** `users/{userId}` reads restricted from any authenticated user to **owner-only**; added a `users/{uid}/public/{doc}` subcollection (owner-write, authenticated-read) for future non-sensitive display fields.
- **§32 H1 / §34 M1–M3:** added participant/creator authorization + `unchanged()` immutability guards to `groupQuestSessions` (read/update limited to creator or existing participant), `questInvites`, `sharedExperiences` (create requires caller ∈ participantIds), and `friendships`. Self-join to a group session is intentionally left server-mediated (documented in-rule). Safe because these social collections are not yet live-written (still MOCKED client-side).

### 41.4 Tier 4 — truthfulness & polish
- **§18 feature flags (MOCKED, now labeled honestly):** `realLocation` / `realPlaces` / `realWeather` set to **`false`** with a comment stating no external provider is wired. These three flags have **no read sites** (inert switches); only `realEvents` is read (`eventsService.ts`) and stays off. Comment explicitly notes device geolocation (Capacitor) and the Leaflet/OSM map are **not** gated by these flags.
- **§36 logger (privacy):** replaced the coordinate substring list with `SENSITIVE_EXACT` (exact match for short keys `lat`/`lng`/`lon`/`location`/`geo`/`coords`) + `SENSITIVE_SUBSTRINGS` (long tokens incl. `reflection`), avoiding false-redaction of `latency`/`related`/`template`. `info()` is now a **no-op in production**; `warn`/`error` always emit with redaction intact.
- **§37 bundle:** `manualChunks` splits vendor code — `vendor-firebase` (650 kB / 147 kB gz), `vendor-react` (164 kB), `vendor` (197 kB), app `index` (356 kB). No chunk-size warning fires (`chunkSizeWarningLimit: 900`). The `vendor-maps` (leaflet) rule is present but **currently inert** — see §41.5.
- **§19 Apple Sign-In (was a silent-wrong-provider KNOWN BUG → now NOT IMPLEMENTED, explicit):** `signInWithApple()` previously aliased `signInWithGoogle()` (would sign users in with the wrong provider). It now `throw`s `AuthError('…not available yet', 'APPLE_AUTH_NOT_IMPLEMENTED')`. **REQUIRES EXTERNAL CONFIGURATION** to enable (Apple OAuth provider / `@capacitor-firebase/authentication`); not exposed in the UI.
- **§8 nearbyPlaces (MOCKED):** added truthfulness comments at `ContextBuilder.ts` and `quest-engine/types/index.ts` — the field is collected but **not consumed by scoring** and is **mock data**; must never be surfaced as real place claims in quest text (AI-grounding guard).

### 41.5 Known residual items (honest labels)
- **KNOWN BUG / dead code — the Leaflet map is not wired in.** `leaflet` is imported only by `src/components/LifeMap.tsx`, which is exported by `src/features/map/index.ts` but **imported by nothing reachable** — it tree-shakes out of the build entirely (no `leaflet` in any chunk, no `vendor-maps` emitted). The visible "map" (`MapScreen`, wired into `App.tsx`) is a **custom icon-based discovery grid, not an interactive Leaflet/OSM map**. Any claim that "the Leaflet map experience is live" is **false today**. The `vendor-maps` chunk rule is a correct reserved switch that activates only if `LifeMap` is ever wired in.
- **Benign build warnings (NOT fixed by design — "do not replace working systems").** Three Rollup `(!) …dynamic import will not move module into another chunk` warnings for `ContextBuilder.ts`, `intelligenceFirestore.ts`, `experienceEventService.ts`. These are **pre-existing** and unrelated to `manualChunks` (which returns `undefined` for all app-code paths). The dynamic `import()`s at `experienceIntelligenceService.ts:446` & `:623` are deliberate mid-function lazy loads in a heavily-imported aggregator; converting them to static to silence the warnings risks an init-order regression. Build exits 0; impact is purely that those modules stay in the main graph rather than splitting into lazy chunks.
- **Still MOCKED / NOT IMPLEMENTED (unchanged, out of hardening scope):** real Places/Weather/Events/Routing providers, FCM push, `/s/:token` share-unfurl page, server-side account purge (`firebase-admin`), and live home/explore/profile-stats. **REQUIRES EXTERNAL CONFIGURATION** and product decisions — deliberately not started.

### 41.6 Left for the user
- **Rotate the MongoDB Atlas password** (the live credential in `server/.env` was never touched by this pass).
- **Run `git init`** when ready — `.gitignore` is in place to keep secrets out of history.
- To make the secured Mongo memory/stats endpoints usable by the app, wire **`firebase-admin` verification server-side + a client Bearer token**; until then Firestore/localStorage remains the persistence path (no data loss).
