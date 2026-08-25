# EXTROVELA — Firebase Setup & Security Guide

## 1. Firebase Project Setup

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable the following services:
   - **Authentication:** Enable Anonymous, Email/Password, and Google/Apple providers.
   - **Cloud Firestore:** Create in Production mode (Rules default to locked).
   - **Cloud Storage:** Create default bucket for memory photo uploads.
   - **Analytics & Crashlytics:** Enabled for iOS & Android apps.
   - **Cloud Messaging:** Enabled for daily quest notifications.

## 2. Deploying Security Rules

Deploy the locked production rules using the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Rules enforce:
- Authenticated users can only read and write their own documents under `/users/{userId}/*`.
- Public places and quests are read-only for clients.
- Safety reports can be submitted by users, but cannot be read or modified by clients.
