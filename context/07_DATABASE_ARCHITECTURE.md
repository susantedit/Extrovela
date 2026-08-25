# 07. EXTROVELA — Data & Database Architecture

## Entity Data Models

```typescript
interface User {
  id: string;
  name: string;
  homeCity: string;
  preferences: UserPreferences;
  createdAt: string;
}

interface UserPreferences {
  defaultTime: string;
  defaultEnergy: string;
  seasonMode: 'Auto' | 'Garimahina' | 'Jadamahina';
}

interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  environment: string;
  mood: string;
  energy: string;
  time: string;
  budget: string;
  social: string;
  season: string;
  cityContext?: string[];
  tags: string[];
}

interface Memory {
  id: string;
  questId: string;
  questTitle: string;
  completedAt: string;
  moodRating: number; // 1 to 5
  reflectionText: string;
  photoUrl?: string;
  voiceNoteDuration?: number;
  location: LocationData;
  isFirstTimeExperience: boolean;
  tags: string[];
}

interface LocationData {
  city: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  placeName?: string;
}

interface ExperienceStats {
  experiencesCount: number;
  newPlacesCount: number;
  soloCount: number;
  socialCount: number;
  sunsetsCount: number;
  memoriesCount: number;
  firstTimeCount: number;
  cityExplorationPercent: number;
}
```
