# EXTROVELA — Backend Architecture & Services

EXTROVELA's backend infrastructure is engineered to scale securely to **100,000+ active downloads**.

---

## 🏗️ Architecture Overview

```
Mobile Client (React / Capacitor)
   │
   ├── Firebase Authentication (Auth Token Handshake)
   ├── Cloud Firestore (User Subcollections via Security Rules)
   ├── Firebase Storage (User Private Uploads)
   │
   └── Trusted Express Gateway / Cloud Run (Port 5000)
         ├── Rate Limiter Middleware (Sliding window per user/IP)
         ├── Request Payload Validator (Strict type/enum checking)
         ├── Provider Abstraction Layer (AI, Weather, Places, Maps)
         └── Account Deletion Service (Apple 5.1.1 & GDPR Erase)
```

---

## 🔒 Security Posture

1. **Deny-by-Default:** Client apps can never access arbitrary global database documents.
2. **User Data Isolation:** All user documents reside under `/users/{uid}/*` and require matching `request.auth.uid`.
3. **No Privileged Client Keys:** Server secrets (`GEMINI_API_KEY`, `MONGODB_URI`, `ADMIN_SECRET_KEY`) are kept strictly on the backend.
