# 12. EXTROVELA — Technical Implementation Specification

## 1. Technology Stack
- **Frontend Framework**: React 18 + TypeScript + Vite.
- **Styling System**: Vanilla CSS Design System with Instagram-inspired typography fonts (`Outfit`, `Plus Jakarta Sans`, `JetBrains Mono`) and dark glassmorphic ambient glows.
- **Icons & Visuals**: `lucide-react`, `canvas-confetti`.
- **Maps**: `leaflet` with dark mode tile layers and custom glowing divIcon pins.
- **Cross-Platform Native Container**: Capacitor (`@capacitor/core`, `@capacitor/cli`) for Android & iOS native execution.

## 2. File & Component Structure
```
src/
├── components/
│   ├── Navbar.tsx             # Header & bottom tab bar
│   ├── QuestGenerator.tsx     # 3-Option quest picker
│   ├── ActiveQuestCard.tsx    # Phone-free focus timer & guidance
│   ├── CaptureModal.tsx       # Memory capture & reflection
│   ├── CalendarJournal.tsx    # Photo story calendar grid
│   ├── LifeMap.tsx            # Open-world Fog of War map
│   ├── RecapsView.tsx         # Monthly story recaps
│   └── CoQuestModal.tsx       # Friend invite & matching
├── context/
│   └── AppStateContext.tsx    # Central state & storage persistence
├── styles/
│   └── index.css              # Typography & ambient glass styles
├── types/
│   └── index.ts               # TypeScript interfaces
├── App.tsx                    # Layout orchestrator
└── main.tsx                   # App entry point
```
