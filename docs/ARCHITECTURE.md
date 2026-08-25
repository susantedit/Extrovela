# EXTROVELA — Technical Architecture & Engineering Standards

## 1. System Overview

EXTROVELA is a personalized real-world experience platform built with a modern mobile-first stack:
- **Client Frontend:** React 18 + Vite + TypeScript + Capacitor (iOS & Android native bridge)
- **Local Persistence & Sync:** Offline Queue + SQLite/Preferences local cache + MongoDB / Cloud Firestore
- **Backend API & AI Gateway:** Express.js + Gemini 1.5 Pro AI + Mongoose
- **Hardware Integrations:** Camera, GPS Geolocation, Tactile Haptics, Local Push Notifications
- **Observability:** Firebase Analytics, Crashlytics, Performance Monitoring

---

## 2. Directory Structure

```
src/
  ├── app/                  # Application bootstrap & providers
  ├── assets/               # Brand logos, icons, and static assets
  ├── components/           # UI components & shared views
  │   └── primitives/       # Atomic design tokens (Button, Card, Badge, Chip, Input, Modal)
  ├── config/               # Environment & runtime configuration
  ├── constants/            # Design tokens, storage keys, route definitions
  ├── context/              # Global React state orchestration
  ├── features/             # Feature-sliced modules (auth, quests, memories, map, profile, social)
  ├── hooks/                # Reusable custom hooks
  ├── lib/                  # Native device APIs & astronomical sun calculations
  ├── services/             # Firebase SDK, API clients, and offline sync layers
  │   ├── firebase/         # Auth, Firestore, Storage, Analytics, Messaging
  │   └── offline/          # Offline queue & local cache manager
  ├── styles/               # Vanilla CSS design system tokens
  ├── types/                # Strongly typed domain model contracts
  └── utils/                # Centralized error handler & privacy logger
```

---

## 3. Core Architecture Principles

1. **Feature-Based Domain Separation:** Features are encapsulated in `src/features/` with well-defined contracts.
2. **Never Scatter Direct Database Calls:** All Firestore and MongoDB queries reside behind dedicated services in `src/services/`.
3. **Zero Secrets in Client Builds:** AI keys, private database connection strings, and admin credentials are strictly server-side.
4. **Privacy-First Telemetry:** The logger strips personal data, credentials, and coordinates before outputting in production.
5. **Offline-First Resilience:** Quests and completed memories remain accessible without network connectivity and sync automatically upon reconnection.
