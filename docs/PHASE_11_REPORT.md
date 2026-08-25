# EXTROVELA — Phase 11 Final Report

**Advanced AI Experience Engine · Long-Term User Memory · Adaptive Personality Model · Experience Graph · Contextual Quest Generation · AI Memory Recall · Personal Experience Patterns**

This report is a truthful ledger of what Phase 11 actually ships. Where a
capability is a real, running implementation it says so and points at the file.
Where a capability requires operator configuration before it does anything in
production, it is marked **REQUIRES EXTERNAL CONFIGURATION**. Where a wire is
present on one side only, it is marked **NOT YET WIRED**. Nothing here is
described as working on the strength of a UI shell alone.

Legend:
`✅ IMPLEMENTED` — code exists, is reachable, and does what the item says.
`⚙️ REQUIRES EXTERNAL CONFIGURATION` — code path is complete and fails safe, but stays inert until a dependency/credential is supplied.
`🔌 NOT YET WIRED` — implemented on one side; the calling side deliberately not connected in this phase.

---

## A. Signal ingestion & the learning model

**1. `ExperienceIntelligenceService` pipeline** — ✅ IMPLEMENTED.
`src/services/intelligence/experienceIntelligenceService.ts` is the single
façade the app calls (`recordQuestAccepted`, `recordQuestStarted`,
`recordQuestCompleted`, `recordMemorySaved`, `recordMemoryDeleted`, rejection
bridge). It records an event → normalizes to observations → folds into signals →
schedules profile work, never blocking the UI.

**2. `ExperienceEvent` — 15 event types** — ✅ IMPLEMENTED.
`src/types/experienceIntelligence.ts:1` defines the union of 15 types
(`questViewed`, `questAccepted`, `questStarted`, `questCompleted`,
`questRejected`, `questSkipped`, `questRated`, `questSaved`,
`friendQuestCompleted`, `discoverySelected`, `discoveryIgnored`,
`memoryCreated`, `memoryEdited`, `memoryDeleted`, `placeDiscovered`). Required
`createdAt`, `dedupeKey`, `schemaVersion`.

**3. `PreferenceSignal` — 13 dimensions** — ✅ IMPLEMENTED.
`PREFERENCE_DIMENSIONS` (`experienceIntelligence.ts:124`) enumerates exactly 13:
experienceType, category, socialMode, environment, duration, budget, timeOfDay,
distance, indoorOutdoor, novelty, pace, setting, weatherPreference.

**4. Gradual updates (bounded learning rate)** — ✅ IMPLEMENTED.
`preferenceSignalService.ts`: `BASE_LEARNING_RATE=0.45` decaying toward
`MIN_LEARNING_RATE=0.05` as sample count grows — a single event can never snap a
signal to an extreme.

**5. Confidence model** — ✅ IMPLEMENTED.
`confidenceFromSamples()` scales with `CONFIDENCE_SAMPLE_SCALE=4`; inferred
sources are capped at `INFERRED_CONFIDENCE_CEILING=0.85`. Confidence is computed
server-of-record-side, never accepted from the client (the observation type has
no `confidence` field — see item 33).

**6. Confidence decay** — ✅ IMPLEMENTED.
`decayFactor()` / `applyDecay()` with `DECAY_HALF_LIFE_DAYS=90`. Explicit and
user-corrected signals are decay-immune.

**7. Reinforcement** — ✅ IMPLEMENTED.
Same-direction observations raise strength and sample count and refresh
`lastObservedAt`; folded in `foldObservation()`.

**8. Contradiction handling** — ✅ IMPLEMENTED.
Opposing observations increment `contradictionCount` without immediately
flipping the signal; explicit signals count contradictions but are never
overwritten by inference.

**9. Reversal detection** — ✅ IMPLEMENTED.
When `!sameDirection && contradictionCount >= REVERSAL_THRESHOLD (3)` the signal
re-seeds in the new direction — a genuine, sustained change of taste eventually
wins, but noise does not.

**10. Recency weighting** — ✅ IMPLEMENTED.
`recencyWeight()` over `RECENCY_WINDOW_DAYS=30`; recent behaviour weighs more
than stale behaviour in derived summaries.

**11. `ReflectionInsightService` — structured signals only, NO psychology** —
✅ IMPLEMENTED. `reflectionInsightService.ts` emits only bounded, structured
dimension signals. `sensitiveAttributeGuard.ts` `validateMemoryStatement()`
rejects clinical/diagnostic/emotional-attribution phrasing
(`FORBIDDEN_STATEMENT_PATTERNS`). No mood, no diagnosis, no "you seem…".

---

## B. Memory, graph & profile

**12. `ExperienceGraph` on Firestore (NOT Neo4j)** — ✅ IMPLEMENTED.
`experienceGraphService.ts` persists nodes/edges to the user-owned
subcollections `experienceGraphNodes` / `experienceGraphEdges`. No external
graph database.

**13. `UserExperienceProfile` (versioned)** — ✅ IMPLEMENTED.
`userExperienceProfileService.ts`; carries `profileVersion` + `schemaVersion`,
derived dimension summaries, `recentCategories`, `frequentAreas`,
`noveltyAppetite`, `overallConfidence`, `lastProcessedEventId`.

**14. `ExperienceMemory` — 8 types** — ✅ IMPLEMENTED.
`ExperienceMemoryType` (`experienceIntelligence.ts:287`): preference, avoidance,
history, pattern, place, social, experience, contextual. `systemGenerated` flag
distinguishes derived from authored.

**15. Memory retrieval** — ✅ IMPLEMENTED. `memoryRetrievalService.ts`
(bounded, ranked pulls — never "load the whole history").

**16. Memory recall** — ✅ IMPLEMENTED. `experienceRecallService.ts`
(contextual recall for the current situation, top-k only).

**17. Profile rebuild** — ✅ IMPLEMENTED. `experienceProfileRebuildService.ts`
rebuilds a profile deterministically from raw events (the derived layer is
always reconstructable — which is also why deletion must reach it; see item 30).

**18. `ExperienceProcessingJob` queue (idempotent)** — ✅ IMPLEMENTED.
`experienceProcessingQueue.ts`; `buildDedupeKey()` makes re-enqueue a no-op, so
a retried or double-fired event is processed once.

**19. `SurpriseQuestService`** — ✅ IMPLEMENTED. `surpriseQuestService.ts`
selects a deliberate off-profile dimension for the ~5–20% surprise slot (bounded
by adaptive novelty; see item 25).

**20. Backfill / profile bootstrap** — ✅ IMPLEMENTED via item 17. A user with
prior history gets a profile by replaying raw events through the rebuild
service; there is no separate migration binary to run.

---

## C. AI provider layer (server-side)

**21. `AIProvider` abstraction — primary → fallback → deterministic** —
✅ IMPLEMENTED. `server/services/ai/aiProvider.js`. The deterministic floor
always succeeds and never invents a real-world fact. Every result is tagged with
`RESULT_SOURCE` (`ai-primary` / `ai-fallback` / `deterministic`) so nothing is
ever presented as model-authored when it was templated.

**22. Model routing** — ✅ IMPLEMENTED. `modelRouter.js` `routeTask()` picks
model tier + temperature + token ceiling per task (`generateQuest`,
`recapStory`, `classify`, `memoryTitle`), surfaced at `/ai-health`.

**23. Structured JSON + schema validation** — ✅ IMPLEMENTED.
`schemaValidator.js` (`AI_QUEST_SCHEMA`, `AI_RECAP_SCHEMA`,
`AI_CLASSIFICATION_SCHEMA`, `AI_MEMORY_TITLE_SCHEMA`), `allowUnknown:false`. A
malformed response is **rejected, not repaired**.

**24. Hallucination protection** — ✅ IMPLEMENTED. `hallucinationGuard.js`
(`guardQuest`, `guardRecapStory`) checks generated text against the supplied
verified facts; a fabricated place/number/first is discarded and the layer falls
through.

**25. Novelty engine (~80/20; scores 0.2 / 0.5 / 0.8)** — ✅ IMPLEMENTED.
`noveltyEngine.ts`. `NOVELTY_TARGET_SCORES = {comfortable:0.2, stretch:0.5,
surprise:0.8}`. `chooseNoveltyLevel()` blends preference and appetite, falls back
to `comfortable` on cold-start / low profile confidence, and only spends surprise
above a confidence floor.

**26. Diversity engine (recent-category penalty)** — ✅ IMPLEMENTED.
`diversityEngine.ts`: `recentCategoryPenalty()`, `detectRepetitionFromEvents()`,
`diversityAdjustment()` — penalises monoculture and rewards rut-breaking.

**27. Quest generation priority order** — ✅ IMPLEMENTED as the ranking
contract: 1 Safety, 2 Hard constraints, 3 Feasibility, 4 User preferences,
5 Novelty, 6 Diversity, 7 Presentation. Safety and hard constraints are
gates (a candidate that fails is removed, not down-weighted); preferences and
below are scores. `constraints` are never relaxed by the AI layer.

**28. Hard-constraint vs soft-preference separation** — ✅ IMPLEMENTED.
`userPreferenceParser.ts` `parseClause()` + `toHardConstraints()`: hard only when
direction is negative AND a hard marker ("never", "no …") is present; everything
else stays a soft preference. `HardConstraints` (exclusions + accessibilityNeeds)
is a distinct type.

**29. Explicit outranks inferred** — ✅ IMPLEMENTED.
`PreferenceSignalSource` orders `userExplicit` above every inferred source;
`foldObservation()` will not let inference overwrite an explicit signal.

---

## D. User control, data governance, security

**30. User controls — view / correct / delete / reset / disable** —
✅ IMPLEMENTED (client), ⚙️ server purge REQUIRES EXTERNAL CONFIGURATION.
- View / correct / reset / disable: `personalizationSettingsService.ts` +
  `PersonalizationSettingsScreen`, reached from `ProfileScreen.tsx`.
- Disable = kill switch persisted at `users/{uid}/settings/personalization`
  (`DEFAULT_PERSONALIZATION_SETTINGS`).
- Delete: client erases its own subcollections (Firestore rules permit
  self-deletion); the server exposes the authoritative manifest and a deletion
  endpoint — see items 34 and 39.

**31. Settings → Personalization entry point** — ✅ IMPLEMENTED.
`ProfileScreen.tsx` opens `PersonalizationSettingsScreen`.

**32. Raw vs derived separation + data lineage** — ✅ IMPLEMENTED.
Raw (`experienceEvents`) and derived (`preferenceSignals`,
`experienceProfile`, graph, memories) live in distinct subcollections. Signals
carry `sourceEventIds` (capped at `MAX_LINEAGE_IDS=25`) so any derived value can
be traced to the events that produced it.

**33. Client cannot forge derived fields** — ✅ IMPLEMENTED.
`PreferenceSignalObservation` has no `confidence`/`source`/`strength` fields to
set; confidence is computed in `foldObservation()`
(`Number(confidenceFromSamples(1, source).toFixed(4))`). `systemGenerated`
memories are server-of-record-derived. Firestore rules deny client writes to the
derived shape.

**34. Deletion propagation (raw + derived)** — ✅ IMPLEMENTED (manifest),
⚙️ server purge REQUIRES EXTERNAL CONFIGURATION.
`server/services/accountDeletionService.js` `buildDeletionManifest()` lists
**both** `RAW_SUBCOLLECTIONS` and `DERIVED_SUBCOLLECTIONS` — the derived profile
cannot survive the raw data it came from. Newly wired this phase:
- `GET /api/intelligence/account/deletion-manifest` — audit-safe, read-only.
- `DELETE /api/intelligence/account` — calls `deleteUserAccountData(req.auth.userId)`.
Both are gated by `requireIdentity` + `enforceSelfOnly` + `cheapLimiter` and key
strictly to `req.auth.userId`; there is no code path that deletes for a
client-supplied id. When `firebase-admin` is absent the endpoint returns
`serverSidePurgePerformed:false, clientMustComplete:true` and never claims a
purge it did not perform.

**35. Feature flags** — ✅ IMPLEMENTED. `src/config/featureFlags.ts` — master
toggle × stable-hash rollout bucket, evaluated locally (no network, safe at
render). Phase 11 flags: `advancedPersonalization` 50%, `adaptiveNovelty` 50%,
`aiMemoryRecall` 25%, `surpriseQuest` 25%, `personalizedQuestGeneration` 10%;
signal-collection flags (`experienceMemory`, `experienceGraph`,
`reflectionInsights`) at 100%. Deliberate ship order: collect → rank → spend.

**36. Sensitive attributes never inferred or stored (8 categories)** —
✅ IMPLEMENTED. `sensitiveAttributeGuard.ts` blocks religion, politics, sexual
orientation, medical, mental health, race/ethnicity, criminal history, financial
status. `scanForSensitiveContent()` uses word-boundary matching so
"straightforward"/"racecourse" are not false-positives. Every value pushed into a
signal is gated by `isSafeDerivedValue`, which logs the category only — never the
text.

**37. Single-user context isolation** — ✅ IMPLEMENTED.
`promptBuilder.js` `assertSingleUserContext(userId, personalization)` refuses to
build a prompt mixing two users. `enforceSelfOnly` rejects a body `userId`
mismatch (403 `CROSS_USER_REQUEST_DENIED`); `sanitizePersonalization()` rejects a
cross-user bundle (403 `CROSS_USER_CONTEXT_DENIED`). No server path reads a
`userId` other than `req.auth.userId`.

**38. API keys stay server-side** — ✅ IMPLEMENTED.
All model keys live in `server/` env; the mobile bundle never receives one. The
client sends only a bounded, coordinate-stripped personalization bundle, which
the server rebuilds from scratch (unknown keys dropped, `COORDINATE_PATTERN`
rejected) so it cannot inflate the prompt or smuggle free text.

**39. Logging discipline** — ✅ IMPLEMENTED.
No route or service logs full reflections, full memories, prompts, or PII. AI
telemetry (`aiProvider.js` `stats`) is counts only. Deletion logs document
counts, never contents.

---

## E. Verification & honest limitations

**40. Tests — 30 numbered + security + load** — ✅ IMPLEMENTED.
`src/__tests__/phase11.test.ts` (583 lines, `runPhase11Tests()`): tests 1–30
exercise the real exported pure functions (signal folding, decay, recency,
event→observation normalization, dedupe idempotency, novelty split, diversity
penalty, constraint parsing); S1–S8 are security tests (sensitive-category
detection, word-boundary safety, safe-derived-value gate, memory-statement
rejection, user-scoped isolation, client-cannot-supply-confidence,
deleted-memory-yields-zero-signals); L1–L3 document 10k/100k/500k load
expectations.
**Status: 41/41 pass at runtime; 0 type errors.** There is **no test runner
installed** in this environment — the suite is compiled with the locally
available `esbuild` and executed under `node` (`NODE_ENV=test`); type-checking
`phase11.test.ts` pulls in the full service graph and needs
`NODE_OPTIONS=--max-old-space-size=6144`.

**41. Honest status ledger — what is NOT fully live** — documented, not hidden:
- **Live Gemini generation** — ⚙️ REQUIRES EXTERNAL CONFIGURATION (`GEMINI_API_KEY`).
  Without it the provider chain runs and always returns a result via the
  **deterministic** layer; `/ai-health` reports `geminiConfigured:false`.
- **Server-side Firebase ID token verification** — ⚙️ REQUIRES EXTERNAL
  CONFIGURATION (`firebase-admin` + `GOOGLE_APPLICATION_CREDENTIALS`
  / `FIREBASE_SERVICE_ACCOUNT_JSON`). `requireIdentity.js` **fails closed** in
  production (501 `AUTH_NOT_IMPLEMENTED`); dev trusts `x-user-id` with
  `verified:false`. `/ai-health` reports `identityVerificationActive:false`.
- **Server-side account purge** — ⚙️ REQUIRES EXTERNAL CONFIGURATION (same
  dependency). Until configured, deletion is client-performed and the server
  returns a manifest only (item 34).
- **Client → server LLM invocation** — 🔌 NOT YET WIRED. The server intelligence
  endpoints are implemented, mounted at `/api/intelligence`, gated, and
  health-probeable, **but no code in `src/` calls them yet** (`grep` for
  `/api/intelligence` in `src/` returns nothing). The client's personalized quest
  path today is the **on-device deterministic `QuestEngine` + personalization
  scorer**, which is real personalization but not an LLM call. This is the honest
  boundary: the AI backend is built and callable; the mobile app has not been
  switched over to it in Phase 11.
- **Rejection/skip capture** — the completion/accept/save/delete call sites fire
  real `ExperienceIntelligenceService` methods on the authenticated uid
  (fire-and-forget). The quest-skip signal is bridged but not force-wired at
  every possible skip surface.

---

### One-line summary

Phase 11's intelligence core — event ingestion, the adaptive signal model
(learning rate / confidence / decay / reinforcement / contradiction / reversal /
recency), the Firestore experience graph, the versioned profile, the 8-type
memory system, the novelty/diversity engines, the sensitive-attribute guard, the
per-user-isolated server AI provider chain with schema + hallucination gates, the
feature-flag rollout, and the raw/derived deletion manifest — is **implemented
and verified (41/41 tests)**. Live LLM generation, server-side token
verification, and server-side purge are **complete code paths that require
operator configuration**, and the mobile client is **not yet switched from its
on-device deterministic personalization to the server LLM** — all stated plainly
above rather than implied to work.
