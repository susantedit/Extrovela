# EXTROVELA — ARCHITECTURAL MEMORY & COST AUDIT

## Project Overview
EXTROVELA is an intentional, privacy-first, real-world exploration and quest discovery platform designed to help people disconnect from screens and experience physical surroundings.

---

# PHASE 14 — SOCIAL EXPERIENCES + SHARED QUESTS + REALTIME PERSISTENCE (SECURE CORE)

### Status: ✅ IMPLEMENTED + TESTED (Rule Logic TEST VERIFIED)
- **Live Firestore Reads/Writes & Deployed Rules:** 🟡 REQUIRES EXTERNAL CONFIGURATION (no real Firebase project/emulator in sandbox)
- **Rule Authorization & Security Boundary:** ✅ TEST VERIFIED via pure `SocialAuthRulesEngine` mirror & 27 unit/adversarial tests.

---

### Key Architectural Decisions (Locked)

1. **Authorization = RULES-ENFORCED:**
   - Client writes directly to Firestore via Firebase Web SDK.
   - Google-verified `request.auth.uid` is the sole identity boundary.
   - **No `firebase-admin` server routes introduced.** Security Rules independently verify ownership, participant memberships, and block relationships.
   - Deterministic doc IDs (`userA__userB`, `blockerId__blockedId`, `inviteToken`) are load-bearing to enable synchronous `exists()` checks in rules.

2. **Scope = SECURE CORE ONLY:**
   - **Implemented:** Friends, friend requests, directional & bidirectional safety blocking (with blocking taking absolute precedence), quest invites with CSPRNG tokens, shared quests with co-completion records (`SharedExperience`), small groups with `OWNER` / `ADMIN` / `MEMBER` roles, default-private privacy controls, derived social notifications projected into the existing Phase 10 inbox, bounded Firestore realtime subscriptions (`onSnapshot`), hardened Security Rules, composite indexes, production-blocked social mocks, pure rule-logic test mirror.
   - **Deferred:** Public quest discovery feed, admin report-review UI, cross-device server push notifications (requires server/Cloud Functions), server-side rate limiting, handle reconciliation background jobs.

3. **No Cross-User Notification Writes:**
   - `users/{uid}/notifications` remains strictly owner-only.
   - Social notifications (`friendInvite`, `groupQuest`, `sharedExperience`) are derived/projected client-side from authorized social state the user can already read.
   - Prevents unauthorized notification injection across accounts.

4. **Crypto Token Security:**
   - Invite tokens generated using `generateSecureToken(24)` from `src/services/security/tokenGenerator.ts`.
   - Produces 28-character base62 URL-safe tokens with ~143 bits of entropy (`inv_` + 24 base62 chars), exceeding the 22-character rule floor.
   - Zero use of `Math.random()`.

5. **Bounded Realtime Sync:**
   - Pure Firestore `onSnapshot` with explicit `limit()` clauses (`limit(200)` for friends, `limit(100)` for requests, `limit(12)` for group members).
   - Every subscription returns a detachable `Unsubscribe` function.
   - No-op in local-first/test environments to prevent unhandled background errors.

6. **Production-Blocked Mocks:**
   - Dev-only escape hatch `VITE_USE_MOCK_SOCIAL` is hard-blocked in production builds via `config.isProduction`.
   - When no backend is configured in production, the social layer fails clean with explicit errors rather than faking data.

---

### Local vs. Live Verification Ceiling & Emulator Commands

- **Local Verification:** All 27 Phase 14 tests in `src/__tests__/phase14.test.ts` passed, alongside full regression suites (Phases 7, 9, 10, 11, 12, 13).
- **Live Verification Setup (When Deploying):**
  1. Start local Firestore emulator:
     ```bash
     firebase emulators:start --only firestore
     ```
  2. Deploy hardened rules & composite indexes:
     ```bash
     firebase deploy --only firestore:rules,firestore:indexes
     ```

---

# COST / FREE-INFRASTRUCTURE AUDIT

EXTROVELA is architected around a strict **FREE-FIRST / OPEN-SOURCE / NO-BILLING-FIRST** model. The core experience must never break due to paywalls, credit card requirements, or expired trials.

| Service / Dependency | Purpose | Cost Model | Classification | Required? | Free / Self-Hostable Alternative |
|---|---|---|---|---|---|
| **Cloud Firestore** (Firebase) | Social persistence, quest attempts, user memories & bounded realtime (`onSnapshot`) | Free Spark Tier (50K reads/day, 20K writes/day, 20K deletes/day, 1 GiB storage) | **FREE TIER** | Yes (Cloud persistence) | Local-First in-memory / IndexedDB / Self-hosted Supabase/PostgreSQL |
| **Firebase Authentication** | Identity & verified UID for Security Rules | Free Spark Tier (unlimited email/password, anonymous/guest auth) | **FREE FOREVER** | Yes (Auth boundary) | Self-hosted Supabase Auth / Keycloak |
| **Firebase Cloud Messaging** | Device push notifications | Free, unlimited push | **FREE FOREVER** | Optional (In-app inbox works standalone) | Web Push API / local device notifications (Capacitor) |
| **Open-Meteo API** | Real-world weather conditions, golden hour & sunset calculation | Keyless, free open-data API for non-commercial & small/medium usage | **OPEN SOURCE / FREE FOREVER** | Yes (Phase 13 context) | Self-hostable Open-Meteo Docker instance |
| **OpenStreetMap Ecosystem (Overpass & Nominatim)** | Real-world places of interest, discovery points & geocoding | Open Data Commons (ODbL), keyless access | **OPEN SOURCE / FREE FOREVER** | Yes (Phase 13 places) | Self-hosted Overpass API / Planet OSM server |
| **OSRM (Open Source Routing Machine)** | Walking distance and route calculation | Open source routing engine | **OPEN SOURCE / FREE FOREVER** | Optional (Route ranking) | Self-hosted OSRM container |
| **Leaflet Map Tiles** | Map rendering & visual discovery | Open source JavaScript library with OSM-compatible tile servers | **OPEN SOURCE / FREE FOREVER** | Yes (Map view) | Self-hosted tile server (MapLibre / TileServer GL) |
| **Web Crypto API (Local)** | Cryptographically secure token generation for share links & quest invites | Local in-engine CSPRNG (`crypto.getRandomValues`) | **FREE FOREVER** | Yes (Capability tokens) | In-repo native crypto |
| **Capacitor Device Plugins** | Native camera, geolocation, haptics, local notifications, preferences | MIT Open Source client library | **OPEN SOURCE** | Yes (Mobile shell) | Browser native APIs |
| **Gemini AI API** | Optional contextual quest generation & creative synthesis | Free tier available; keyless deterministic fallback always active | **FREE TIER (OPTIONAL)** | No (Core app operates without AI) | Deterministic template quest engine (`localQuestData`) |
| **Firebase Cloud Storage** | Optional user photo storage for memory reflections | Spark free tier (5 GB historically; newer projects may require billing configuration) | **REQUIRES CONFIGURATION / VERIFY** | No (Local canvas/base64 & avatar initials fallback) | Client-side compressed offline storage / Self-hosted MinIO |

### Cost Protection Levers Built into Architecture:
1. **Zero Paid SaaS Dependencies:** No Stream, Sendbird, Pusher, Ably, PubNub, Algolia, Stripe, or paid map SDKs.
2. **Deterministic Queries & Indexes:** All queries are equality-filtered or indexed, preventing full-collection scans.
3. **Derived Notifications:** Eliminates extra cross-user document write operations and storage churn.
4. **Token as Doc ID:** `questInvites/{token}` uses direct `getDoc()` lookups without expensive querying or listing.
5. **In-Memory & Local-First Resilience:** App runs fully functional in local-first mode when network or cloud backend is disconnected.
