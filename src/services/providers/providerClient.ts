/**
 * EXTROVELA — Phase 13: Provider Client (client → server bridge)
 *
 * The ONLY client-side path to real-world data. It calls the server's
 * /api/providers/* endpoints — which hold any secret provider key — and returns
 * already-normalized internal models, or null/[] on ANY failure. It NEVER throws
 * and NEVER fabricates data. Concurrent identical requests are de-duplicated so a
 * burst of context builds hits the network once.
 *
 * No secret ever lives here: keyless providers need none, and keyed providers are
 * reached only through the server. This module must stay free of heavy runtime
 * imports (Firebase/Capacitor) so it is safe to unit-test in a bare Node bundle.
 */

import { config } from '../../config/env';
import type { WeatherData } from './interfaces';
import type { Coordinates, Place } from '../../types/place';

const BASE = `${config.apiBaseUrl}/api/providers`;
const DEFAULT_TIMEOUT_MS = 10000;

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  mode: string;
  geometry?: unknown;
}

// De-dupes concurrent identical requests: the second caller awaits the first.
const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const started = run().finally(() => inFlight.delete(key));
  inFlight.set(key, started as Promise<unknown>);
  return started;
}

/** Fetch `{ success, data }`; returns `data` on success, null on ANY failure. Never throws. */
async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    if (!body || body.success !== true) return null;
    return body.data ?? null;
  } catch {
    return null; // network error, timeout/abort, or malformed JSON — fail clean
  } finally {
    clearTimeout(timer);
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000; // ~110m buckets for the dedup key
}

function coordsValid(c?: Coordinates): c is Coordinates {
  return !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

export async function fetchWeather(coords: Coordinates): Promise<WeatherData | null> {
  if (!coordsValid(coords)) return null;
  const key = `w:${round(coords.lat)},${round(coords.lng)}`;
  return dedupe(key, async () => {
    const data = await getJson(`${BASE}/weather?lat=${coords.lat}&lng=${coords.lng}`);
    return (data as WeatherData) ?? null;
  });
}

export async function fetchPlaces(
  coords: Coordinates,
  radiusMeters = 1500,
  category?: string
): Promise<Place[]> {
  if (!coordsValid(coords)) return [];
  const cat = category ? `&category=${encodeURIComponent(category)}` : '';
  const key = `p:${round(coords.lat)},${round(coords.lng)}:${radiusMeters}:${category || ''}`;
  return dedupe(key, async () => {
    const data = await getJson(
      `${BASE}/places?lat=${coords.lat}&lng=${coords.lng}&radius=${radiusMeters}${cat}`
    );
    return Array.isArray(data) ? (data as Place[]) : [];
  });
}

export async function fetchRoute(
  start: Coordinates,
  end: Coordinates,
  mode: 'walking' | 'cycling' | 'driving' = 'walking'
): Promise<RouteResult | null> {
  if (!coordsValid(start) || !coordsValid(end)) return null;
  const key = `r:${round(start.lat)},${round(start.lng)}->${round(end.lat)},${round(end.lng)}:${mode}`;
  return dedupe(key, async () => {
    const data = await getJson(`${BASE}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, mode }),
    });
    return (data as RouteResult) ?? null;
  });
}

export const providerClient = { fetchWeather, fetchPlaces, fetchRoute };
export default providerClient;
