import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Memory } from '../models/Memory.js';
import { QuestModel } from '../models/Quest.js';
import { requireIdentity } from '../middleware/requireIdentity.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questDataPath = path.resolve(__dirname, '../../context/quest_database.json');
const defaultQuests = JSON.parse(fs.readFileSync(questDataPath, 'utf-8'));

const router = express.Router();

// ─── Health Check ──────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'EXTROVELA MongoDB API',
    timestamp: new Date().toISOString(),
  });
});

// ─── Quests API ───────────────────────────────────────────
router.get('/quests', async (req, res) => {
  try {
    const { time, energy, mood, budget, social, environment, season } = req.query;

    // Build Mongo query filter
    const query = {};
    if (time) query.time = time;
    if (energy) query.energy = energy;
    if (mood) query.mood = mood;
    if (budget) query.budget = budget;
    if (social) query.social = social;
    if (environment) query.environment = environment;

    let quests = [];
    // Try querying MongoDB if connected, fallback to built-in database
    try {
      quests = await QuestModel.find(query).lean();
    } catch {
      quests = [];
    }

    if (!quests || quests.length === 0) {
      // Fallback to local quest database json
      quests = defaultQuests.quests || [];
      if (season && season !== 'Any') {
        quests = quests.filter(q => {
          if (q.season === 'Any') return true;
          return q.season.toLowerCase().includes(season.toLowerCase().split(' ')[0]);
        });
      }
    }

    res.json({ success: true, count: quests.length, quests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Secure Server-Side AI Quest Generator ─────────────────
//
// Open (no per-user identity) BY DESIGN: gating this behind the server's
// firebase-admin auth — which is not yet configured — would disable AI quest
// generation in production entirely. It holds no client-exposed secret and
// returns only quest text, so it is protected instead by (1) a per-caller rate
// limit, (2) bounded prompt inputs below, and (3) the global cost-protection
// middleware already mounted in server.js.
const aiGenerationLimiter = rateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  message: 'Too many quest generation requests. Please wait a minute before trying again.',
});

// Bound every user-controlled field interpolated into the AI prompt so an
// oversized or multi-line value cannot bloat the prompt or attempt injection.
const clampPromptField = (value, max = 48) =>
  typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : '';

router.post('/quests/generate-ai', aiGenerationLimiter, async (req, res) => {
  try {
    const raw = req.body || {};
    const time = clampPromptField(raw.time);
    const energy = clampPromptField(raw.energy);
    const mood = clampPromptField(raw.mood);
    const budget = clampPromptField(raw.budget);
    const social = clampPromptField(raw.social);
    const environment = clampPromptField(raw.environment);
    const city = clampPromptField(raw.city) || 'Kathmandu';
    const season = clampPromptField(raw.season) || 'Any';
    const goldenHourStart = clampPromptField(raw.goldenHourStart, 16);
    const sunsetTime = clampPromptField(raw.sunsetTime, 16);
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
      try {
        const prompt = `You are the AI experience engine for EXTROVELA, an anti-productivity real-world quest app designed to break daily routine and create memorable experiences.
Synthesize exactly 3 distinct, poetic, and actionable real-world quests for:
- City: ${city}
- Season: ${season}
- Available Time: ${time}
- Energy Level: ${energy}
- Desired Mood: ${mood}
- Budget: ${budget}
- Social Preference: ${social}
- Environment: ${environment}
${sunsetTime ? `- Sunset Time: ${sunsetTime} (Golden hour begins at ${goldenHourStart || ''})` : ''}

Return a pure JSON array containing exactly 3 objects with the following schema:
[
  {
    "id": "ai_quest_1",
    "title": "Short poetic title (4-7 words)",
    "description": "2-3 clear, mindful sentences describing the exact experience without phone distractions.",
    "category": "Mindfulness | Exploration | Connection | Creativity | Nature",
    "environment": "${environment}",
    "mood": "${mood}",
    "energy": "${energy}",
    "time": "${time}",
    "budget": "${budget}",
    "social": "${social}",
    "season": "${season}",
    "cityContext": ["Specific neighborhood or viewpoint in ${city}"],
    "tags": ["tag1", "tag2"]
  }
]`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length >= 3) {
              return res.json({ success: true, source: 'gemini-ai', quests: parsed.slice(0, 3) });
            }
          }
        }
      } catch (aiError) {
        console.warn('[EXTROVELA Server AI] Gemini API call error, falling back to database:', aiError.message);
      }
    }

    // Heuristic fallback from database
    const allQuests = defaultQuests.quests || [];
    const matched = allQuests.filter(q => {
      if (q.season !== 'Any' && season.includes('Summer') && q.season.includes('Winter')) return false;
      if (q.season !== 'Any' && season.includes('Winter') && q.season.includes('Summer')) return false;
      return true;
    });

    const shuffled = [...matched].sort(() => 0.5 - Math.random());
    res.json({ success: true, source: 'curated-database', quests: shuffled.slice(0, 3) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Seed Quests into MongoDB ───────────────────────────────
router.post('/quests/seed', async (req, res) => {
  try {
    const quests = defaultQuests.quests || [];
    let inserted = 0;

    for (const q of quests) {
      await QuestModel.updateOne(
        { questId: q.id },
        { ...q, questId: q.id },
        { upsert: true }
      );
      inserted++;
    }

    res.json({ success: true, message: `Seeded ${inserted} quests into MongoDB` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Memories API ─────────────────────────────────────────
// Identity is server-derived (req.auth.userId), never taken from the query
// string — this closes the IDOR where any caller could read another user's
// memories by passing ?userId=. Real verification REQUIRES EXTERNAL
// CONFIGURATION (firebase-admin); until then requireIdentity fails closed in
// production and the client operates local-first (Firestore + localStorage),
// so no data is lost.
router.get('/memories', requireIdentity, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Memory store is offline. Client operates from local cache.' },
      });
    }
    const userId = req.auth.userId;
    const { city, tag } = req.query;
    const filter = { userId };
    if (city) filter['location.city'] = city;
    if (tag && tag !== 'all') filter.tags = tag;

    const memories = await Memory.find(filter).sort({ completedAt: -1 }).lean();
    res.json({ success: true, count: memories.length, memories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memories', requireIdentity, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Memory store is offline. The client will retry from its offline queue.' },
      });
    }
    // Ownership is assigned server-side from the verified identity. Any userId in
    // the body is ignored — a client can never write into another user's history.
    const memoryData = { ...req.body, userId: req.auth.userId };
    const newMemory = new Memory(memoryData);
    const saved = await newMemory.save();
    res.status(201).json({ success: true, memory: saved });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Batch sync for offline-created memories
router.post('/memories/sync', requireIdentity, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Memory store is offline. The offline queue will be retried later.' },
      });
    }
    const { memories = [] } = req.body;
    const results = [];

    for (const mem of memories) {
      const { id, _id, ...cleanData } = mem;
      // Force ownership to the authenticated user on every synced record.
      const created = await Memory.create({ ...cleanData, userId: req.auth.userId });
      results.push(created);
    }

    res.json({ success: true, syncedCount: results.length, memories: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Recaps & Stats API ───────────────────────────────────
router.get('/stats', requireIdentity, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Stats store is offline. The client computes stats locally.' },
      });
    }
    const userId = req.auth.userId;
    const memories = await Memory.find({ userId }).lean();

    const uniquePlaces = new Set(memories.map(m => m.location?.placeName || m.location?.city));
    const firstTimes = memories.filter(m => m.isFirstTimeExperience).length;
    const sunsets = memories.filter(m => m.tags?.includes('sunset')).length;

    const stats = {
      totalQuestsCompleted: memories.length,
      uniqueLocationsVisited: uniquePlaces.size,
      firstTimeCount: firstTimes,
      sunsetsCount: sunsets,
      routineBreakerStreak: Math.max(1, Math.floor(memories.length * 0.7)),
      cityExplorationPercent: Math.min(100, memories.length * 14 + 18),
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
