# EXTROVELA: Real-World Experience Engine & Open-World Life Platform

<div align="center">
  <img src="public/hero-banner.jpg" alt="EXTROVELA Real-World Experience Engine" width="100%" />

  <br /><br />

  <img src="public/logo-dark.png" alt="EXTROVELA Brand Emblem" width="340" />
  <h2>Stop scrolling. Start experiencing.</h2>
  <p><em>Don't just get through your day. Make today different.</em></p>

  <p>
    <a href="#table-of-contents">Table of Contents</a> •
    <a href="#system-architecture">Architecture</a> •
    <a href="#interactive-flowcharts-and-state-diagrams">Interactive Flowcharts</a> •
    <a href="#architectural-trade-offs-and-rationale">Trade-Offs & Rationale</a> •
    <a href="#mathematical-foundations-and-algorithmic-architecture">Mathematical Foundations</a> •
    <a href="#api-reference">API Reference</a> •
    <a href="#database-architecture">Database</a> •
    <a href="#developer-guide">Developer Guide</a> •
    <a href="#security-and-privacy">Security</a>
  </p>
</div>

================================================================================
TABLE OF CONTENTS
================================================================================

1. EXECUTIVE SUMMARY AND PRODUCT VISION
2. PROBLEM STATEMENT AND PSYCHOLOGICAL FOUNDATIONS
3. THE EXTROVELA SIX-STAGE EXPERIENCE LOOP
4. COMPLETE SYSTEM ARCHITECTURE AND DATA TOPOLOGY
5. INTERACTIVE FLOWCHARTS AND STATE DIAGRAMS
6. ARCHITECTURAL DECISIONS AND TRADE-OFF RATIONALE (WHY, HOW, WHEN, WHY NOT)
7. COMPREHENSIVE COMPONENT CATALOG AND DIRECTORY MAP
8. MASTER QUEST TAXONOMY AND ONTOLOGY (180+ REAL EXPERIENCES)
9. MATHEMATICAL FOUNDATIONS AND ALGORITHMIC ARCHITECTURE (WHAT, HOW, WHEN, WHY)
10. ASTRONOMICAL SOLAR AND CELESTIAL PHYSICS ENGINE
11. WEATHER-ADAPTIVE CONTEXTUAL ENGINE
12. PROCEDURAL AMBIENT AUDIO SYNTHESIS DSP ENGINE
13. HARDWARE MEDIA CAPTURE AND 9:16 CANVAS STORY EXPORTER
14. GEOLOCATION, REVERSE GEOCODING, AND PRIVACY FUZZING
15. LEAFLET LIFE MAP AND DISCOVERY GRID SYSTEM
16. ANTI-REPETITION AND CATEGORY ENTROPY ALGORITHM
17. CO-QUESTS, CRYPTOGRAPHIC INVITES, AND SOCIAL LOOPS
18. EMIL KOWALSKI AND APPLE SPRING MOTION DESIGN SYSTEM
19. GLASSMORPHIC ALERT AND TOAST SYSTEM
20. COMPLETE REST API SPECIFICATION
21. MONGODB AND FIRESTORE DATABASE MODELS
22. DECLARATIVE SECURITY RULES AND PERMISSION MATRICES
23. OFFLINE-FIRST SYNCHRONIZATION AND QUEUE PROTOCOL
24. DEVELOPER ONBOARDING AND CONFIGURATION GUIDE
25. CAPACITOR NATIVE MOBILE COMPILATION GUIDE
26. COMPLETE FOURTEEN PHASE ENGINEERING HISTORY
27. PRE-PUSH DEFENSIVE SECURITY AUDIT REPORT
28. DOCUMENTATION SITEMAP AND REPOSITORY INDEX
29. LICENSE AND CREDITS

================================================================================
1. EXECUTIVE SUMMARY AND PRODUCT VISION
================================================================================

EXTROVELA is a cross-platform mobile and web application engineered to solve the pervasive modern crisis of routine paralysis, digital screen fatigue, and urban loneliness. In contemporary society, people spend upwards of eight to twelve hours per day looking at computer screens and smartphones, consuming passive algorithmic entertainment that leaves them feeling isolated, anxious, and unfulfilled.

Even when people feel an active desire to step outside, explore their surrounding city, or experience something novel, they are frequently paralyzed by decision fatigue. Traditional discovery tools like Yelp, TripAdvisor, or Google Maps are designed for consumer commerce, dining, and tourism rather than intentional personal living; they present overwhelming lists of commercial venues without context, encouragement, emotional attunement, or narrative meaning.

EXTROVELA is built on a fundamentally different philosophy:
1. Anti-Screen Architecture: Every screen interaction is intentionally designed to push the user into the real, physical world within two minutes of opening the app.
2. The World as an Open-World Exploration Game: Every completed real-world experience illuminates territory on a personal Life Map, creating a tangible visual chronicle of a life lived.
3. Adaptive Contextual Personalization: Quests adapt dynamically based on time availability (15 minutes to 60+ minutes), physical energy level, current mood, budget, real-time outdoor weather, and astronomical solar timing.
4. Non-Commercial and Mindful: Operates without commercial pressure, dark patterns, endless social feeds, or infinite doom-scrolling mechanisms.

================================================================================
2. PROBLEM STATEMENT AND PSYCHOLOGICAL FOUNDATIONS
================================================================================

The architectural design of EXTROVELA is grounded in three core psychological and behavioural frameworks:

1. THE PARADOX OF CHOICE AND DECISION FATIGUE
When individuals finish a workday or weekend morning with unstructured free time, having infinite possible activities causes cognitive friction. Rather than deciding between hundreds of options, people default to high-dopamine, low-effort passive screen consumption. EXTROVELA eliminates decision fatigue by offering exactly one curated "Today's Quest" with three personalized alternatives tailored to the user's immediate state.

2. BEHAVIOURAL ACTIVATION AND ROUTINE DISRUPTION
Psychological research in behavioural activation demonstrates that engaging in small, structured physical activities directly alleviates depressive inertia and feelings of stagnation. EXTROVELA structures real-world quests into low-friction, micro-adventures (e.g., 15-minute sky watching, silent book reading in a neighborhood teahouse, noticing five architectural details on a familiar street) that require minimal prep but deliver high emotional payoff.

3. THE POWER OF EPISODIC MEMORY ANCHORING
Routine days blend together in human memory because the brain filters out repetitive stimuli. When someone does something novel—even as simple as getting off a bus at a random stop or watching sunset from an unfamiliar hill—the hippocampus records distinct episodic memory anchors. EXTROVELA captures these anchors through multimodal reflection: verified proof photos, 15-second ambient sound recordings, mood delta scores, and personal reflections.

================================================================================
3. THE EXTROVELA SIX-STAGE EXPERIENCE LOOP
================================================================================

The entire application operates around a seamless six-stage cyclical loop:

STAGE 1: CONTEXT INITIALIZATION
The client device wakes up, resolves geographic coordinates, performs reverse geocoding to identify the local municipality, calculates solar sunset declination, and samples atmospheric conditions.

STAGE 2: INTENT SELECTION OR "I'M BORED" INSTANT SPIN
The explorer declares their constraints:
• Available Time: 15 Minutes (Micro), 30 Minutes (Standard), 45 Minutes (Extended), or 60+ Minutes (Deep Immersion)
• Energy Level: Low (Calm/Observational), Medium (Active Walk), or High (Physical/Social)
• Emotional State: Seeking Peace, Seeking Inspiration, Feeling Stuck, or Seeking Connection
• Budget: Free ($0), Inexpensive ($), or Moderate ($$)
Alternatively, tapping the "I'm Bored" Quick Escape triggers an interactive physics wheel that instantly picks an achievable 15-minute micro-quest.

STAGE 3: REAL-WORLD EXECUTION (PHONE-FREE IMMERSION)
The user locks their phone or enables Phone-Free Mode. The app provides clear instructions, ambient background audio synthesizers if requested, and runs a gentle timer. The user completes the experience in physical reality.

STAGE 4: MULTIMODAL PROOF AND REFLECTION CAPTURE
Upon completion, the user launches the Capture Modal:
• Proof Photo: Snapped directly via native camera hardware or uploaded.
• 15-Second Ambient Voice Note: Records environmental acoustics (bird calls, rain, city hum, fountain water).
• Reflection Journaling: Captures feelings, insights, and lessons.
• Quantitative Scores: 1–5 Star Rating and 1–5 Mood Transformation Delta.

STAGE 5: LIFE MAP ILLUMINATION AND REPUTATION
The memory is committed to the local database and synchronized to the cloud. A glowing discovery pin drops onto the Leaflet Life Map, fog over the neighborhood dissolves, and the user's city exploration percentage increments.

STAGE 6: SOCIAL SHARING AND CO-QUEST INVITATION
The explorer can export a branded 9:16 full-bleed Instagram/TikTok story card or generate a cryptographic invite token to embark on their next adventure with a companion.

================================================================================
4. COMPLETE SYSTEM ARCHITECTURE AND DATA TOPOLOGY
================================================================================

EXTROVELA utilizes a multi-tiered, decoupled client-server architecture designed for high availability, zero-latency offline operation, and strict user privacy:

```
+=============================================================================================================+
|                                        EXTROVELA MOBILE & WEB CLIENT                                        |
|                                                                                                             |
|  +--------------------+  +--------------------+  +--------------------+  +-------------------------------+  |
|  |     HomeScreen     |  |   ExploreScreen    |  |     MapScreen      |  |        MemoriesScreen         |  |
|  |  (Featured Quests) |  |  (180+ Real World) |  |   (Leaflet World)  |  | (Journal, Timeline, Audio)  |  |
|  +---------+----------+  +---------+----------+  +---------+----------+  +---------------+---------------+  |
|            |                       |                       |                             |                  |
|            +-----------------------+-----------+-----------+-----------------------------+                  |
|                                                |                                                            |
|                                                v                                                            |
|                           GLOBAL REACT CONTEXT ORCHESTRATION LAYER                                          |
|                (AppStateContext, AuthContext, CustomAlertContext, ThemeProvider)                            |
|                                                |                                                            |
|                        +-----------------------+-----------------------+                                    |
|                        |                                               |                                    |
|                        v                                               v                                    |
|             CAPACITOR NATIVE BRIDGE                         OFFLINE-FIRST STORAGE LAYER                     |
|         (Camera, GPS, Haptics, Audio)                     (IndexedDB, LocalStorage Queue)                   |
+========================+===============================================+====================================+
                         |                                               |
                         | REST HTTPS API                                | Background Sync Queue
                         v                                               v
+=============================================================================================================+
|                                    EXTROVELA EXPRESS BACKEND GATEWAY                                        |
|                                                                                                             |
|  +-------------------------------------------------------------------------------------------------------+  |
|  |                                          ROUTER LAYER                                                 |  |
|  |   /api/quests       /api/memories    /api/stats     /api/intelligence   /api/providers   /api/growth  |  |
|  +-------------------------------------------------------------------------------------------------------+  |
|         |                                      |                                       |                    |
|         v                                      v                                       v                    |
|  costProtectionMiddleware             requireIdentityMiddleware               requireAdminMiddleware        |
|  (AI Budget & Rate Limit)             (Identity Verification)                 (Observability Guard)         |
+=========+======================================+=======================================+====================+
          |                                      |                                       |
          v                                      v                                       v
+=============================+        +=============================+         +==============================+
|        MONGODB ATLAS        |        |      FIREBASE SERVICES      |         |      EXTERNAL PROVIDERS      |
|  • Quests (180+ Catalog)    |        |  • Firebase Authentication  |         |  • OpenStreetMap Nominatim   |
|  • Memories (Life Stories)  |        |  • Cloud Storage (Photos)   |         |  • Open-Meteo Weather API    |
|  • User Experience Profiles |        |  • Web Analytics & Perf     |         |  • Web Audio API Synthesizer |
+=============================+        +=============================+         +==============================+
```

================================================================================
5. INTERACTIVE FLOWCHARTS AND STATE DIAGRAMS
================================================================================

```mermaid
flowchart TD
    UserAppLaunch([User Launches EXTROVELA]) --> InitHardware[Initialize Native Shell & Check Permissions]
    
    subgraph GeoPipeline [1. Geolocation & Celestial Physics Pipeline]
        InitHardware --> QueryGPS[LocationService.getCurrentLocation]
        QueryGPS --> RunNominatim[OpenStreetMap Nominatim Reverse Geocoding]
        RunNominatim --> CityIdentified[City Resolved: Tokyo / London / New York / Kathmandu]
        CityIdentified --> ComputeSun[Compute Solar Declination, Noon & Golden Hour Window]
        CityIdentified --> FetchMeteo[Query Open-Meteo Real-time Weather API]
    end

    subgraph IntelligenceCore [2. Experience Intelligence & Entropy Engine]
        ComputeSun & FetchMeteo --> CalcEntropy[Calculate Recent Memory Shannon Entropy]
        CalcEntropy --> FilterQuests[Filter 180+ Curated Quest Master Repository]
        FilterQuests --> CheckBackend{Backend AI Gateway Reachable?}
        CheckBackend -- Reachable --> GeminiSynthesis[Gemini 1.5 Pro AI Personalization]
        CheckBackend -- Offline / Timeout --> HeuristicRanking[Local Heuristic Ranking Strategy]
    end

    subgraph UIOrchestration [3. Mobile UI Presentation & Interaction]
        GeminiSynthesis & HeuristicRanking --> DisplayHero[Render Featured Quest with Ambient Pulse Aura]
        DisplayHero --> AcceptQuest[Explorer Accepts Real-World Quest]
        AcceptQuest --> ExecuteExperience[Real-World Phone-Free Immersion Mode]
    end

    subgraph CaptureAndSync [4. Completion, Multimodal Proof & Cloud Sync]
        ExecuteExperience --> LaunchCapture[Open Capture Modal with Emil Kowalski Spring]
        LaunchCapture --> TakePhoto[Native Camera Proof Verification]
        LaunchCapture --> RecordAudio[15-Second Ambient Acoustic Recording]
        LaunchCapture --> WriteJournal[Log Mood Score, Reflections & Star Ratings]
        TakePhoto & RecordAudio & WriteJournal --> CommitLocal[Persist Instantly to Local Storage]
        CommitLocal --> DropPin[Drop Glowing Discovery Pin on Leaflet Life Map]
        CommitLocal --> SyncCloud[Asynchronously Dispatch to Cloud Gateway]
    end
```

```mermaid
sequenceDiagram
    autonumber
    actor Host as Quest Initiator
    participant Client as EXTROVELA Client
    participant Server as Express Gateway
    actor Friend as Co-Quest Explorer

    Host->>Client: Selects Quest & Taps "Invite Companion"
    Client->>Server: POST /api/growth/invite-token {questId, userId}
    Server-->>Client: Returns HMAC-SHA256 Cryptographic Invite Token
    Client->>Host: Opens Native Share Sheet (WhatsApp, Telegram, SMS)
    Host->>Friend: Dispatches Invite URL (extrovela.app/invite/{token})
    Friend->>Client: Opens Invite URL
    Client->>Server: GET /api/growth/invite/{token}
    Server-->>Client: Validates Signature & Resolves Quest Context
    Friend->>Client: Accepts Co-Quest Invitation
    Client->>Server: POST /api/growth/session/join {sessionId, friendId}
    Server-->>Client: Session Synchronized (Status: Active)
    Note over Host, Friend: Both explorers perform experience in physical reality
    Host->>Client: Submits Photo Proof & Reflection
    Friend->>Client: Submits Photo Proof & Reflection
    Client->>Server: POST /api/memories {isShared: true, companionId}
    Server-->>Client: Shared Life Experience Badge Unlocked!
```

```mermaid
stateDiagram-v2
    [*] --> Idle : User Opens App
    Idle --> SelectingConstraints : Tap Filter or Wheel
    SelectingConstraints --> QuestGenerated : Context Computed
    QuestGenerated --> QuestActive : Tap "Start Experience"
    
    state QuestActive {
        [*] --> TimerRunning
        TimerRunning --> AmbientAudioActive : Open Soundscapes
        AmbientAudioActive --> TimerRunning : Close Drawer
        TimerRunning --> ProofCapture : Tap "Complete Quest"
    }

    QuestActive --> MemoryLogged : Photo + Audio + Reflection Submitted
    MemoryLogged --> LifeMapUpdated : Discovery Pin Placed
    LifeMapUpdated --> StoryShared : Export 9:16 Canvas Card
    StoryShared --> Idle : Return to Home
```

================================================================================
6. ARCHITECTURAL DECISIONS AND TRADE-OFF RATIONALE
================================================================================

--------------------------------------------------------------------------------
ADR 1: PURE VANILLA CSS DESIGN TOKENS INSTEAD OF TAILWIND CSS
--------------------------------------------------------------------------------
1. WHAT: A centralized CSS Custom Properties design system in `src/styles/index.css` defining spatial scales, colors, glassmorphism filters, and hardware-accelerated spring curves.
2. HOW: Native CSS variables (`--color-surface`, `--color-accent`, `--ease-spring`) compiled directly by browser rendering engines without build-step overhead.
3. WHEN: Applied universally across all screens, modals, badges, cards, and typography.
4. WHY CHOSEN: Guarantees 100% granular control over Emil Kowalski spring easing physics, zero runtime overhead, instant style hot-reloading, and consistent dark-mode tokens without generating massive utility class bloat.
5. WHY NOT TAILWIND CSS: Tailwind creates class string clutter, complicates custom cubic-bezier spring curves with arbitrary values, and couples component structure tightly to framework-specific utility conventions.
6. WHAT TO DO INSTEAD: If scoped component styles are required in future extensions, CSS Modules can be used alongside the existing global token hierarchy.

--------------------------------------------------------------------------------
ADR 2: CAPACITOR 6.0 NATIVE BRIDGE INSTEAD OF REACT NATIVE OR FLUTTER
--------------------------------------------------------------------------------
1. WHAT: Capacitor 6.0 wrapping a unified Vite + React 18 single-page application into native iOS Xcode and Android Gradle binaries.
2. HOW: Exposes hardware primitives (Camera, GPS Geolocation, Tactile Haptics, Local Notifications) through asynchronous JavaScript-to-native message bridges.
3. WHEN: Invoked whenever media capture, haptics, geolocation, or push notifications are executed.
4. WHY CHOSEN: Allows 100% code reuse across Web, iOS, and Android. Eliminates double-codebase maintenance, enables instant web previews during development, and provides access to standard Web APIs (Web Audio API, Canvas 2D) that are cumbersome in React Native.
5. WHY NOT REACT NATIVE: React Native requires bridge-specific native UI components, complicates Canvas 2D rendering for 9:16 story cards, and creates ongoing maintenance overhead with bridge deprecations.
6. WHY NOT FLUTTER: Flutter requires switching languages from TypeScript to Dart, duplicates business logic, and lacks seamless Web Audio DSP synthesizer support.
7. WHAT TO DO INSTEAD: If a device runs in a standard mobile browser where Capacitor native plugins are absent, all hardware calls fall back gracefully to standard Web APIs (`navigator.geolocation`, `MediaRecorder`, `navigator.share`).

--------------------------------------------------------------------------------
ADR 3: OPENSTREETMAP NOMINATIM INSTEAD OF GOOGLE MAPS GEOCODING API
--------------------------------------------------------------------------------
1. WHAT: Free, open-access reverse geocoding resolving GPS latitude/longitude into human-readable city and municipal district names.
2. HOW: HTTP GET request with an English language header dispatched to `https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}`.
3. WHEN: Triggered once on initial app mount and whenever location permissions are granted.
4. WHY CHOSEN: Eliminates expensive per-request API billing, requires zero API key leakage in mobile bundles, and provides robust global coverage across thousands of cities worldwide.
5. WHY NOT GOOGLE MAPS GEOCODING API: Google Maps Geocoding costs $5.00 per 1,000 requests, requires mandatory credit card billing, enforces restrictive quota caps, and exposes private billing keys to client tampering.
6. WHAT TO DO INSTEAD: If Nominatim encounters network timeout (e.g. strict rate limit), the app falls back to local timezone offset coordinate estimation or cached municipal profiles.

--------------------------------------------------------------------------------
ADR 4: WEB AUDIO PROCEDURAL SYNTHESIS INSTEAD OF HOSTED MP3 AUDIO FILES
--------------------------------------------------------------------------------
1. WHAT: Real-time mathematical acoustic sound generation for continuous nature ambiance (Summer Rain, Ocean Shore, Forest Birds, Highland Wind).
2. HOW: Web Audio API `AudioContext` generating white and pink noise buffers filtered through 2nd-order recursive Biquad filters and modulated by low-frequency oscillators.
3. WHEN: Activated on demand when an explorer opens the Soundscape Drawer during a quest.
4. WHY CHOSEN: Zero network bandwidth consumption (0 MB downloaded), instant playback with zero buffering latency, infinite non-repeating acoustic variation, and complete offline capability.
5. WHY NOT HOSTED MP3 FILES: MP3 audio loops require downloading 15–50 MB of audio files, introduce audible looping seams, waste mobile cellular data, and fail entirely in offline environments.
6. WHAT TO DO INSTEAD: If the browser's Web Audio API is muted or disabled by power-saving modes, the app renders visual pulsing ambient aura animations to provide calming feedback.

--------------------------------------------------------------------------------
ADR 5: LOCAL-FIRST SYNCHRONIZATION QUEUE INSTEAD OF ALWAYS-ONLINE REST
--------------------------------------------------------------------------------
1. WHAT: Resilient offline storage layer writing memories and reflections to local `localStorage` and `IndexedDB` immediately, followed by asynchronous background cloud synchronization.
2. HOW: Memory records are saved with client-generated UUIDs, committed to local state instantly, and appended to an offline dispatch queue with exponential retry backoff.
3. WHEN: Triggered on every quest completion, photo snap, and reflection submission.
4. WHY CHOSEN: Real-world experiences often occur in areas with poor cellular reception (hilltops, basements, remote parks, underground transit). Explorers must never lose a memory or photo due to spotty network connectivity.
5. WHY NOT ALWAYS-ONLINE REST: Standard REST architectures block the user interface with loading spinners, fail abruptly on HTTP timeout, and discard memories if the network drops before completion.
6. WHAT TO DO INSTEAD: When the client detects an active internet connection via `window.addEventListener('online')`, the queue drains automatically to `/api/memories/sync`.

--------------------------------------------------------------------------------
ADR 6: CRYPTOGRAPHIC HMAC-SHA256 INVITES INSTEAD OF CENTRALIZED SESSIONS
--------------------------------------------------------------------------------
1. WHAT: Self-contained, tamper-proof co-quest invite URLs containing cryptographically signed payloads.
2. HOW: A Base64Url header and payload signed with server-side HMAC-SHA256. The recipient's client validates the signature and resolves quest parameters directly from the token.
3. WHEN: Generated when an explorer taps "Invite Companion" on any quest card.
4. WHY CHOSEN: Allows instant peer-to-peer sharing via WhatsApp, SMS, or Telegram without requiring database writes prior to invitation, and permits non-registered recipients to preview the quest immediately.
5. WHY NOT CENTRAL DATABASE INVITE ROWS: Database-dependent invite tables accumulate stale orphaned rows from unaccepted links, create unnecessary database write loads, and require recipient authentication before viewing.
6. WHAT TO DO INSTEAD: If a token expires after its 24-hour validity window, the recipient is presented with a fresh candidate quest from the same category with an option to request a new invite.

================================================================================
7. COMPREHENSIVE COMPONENT CATALOG AND DIRECTORY MAP
================================================================================

```
src/
├── components/
│   ├── primitives/
│   │   ├── Badge.tsx           Glassmorphic status badge with mono typography
│   │   ├── Button.tsx          Spring-animated tactile button with haptic triggers
│   │   ├── Card.tsx            Glassmorphic elevated surface with glow auras
│   │   ├── Chip.tsx            Selectable filter chip with spring compression
│   │   ├── Input.tsx           Accessible form input with focus ring transition
│   │   ├── Modal.tsx           Bottom-sheet and centered dialog with spring physics
│   │   ├── QuestCard.tsx       Featured and list quest card with ambient aura
│   │   ├── SectionHeader.tsx   Section title with subtitle and action button
│   │   └── Typography.tsx      Display, heading, and body typography variants
│   ├── screens/
│   │   ├── HomeScreen.tsx      Time greeting, featured quest, quick escapes, world preview
│   │   ├── ExploreScreen.tsx   Searchable 180+ quest directory with category tabs
│   │   ├── MapScreen.tsx       Interactive Leaflet life map with discovery pins
│   │   ├── MemoriesScreen.tsx  Memory timeline, calendar view, recaps, collections
│   │   └── ProfileScreen.tsx   Exploration stats, account security, data management
│   ├── AdminMetricsModal.tsx   Live platform telemetry and MongoDB connectivity
│   ├── CaptureModal.tsx        Camera proof verification and reflection logging
│   ├── Navbar.tsx              Desktop and mobile bottom navigation with spring pop
│   ├── QuestSpinnerModal.tsx   Physics-driven canvas spinning wheel for micro-escapes
│   ├── ShareStoryModal.tsx     1080x1920 HTML5 Canvas Instagram/TikTok story card
│   ├── SoundscapeDrawer.tsx    Web Audio procedural nature sound synthesizer
│   └── VoiceRecorder.tsx       15-second acoustic ambient environmental recorder
├── context/
│   ├── AppStateContext.tsx     Global app state, GPS city resolver, quest registry
│   ├── AuthContext.tsx         Local session state and Firebase Authentication
│   └── CustomAlertContext.tsx  Glassmorphic alert, confirm, and toast provider
├── lib/
│   ├── ai-quest-engine.ts      Astronomical solar calculations and AI synthesis
│   ├── api.ts                  Sanitized REST client for backend gateway
│   └── native-device.ts        Capacitor camera, geolocation, and haptics bridge
├── services/
│   ├── context/
│   │   └── locationService.ts  GPS resolver and OpenStreetMap Nominatim geocoder
│   ├── firebase/
│   │   ├── firebaseAuth.ts     Google Sign-In and anonymous authentication
│   │   └── firebaseStorage.ts  Cloud Storage photo proof upload pipeline
│   └── intelligence/
│       └── diversityEngine.ts  Shannon category entropy anti-repetition engine
└── styles/
    └── index.css               Pure Vanilla CSS design tokens and spring animations
```

================================================================================
8. MASTER QUEST TAXONOMY AND ONTOLOGY (180+ REAL EXPERIENCES)
================================================================================

EXTROVELA includes 180+ curated, non-commercial real-world quests classified into five core life dimensions:

| Dimension | Core Mission | Sample Experiences | Average Duration | Environment |
|---|---|---|:---:|:---:|
| **EXPLORE** | Break geographical routine & observe architecture | Alleyway Wanderer, Top-Floor Viewfinder, Random Bus Ride, Bridge Crossing | 30–60 min | Outdoor |
| **NATURE** | Reconnect with natural rhythms & sky | 15-Minute Cloud Watching, Sunset Hilltop Vista, Creek Meditation, Tree Canopy Gaze | 15–45 min | Outdoor |
| **CREATE** | Multimodal physical & sensory expression | 5-Minute Pen Sketch, Letter to Future Self, 3-Color Photo Challenge, Texture Hunting | 20–40 min | Any |
| **CONNECT** | Authentic micro-interactions with humans | Genuine Barista Compliment, Tea with an Elder, Local Artisan Chat, Silent Shared Walk | 15–30 min | Indoor/Outdoor |
| **REFLECT** | Mental stillness & contemplative presence | Phone-Free Coffee Ritual, Sanctuary Silence, Cemetery History Walk, Rain Observation | 20–45 min | Indoor/Outdoor |

================================================================================
9. MATHEMATICAL FOUNDATIONS & ALGORITHMIC ARCHITECTURE
================================================================================

EXTROVELA is built upon seven rigorous mathematical and algorithmic frameworks that power its astronomical timing, recommendation intelligence, acoustic synthesis, geospatial discovery, motion physics, and cryptography. Below is the detailed breakdown of the WHAT, HOW, WHEN, and WHY for each system.

--------------------------------------------------------------------------------
DOMAIN 1: ASTRONOMICAL SOLAR POSITIONING AND CELESTIAL MECHANICS
--------------------------------------------------------------------------------

1. WHAT:
A zero-dependency celestial calculation engine that computes exact local solar noon, astronomical sunrise, sunset, and golden hour windows for any geographic coordinate on Earth.

2. HOW:
• Solar Declination ($\delta$):
The tilt angle of the Earth relative to the Sun on day $n$ of the year (where $n \in [1, 365]$) is calculated using Spencer's solar declination formula:

$$\delta = 23.45^\circ \cdot \sin\left(\frac{284 + n}{365} \cdot 360^\circ\right)$$

In radians:

$$\delta_{\text{rad}} = \delta \cdot \frac{\pi}{180}$$

• Sunset Hour Angle ($\omega$):
The angular distance the Earth must rotate from solar noon to sunset for latitude $\phi$ is given by:

$$\omega = \arccos\left(-\tan(\phi_{\text{rad}}) \cdot \tan(\delta_{\text{rad}})\right)$$

Converting $\omega$ from radians to degrees:

$$\omega_{\text{deg}} = \omega \cdot \frac{180}{\pi}$$

• Solar Noon and Sunset Hours:
Using the explorer's longitude $\lambda$ and local timezone offset in minutes $T_{\text{offset}}$:

$$\text{Solar Noon (Hours)} = 12.0 - \frac{\lambda}{15^\circ} + \frac{T_{\text{offset}}}{60}$$

$$\text{Sunset Hour} = \text{Solar Noon} + \frac{\omega_{\text{deg}}}{15^\circ}$$

$$\text{Golden Hour Start} = \text{Sunset Hour} - 0.75 \text{ (45 minutes prior)}$$

3. WHEN:
Evaluated on app initialization and whenever quest generation is triggered.

4. WHY:
Enables the app to identify the exact 45-minute window before sunset in any city on Earth without making costly third-party API calls, allowing the engine to promote golden-hour viewpoints precisely when the physical sky is visually breathtaking.

--------------------------------------------------------------------------------
DOMAIN 2: INFORMATION THEORY, SHANNON ENTROPY, AND ANTI-REPETITION
--------------------------------------------------------------------------------

1. WHAT:
A statistical diversity monitoring system that measures the predictability and category concentration of the user's recent experiences.

2. HOW:
Given a sliding window of the user's last $N$ completed memories ($N=10$) across $K$ discrete categories (Explore, Nature, Create, Connect, Reflect):

• Category Probability Mass Function:

$$P(c_i) = \frac{\text{Count of quests in category } c_i}{N}, \quad \sum_{i=1}^{K} P(c_i) = 1$$

• Shannon Category Entropy $H(X)$:

$$H(X) = -\sum_{i=1}^{K} P(c_i) \log_2 P(c_i)$$

• Entropy Normalization:
Maximal entropy occurs under a uniform distribution where $H_{\max} = \log_2(K) = \log_2(5) \approx 2.322 \text{ bits}$. The normalized diversity score is:

$$D = \frac{H(X)}{H_{\max}} \in [0, 1]$$

• Dynamic Category Weight Penalty:
If category $c_i$ exceeds a threshold $P(c_i) \ge 0.40$ (or if $H(X) < 1.25 \text{ bits}$), the candidate generation weight $W(c_i)$ for the dominant category is depressed while under-represented categories $c_j$ receive a diversity boost:

$$W(c_i) = W_0 \cdot \exp\left(-2.5 \cdot P(c_i)\right)$$

$$W(c_j) = W_0 \cdot \left(1.0 + \frac{1.0}{P(c_j) + 0.05}\right)$$

3. WHEN:
Calculated prior to quest candidate filtering whenever Today's Quest or personalized recommendations are generated.

4. WHY:
Prevents behavioral fatigue and routine stagnation. If a user naturally defaults to quiet cafe visits 5 days in a row, the entropy engine detects the monotony and actively nudges them toward a refreshing outdoor hike or creative observation quest.

--------------------------------------------------------------------------------
DOMAIN 3: GEOSPATIAL HAVERSINE AND GEODESIC SPHERICAL DISTANCE
--------------------------------------------------------------------------------

1. WHAT:
Great-circle distance computation between the user's current GPS position and discovery pins or landmark nodes across the spherical surface of Earth.

2. HOW:
For user coordinates $(\phi_1, \lambda_1)$ and target coordinate $(\phi_2, \lambda_2)$ in radians:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$

• Haversine Square Half-Chord:

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$

• Angular Distance in Radians:

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

• Surface Distance in Kilometers (Mean Earth radius $R = 6371.0 \text{ km}$):

$$d = R \cdot c$$

• Proximity Radius Unlock Condition:
A discovery landmark or co-quest pin is unlocked if:

$$d \le 0.150 \text{ km (150 meters)}$$

3. WHEN:
Evaluated on map panning, proximity alerts, and when sorting nearby quests by walking distance.

4. WHY:
Accurately measures physical proximity on a spherical geoid without planar projection distortions, ensuring reliable discovery node unlocks and realistic walking duration estimates.

--------------------------------------------------------------------------------
DOMAIN 4: DIGITAL SIGNAL PROCESSING AND PROCEDURAL ACOUSTIC SYNTHESIS
--------------------------------------------------------------------------------

1. WHAT:
In-memory mathematical synthesis of continuous nature soundscapes (Rain, Ocean, Birds, Wind) via the Web Audio API without loading external audio assets.

2. HOW:
• White Noise Generation:
Uniform random sampling over interval $[-1.0, 1.0]$:

$$x[n] \sim U(-1.0, 1.0)$$

• Pink Noise Voss-McCartney Filter ($1/f$ Spectral Density):
Iterative summation of octave-decimated white noise generators producing a $-3\text{ dB/octave}$ power spectral density roll-off.

• Second-Order Biquad Difference Equations:
Filtering audio buffers through lowpass and bandpass nodes using recursive difference equations:

$$y[n] = b_0 x[n] + b_1 x[n-1] + b_2 x[n-2] - a_1 y[n-1] - a_2 y[n-2]$$

For a lowpass filter with cutoff frequency $f_c = 750\text{ Hz}$ and resonance $Q = 1.2$:

$$\omega_0 = 2\pi \cdot \frac{f_c}{f_s}, \quad \alpha = \frac{\sin(\omega_0)}{2Q}$$

$$b_0 = \frac{1 - \cos(\omega_0)}{2}, \quad b_1 = 1 - \cos(\omega_0), \quad b_2 = \frac{1 - \cos(\omega_0)}{2}$$

$$a_0 = 1 + \alpha, \quad a_1 = -2\cos(\omega_0), \quad a_2 = 1 - \alpha$$

• Ocean Swell Low-Frequency Oscillator (LFO):
A sinusoidal gain multiplier running at frequency $f = 0.08\text{ Hz}$:

$$G(t) = G_0 + A \cdot \sin(2\pi \cdot 0.08 \cdot t)$$

Where $G_0 = 0.25$ and $A = 0.20$, modulating volume between $0.05$ and $0.45$.

3. WHEN:
Runs in an isolated Web Audio processing thread whenever the Soundscape Drawer is active during quest immersion.

4. WHY:
Provides instant, responsive, and infinitely non-repeating acoustic relaxation environments with zero data bandwidth consumption, 0 bytes of network asset downloads, and zero battery drain from media streaming.

--------------------------------------------------------------------------------
DOMAIN 5: PHYSICAL SPRING DYNAMICS AND CUBIC-BEZIER MOTION CALCULUS
--------------------------------------------------------------------------------

1. WHAT:
Mathematical motion curves that give user interface components physical mass, momentum, velocity, and spring overshoot.

2. HOW:
• Cubic-Bezier Parametric Formulation:
A parametric curve $B(t)$ for $t \in [0, 1]$ defined by control points $P_0(0,0), P_1(x_1,y_1), P_2(x_2,y_2), P_3(1,1)$:

$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3$$

• EXTROVELA Spring Motion Coordinates:
• `--ease-spring`: $P_1 = (0.175, 0.885), \quad P_2 = (0.32, 1.22)$
• Peak Overshoot: $y_{\max} = 1.22$ (+22% spring pop expansion before resting at $1.0$).
• Derivative Velocity: At $t=0$, initial acceleration $\frac{dy}{dt} = \frac{3y_1}{3x_1} = \frac{0.885}{0.175} \approx 5.05\text{ units/sec}$.

• Staggered Geometric Time Progression:
For card collections of count $M$, each item $k \in [1, M]$ delays entrance according to an arithmetic progression:

$$\Delta t_k = t_{\text{base}} + (k - 1) \cdot 0.040 \text{ seconds}$$

3. WHEN:
Applied across all interactive cards, bottom navigation tab selection, modal launches, and list renders.

4. WHY:
Emulates physical spring-damper dynamics found in native Apple iOS hardware, making the web interface feel tactile, weighted, and responsive.

--------------------------------------------------------------------------------
DOMAIN 6: CRYPTOGRAPHIC HMAC-SHA256 TOKENIZATION
--------------------------------------------------------------------------------

1. WHAT:
Cryptographic signing and verification of co-quest invitations and user session handoffs.

2. HOW:
• Token Structure:
A URL-safe string structured as:

$$\text{Token} = \text{Base64Url}(\text{Header}) \mathbin{\Vert} "." \mathbin{\Vert} \text{Base64Url}(\text{Payload}) \mathbin{\Vert} "." \mathbin{\Vert} \text{Base64Url}(\text{Signature})$$

• Hash-based Message Authentication Code:

$$\text{HMAC}(K, m) = H\Big((K' \oplus \text{opad}) \mathbin{\Vert} H\big((K' \oplus \text{ipad}) \mathbin{\Vert} m\big)\Big)$$

Where:
• $H$: SHA-256 cryptographic hashing function (256-bit output).
• $K'$: Secret key padded to 64-byte block size.
• $\text{ipad}$: Inner padding byte sequence `0x36` repeated 64 times.
• $\text{opad}$: Outer padding byte sequence `0x5C` repeated 64 times.
• $m$: Concatenated $\text{Header} \mathbin{\Vert} "." \mathbin{\Vert} \text{Payload}$.

• Verification Condition:
The gateway recomputes the signature over the received header and payload using constant-time comparison to prevent timing attacks:

$$\operatorname{crypto.timingSafeEqual}(\text{Signature}_{\text{calc}}, \text{Signature}_{\text{received}}) == \text{true} \quad \land \quad T_{\text{current}} < T_{\text{expiry}}$$

3. WHEN:
Generated when creating co-quest invite URLs and validated when a companion accesses an invite.

4. WHY:
Guarantees tamper-proof peer-to-peer invitation security without exposing database IDs, preventing link spoofing or unauthorized session interception.

--------------------------------------------------------------------------------
DOMAIN 7: DISCRETE GRID AREA COVERAGE AND CITY EXPLORATION GEOMETRY
--------------------------------------------------------------------------------

1. WHAT:
A spatial partitioning algorithm that tracks the percentage of a metropolitan area personally explored by the user.

2. HOW:
• Bounding Box Tessellation:
For a designated city bounding box $[\phi_{\min}, \phi_{\max}] \times [\lambda_{\min}, \lambda_{\max}]$, the territory is partitioned into a discrete matrix of $M \times N$ cells of size $\Delta\phi \approx 0.0045^\circ$ and $\Delta\lambda \approx 0.0055^\circ$ ($\approx 500\text{m} \times 500\text{m}$ grid cells).

• Spatial Hash Mapping:
For any completed experience coordinate $(\phi_m, \lambda_m)$:

$$\operatorname{Row} = \left\lfloor \frac{\phi_m - \phi_{\min}}{\Delta\phi} \right\rfloor, \quad \operatorname{Col} = \left\lfloor \frac{\lambda_m - \lambda_{\min}}{\Delta\lambda} \right\rfloor$$

$$\text{Cell ID} = \operatorname{Row} \times N + \operatorname{Col}$$

• City Exploration Progress Metric:

$$\text{Exploration } \% = \min\left(100.0, \frac{|\text{Set of Unique Visited Cell IDs}|}{\text{Total Habitable Grid Cells in Municipality}} \times 100\right)$$

3. WHEN:
Updated whenever a new memory containing geographic coordinates is saved.

4. WHY:
Provides a transparent, game-like exploration progress metric that incentivizes users to visit diverse neighborhoods across their city rather than repeating the same block.

================================================================================
10. ASTRONOMICAL SOLAR AND CELESTIAL PHYSICS ENGINE
================================================================================

EXTROVELA implements exact astronomical solar positioning algorithms in `src/lib/ai-quest-engine.ts` to schedule golden-hour experiences with zero API overhead.

If the current system clock falls within 45 minutes prior to calculated sunset, the quest engine dynamically promotes sunset viewpoint quests across the Home Screen.

================================================================================
11. WEATHER-ADAPTIVE CONTEXTUAL ENGINE
================================================================================

The application interfaces with the open-access Open-Meteo API (`https://api.open-meteo.com/v1/forecast`) via server-mediated proxies to query real-time meteorological variables:

1. METEOROLOGICAL PARAMETERS MONITORED
• `temperature_2m`: Ambient air temperature in Celsius.
• `relative_humidity_2m`: Atmospheric moisture percentage.
• `precipitation`: Real-time rainfall rate in millimeters per hour.
• `weather_code`: WMO standard weather interpretation codes (0–99).
• `cloud_cover`: Total cloud coverage percentage across the sky dome.

2. ADAPTIVE FILTERING LOGIC
• WMO Codes 51–67 or 80–82 (Rain/Drizzle): Suppresses distant outdoor hikes and automatically highlights rain-friendly experiences (teahouses, library reading, covered veranda observation).
• WMO Code 0 (Clear Skies) + Sunset Window: Promotes high-altitude scenic ridge quests.
• Cloud Cover 30%–70%: Triggers the 15-Minute Cloud Watching meditation quest.

================================================================================
12. PROCEDURAL AMBIENT AUDIO SYNTHESIS ENGINE
================================================================================

In `src/components/SoundscapeDrawer.tsx`, EXTROVELA synthesizes generative soundscapes directly in the browser using the Web Audio API without loading external MP3 audio files:

1. RAIN SYNTHESIZER
• Source: 2-second looped White Noise buffer generated via `Math.random() * 2 - 1`.
• Filtering: `BiquadFilterNode` configured as Lowpass at 750Hz with resonance Q=1.2.
• Dynamics: Random gain modulation producing organic droplet patterns.

2. OCEAN WAVE SWELLS
• Source: Pink noise buffer generated using Voss-McCartney algorithmic filtration.
• Modulation: Low-Frequency Oscillator (LFO) running at 0.08Hz modulating a Master Gain node between 0.05 and 0.45 volume, simulating wave crests and troughs.

3. FOREST BIRDS
• Source: Periodic sine wave bursts (`OscillatorNode`) with fundamental frequencies between 2600Hz and 4800Hz.
• Envelope: Rapid linear attack (8ms) followed by exponential decay (120ms) triggered at Poisson-distributed intervals.

================================================================================
13. HARDWARE MEDIA CAPTURE AND 9:16 CANVAS STORY EXPORTER
================================================================================

1. NATIVE CAMERA BRIDGE
Camera integration utilizes `@capacitor/camera` with `CameraResultType.Uri` and `CameraSource.Prompt`. Photos are downsampled on-device to a maximum width of 1440px with 85% JPEG compression to conserve bandwidth.

2. 15-SECOND ACOUSTIC MEDIARECORDER
Voice and environmental notes utilize `navigator.mediaDevices.getUserMedia({ audio: true })`. Audio streams are encoded into `audio/webm;codecs=opus` (or `audio/mp4` on iOS Safari) and capped at exactly 15 seconds with a visual circular progress timer.

3. 1080x1920 HTML5 CANVAS STORY PIPELINE
In `src/components/ShareStoryModal.tsx`, social story cards are generated in-memory:
1. High-resolution canvas initialized at exactly 1080px by 1920px.
2. The user's photo is drawn with center-crop aspect fill.
3. A multi-stop linear gradient (`rgba(0,0,0,0)` to `rgba(8,9,13,0.92)`) is composited over the bottom half.
4. Editorial typography is rendered with the quest title, date, city, and reflection text.
5. The EXTROVELA brand watermark and a discovery QR code are rendered at the footer.
6. The canvas is exported as a PNG Blob and shared via `navigator.share({ files })`.

================================================================================
14. GEOLOCATION, REVERSE GEOCODING, AND PRIVACY ENGINE
================================================================================

1. GPS RESOLUTION LIFECYCLE
Location discovery is handled by `LocationService` in `src/services/context/locationService.ts`:
• Primary: `@capacitor/geolocation` on iOS and Android native containers.
• Fallback: Browser `navigator.geolocation.getCurrentPosition` with an 8-second timeout.

2. OPENSTREETMAP NOMINATIM REVERSE GEOCODING
Coordinates are dispatched to OpenStreetMap Nominatim with an HTTP Accept-Language header set to English:
`https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}`
The response parses `address.city || address.town || address.village || address.suburb` to determine the user's active municipality anywhere on Earth.

3. PRIVACY FUZZING FOR AI AND ANALYTICS
Exact coordinates are strictly protected under EXTROVELA privacy policies:
• Raw GPS coordinates are stored only in local device storage.
• Outbound requests to AI generation gateways receive only the broad city name and general district (e.g., "Tokyo Central District"). Exact lat/long pairs are stripped.

================================================================================
15. LEAFLET LIFE MAP AND DISCOVERY GRID SYSTEM
================================================================================

The interactive world map in `src/components/screens/MapScreen.tsx` utilizes Leaflet with custom dark-themed CartoDB tile layers (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`).

1. MEMORY PINS
Every completed experience with geographical coordinates renders as an animated glowing pin colored by category (Lime for Explore, Cyan for Nature, Gold for Connect, Purple for Reflect, Coral for Create). Tapping a pin opens the full memory card.

2. DISCOVERY POINTS
Unvisited landmarks and suggested starting points appear as pulsing hollow rings, inviting the explorer to walk into proximity to unlock the location.

================================================================================
16. ANTI-REPETITION AND CATEGORY ENTROPY ALGORITHM
================================================================================

To avoid behavioral boredom, `src/services/intelligence/diversityEngine.ts` implements Shannon Entropy scoring over the user's previous $N$ completed memories.

If the entropy score $H$ falls below 1.25 (indicating severe concentration in one category), the quest ranking engine applies a dynamic penalty factor to the dominant category and boosts opposing categories by 2.5x.

================================================================================
17. CO-QUESTS, CRYPTOGRAPHIC INVITES, AND SOCIAL LOOPS
================================================================================

1. TOKEN GENERATION (HMAC-SHA256)
When a user taps "Invite Companion", the backend gateway creates a 24-hour cryptographic invite token containing `inviteId`, `hostUserId`, `questId`, and `expiryTimestamp`.

2. PEER SYNCHRONIZATION
When a recipient opens the link, the token signature is verified. The companion joins the group session, and both users receive live completion confirmations upon verification.

================================================================================
18. EMIL KOWALSKI AND APPLE SPRING MOTION DESIGN SYSTEM
================================================================================

EXTROVELA's motion physics in `src/styles/index.css` adhere to modern design engineering standards:

1. SPRING EASING CONSTANTS
• `--ease-spring`: `cubic-bezier(0.175, 0.885, 0.32, 1.22)` (Used for button releases, tab icon pops, and dialog opens)
• `--ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)` (Used for screen mount transitions)
• `--ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)` (Used for iOS-style bottom sheets)

2. GPU ACCELERATION
All animations transform strictly via `transform` and `opacity` properties, utilizing `will-change: transform` to bypass browser layout reflows and guarantee 60fps / 120fps performance on high-refresh mobile screens.

3. TACTILE TAP COMPRESSION
All interactive cards and buttons compress subtly to `scale(0.97)` on `:active` touch, providing immediate physical feedback.

================================================================================
19. GLASSMORPHIC ALERT AND TOAST SYSTEM
================================================================================

All alert and confirmation interactions are managed through `src/context/CustomAlertContext.tsx`:
• `showAlert({ title, message, type })`: Renders an animated modal dialog with custom icons and haptics.
• `showConfirm({ title, message, confirmText, cancelText })`: Returns an asynchronous Promise resolving to boolean `true` or `false`.
• `showToast({ message, type })`: Displays a transient bottom-anchored notification with auto-dismissal after 3 seconds.

================================================================================
20. COMPLETE REST API SPECIFICATION
================================================================================

### QUEST ENDPOINTS
```http
GET /api/quests
Query Parameters:
  category (optional): string ("Explore" | "Nature" | "Create" | "Connect" | "Reflect")
  city (optional): string
Response (200 OK):
  { "quests": [ { "id": "q_1", "title": "...", "category": "...", "time": "..." } ] }

POST /api/quests/generate-ai
Headers: Content-Type: application/json
Body:
  {
    "time": "30 min",
    "energy": "Medium",
    "mood": "Seeking Inspiration",
    "budget": "Free",
    "environment": "Outdoor",
    "city": "Tokyo",
    "season": "Summer"
  }
Response (200 OK):
  { "quests": [ ... 3 customized quest objects ... ] }
```

### MEMORY AND JOURNAL ENDPOINTS
```http
GET /api/memories?userId={userId}
Response (200 OK):
  { "memories": [ { "id": "mem_1", "questTitle": "...", "rating": 5, "completedAt": "..." } ] }

POST /api/memories
Body:
  {
    "userId": "user_123",
    "questId": "q_cloud_watching",
    "questTitle": "15-Minute Sky Gazing",
    "rating": 5,
    "moodRating": 5,
    "mood": "calm",
    "reflectionText": "Watching clouds over the river.",
    "photoUrl": "https://...",
    "audioUrl": "https://...",
    "location": { "city": "London", "lat": 51.5074, "lng": -0.1278, "placeName": "Thames Path" }
  }
Response (201 Created):
  { "success": true, "memory": { ... } }

POST /api/memories/sync
Body:
  { "memories": [ ... array of offline recorded memories ... ] }
Response (200 OK):
  { "syncedCount": 3, "success": true }
```

### STATS AND METRICS ENDPOINTS
```http
GET /api/stats?userId={userId}
Response (200 OK):
  {
    "stats": {
      "totalExperiencesCompleted": 14,
      "currentStreakDays": 5,
      "cityExplorationPercent": 18,
      "uniqueLocationsVisited": 12,
      "outdoorRatioPercent": 75
    }
  }

GET /api/admin/metrics
Headers: Authorization: Bearer {ADMIN_SECRET_KEY}
Response (200 OK):
  { "activeSessions": 42, "totalMemories": 1240, "dbStatus": "connected" }
```

================================================================================
21. MONGODB AND FIRESTORE DATABASE MODELS
================================================================================

### MONGODB MEMORY SCHEMA (`server/models/Memory.js`)
```javascript
const MemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  questId: { type: String, required: true },
  questTitle: { type: String, required: true },
  completedAt: { type: Date, default: Date.now, index: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  moodRating: { type: Number, min: 1, max: 5, default: 5 },
  mood: { type: String, enum: ['calm', 'inspired', 'energized', 'reflective'], default: 'calm' },
  reflectionText: { type: String, default: '' },
  photoUrl: { type: String, default: null },
  audioUrl: { type: String, default: null },
  location: {
    city: { type: String, default: 'Kathmandu' },
    neighborhood: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    placeName: { type: String, default: 'Discovery Site' }
  },
  isFavorite: { type: Boolean, default: false },
  isFirstTimeExperience: { type: Boolean, default: false },
  tags: [{ type: String }]
}, { timestamps: true });
```

================================================================================
22. SECURITY RULES AND PERMISSION MATRICES
================================================================================

1. FIRESTORE SECURITY RULES (`firestore.rules`)
• User Profiles: Users can read and write only documents where `request.auth.uid == userId`.
• Memories Collection: Read access permitted to author; public access permitted only if `resource.data.visibility == 'public'`.
• Admin Operations: Blocked unless `request.auth.token.admin == true`.

2. CLOUD STORAGE RULES (`storage.rules`)
• Photo Uploads: Path restricted to `/users/{userId}/photos/{photoId}`. Maximum file size 10MB. MIME type must match `image/*`.
• Audio Uploads: Path restricted to `/users/{userId}/audio/{audioId}`. Maximum file size 5MB. MIME type must match `audio/*`.

================================================================================
23. OFFLINE-FIRST SYNCHRONIZATION PROTOCOL
================================================================================

1. PERSISTENCE ENGINE
When network connectivity is unavailable, EXTROVELA writes memories to `localStorage` under key `extrovela_memories` and enqueues sync tasks in `extrovela_offline_queue`.

2. AUTO-RECONNECTION RECOVERY
The client registers an event listener for `window.addEventListener('online', syncOfflineMemories)`. Upon network reconnection, queued memories are dispatched to `/api/memories/sync` via POST and cleared upon HTTP 200 confirmation.

================================================================================
24. DEVELOPER ONBOARDING AND ENVIRONMENT CONFIGURATION
================================================================================

### PREREQUISITES
• Node.js: Version 18.0.0 or higher
• npm: Version 9.0.0 or higher

### STEP 1: REPOSITORY SETUP
```bash
git clone https://github.com/susantedit/Extrovela.git
cd Extrovela
npm install
cd server && npm install && cd ..
```

### STEP 2: ENVIRONMENT CONFIGURATION
Create `.env` in the project root:
```env
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_ANALYTICS=true
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Create `server/.env` in the server directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/extrovela
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,capacitor://localhost
ADMIN_SECRET_KEY=extrovela_dev_secret_key_2026
GEMINI_API_KEY=your_gemini_api_key
```

### STEP 3: STARTING LOCAL DEVELOPMENT
```bash
# Terminal 1: Backend Gateway
node server/server.js

# Terminal 2: Client Web Application
npm run dev
```

================================================================================
25. CAPACITOR NATIVE MOBILE COMPILATION GUIDE
================================================================================

```bash
# 1. Compile production TypeScript and bundle assets
npm run build

# 2. Synchronize native Android and iOS containers
npx cap sync

# 3. Open Android Studio to build APK or AAB
npx cap open android

# 4. Open Xcode for iOS compilation (macOS required)
npx cap open ios
```

================================================================================
26. COMPLETE FOURTEEN PHASE ENGINEERING HISTORY
================================================================================

PHASE 1: Core Foundation & Pure CSS Tokens
Established React 18, Vite, and dark design system tokens without Tailwind dependency.

PHASE 2: Atomic Primitives
Constructed Button, Card, Badge, Modal, Typography, and Input primitives.

PHASE 3: Master Quest Database
Generated 180+ curated, non-commercial real-world quests.

PHASE 4: Interactive Leaflet Life Map
Implemented Leaflet map viewport, custom pin rendering, and discovery node placement.

PHASE 5: Multimodal Memory Journal
Constructed camera capture, reflection forms, and timeline grouping.

PHASE 6: Location Privacy & Geocoding
Built LocationService with OpenStreetMap Nominatim reverse geocoding.

PHASE 7: Astronomical Solar Engine
Engineered celestial solar declination formulas for sunset calculations.

PHASE 8: Procedural Web Audio Soundscapes
Synthesized real-time rain, ocean, wind, and birdsong ambiance.

PHASE 9: 15-Second Ambient Voice Recorder
Built native MediaRecorder audio pipeline for environmental audio capture.

PHASE 10: 9:16 Story Canvas Exporter
Constructed HTML5 Canvas 1080x1920 social story generator.

PHASE 11: AI Experience Intelligence
Built Gemini 1.5 Pro proxy, candidate scoring, and diversity engines.

PHASE 12: Social Loops & Co-Quests
Implemented HMAC-SHA256 signed invite tokens and shared group questing.

PHASE 13: Real-World Weather Provider
Integrated Open-Meteo API for real-time weather-adaptive quest filtering.

PHASE 14: Spring Motion & Security Hardening
Implemented Emil Kowalski spring animations, custom alert provider, and complete pre-push security audit.

================================================================================
27. PRE-PUSH DEFENSIVE SECURITY AUDIT REPORT
================================================================================

• Secrets and Keys: Zero private API keys committed. All `.env` files protected by `.gitignore`.
• Dependency Vulnerabilities: Audited with `npm audit --omit=dev` — 0 vulnerabilities found.
• XSS Safeguards: Zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, or `eval()`.
• URL Sanitization: All query parameters encoded with `encodeURIComponent`.
• Server Security: CORS origin allowlist, rate limiting, and admin route authorization enforced.
• Apple Guideline 5.1.1: Complete account deletion, cache clearing, and data export available.

================================================================================
28. DOCUMENTATION SITEMAP AND REPOSITORY INDEX
================================================================================

1. [Architecture and Standards Guide](docs/ARCHITECTURE.md)
2. [Environment Configuration and Secrets](docs/ENVIRONMENT.md)
3. [Backend Gateway and MongoDB Architecture](docs/BACKEND.md)
4. [Firebase Setup, Rules, and Analytics](docs/FIREBASE_SETUP.md)
5. [Cloud Firestore Schema Definitions](docs/FIRESTORE_SCHEMA.md)
6. [AI Cost Control and Token Budgets](docs/COST_CONTROL.md)
7. [Security Policies and Privacy Engine](docs/SECURITY.md)
8. [Phase 11 Experience Intelligence Report](docs/PHASE_11_REPORT.md)
9. [Phase 12 Social Loops and Co-Quests](docs/PHASE_12_REPORT.md)
10. [Master 21-Area Integration Audit](docs/MASTER_INTEGRATION_AUDIT.md)

================================================================================
29. LICENSE AND CREDITS
================================================================================

EXTROVELA is open-source software licensed under the MIT License.

Built with dedication for real-world explorers by Susant.
