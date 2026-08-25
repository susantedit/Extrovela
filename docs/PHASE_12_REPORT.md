# EXTROVELA — Phase 12 Final Report

**Memory Journal 2.0 · Experience Timeline · AI Life Recaps (Monthly / Yearly) · Personal Story Generation · Shareable Experience Cards · Smart & Manual Collections**

This report is a truthful ledger of what Phase 12 actually ships. Where a
capability is a real, running implementation it says so and points at the file
and, where useful, the line. Where a capability's code path is complete but stays
inert until an operator supplies a credential or stands up hosting, it is marked
**REQUIRES EXTERNAL CONFIGURATION**. Where a described capability has *no*
implementation behind it at all, it is marked **NOT IMPLEMENTED** — plainly, not
buried. Nothing in this document is described as working on the strength of a UI
shell alone, and every AI claim is qualified by exactly what it needs to run.

Legend:
`✅ IMPLEMENTED` — code exists, is reachable from the running app, and does what the item says on-device.
`⚙️ REQUIRES EXTERNAL CONFIGURATION` — code path is complete and fails safe, but stays inert until a dependency/credential/host is supplied.
`🚫 NOT IMPLEMENTED` — the described surface has no code behind it in this phase; called out so it is never mistaken for shipped.

---

## A. What mounted into the live app

Phase 12's service layer was already real before this phase; the work here was to
mount it into the running UI without duplicating or replacing any working service,
and to prove the pure core with an automated test suite.

**1. Four-tab Experience Journal** — ✅ IMPLEMENTED.
`src/components/screens/MemoriesScreen.tsx:19` defines `ViewMode =
'timeline' | 'calendar' | 'recaps' | 'collections'` and renders a real panel for
each: the timeline grid (grouped, searchable, filterable), `CalendarJournalView`,
`RecapPanel`, and `CollectionsPanel` (`MemoriesScreen.tsx:366`). No tab is a
placeholder.

**2. Stats header is computed, not hardcoded** — ✅ IMPLEMENTED.
`ExperienceStatsService.computeStats(memories)` (`MemoriesScreen.tsx:66`) drives
TOTAL STORIES / NEW PLACES / FIRST-TIMES / FAVORITES. The numbers are derived
from the loaded memories on-device.

**3. Share entry point** — ✅ IMPLEMENTED.
`MemoryDetailModal.tsx:283` mounts `ShareCardModal`; the share subject built at
`MemoryDetailModal.tsx:53` carries **only** approved fields (title, a month/year
subtitle, a city-level place label, stat lines, a date label). Exact
coordinates, media, and the private reflection text are deliberately excluded at
the point of construction — the reflection never enters the share path.

**4. Deletion propagates to shared cards** — ✅ IMPLEMENTED.
`MemoriesScreen.tsx:84-98`: deleting a memory best-effort revokes any public
share links whose subject is that memory, so a deleted memory can no longer be
resolved through a card published earlier. Fire-and-forget, off the UI path.

---

## B. Memory Journal 2.0 & Experience Timeline

**5. Period grouping** — ✅ IMPLEMENTED.
`src/services/memories/timelineGrouping.ts`. `groupMemoriesByPeriod(memories,
grouping)` buckets by day/week/month/year with newest bucket and newest member
first; `bucketFor` produces stable UTC labels (`'Aug 15, 2026'`, `'August 2026'`,
`'2026'`, `'Week of …'`). Memories with a missing or unparseable `completedAt`
are skipped rather than crashing the view (proved by test 5).

**6. First-time detection** — ✅ IMPLEMENTED.
`src/services/memories/firstTimeDetection.ts`. `detectFirstTimeFlags` compares a
memory against prior history to flag a new place / new experience type;
`isFirstTimeExperience`, `placeKey`, and `typeTagsOf` are pure and history-driven.
An unknown location cannot assert a "new place" (test 8).

**7. Experience statistics** — ✅ IMPLEMENTED.
`src/services/memories/experienceStatsService.ts`. `computeStats` returns totals,
favorite count, first-time count, new-place count, and an average rating that
defaults to `5.0` when unrated. Pure; no network, no LLM.

---

## C. AI Life Recaps — factual by construction

The recap system is built so that **every number a recap shows is computed on the
device from the user's own memories**, with no model in the loop. A model may
*optionally* add prose, and even then it is not trusted to invent facts.

**8. Verified recap stats** — ✅ IMPLEMENTED.
`src/services/memories/recapGrounding.ts`. `periodWindow`, `memoriesInWindow`,
`computeVerifiedRecapStats`, `extractVerifiedPlaces`, `extractVerifiedFirsts`, and
`buildHighlights` compute the recap entirely from memories inside the half-open
period window. No LLM is called to produce a statistic.

**9. Content hash & staleness** — ✅ IMPLEMENTED.
`buildRecapContentHash` sorts memory ids before hashing (FNV-1a), so the hash is
order-independent; `isRecapOutdated` flips when the underlying set or stats change
(test 13). `recapGenerationService.invalidateIfStale` marks a recap `'outdated'`
rather than silently serving stale prose.

**10. Story slides expose only verified numbers** — ✅ IMPLEMENTED.
`src/services/memories/recapStorySlides.ts`. `buildRecapStorySlides` renders an
intro/places/firsts/balance/highlights/outro deck whose numbers come straight
from the verified stats. An empty period returns a single honest slide
(*"No experiences logged in this period yet."*) rather than an invented recap
(test 14).

**11. Pure recap generation** — ✅ IMPLEMENTED.
`src/services/memories/recapGenerationService.ts`. `computeRecap` and
`pregenerate` are pure and contain no model call. The recap object is complete and
displayable with `narrativeAvailable: false`.

---

## D. AI narrative (personal story prose)

**12. Optional, gated, and double-grounded narrative** — ⚙️ REQUIRES EXTERNAL CONFIGURATION.
`recapGenerationService.attachNarrative` is the *only* path that adds prose. It is
gated three ways before a single word is written:

  1. **Feature gate** — `isFeatureEnabled('aiMemoryStories', userId)`. Master
     toggle is `true`; **rollout is 5%** (`src/config/featureFlags.ts:149`), and a
     percentage-gated flag with no `userId` fails closed
     (`featureFlags.ts:227`). So for ~95% of signed-in users this path does
     nothing by design.
  2. **Server + credential** — it calls `intelligenceClient.generateRecapStory`,
     which POSTs to the Express gateway → Gemini provider. With no server running
     or **no `GEMINI_API_KEY` configured, no narrative is produced.**
  3. **Grounding** — any returned prose is checked client-side by
     `assertNarrativeGrounded(story, allowedNumbersFrom(stats))`, which rejects any
     standalone integer greater than 1 that the verified stats do not support
     (server-side `hallucinationGuard` is the first line; test S5 proves the client
     check). On any failure the recap degrades to **stats-only**
     (`narrativeAvailable: false`).

**Honest status:** the numeric recap is fully on-device and always available. The
*narrative* is off by default for almost everyone and **does nothing at all until
Gemini is configured server-side**. `RecapPanel`'s Story Mode says exactly this to
the user ("AI narration requires server configuration and is gradually rolling
out") rather than presenting an empty box as a feature.

---

## E. Collections — smart & manual

**13. Declarative smart collections** — ✅ IMPLEMENTED.
`src/services/memories/smartCollectionRules.ts`. `evaluateSmartCollection` returns
the matching memory-id set from a pure any/all rule tree (`matchesClause`); no
model is involved. `PREDEFINED_SMART_COLLECTIONS` ships the built-in rule sets
(e.g. outdoor tags including `'nature'`). Proved on a 10k-memory set (test L2).

**14. Manual collections + panel** — ✅ IMPLEMENTED.
`src/features/memories/CollectionsPanel.tsx` mounts the real collection service and
lets the user open a memory from a collection. Membership is data, evaluated
locally.

---

## F. Shareable Experience Cards

The guiding principle, enforced in code: **nothing becomes public without the user
seeing the exact payload first, the payload provably carries no identifiers, and
the shared image is a newly rendered composite — never the user's original media.**

**15. Unguessable tokens** — ✅ IMPLEMENTED.
`src/services/security/tokenGenerator.ts`. `generateSecureToken(length = 28)`
throws below a 22-character floor, uses rejection sampling into a base62 alphabet,
and is CSPRNG-backed (28 chars ≈ 166 bits). `isValidShareToken` enforces
`≥ 22` and `^[0-9A-Za-z]+$`. Tokens are independent of any user id (test S4).

**16. Denylisted public payload** — ✅ IMPLEMENTED.
`src/services/sharing/sharePayload.ts`. `buildPublicSharePayload` calls
`assertNoDenylistedKeys` internally; `SHARE_DENYLIST_KEYS` blocks `userId`, `uid`,
`memoryId`, `recapId`, `storagePath`, `email`, `handle`, coordinates, and
reflection text — recursively, including nested objects and arrays (test S1). A
published payload provably contains no identifiers, no coordinates, and no
reflection value (test S2). `sanitizeStatLines` clips to 6 lines / 48 chars.

**17. Live / revoked / expired resolution** — ✅ IMPLEMENTED.
`isShareLinkLive(link, nowMs)` returns false once a link is revoked or past its
expiry, so revoking or expiring a card makes it un-resolvable against the caller's
clock (test S3). Revoke is wired into the share modal
(`ShareCardModal.tsx:98`) and into memory deletion (§A/4).

**18. Transparent publish flow** — ✅ IMPLEMENTED.
`src/features/memories/ShareCardModal.tsx`. The "WHAT BECOMES PUBLIC" panel renders
the literal `shareExperienceCardService.preview(subject, template)` payload — the
same object that gets written — before any publish. Publishing is an explicit
button press; the modal offers no-expiry / 7-day / 30-day options and a revoke
control on the published result.

---

## G. The public shareable-card web page (social unfurl)

**19. Crawlable `/s/:token` page with OpenGraph tags** — 🚫 NOT IMPLEMENTED.
There is **no server route** that serves a public HTML page for a share token.
A sweep of the Express server found `/q/:code` (growth), `/account/deletion-manifest`,
`/ai-health`, `/metrics`, and the API routes — **no `/s/:token` and no OpenGraph /
`og:` meta rendering.** The client can construct a `webUrl` and
`shareExperienceCardService` can resolve a token's public payload from Firestore,
but the crawlable, link-unfurling web page a recipient would open **does not
exist in this phase**. Standing it up **REQUIRES EXTERNAL CONFIGURATION**: a public
web host (or SSR route) plus, for owner-scoped reads under production security
rules, a privileged server (`firebase-admin`, see §H). Until then a share link
resolves inside the app, not as a public web card.

---

## H. Account deletion & the shared-link lifecycle

**20. Deletion manifest enumerates Phase 12 artifacts** — ✅ IMPLEMENTED (manifest).
`server/services/accountDeletionService.js` lists, among the raw subcollections to
purge, `recaps`, `memoryMedia`, `memoryCollections`, `experienceRecaps`, and
`shareTokens`, plus the derived Phase 11 signals. The manifest is honest about
scope.

**21. Server-side purge** — ⚙️ REQUIRES EXTERNAL CONFIGURATION.
The service file's own header states plainly that server-side purge is **not
active** because `firebase-admin` is absent in this environment; deletion is
performed **client-side** today. This is not presented as a working server sweep.

**22. Public `/shareLinks/{token}` on account deletion** — 🚫 NOT IMPLEMENTED (gap, flagged).
The per-user deletion manifest purges the owner's `shareTokens` index under
`users/{uid}/…`, but the **public, top-level `/shareLinks/{token}` documents are
keyed by token, not by user**, and are **not** enumerated by the per-user manifest.
Individual links are revoked on memory deletion (§A/4) and via the modal, but a
*full account deletion* does not currently sweep every published public card.
Closing this cleanly **REQUIRES EXTERNAL CONFIGURATION** (a privileged server sweep
by owner uid, or a client-side "revoke all links" step run before account
deletion). Called out here so it is not mistaken for handled.

---

## I. Feature flags & rollout (Phase 12)

**23. Two-gate rollout, fail-closed** — ✅ IMPLEMENTED.
`src/config/featureFlags.ts`. Every Phase 12 flag passes only if the master toggle
is on **and** the user's stable FNV-1a bucket falls under the rollout percentage;
a percentage-gated flag with no `userId` returns false. Master toggles are all
`true`; rollout percentages as shipped:

| Flag | Master | Rollout |
|---|---|---|
| `memoryJournalV2` | true | 100% |
| `experienceTimeline` | true | 50% |
| `monthlyRecaps` | true | 25% |
| `yearlyRecaps` | true | 25% |
| `memoryCollections` | true | 25% |
| `smartCollections` | true | 10% |
| `shareableExperienceCards` | true | 10% |
| `aiMemoryStories` | true | 5% |
| `recapSharing` | true | 5% |

The ship order is deliberate: on-device journal at 100%, then anything that
writes prose or leaves the device last (5–10%), because a share link is public and
cannot be un-published.

---

## J. Privacy & security posture (verified)

- **No secrets client-side** — the narrative path POSTs to the gateway; `GEMINI_API_KEY` and other secrets stay server-side. ✅
- **Numeric-only intelligence payloads** — the client sends counts/enums, keyed by `x-user-id`; no raw reflections or coordinates leave the device on the recap path. ✅
- **Reflection never shared** — excluded at share-subject construction and again by the payload denylist (§A/3, §F/16). ✅
- **User isolation** — smart-collection and stats evaluators only ever operate on the memories handed to them; they cannot reach another user's data (test S6). ✅
- **Sensitive-attribute inference** — none introduced by Phase 12; recaps and collections are built from the user's own logged experiences and explicit tags only. ✅

---

## K. Automated test proof

**24. `src/__tests__/phase12.test.ts` — 29 tests, all passing.** ✅ IMPLEMENTED.
Exported as `runPhase12Tests()` following the repo's runner-free convention
(internal `run(name, fn)` + `assert`). It exercises **only the pure, Firebase-free
core** — it never touches `recapGenerationService`/`shareExperienceCardService`
(which require Gemini/Firestore), so the node process stays dependency-free and
the suite proves exactly what it claims.

- **20 functional tests (1–20):** upload backoff; timeline grouping incl.
  invalid-date skipping; first-time detection; recap window + verified stats;
  order-independent content hash + staleness; empty-period honesty; story-slide
  number/narrative gating; smart-collection any/all; stats totals; share-payload
  field copying + URL building; live/revoked/expired resolution; secure-token
  generation.
- **6 security/privacy tests (S1–S6):** recursive denylist enforcement; a
  published payload has no identifiers/coordinates/reflection value; revoke/expiry
  kills resolution; token entropy & user-independence; `assertNarrativeGrounded`
  rejects unsupported numbers; evaluators respect user boundaries.
- **3 scale checks (L1–L3):** 10k-memory timeline with no dropped valid members;
  10k-memory smart-collection exact subset; L3 is a **documented** scale note
  (recorded as a passing note, not a hidden cap).

Determinism: token tests inject an LCG `SecureRng` so they don't depend on
platform crypto; no `Date.now()`/`Math.random()` in the pure paths under test.

**How to run:**

```bash
npx esbuild src/__tests__/phase12.test.ts --bundle --platform=node --format=cjs --outfile=.tmp/phase12.cjs && NODE_ENV=test node .tmp/phase12.cjs
```

**25. Typecheck** — ✅ GREEN.
The full project typecheck passes with the test file present:

```bash
NODE_OPTIONS=--max-old-space-size=6144 node_modules/.bin/tsc -p tsconfig.json --noEmit
```

---

## L. Documented limitations (so no number is oversold)

**26. `newPlaces` requires a verified place id.** `computeVerifiedRecapStats`
counts a new place only when a memory carries **both** `firstTimeFlags.newPlace`
**and** a resolved `location.placeId`. A first-time visit logged without a resolved
place id contributes to first-time counts but **not** to the new-places count —
the recap under-counts rather than assert a place it cannot verify. Test 12
asserts this behavior explicitly.

**27. Narrative is best-effort and usually absent.** Per §D: off for ~95% of
users by rollout, and entirely absent without a configured Gemini backend. The
numeric recap is always present regardless.

**28. Share links resolve in-app, not as public web cards** (per §G), and a full
account deletion does not yet sweep public `/shareLinks` (per §H/22).

---

## M. Phase 13 — stop condition honored

**29. Phase 13 not started.** 🚫 Per the directive's explicit STOP condition,
nothing beyond Phase 12 was begun: no payments, subscriptions, premium tiers,
ads, referral rewards, marketplace, creator economy, public social feed,
advanced/always-on AI recap generation, or enterprise features. Phase 12 is the
final scope of this work.

---

### Summary

Phase 12 ships a real, on-device Memory Journal 2.0: timeline/calendar/recaps/
collections are mounted and functional, recap **statistics are factual by
construction**, smart collections are pure and declarative, and shareable cards
are gated behind an unguessable token with a transparent, denylisted, revocable
public payload — proved end-to-end by 29 passing tests over the pure core, with
the project typecheck green.

Three things are honestly **not** finished and are marked as such rather than
implied: the **AI narrative** does nothing until Gemini is configured server-side
and is 5%-gated even then (**REQUIRES EXTERNAL CONFIGURATION**); the **public
`/s/:token` unfurl page has no server route** (**NOT IMPLEMENTED**); and
**server-side account purge is inactive** (client-driven today), with public
`/shareLinks` not yet swept on full account deletion (**REQUIRES EXTERNAL
CONFIGURATION**). Everything else above is running code with a file behind it.
