# EXTROVELA — Security & Threat Model

## 🛡️ Core Rules
1. **Deny All by Default:** Every collection is locked unless explicitly permitted by matching `request.auth.uid`.
2. **Immutable Server Fields:** Clients cannot tamper with `createdAt`, `updatedAt`, or moderation metadata.
3. **Storage Quotas:** Strict 10MB limits on images and 50MB limits on video to prevent bucket exhaustion.
4. **Rate Limiting:** Sliding-window rate limiters prevent API abuse and DDoS attacks.
5. **Apple Guideline 5.1.1:** Complete, verifiable account deletion workflow purging Firestore subcollections, Storage buckets, and Auth identities.
