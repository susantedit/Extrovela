# EXTROVELA — Environment Configuration Guide

## Environment Variables Taxonomy

EXTROVELA separates configuration into two distinct layers:

### 1. Client-Safe Variables (`.env`)
These are exposed to Vite during build time and are bundled into the web/mobile app:

| Variable | Type | Description |
|---|---|---|
| `VITE_APP_ENV` | `development \| staging \| production` | Current deployment stage |
| `VITE_API_URL` | URL string | Backend REST API gateway URL |
| `VITE_FIREBASE_API_KEY` | String | Firebase Web SDK API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | String | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | String | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | String | Cloud Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | String | FCM Sender ID |
| `VITE_FIREBASE_APP_ID` | String | Firebase Web App ID |
| `VITE_ENABLE_ANALYTICS` | `boolean` | Enable Firebase Analytics telemetry |
| `VITE_ENABLE_CRASHLYTICS` | `boolean` | Enable Crashlytics native monitoring |

### 2. Server-Only Secrets (`server/.env`)
**Never expose to client or prefix with `VITE_`**:

| Variable | Description |
|---|---|
| `PORT` | Backend port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string (Local or MongoDB Atlas M0) |
| `GEMINI_API_KEY` | Google Gemini Pro AI API Key |
| `ADMIN_SECRET_KEY` | Secret token for admin observability endpoints |
