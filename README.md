# EXTROVELA — Personal Real-World Experience & Quest Engine

<div align="center">
  <img src="public/logo-dark.png" alt="EXTROVELA" width="320" />
  <p><em>"Stop scrolling. Start experiencing. Don't just get through your day — make today different."</em></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square)](https://vitejs.dev/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF.svg?style=flat-square)](https://capacitorjs.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
</div>

---

## 🌟 The Vision

> *"I get lonely sometimes. I like spending time by myself, but sometimes I get bored. I want to go out of my room, but I don't know what to do. So I built an app to solve my problem: a daily quest personalized to me, my time, my energy, and the city I'm in."*

**EXTROVELA** is an intentional, anti-screen real-world experience platform. It is **not** a habit tracker, to-do list, or endless social feed. It gives users one meaningful, delightful real-world invitation each day—whether watching clouds for 15 minutes, watching sunset from the highest point in their city, reading a book in a quiet alley cafe, or taking a public bus to a random stop.

---

## 🧭 The Core Product Loop

```
CHOOSE TIME & ENERGY ──► RECEIVE PERSONALIZED QUEST ──► EXPERIENCE IN REAL LIFE
                                                               │
                                                               ▼
DISCOVER & GROW ◄── REVEAL LIFE MAP ◄── LOG STORY & AUDIO ◄── PHOTO PROOF
```

---

## 🚀 Key Features

### 1. 🎯 Dynamic Quest Engine
- **Astronomical Golden Hour & Solar Matching:** Calculates exact local sunset and golden hour times for the user's coordinates.
- **Weather & Season Adaptive:** Selects quests matching real-time outdoor conditions (Open-Meteo API).
- **Anti-Repetition Intelligence:** Detects routine fatigue (e.g., too many indoor sessions) and nudges users toward refreshing outdoor or mindful experiences.

### 2. 🌍 Global Location & City Detection
- **Auto-Detection:** Automatically resolves the user's city anywhere in the world using GPS and OpenStreetMap Nominatim reverse geocoding.
- **City Adaptation:** Customizes quest prompts, landmarks, and coordinates for any city (Tokyo, New York, London, Kathmandu, Paris, Sydney, etc.).

### 3. 🗺️ Interactive Life Map & Discoveries
- **Life Map Canvas:** A visual record of your real-world exploration.
- **Discovery Nodes & Pins:** Completed quests illuminate your map like an open-world exploration game.

### 4. 🎨 Ambient Immersion & Media Capture
- **Procedural Soundscapes:** Built-in Web Audio API synthesizers generating generative nature ambiance (Rain, Forest Birds, Wind, Ocean Tide).
- **Ambient Voice Recorder:** Capture 15-second ambient sound notes alongside photo proof.
- **9:16 Social Story Exporter:** Generates branded 9:16 Instagram/TikTok story recap cards directly onto an HTML5 canvas with one-tap download and Web Share API support.

### 5. ⚡ Quick Action Modes & Micro-Escapes
- **"I'm Bored" Quest Spinner:** An interactive physics-based wheel for instant micro-adventures when you only have 15–20 minutes.
- **Co-Quests & Companion Invites:** Cryptographically secure invite tokens to embark on quests with friends or meet mindful companions.

### 6. ✨ Apple & Emil Kowalski Motion Design
- Hardware-accelerated GPU transitions (`--ease-out`, `--ease-spring`, `--ease-drawer`).
- Native mobile tab pops, active indicator glow, staggered list cascades, and tactile touch compression.

### 7. 🛡️ Custom Alerts & Offline-First Architecture
- Custom glassmorphic dialogs, confirmation modals, and toast notifications (zero native browser `window.alert` popups).
- Complete offline-first IndexedDB and local storage synchronization.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Client** | React 18, TypeScript, Vite, Capacitor Native Bridge (iOS & Android) |
| **Styling & Tokens** | Pure Vanilla CSS Design System, Glassmorphism, Dark Forest / Natural Light Modes |
| **Hardware APIs** | Camera, GPS Geolocation, Web Audio API, MediaRecorder, Device Haptics |
| **Backend Gateway** | Express.js, MongoDB Atlas (Mongoose), Node.js |
| **Mapping & Weather**| Leaflet, OpenStreetMap Nominatim, Open-Meteo |
| **Authentication** | Local-First Session Registry + Firebase Authentication |

---

## 📚 Technical Documentation Index

Every component, architecture decision, and security rule is documented in the [`docs/`](docs/) directory:

| Document | Description |
| :--- | :--- |
| 🏗️ [**Architecture & Standards**](docs/ARCHITECTURE.md) | Client/server directory structure, design patterns, and engineering principles. |
| ⚙️ [**Environment Setup**](docs/ENVIRONMENT.md) | Client and backend environment variables, secrets management, and build flags. |
| 🖥️ [**Backend Gateway**](docs/BACKEND.md) | Express.js architecture, routes, MongoDB schemas, and local fallback mode. |
| 🔥 [**Firebase Setup & Rules**](docs/FIREBASE_SETUP.md) | Firebase Authentication, Cloud Storage rules, and Web Analytics setup. |
| 🗄️ [**Firestore Schema**](docs/FIRESTORE_SCHEMA.md) | Cloud Firestore collection structures, composite indexes, and data contracts. |
| 💰 [**Cost Control & Protection**](docs/COST_CONTROL.md) | AI rate-limiting, token budgets, and API cost protection middleware. |
| 🔒 [**Security & Privacy Guide**](docs/SECURITY.md) | Location privacy sanitization, CORS allowlists, and secure storage rules. |
| 🧠 [**Phase 11: Experience Intelligence**](docs/PHASE_11_REPORT.md) | AI personalization models, quest synthesis heuristics, and candidate generation. |
| 👥 [**Phase 12: Social Loops & Invites**](docs/PHASE_12_REPORT.md) | Cryptographic invite tokens, friend systems, and co-quest collaboration. |
| 📋 [**Master Integration Audit**](docs/MASTER_INTEGRATION_AUDIT.md) | Comprehensive 21-area architectural audit, verification matrix, and remediation history. |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/extrovela.git
cd extrovela

# Install client dependencies
npm install

# Install backend dependencies
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
# Start Backend Gateway (Port 5000)
node server/server.js

# In a new terminal: Start Frontend Dev Server (Port 3000 / 5173)
npm run dev
```

### 4. Build & Sync Native iOS / Android Apps
```bash
# Production web build
npm run build

# Sync native assets to iOS and Android
npx cap sync
```

---

## 🧪 Testing & Verification

Run the automated test suite and type check:

```bash
# Type check with 0 errors
npx tsc --noEmit

# Run Phase 14 automated unit & integration test suite (27/27 tests)
npx esbuild src/__tests__/phase14.test.ts --bundle --platform=node --format=cjs --outfile=.tmp/phase14.cjs
node .tmp/phase14.cjs

# Audit dependencies for security vulnerabilities
npm audit --omit=dev
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
