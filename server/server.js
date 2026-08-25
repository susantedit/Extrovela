import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import growthRoutes from './routes/growth.js';
import intelligenceRoutes from './routes/intelligence.js';
import providerRoutes from './routes/providers.js';
import { costProtectionMiddleware } from './middleware/costProtection.js';
import { requireAdmin } from './middleware/requireAdmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/extrovela';

// Middleware
// CORS — restrict to known web origins and native (Capacitor) origins. Requests
// with no Origin (native WebView, same-origin, curl) are allowed; browser
// cross-origin requests must originate from the allowlist. Add deployed web
// domains via ALLOWED_ORIGINS (comma-separated) in the environment.
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
];
const allowedOrigins = new Set([
  ...defaultOrigins,
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
]);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(costProtectionMiddleware);

// API Routes
app.use('/api', apiRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/api/growth', growthRoutes);
// Phase 11 — AI personalization. Every route here is identity-guarded; see
// server/middleware/requireIdentity.js for the documented verification gap.
app.use('/api/intelligence', intelligenceRoutes);
// Phase 13 — real-world providers (weather / places / routing). Server-mediated
// so any secret provider key stays out of the mobile bundle. Keyless by default.
app.use('/api/providers', providerRoutes);

// Root Status
app.get('/', (req, res) => {
  res.json({
    app: 'EXTROVELA Experience Platform',
    version: '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected (MongoDB)' : 'offline/fallback mode',
    docs: '/api/health',
    admin: '/api/admin/metrics',
    aiHealth: '/api/intelligence/ai-health',
  });
});

// Connect to MongoDB
async function startServer() {
  try {
    console.log(`[EXTROVELA Server] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log('[EXTROVELA Server] Connected to MongoDB successfully.');
  } catch (error) {
    console.warn('[EXTROVELA Server] MongoDB not reachable on local port. Operating in Graceful Fallback Mode.');
    console.warn('[EXTROVELA Server] Note: Configure MONGODB_URI in server/.env with your free MongoDB Atlas cluster connection string.');
  }

  app.listen(PORT, () => {
    console.log(`[EXTROVELA Server] Listening on http://localhost:${PORT}`);
  });
}

startServer();
