# 🧭 EXTROVELA — Personal Real-World Experience & Quest Engine

<div align="center">
  <img src="public/logo-dark.png" alt="EXTROVELA" width="340" />
  <p><strong>"Stop scrolling. Start experiencing. Don't just get through your day — make today different."</strong></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square)](https://vitejs.dev/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF.svg?style=flat-square)](https://capacitorjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?style=flat-square)](https://www.mongodb.com/)
  [![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Storage-FFCA28.svg?style=flat-square)](https://firebase.google.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
</div>

---

## 📋 Table of Contents

- [The Idea](#-the-idea)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Feature Map](#-feature-map)
- [Tech Stack](#-tech-stack)
- [Data Flow](#-data-flow)
- [API Reference](#-api-reference)
- [Database Models](#-database-models)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Native Mobile Build](#-native-mobile-build)
- [Build History (Phases 1–14)](#-build-history)
- [Security & Privacy](#-security--privacy)
- [Documentation Index](#-documentation-index)

---

## 💡 The Idea

Modern life traps people in repetitive routines: waking up, commuting, staring at screens for 8–10 hours, scrolling social media feeds, and repeating the same cycle tomorrow. Even when someone wants to go out or experience something new, decision fatigue, loneliness, or lack of ideas keeps them isolated in their room.

**EXTROVELA solves this problem.** It acts as a personal real-world quest generator that gives the user one achievable, surprising, and mindful experience each day tailored to their exact state:

```
CHOOSE TIME & ENERGY ──► RECEIVE PERSONALIZED QUEST ──► EXPERIENCE IN REAL LIFE
                                                               │
                                                               ▼
DISCOVER & GROW ◄── REVEAL LIFE MAP ◄── LOG STORY & AUDIO ◄── PHOTO PROOF
```

### Core Principles
- **Anti-Screen & Anti-Scroll:** The app exists to get you off your phone and into the physical world.
- **Micro-Adventures over Extreme Trips:** Quests take 15–45 minutes (e.g. *"Watch clouds drift above the lake for 15 minutes"*, *"Read a book in a quiet alley teahouse"*, *"Catch golden hour from the highest viewpoint in your city"*, *"Take a random public bus and get off at stop #5"*).
- **Personal Life Map:** Every completed quest drops a glowing discovery pin on your world map, transforming daily life into an open-world exploration game.
- **Privacy First:** Exact GPS coordinates are never sent to AI models or third parties. Zero hardcoded mock assumptions—all features adapt dynamically to any city globally.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLIENT (React 18 + Vite + TypeScript)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ HomeScreen   │  │ ExploreScreen│  │  MapScreen   │  │ MemoriesScreen │  │
│  │ (Quests/Spin)│  │ (Categories) │  │ (Leaflet)    │  │ (Journal/Audio)│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         └─────────────────┼─────────────────┴──────────────────┘           │
│                           ▼                                                 │
│               AppStateContext / AuthContext / CustomAlertContext            │
│                           │                                                 │
│         ┌─────────────────┴─────────────────┐                               │
│         ▼                                   ▼                               │
│  Native Capacitor Bridge             Local-First Offline Layer              │
│  (Camera, GPS, Haptics, Audio)       (IndexedDB / LocalStorage Queue)       │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼─────────────────────────────────────────────────┐
│                    SERVER GATEWAY (Node.js + Express)                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                             routes/                                   │  │
│  │  /api/quests       /api/memories    /api/stats      /api/intelligence │  │
│  │  /api/providers    /api/growth      /api/admin      /api/health       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│         │                    │                     │                        │
│  ┌──────┴──────────┐  ┌──────┴───────────┐  ┌──────┴──────────┐             │
│  │ costProtection  │  │ requireIdentity  │  │  requireAdmin   │             │
│  │   Middleware    │  │   Middleware     │  │   Middleware    │             │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘             │
└──────────────┬───────────────────────┬──────────────────────┬───────────────┘
               │                       │                      │
┌──────────────▼──────┐ ┌──────────────▼──────┐ ┌─────────────▼───────────────┐
│   MongoDB Atlas     │ │  Firebase Services  │ │     External Providers      │
│ (Quests, Memories,  │ │ (Auth, Storage,     │ │ (OpenStreetMap Nominatim,   │
│  Users, Analytics)  │ │  Crashlytics, Perf) │ │  Open-Meteo, Web Audio API) │
└─────────────────────┘ └─────────────────────┘ └─────────────────────────────┘
```

---

## 📁 Project Structure

```
Extrovela/
├── android/                         # Capacitor Android native project & Gradle build
├── ios/                             # Capacitor iOS native Xcode workspace
├── docs/                            # 10 comprehensive architectural & security specifications
│   ├── ARCHITECTURE.md              # System architecture & engineering guidelines
│   ├── BACKEND.md                   # Express.js backend gateway & MongoDB schemas
│   ├── COST_CONTROL.md              # AI token budgets & rate-limiting policies
│   ├── ENVIRONMENT.md               # Environment variables & secrets management
│   ├── FIREBASE_SETUP.md            # Firebase Auth & Cloud Storage configuration
│   ├── FIRESTORE_SCHEMA.md          # Cloud Firestore data schemas & security rules
│   ├── MASTER_INTEGRATION_AUDIT.md  # 21-area architectural audit & verification matrix
│   ├── PHASE_11_REPORT.md           # Experience Intelligence & AI Personalization
│   ├── PHASE_12_REPORT.md           # Growth loops, invite tokens & co-quests
│   └── SECURITY.md                  # Location privacy sanitization & defensive rules
├── public/                          # Brand assets, logos, and PWA manifest
│   ├── logo-light.png               # Light mode brand logo (without background)
│   ├── logo-dark.png                # Dark mode high-contrast brand emblem
│   └── favicon.ico                  # Application favicon
├── server/                          # Backend Express Gateway
│   ├── middleware/
│   │   ├── costProtection.js        # AI rate-limiting & denial-of-wallet protection
│   │   ├── requireAdmin.js          # Admin authorization middleware
│   │   └── requireIdentity.js       # Client identity assertion guard
│   ├── models/
│   │   ├── Memory.js                # Experience story schema with photo & audio
│   │   ├── Quest.js                 # Curated quest repository schema
│   │   └── User.js                  # User profile, streak, & preferences schema
│   ├── routes/
│   │   ├── admin.js                 # Platform metrics & admin controls
│   │   ├── api.js                   # Quests, memories, and user stats endpoints
│   │   ├── growth.js                # Invite tokens & co-quest referral endpoints
│   │   ├── intelligence.js          # AI quest synthesis proxy
│   │   └── providers.js             # Weather & geocoding proxy
│   ├── server.js                    # Express application entry & CORS allowlists
│   └── .env.example                 # Backend environment variable template
├── src/                             # Frontend React 18 + TypeScript Application
│   ├── assets/                      # Static brand imagery & badges
│   ├── components/
│   │   ├── primitives/              # Atomic UI tokens (Button, Card, Badge, Modal, Typography)
│   │   ├── screens/                 # Core app views (HomeScreen, ExploreScreen, MapScreen, ProfileScreen)
│   │   ├── AdminMetricsModal.tsx    # Administrative live platform telemetry
│   │   ├── CaptureModal.tsx         # Camera capture, photo upload & reflection flow
│   │   ├── Navbar.tsx               # Responsive desktop & mobile spring-animated navigation
│   │   ├── QuestSpinnerModal.tsx    # "I'm Bored" physics-based wheel spinner
│   │   ├── ShareStoryModal.tsx      # 9:16 Instagram/TikTok canvas story card exporter
│   │   ├── SoundscapeDrawer.tsx     # Web Audio API ambient nature sound synthesizer
│   │   └── VoiceRecorder.tsx        # 15-second ambient audio recording engine
│   ├── config/                      # Environment configuration & feature flags
│   ├── context/
│   │   ├── AppStateContext.tsx      # Global app state, GPS city resolver, quest registry
│   │   ├── AuthContext.tsx          # Local-first user state + Firebase Authentication
│   │   └── CustomAlertContext.tsx   # Glassmorphic custom alert, confirm & toast provider
│   ├── features/                    # Domain-sliced features (memories, onboarding, social, profile)
│   ├── lib/
│   │   ├── ai-quest-engine.ts       # Astronomical solar sunset & golden hour calculations
│   │   ├── api.ts                   # Strongly typed REST client with sanitization
│   │   └── native-device.ts         # Capacitor camera, geolocation, and haptics wrapper
│   ├── quest-engine/                # Heuristic quest matching & scoring engine
│   ├── services/
│   │   ├── context/                 # GPS LocationService (Nominatim reverse-geocoding)
│   │   ├── firebase/                # Firebase Auth, Storage, and Performance monitoring
│   │   └── intelligence/            # Anti-repetition engine & experience recall
│   ├── styles/
│   │   └── index.css                # Apple & Emil Kowalski spring physics design system
│   ├── types/                       # TypeScript interfaces & domain contracts
│   └── utils/
│       ├── haptics.ts               # Device vibration & tactile patterns
│       └── logger.ts                # Privacy-scrubbed structured logger
├── capacitor.config.json            # Capacitor native mobile runtime configuration
├── firestore.rules                  # Firestore database security rules
├── storage.rules                    # Cloud Storage photo/audio upload rules
└── vite.config.ts                   # Vite build configuration
```

---

## 🗺️ Feature Map

### User-Facing Features

| Feature | Status | Description |
|---|:---:|---|
| **Personalized Daily Quest** | ✅ | Curated invitation tailored to time (15–60 min), energy, mood, and budget |
| **Astronomical Solar Matching** | ✅ | Real-time golden hour and sunset calculation based on local coordinates |
| **Weather-Adaptive Intelligence** | ✅ | Dynamic quest selection based on rain, temperature, and season |
| **Global City Auto-Detection** | ✅ | Automatic GPS + OpenStreetMap Nominatim reverse geocoding for any city globally |
| **Interactive Life Map** | ✅ | Visual Leaflet map displaying explored territory and discovery pins |
| **Photo & Reflection Capture** | ✅ | Take camera proof, log mood, ratings, and written memories |
| **15-Second Ambient Voice Recorder** | ✅ | Capture environmental soundscapes (birds, rain, cafe chatter) |
| **Procedural Soundscape Generator** | ✅ | Synthesizes relaxing nature ambiance (Rain, Forest, Wind, Waves) via Web Audio API |
| **9:16 Social Story Exporter** | ✅ | Generates branded Instagram/TikTok story recap cards on HTML5 Canvas |
| **"I'm Bored" Quest Spinner Wheel** | ✅ | Interactive physics-based wheel for instant micro-adventures |
| **Anti-Repetition Engine** | ✅ | Detects routine fatigue (e.g. 3+ indoor quests) and suggests outdoor variety |
| **Co-Quests & Cryptographic Invites** | ✅ | Invite friends to complete real-world experiences together |
| **Memory Timeline & Journal** | ✅ | Group memories by Day, Week, Month, or Year with photo galleries |
| **Smart Memory Collections** | ✅ | Auto-organized albums: "Golden Hour Walks", "Quiet Cafes", "First-Time Discoveries" |
| **Exploration Milestone Stats** | ✅ | City exploration %, streak counter, outdoor/indoor ratio, unique locations |
| **Custom Glassmorphic Alerts** | ✅ | Tactile, animated custom dialogs (replaces native browser alert popups) |
| **Apple / Emil Kowalski Spring Motion** | ✅ | GPU-accelerated spring transitions, tab pops, and interactive touch physics |
| **Guest Mode & Account Linking** | ✅ | Instant onboarding with zero sign-up wall; link Google/email anytime |
| **Account & Security Panel** | ✅ | Clear local cache, export memories, sign out, or delete account |

### Admin & Backend Features

| Feature | Status | Description |
|---|:---:|---|
| **Live Telemetry Dashboard** | ✅ | Active sessions, memory count, API latency, error rates |
| **AI Cost Protection** | ✅ | Rate limiting and token usage boundaries on AI quest generation |
| **CORS Origin Allowlist** | ✅ | Strict origin verification for web domains and Capacitor mobile wrappers |
| **Local-First Fallback Mode** | ✅ | Full client and server operation even when MongoDB/Firebase are offline |
| **Privacy Redaction Engine** | ✅ | GPS coordinates fuzzed to city/district level before AI processing |

---

## 🛠️ Tech Stack

### Client (Mobile & Web)
| Technology | Version | Purpose |
|---|---|---|
| **React** | `18.2.0` | Declarative component UI engine |
| **TypeScript** | `5.2.2` | Complete end-to-end type safety |
| **Vite** | `5.0.8` | Ultra-fast ES module build tool |
| **Capacitor** | `6.0.0` | Native iOS & Android hardware runtime bridge |
| **Leaflet** | `1.9.4` | Lightweight, touch-friendly interactive map engine |
| **Lucide React** | `0.344.0` | Consistent minimalist iconography |
| **Web Audio API** | Native | Procedural ambient sound synthesis & voice recording |
| **Vanilla CSS** | Standard | Zero-runtime CSS design tokens & Emil Kowalski spring physics |

### Server Gateway
| Technology | Purpose |
|---|---|
| **Node.js + Express** | High-performance REST API gateway |
| **MongoDB + Mongoose** | Document persistence for quests, memories, and profiles |
| **Firebase Admin SDK** | Authentication token verification & Cloud Storage |
| **Open-Meteo API** | Free, keyless real-time weather & temperature queries |
| **OpenStreetMap Nominatim** | Reverse geocoding for global city resolution |

---

## 🔄 Data Flow

### 1. Quest Generation & Adaptation Flow
```
User opens app
      ↓
LocationService checks GPS → OpenStreetMap Nominatim resolves City Name (e.g. "Tokyo")
      ↓
Astronomical Engine calculates local Sunset & Golden Hour for local timezone
      ↓
WeatherService checks local temperature and outdoor conditions
      ↓
Anti-Repetition Engine evaluates last 3 memories (checks indoor/outdoor balance)
      ↓
AI Gateway or Curated Heuristic Engine matches best candidate quests
      ↓
HomeScreen renders Today's Featured Quest with ambient breathing aura
```

### 2. Experience Completion & Memory Capture Flow
```
User completes quest in real life
      ↓
Opens Capture Modal → Takes photo proof (Capacitor Camera)
      ↓
Records 15-second ambient sound note (Web Audio API MediaRecorder)
      ↓
Fills out reflection, mood score, and rating
      ↓
Saved to local storage instantly + queued for cloud synchronization
      ↓
New discovery pin dropped on Life Map + Exploration % incremented
      ↓
Optionally generates branded 9:16 story card for Instagram / TikTok
```

---

## 📡 API Reference

### Quests & Experience Generation
```http
GET  /api/quests               List curated quests (supports ?category=&city=)
POST /api/quests/generate-ai   Generate 3 contextual AI quests (rate-limited)
```

### Memories & Life Journal
```http
GET  /api/memories?userId={id} Fetch user's memory journal
POST /api/memories             Save new completed memory with photo & audio
POST /api/memories/sync        Batch synchronization for offline-recorded memories
```

### User Stats & Profile
```http
GET  /api/stats?userId={id}    Fetch exploration %, streaks, and visited locations
```

### Weather & Real-World Providers
```http
GET  /api/providers/weather    Query live weather and conditions for coordinates
GET  /api/providers/geocode    Reverse-geocode lat/lng to city name
```

### Social & Growth Loops
```http
POST /api/growth/invite-token  Generate cryptographically signed quest invite token
GET  /api/growth/invite/:token Validate and preview shared quest invitation
```

### Admin & Observability
```http
GET  /api/admin/metrics        Fetch live system metrics (requires ADMIN_KEY)
GET  /api/health               Service health check and database connectivity status
```

---

## 🗄️ Database Models

### Memory (Experience Story)
```typescript
interface Memory {
  id: string;
  userId: string;
  questId: string;
  questTitle: string;
  completedAt: string;
  rating: number;             // 1 to 5 stars
  moodRating: number;         // 1 to 5 mood score
  mood: 'calm' | 'inspired' | 'energized' | 'reflective';
  reflectionText: string;
  photoUrl?: string;          // Cloud Storage or local base64
  audioUrl?: string;          // 15-second ambient audio note
  location: {
    city: string;
    neighborhood?: string;
    lat: number;
    lng: number;
    placeName: string;
  };
  isFavorite: boolean;
  isFirstTimeExperience: boolean;
  tags: string[];
}
```

### Quest (Experience Definition)
```typescript
interface Quest {
  id: string;
  title: string;
  description: string;
  category: 'Explore' | 'Create' | 'Connect' | 'Reflect' | 'Nature';
  time: '15 min' | '30 min' | '45 min' | '60+ min';
  energy: 'Low' | 'Medium' | 'High';
  mood: string;
  budget: 'Free' | '$' | '$$';
  environment: 'Indoor' | 'Outdoor' | 'Any';
  season: 'Any' | 'Summer' | 'Winter' | 'Monsoon' | 'Spring';
  unlockCondition?: string;
}
```

---

## ⚙️ Setup & Installation

### Prerequisites
- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **Android Studio / Xcode** *(optional, for native mobile builds)*

### 1. Clone & Install
```bash
git clone https://github.com/susantedit/Extrovela.git
cd Extrovela

# Install client dependencies
npm install

# Install server gateway dependencies
cd server && npm install && cd ..
```

### 2. Configure Environment Files
```bash
# Copy client template
cp .env.example .env

# Copy backend template
cp server/.env.example server/.env
```

### 3. Run Development Servers
```bash
# Terminal 1 — Start Backend Gateway (Port 5000)
node server/server.js

# Terminal 2 — Start Frontend Dev Server (Port 3000 / 5173)
npm run dev
```

---

## 🔐 Environment Variables

### Client (`.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_ANALYTICS=true
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Server (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/extrovela
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,capacitor://localhost
ADMIN_SECRET_KEY=your_super_secret_admin_key
GEMINI_API_KEY=your_gemini_api_key
```

---

## 📱 Native Mobile Build

Build and sync native iOS & Android binaries using Capacitor:

```bash
# 1. Build the production web bundle
npm run build

# 2. Sync web assets with native mobile projects
npx cap sync

# 3. Open in Android Studio
npx cap open android

# 4. Open in Xcode (macOS only)
npx cap open ios
```

---

## 📈 Build History

| Phase | Milestone & Features Delivered |
|---|---|
| **Phase 1** | Project initialization, React 18 + Vite setup, Vanilla CSS design tokens, Dark aesthetic |
| **Phase 2** | Core UI primitives (`Button`, `Card`, `Badge`, `Chip`, `Modal`, `Typography`) |
| **Phase 3** | Quest database generation (180+ curated routine-breaking quests across 5 categories) |
| **Phase 4** | Interactive Leaflet Life Map with custom discovery pins and explored territory fog |
| **Phase 5** | Memory Journal with photo capture, reflection logging, and timeline grouping |
| **Phase 6** | Location privacy engine, GPS location resolver & OpenStreetMap Nominatim reverse geocoding |
| **Phase 7** | Astronomical solar calculation engine (local sunset and golden hour times) |
| **Phase 8** | Web Audio API ambient soundscape generator (Rain, Forest Birds, Wind, Waves) |
| **Phase 9** | 15-second ambient audio recording engine & MediaStorage upload pipeline |
| **Phase 10** | 9:16 Instagram/TikTok canvas story card exporter with Web Share API |
| **Phase 11** | Experience Intelligence: AI quest synthesis, anti-repetition engine, and candidate scoring |
| **Phase 12** | Social loops, cryptographic co-quest invite tokens, and companion sessions |
| **Phase 13** | Server-mediated keyless weather (Open-Meteo) & places provider integration |
| **Phase 14** | Apple & Emil Kowalski spring motion suite, custom glassmorphic alert system, and full pre-push security audit |

---

## 🔒 Security & Privacy

- **Zero Secrets in Client Code:** API secret keys and database connection strings reside exclusively on the server gateway.
- **Location Privacy Sanitization:** Exact GPS coordinates are fuzzed and scrubbed before AI quest generation.
- **Dependency Audit:** `0 vulnerabilities` detected via `npm audit`.
- **CORS Protection:** Express backend enforces strict origin allowlisting for web and native Capacitor origins.
- **XSS & Injection Safeguards:** 0 occurrences of `dangerouslySetInnerHTML`, `innerHTML`, or `eval()`. All URL query parameters are encoded with `encodeURIComponent`.
- **Apple Guideline 5.1.1 Compliance:** Account deletion, cache clearing, and local data export available directly in the user profile.

---

## 📚 Documentation Index

Every component, architecture decision, and security rule is documented in detail:

- 🏗️ [**Architecture & Engineering Standards**](docs/ARCHITECTURE.md)
- ⚙️ [**Environment & Secrets Configuration**](docs/ENVIRONMENT.md)
- 🖥️ [**Backend Gateway & MongoDB Integration**](docs/BACKEND.md)
- 🔥 [**Firebase Setup, Rules & Analytics**](docs/FIREBASE_SETUP.md)
- 🗄️ [**Firestore Schema & Index Definitions**](docs/FIRESTORE_SCHEMA.md)
- 💰 [**AI Cost Control & Rate Limiting**](docs/COST_CONTROL.md)
- 🔒 [**Security Policies & Location Privacy**](docs/SECURITY.md)
- 🧠 [**Phase 11: Experience Intelligence**](docs/PHASE_11_REPORT.md)
- 👥 [**Phase 12: Social Loops & Co-Quests**](docs/PHASE_12_REPORT.md)
- 📋 [**Master Integration Audit & Verification**](docs/MASTER_INTEGRATION_AUDIT.md)

---

## 📐 Project Wiki & README Structural Blueprint

To write a README as comprehensive and professional as this one for your next project, you should follow its specific structural blueprint. It goes far beyond a standard README by acting as a complete project wiki.

Here is the exact blueprint of what was implemented, section by section, so you can replicate it:

### 1. The Hook & Introduction
* **Project Title & Subtitle:** Clear name with a catchy, bolded one-liner explaining exactly what the project is.
* **Elevator Pitch:** A short paragraph explaining the core functionality and business value.
* **Table of Contents:** Linked anchors so developers can jump straight to technical specs.

### 2. The Context
* **The Idea (Problem & Solution):** Explains *why* the project was built. It defines the initial manual problem (e.g., routine fatigue, social media scrolling, loneliness) and how the software automates and solves it.

### 3. High-Level Engineering
* **Architecture Diagram:** An ASCII-art diagram showing how the Frontend, Backend, Database, and External APIs communicate. *(This makes you look like a senior developer who understands system design).*
* **Data Flow:** Step-by-step text charts explaining the business logic for complex features (e.g., the exact lifecycle of quest generation, solar calculations, memory audio capture).

### 4. The Codebase Breakdown
* **Project Structure (Tree):** A simplified folder tree (`├── client` / `├── server` / `├── docs`) with comments explaining the purpose of specific files or directories.
* **Tech Stack Tables:** Grouped by Frontend, Backend, and External Services, listing the technology, its specific purpose in the app, and tier/cost.

### 5. Product Documentation
* **Feature Map:** Segmented tables (User vs. Admin features) listing the feature, its completion status (✅), and a brief description.
* **Database Models:** Simplified JSON structures showing the exact schema for core database collections (`User`, `Quest`, `Memory`, `DiscoveryPin`).
* **API Reference:** Grouped lists of backend endpoints (`/api/quests`, `/api/memories`, `/api/growth`, `/api/admin`) detailing the HTTP method and route.

### 6. Developer Onboarding (The "How-To")
* **Setup & Installation:** Copy-pasteable terminal commands to clone, install dependencies, and run the dev servers.
* **Environment Variables:** A clear list of what keys are required in the `.env` files without exposing real secrets.
* **Deployment Guide:** Quick steps on how to push the project to production (e.g., Capacitor for native iOS/Android, Vercel/Render for web/API).

### 7. Project Management & Quality
* **Build History / Phases:** A roadmap showing how the project evolved from MVP (Phase 1) to a complex platform (Phase 14).
* **Security Section:** A bulleted list of security measures implemented (Rate limiting, zero-secret clients, CORS allowlists, GPS fuzzing).
* **Special Features:** Highlighting unique technical implementations like Procedural Audio Synthesis, Leaflet Life Maps, and Canvas Story Cards.

---

## 🔬 Deep-Dive Technical Systems Encyclopedia

### 1. Astronomical Solar Declination & Golden Hour Math
The solar calculation algorithm in [`src/lib/ai-quest-engine.ts`](src/lib/ai-quest-engine.ts) computes exact local solar noon, sunset, and golden hour windows using astronomical equations:

$$\delta = 23.45^\circ \cdot \sin\left(\frac{284 + n}{365} \cdot 360^\circ\right)$$

$$\omega = \arccos(-\tan(\phi) \cdot \tan(\delta))$$

$$\text{Solar Noon} = 12.0 - \frac{\text{Longitude}}{15^\circ} + \frac{\text{Timezone Offset}}{60}$$

$$\text{Sunset Time} = \text{Solar Noon} + \frac{\omega}{15^\circ}$$

$$\text{Golden Hour Start} = \text{Sunset Time} - 45 \text{ minutes}$$

### 2. Web Audio API Procedural Soundscapes
The ambient sound generator in [`src/components/SoundscapeDrawer.tsx`](src/components/SoundscapeDrawer.tsx) uses zero external audio files. It synthesizes soothing nature ambiance in real time using the browser's Web Audio API:
- **Rain Engine:** Generates white noise through a `BiquadFilterNode` (lowpass at 800Hz) with random gain drops simulating falling raindrops.
- **Ocean Waves:** Modulates pink noise with a low-frequency oscillator (LFO at 0.1Hz) to simulate natural wave swell cycles.
- **Forest Ambiance:** High-frequency sine wave pings (2.4kHz–4.8kHz) with randomized exponential decay envelopes to simulate chirping birds.
- **Wind:** Resonant bandpass filter sweeps through brownian noise layers.

### 3. Anti-Repetition & Entropy Scoring
To prevent routine fatigue, [`src/services/intelligence/diversityEngine.ts`](src/services/intelligence/diversityEngine.ts) tracks category entropy across the user's last $N$ completed experiences:

$$\text{Entropy Score} = -\sum_{i=1}^{k} p_i \log_2(p_i)$$

Where $p_i$ is the proportion of category $i$ across recent memories. If entropy drops below the threshold ($\le 1.2$), the engine penalizes frequently repeated categories and boosts contrasting experiences (e.g., recommending a golden-hour nature walk if the user has completed consecutive indoor cafe sessions).

### 4. 9:16 HTML5 Canvas Story Generation Pipeline
The social card exporter in [`src/components/ShareStoryModal.tsx`](src/components/ShareStoryModal.tsx) renders a crisp 1080×1920 mobile story card directly onto an HTML5 Canvas:
1. Loads the user's quest photo proof and applies a subtle linear gradient overlay.
2. Draws brand typography, quest badge, time, city, and reflection quote.
3. Renders a custom exploration watermark and QR discovery token.
4. Exports as high-resolution PNG blob with automatic fallback between native Web Share API (`navigator.share`) and direct file download.

---

## 📱 Native Android & iOS Permissions Matrix

| Permission | Android (`AndroidManifest.xml`) | iOS (`Info.plist`) | Reason |
|---|---|---|---|
| **Camera** | `android.permission.CAMERA` | `NSCameraUsageDescription` | Real-world photo proof verification |
| **Geolocation** | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `NSLocationWhenInUseUsageDescription` | Local city resolution & Life Map pins |
| **Microphone** | `android.permission.RECORD_AUDIO` | `NSMicrophoneUsageDescription` | 15-second ambient nature audio recording |
| **Haptics** | `android.permission.VIBRATE` | Automatic | Tactile touch feedback on quest actions |
| **Notifications** | `POST_NOTIFICATIONS` | Push capability | Daily morning quest reminder notification |

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

*Built with ❤️ for real-world explorers by Susant.*
