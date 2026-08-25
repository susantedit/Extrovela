// EXTROVELA — AI Cost & Quota Protection Middleware (Sections 75-76)

const userRequestCounts = new Map();
const questCache = new Map();

const MAX_REQUESTS_PER_MINUTE = 30;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache for identical context

export function costProtectionMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'client';
  const now = Date.now();

  const userStats = userRequestCounts.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > userStats.resetTime) {
    userStats.count = 0;
    userStats.resetTime = now + 60000;
  }

  userStats.count++;
  userRequestCounts.set(ip, userStats);

  if (userStats.count > MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error: 'Too many experience requests. Please wait a moment to preserve mindfulness and system stability.',
    });
  }

  next();
}

export function getCachedQuests(cacheKey) {
  const cached = questCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.quests;
  }
  return null;
}

export function setCachedQuests(cacheKey, quests) {
  questCache.set(cacheKey, { quests, timestamp: Date.now() });
}
