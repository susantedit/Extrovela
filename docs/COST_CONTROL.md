# EXTROVELA — Cost Control & Optimization Guidelines

## 💰 Firestore Cost Safeguards
1. **No Unbounded Listeners:** Avoid real-time subscriptions on deep nested collections. Use targeted cursor-based pagination.
2. **Composite Indexes:** Avoid index explosion; define composite indexes only for high-frequency queries (`firestore.indexes.json`).
3. **Storage Caching:** Local cache via `localStorage` and `@capacitor/preferences` to prevent redundant network downloads on app reload.
4. **AI Token Quotas:** Cap prompt lengths and use server-side caching on contextual recommendations.
