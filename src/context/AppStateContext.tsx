import React, { createContext, useContext, useState, useEffect } from 'react';
import { Quest, Memory, UserStats, UserPreferences, Mood, Energy, TimeOption, Budget, SocialPref, Environment, Season } from '../types';
import localQuestData from '../../context/quest_database.json';
import { fetchQuestsFromAPI, saveMemoryToAPI, syncOfflineMemories } from '../lib/api';
import { initializeNativeShell, scheduleDailyQuestNotification } from '../lib/native-device';
import { generateAIQuests, calculateSunTimes } from '../lib/ai-quest-engine';
import { useAuth } from './AuthContext';
import { experienceIntelligenceService } from '../services/intelligence/experienceIntelligenceService';
import { locationService } from '../services/context/locationService';

interface AppContextType {
  city: string;
  setCity: (city: string) => void;
  season: Season;
  setSeason: (season: Season) => void;
  quests: Quest[];
  generatedOptions: Quest[];
  activeQuest: Quest | null;
  setActiveQuest: (quest: Quest | null) => void;
  memories: Memory[];
  addMemory: (memory: Omit<Memory, 'id' | 'completedAt'>) => void;
  revealedPins: Memory[];
  stats: UserStats;
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  generateQuests: (params: {
    time: TimeOption;
    energy: Energy;
    mood: Mood;
    budget: Budget;
    social: SocialPref;
    environment: Environment;
  }) => void;
  triggerQuickMode: (mode: 'room_escape' | 'bored' | 'wildcard' | 'tonight' | 'chain') => void;
  antiRepetitionNudge: string | null;
  isPhoneFreeMode: boolean;
  setIsPhoneFreeMode: (val: boolean) => void;
  coQuestModalQuest: Quest | null;
  setCoQuestModalQuest: (quest: Quest | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  goals: ['break_routine', 'explore_city', 'outdoor_time'],
  personality: {
    adventurousVsComfort: 60,
    soloVsSocial: 35,
    spontaneousVsPlanned: 65,
    calmVsEnergetic: 50,
  },
  hasCompletedOnboarding: false,
  privacy: {
    allowAnalytics: true,
    hideExactHomeArea: true,
    enableCrashReporting: true,
  },
};

const SAMPLE_MEMORIES: Memory[] = [
  {
    id: 'mem_1',
    userId: 'user_active',
    questId: 'q_sunset_viewpoint',
    questTitle: 'Sunset Above Swayambhunath Viewpoint',
    completedAt: '2026-08-20T18:30:00Z',
    createdAt: '2026-08-20T18:30:00Z',
    rating: 5,
    moodRating: 5,
    mood: 'inspired',
    reflectionText: 'Left my room alone around 5 PM. Stood quietly watching the orange glow over the valley. Didn’t pick up my phone once. Felt a deep sense of stillness.',
    photoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    location: {
      city: 'Kathmandu',
      neighborhood: 'Swayambhu',
      lat: 27.7149,
      lng: 85.2903,
      placeName: 'Swayambhunath Hill',
    },
    visibility: 'private',
    isFavorite: true,
    isFirstTimeExperience: true,
    feedback: {
      wouldDoAgain: 'absolutely',
      tags: ['Peaceful', 'Scenic', 'Inspiring'],
    },
    tags: ['sunset', 'viewpoint', 'kathmandu', 'outdoor'],
  },
  {
    id: 'mem_2',
    userId: 'user_active',
    questId: 'q_cafe_solo_reader',
    questTitle: 'Solo Sanctuary at Patan Local Café',
    completedAt: '2026-08-18T14:15:00Z',
    createdAt: '2026-08-18T14:15:00Z',
    rating: 5,
    moodRating: 5,
    mood: 'peaceful',
    reflectionText: 'Tried a quiet back-alley tea café in Patan. Read 40 pages of a novel while rain drizzled outside. Unlocked a brand new hidden spot.',
    photoUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
    location: {
      city: 'Kathmandu',
      neighborhood: 'Patan',
      lat: 27.6744,
      lng: 85.3245,
      placeName: 'Patan Alley Teahouse',
    },
    visibility: 'private',
    isFavorite: true,
    isFirstTimeExperience: true,
    feedback: {
      wouldDoAgain: 'absolutely',
      tags: ['Peaceful', 'Relaxing'],
    },
    tags: ['cafe', 'reading', 'patan', 'indoor'],
  },
  {
    id: 'mem_3',
    userId: 'user_active',
    questId: 'q_cloud_watching',
    questTitle: '15-Minute Sky Gazing at Lakeside',
    completedAt: '2026-08-15T11:00:00Z',
    createdAt: '2026-08-15T11:00:00Z',
    rating: 5,
    moodRating: 5,
    mood: 'calm',
    reflectionText: 'Sat near the quiet grass of Lakeside Pokhara. Watching clouds drift over the Machhapuchhre reflection. Felt completely grounded.',
    photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    location: {
      city: 'Pokhara',
      neighborhood: 'Lakeside',
      lat: 28.2096,
      lng: 83.9575,
      placeName: 'Fewa Lake North Bank',
    },
    visibility: 'private',
    isFavorite: false,
    isFirstTimeExperience: false,
    feedback: {
      wouldDoAgain: 'absolutely',
      tags: ['Peaceful', 'Scenic'],
    },
    tags: ['clouds', 'pokhara', 'lakeside', 'outdoor'],
  },
];


export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const authUserId = user?.uid ?? null;
  const [city, setCity] = useState<string>('Kathmandu');
  const [season, setSeason] = useState<Season>('Garimahina (Summer)');
  const [quests, setQuests] = useState<Quest[]>(localQuestData.quests as Quest[]);
  const [generatedOptions, setGeneratedOptions] = useState<Quest[]>([]);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [isPhoneFreeMode, setIsPhoneFreeMode] = useState<boolean>(false);
  const [coQuestModalQuest, setCoQuestModalQuest] = useState<Quest | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('extrovela_preferences');
    return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
  });

  const [memories, setMemories] = useState<Memory[]>(() => {
    const saved = localStorage.getItem('extrovela_memories');
    return saved ? JSON.parse(saved) : SAMPLE_MEMORIES;
  });

  // On App Launch
  useEffect(() => {
    initializeNativeShell();
    scheduleDailyQuestNotification();
    syncOfflineMemories();

    fetchQuestsFromAPI().then(loadedQuests => {
      if (loadedQuests && loadedQuests.length > 0) {
        setQuests(loadedQuests);
      }
    });

    // Auto-detect user's real location & city dynamically via GPS & OpenStreetMap reverse geocoding
    locationService.getCurrentLocation().then(async loc => {
      if (loc?.coordinates) {
        const detectedCity = await locationService.reverseGeocode(loc.coordinates.lat, loc.coordinates.lng);
        if (detectedCity) {
          setCity(detectedCity);
        }
      }
    }).catch(() => {
      // Graceful fallback
    });

    const handleOnline = () => syncOfflineMemories();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    localStorage.setItem('extrovela_memories', JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem('extrovela_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (partial: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...partial }));
  };

  // Anti-Repetition Engine (Section 13)
  const recentIndoorCount = memories.slice(0, 3).filter(m => m.tags.includes('indoor')).length;
  const antiRepetitionNudge = recentIndoorCount >= 2
    ? "You've had multiple quiet indoor experiences lately. Want to break the routine and catch today's golden hour sunset outside?"
    : null;

  // Generate 3 personalized quest options
  const generateQuests = async (params: {
    time: TimeOption;
    energy: Energy;
    mood: Mood;
    budget: Budget;
    social: SocialPref;
    environment: Environment;
  }) => {
    const aiOptions = await generateAIQuests({
      ...params,
      city,
      season,
    });
    setGeneratedOptions(aiOptions);
  };

  // Trigger Quick Action Modes (Sections 45-51)
  const triggerQuickMode = async (mode: 'room_escape' | 'bored' | 'wildcard' | 'tonight' | 'chain') => {
    if (mode === 'room_escape') {
      const options = await generateAIQuests({
        time: '30 mins',
        energy: 'Moderate',
        mood: 'Spontaneous',
        budget: 'Free',
        social: 'Solo',
        environment: 'Outdoor',
        city,
        season,
      });
      setGeneratedOptions(options);
    } else if (mode === 'bored') {
      const options = await generateAIQuests({
        time: '1 hour',
        energy: 'Adventurous',
        mood: 'Curious',
        budget: 'Low ($)',
        social: 'Solo',
        environment: 'Urban Street',
        city,
        season,
      });
      setGeneratedOptions(options);
    } else if (mode === 'wildcard') {
      const wildcardQuest: Quest = {
        id: `wildcard_${Date.now()}`,
        title: '🎲 The Unplanned 45-Minute Wandering',
        description: 'Leave your room right now with no destination. Walk in a direction you usually avoid for 20 minutes, buy something warm to drink at the third shop you pass, and notice 3 things you never saw before.',
        category: 'Spontaneity',
        environment: 'Urban Street',
        mood: 'Spontaneous',
        energy: 'Adventurous',
        time: '1 hour',
        budget: 'Low ($)',
        social: 'Solo',
        season,
        difficulty: 'Wild Card',
        whyThisQuest: 'Completely unscripted AI routine breaker. Steps outside all algorithmic prediction.',
        tags: ['wildcard', 'spontaneous', city.toLowerCase()],
      };
      setGeneratedOptions([wildcardQuest, ...quests.slice(0, 2)]);
    } else if (mode === 'tonight') {
      const sun = calculateSunTimes(city);
      const tonightQuest: Quest = {
        id: `tonight_${Date.now()}`,
        title: `🌇 Chase the ${sun.sunsetTime} Golden Light`,
        description: `Golden hour begins around ${sun.goldenHourStart}. Head to the highest accessible open-air point or lakeside in ${city} and watch the colors transition without opening your phone.`,
        category: 'Nature & Mindfulness',
        environment: 'Outdoor',
        mood: 'Peaceful',
        energy: 'Chill',
        time: '1 hour',
        budget: 'Free',
        social: 'Solo',
        season,
        difficulty: 'Comfort',
        whyThisQuest: `Live astronomical timing calculated for ${city}. Sunset is at ${sun.sunsetTime}.`,
        tags: ['sunset', 'tonight', 'nature', city.toLowerCase()],
      };
      setGeneratedOptions([tonightQuest, ...quests.slice(1, 3)]);
    } else if (mode === 'chain') {
      const chainQuest: Quest = {
        id: `chain_${Date.now()}`,
        title: '📖 The Lost Afternoon: 4-Step Journey',
        description: 'A multi-experience narrative quest: 1) Take a local bus/walk 3 stops. 2) Order a traditional snack. 3) Photograph a single vibrant color. 4) Write one sentence in your journal.',
        category: 'Story Mode',
        environment: 'Urban Street',
        mood: 'Curious',
        energy: 'Moderate',
        time: '2+ hours',
        budget: 'Low ($)',
        social: 'Solo',
        season,
        isQuestChain: true,
        chainSteps: [
          { stepNumber: 1, title: 'Wander 3 Bus Stops', description: 'Get off somewhere completely unfamiliar.' },
          { stepNumber: 2, title: 'Taste Local Flavors', description: 'Try a fresh snack or tea from a corner stall.' },
          { stepNumber: 3, title: 'Color Hunt', description: 'Photograph 3 distinct objects that share the color orange or green.' },
          { stepNumber: 4, title: 'Reflection Story', description: 'Log what felt different about today.' },
        ],
        whyThisQuest: 'Multi-chapter experience journey that creates an unforgettable story.',
        tags: ['quest_chain', 'story', city.toLowerCase()],
      };
      setGeneratedOptions([chainQuest, ...quests.slice(0, 2)]);
    }
  };

  const addMemory = async (newMem: Omit<Memory, 'id' | 'completedAt'>) => {
    const completedQuest = activeQuest;
    const created: Memory = {
      ...newMem,
      id: `mem_${Date.now()}`,
      completedAt: new Date().toISOString(),
    };

    setMemories(prev => [created, ...prev]);
    setActiveQuest(null);

    await saveMemoryToAPI(created);

    // Phase 11 — feed the real interaction into the Experience Intelligence
    // pipeline. Keyed to the authenticated Firebase uid (never the local mock
    // 'user_active'), so derived writes satisfy the deny-by-default Firestore
    // rules and never pollute another user's profile. Fire-and-forget: a
    // personalization write must never block or fail a memory save.
    if (authUserId) {
      void experienceIntelligenceService
        .recordMemorySaved({ ...created, userId: authUserId })
        .catch(() => { /* non-blocking; the memory itself is already saved */ });

      if (completedQuest) {
        void experienceIntelligenceService
          .recordQuestCompleted(authUserId, completedQuest, {
            rating: created.rating ?? created.moodRating,
            moodAfter: created.mood,
          })
          .catch(() => { /* non-blocking */ });
      }
    }
  };

  // Archetype and Experience Ratios calculation (Section 42)
  const uniqueLocations = new Set(memories.map(m => m.location.placeName || m.location.city));
  const outdoorCount = memories.filter(m => m.tags.includes('outdoor') || m.tags.includes('nature') || m.tags.includes('sunset')).length;
  const soloCount = memories.filter(m => !m.tags.includes('social') && !m.tags.includes('friendship')).length;

  const outdoorPercentage = memories.length > 0 ? Math.round((outdoorCount / memories.length) * 100) : 65;
  const soloPercentage = memories.length > 0 ? Math.round((soloCount / memories.length) * 100) : 75;

  let explorerArchetype = 'The Quiet Adventurer';
  if (outdoorPercentage >= 70 && soloPercentage >= 60) {
    explorerArchetype = 'The Mindful Trailblazer';
  } else if (soloPercentage < 50) {
    explorerArchetype = 'The Social Wanderer';
  } else if (outdoorPercentage < 40) {
    explorerArchetype = 'The Urban Sanctuary Seeker';
  }

  const stats: UserStats = {
    totalQuestsCompleted: memories.length,
    uniqueLocationsVisited: uniqueLocations.size,
    soloCount,
    socialCount: memories.length - soloCount,
    sunsetsCount: memories.filter(m => m.tags.includes('sunset')).length,
    firstTimeCount: memories.filter(m => m.isFirstTimeExperience).length,
    cityExplorationPercent: Math.min(100, memories.length * 14 + 18),
    routineBreakerStreak: Math.max(1, Math.floor(memories.length * 0.7)),
    outdoorPercentage,
    soloPercentage,
    explorerArchetype,
  };

  return (
    <AppContext.Provider
      value={{
        city,
        setCity,
        season,
        setSeason,
        quests,
        generatedOptions,
        activeQuest,
        setActiveQuest,
        memories,
        addMemory,
        revealedPins: memories,
        stats,
        preferences,
        updatePreferences,
        generateQuests,
        triggerQuickMode,
        antiRepetitionNudge,
        isPhoneFreeMode,
        setIsPhoneFreeMode,
        coQuestModalQuest,
        setCoQuestModalQuest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
};
