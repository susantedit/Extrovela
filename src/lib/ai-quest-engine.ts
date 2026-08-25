// EXTROVELA — AI Experience & Context Engine
// Securely requests personalized routine-breaking quests from the backend API,
// with astronomical sunset calculations and instant local offline fallback.

import { Quest, TimeOption, Energy, Mood, Budget, Environment, SocialPref, Season } from '../types';
import localQuestData from '../../context/quest_database.json';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── 1. Astronomical Golden Hour Calculation ────────────────
export interface SunContext {
  goldenHourStart: string;
  sunsetTime: string;
  isGoldenHourNow: boolean;
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Kathmandu: { lat: 27.7172, lng: 85.3240 },
  Pokhara: { lat: 28.2096, lng: 83.9575 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  London: { lat: 51.5074, lng: -0.1278 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.5200, lng: 13.4050 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  Dubai: { lat: 25.2048, lng: 55.2708 },
  Toronto: { lat: 43.6532, lng: -79.3832 },
};

/**
 * Calculates approximate sunset and golden hour times for a given city and date.
 */
export function calculateSunTimes(cityName: string, date: Date = new Date()): SunContext {
  const coords = CITY_COORDS[cityName] || CITY_COORDS['Kathmandu'];
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

  // Solar declination approximation
  const declination = 23.45 * Math.sin(((284 + dayOfYear) / 365) * 2 * Math.PI);
  const latRad = (coords.lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;

  // Hour angle calculation
  const hourAngleRad = Math.acos(-Math.tan(latRad) * Math.tan(decRad));
  const hourAngleDeg = (hourAngleRad * 180) / Math.PI;

  const solarNoon = 12.0 - (coords.lng / 15.0) + (date.getTimezoneOffset() / 60.0);
  const sunsetHours = solarNoon + (hourAngleDeg / 15.0);

  const sunsetDate = new Date(date);
  const validSunset = isNaN(sunsetHours) ? 18.5 : sunsetHours;
  const sunsetHour = Math.floor(validSunset);
  const sunsetMin = Math.floor((validSunset - sunsetHour) * 60);

  sunsetDate.setHours(sunsetHour, sunsetMin, 0);

  const goldenHourStartDate = new Date(sunsetDate.getTime() - 45 * 60 * 1000);
  const now = date.getTime();
  const isGoldenHourNow = now >= goldenHourStartDate.getTime() && now <= sunsetDate.getTime();

  return {
    goldenHourStart: goldenHourStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sunsetTime: sunsetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isGoldenHourNow,
  };
}

// ─── 2. Secure Backend AI Quest Synthesizer ─────────────────
export async function generateAIQuests(params: {
  time: TimeOption;
  energy: Energy;
  mood: Mood;
  budget: Budget;
  social: SocialPref;
  environment: Environment;
  city: string;
  season: Season;
}): Promise<Quest[]> {
  const sun = calculateSunTimes(params.city);

  // 1. Try secure backend AI endpoint (No secret keys exposed on client)
  try {
    const res = await fetch(`${API_BASE_URL}/quests/generate-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        goldenHourStart: sun.goldenHourStart,
        sunsetTime: sun.sunsetTime,
      }),
      signal: AbortSignal.timeout(4500), // 4.5s timeout
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quests && Array.isArray(data.quests) && data.quests.length >= 3) {
        return data.quests.slice(0, 3);
      }
    }
  } catch (e) {
    console.warn('[EXTROVELA AI] Backend unreachable, using offline heuristic database engine:', e);
  }

  // 2. Offline fallback: Curated contextual matching from local database
  const allQuests = localQuestData.quests as Quest[];
  const matched = allQuests.filter(q => {
    if (q.season !== 'Any' && params.season.includes('Summer') && q.season.includes('Winter')) return false;
    if (q.season !== 'Any' && params.season.includes('Winter') && q.season.includes('Summer')) return false;
    return true;
  });

  const shuffled = [...matched].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}
