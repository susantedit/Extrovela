/**
 * EXTROVELA — High-Fidelity Mock Data Suite (Phase 2)
 * 
 * Realistic mock experiences, memories, curated packs, and exploration stats
 * to power the Phase 2 design system and screen shells without relying on live backend APIs.
 */

import { Quest, Memory, UserStats } from '../types';

export const MOCK_TODAY_QUEST: Quest = {
  id: 'quest_today_sunset',
  title: 'Chase the Last Light',
  description: 'There is still time before the sun slips below the ridge. Walk toward an open viewpoint you have never stood on before. Watch the sky shift from gold to deep indigo without touching your screen.',
  category: 'Nature & Mindfulness',
  environment: 'Outdoor',
  mood: 'Reflective',
  energy: 'Chill',
  time: '1 hour',
  budget: 'Free',
  social: 'Solo',
  season: 'Garimahina (Summer)',
  difficulty: 'Comfort',
  whyThisQuest: 'You have spent several days in quiet indoor routines. The golden hour sky is clear today in Kathmandu.',
  tags: ['sunset', 'mindful', 'viewpoint', 'kathmandu'],
};

export const MOCK_QUICK_ESCAPES: Quest[] = [
  {
    id: 'escape_20min_alley',
    title: 'The 20-Minute Secret Alley Walk',
    description: 'Step outside immediately. Turn left at the first intersection you usually ignore. Walk until you notice a hidden doorway, tree, or stone carving.',
    category: 'Exploration',
    environment: 'Urban Street',
    mood: 'Curious',
    energy: 'Moderate',
    time: '15 mins',
    budget: 'Free',
    social: 'Solo',
    season: 'Any',
    difficulty: 'Comfort',
    tags: ['micro_escape', 'curiosity'],
  },
  {
    id: 'escape_30min_tea',
    title: 'Analog Teahouse Sanctuary',
    description: 'Find the nearest traditional street teahouse. Order a warm spiced chai, sit down, and listen to the ambient chatter for 20 minutes without checking notifications.',
    category: 'Quiet',
    environment: 'Cozy Local Spot',
    mood: 'Peaceful',
    energy: 'Chill',
    time: '30 mins',
    budget: 'Low ($)',
    social: 'Solo',
    season: 'Any',
    difficulty: 'Comfort',
    tags: ['chai', 'mindful', 'analog'],
  },
  {
    id: 'escape_wildcard',
    title: '🎲 The One-Color Photo Hunt',
    description: 'Pick the color amber or emerald. Walk 500 meters and photograph 3 unique real-world objects that share that color.',
    category: 'Creative',
    environment: 'Outdoor',
    mood: 'Spontaneous',
    energy: 'High Energy',
    time: '30 mins',
    budget: 'Free',
    social: 'Solo',
    season: 'Any',
    difficulty: 'Wild Card',
    tags: ['photography', 'wildcard'],
  },
];

export interface CategoryItem {
  id: string;
  name: string;
  tagline: string;
  iconName: string;
  accentColor: string;
  questCount: number;
  featuredImage: string;
}

export const MOCK_CATEGORIES: CategoryItem[] = [
  {
    id: 'nature',
    name: 'Nature & Solitude',
    tagline: 'Quiet hillsides, lakeside paths, and sunset vistas.',
    iconName: 'Trees',
    accentColor: '#4A7C59',
    questCount: 14,
    featuredImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'culture',
    name: 'Heritage & Alleys',
    tagline: 'Courtyards, ancient stupas, and hidden stone shrines.',
    iconName: 'Compass',
    accentColor: '#C99A45',
    questCount: 19,
    featuredImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'quiet',
    name: 'Mindful Sanctuary',
    tagline: 'Analog book reading, corner teahouses, and peaceful pauses.',
    iconName: 'Coffee',
    accentColor: '#56643A',
    questCount: 11,
    featuredImage: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'creative',
    name: 'Street Photography',
    tagline: 'Observational wandering and noticing unnoticed details.',
    iconName: 'Camera',
    accentColor: '#06B6D4',
    questCount: 8,
    featuredImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'adventure',
    name: 'Wild Card & First Times',
    tagline: 'Unscripted experiences that break all predictability.',
    iconName: 'Zap',
    accentColor: '#F97316',
    questCount: 12,
    featuredImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'social',
    name: 'Low-Pressure Social',
    tagline: 'Spontaneous conversations and shared experiences.',
    iconName: 'Users',
    accentColor: '#8B5CF6',
    questCount: 9,
    featuredImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
  },
];

export const MOCK_MEMORIES: Memory[] = [
  {
    id: 'mem_1',
    userId: 'user_active',
    questId: 'q_sunset_viewpoint',
    questTitle: 'Sunset Above Swayambhunath Ridge',
    completedAt: '2026-08-21T18:40:00Z',
    createdAt: '2026-08-21T18:40:00Z',
    rating: 5,
    moodRating: 5,
    mood: 'inspired',
    reflectionText: 'Left my room alone around 5 PM. Stood quietly watching the valley ignite in gold. Didn’t check my phone once. A genuine moment of stillness.',
    photoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    location: {
      city: 'Kathmandu',
      neighborhood: 'Swayambhu',
      lat: 27.7149,
      lng: 85.2903,
      placeName: 'Swayambhunath Hill Vista',
    },
    visibility: 'private',
    isFavorite: true,
    isFirstTimeExperience: true,
    feedback: {
      wouldDoAgain: 'absolutely',
      tags: ['Peaceful', 'Scenic', 'Inspiring'],
    },
    tags: ['sunset', 'mindful', 'kathmandu', 'outdoor'],
  },
  {
    id: 'mem_2',
    userId: 'user_active',
    questId: 'q_cafe_solo_reader',
    questTitle: 'Solo Reading Sanctuary in Patan Courtyard',
    completedAt: '2026-08-19T14:30:00Z',
    createdAt: '2026-08-19T14:30:00Z',
    rating: 5,
    moodRating: 5,
    mood: 'peaceful',
    reflectionText: 'Found a quiet brick-lined teahouse behind Patan Durbar. Read 45 pages of a book while rain gently fell on the courtyard tiles.',
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
    questTitle: '15-Minute Cloud Gazing by Fewa Lake',
    completedAt: '2026-08-16T11:15:00Z',
    createdAt: '2026-08-16T11:15:00Z',
    rating: 4,
    moodRating: 4,
    mood: 'calm',
    reflectionText: 'Sat near the quiet grass of Lakeside Pokhara. Watched mist drift over the Annapurna ridge reflection. Recharged my mind.',
    photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    location: {
      city: 'Pokhara',
      neighborhood: 'Lakeside',
      lat: 28.2096,
      lng: 83.9575,
      placeName: 'Fewa Lake North Shore',
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

export const MOCK_USER_STATS: UserStats = {
  totalQuestsCompleted: 37,
  uniqueLocationsVisited: 18,
  soloCount: 26,
  socialCount: 11,
  sunsetsCount: 8,
  firstTimeCount: 12,
  cityExplorationPercent: 34,
  routineBreakerStreak: 9,
  outdoorPercentage: 68,
  soloPercentage: 70,
  explorerArchetype: 'The Mindful Trailblazer',
};
