# EXTROVELA — Cloud Firestore Schema Reference

## User-Owned Hierarchy

```
/users/{userId}
   ├── preferences/{preferenceId}   # Motivations, adventure level, time window, budget
   ├── quests/{questId}             # Generated or pinned daily quests
   ├── questAttempts/{attemptId}    # Quest start/finish timestamps and notes
   ├── memories/{memoryId}          # Permanent photo stories and reflections
   ├── reflections/{reflectionId}   # Star ratings and mood shifts
   ├── exploration/{explorationId}  # Discovered map zones and visit counters
   ├── notifications/{notificationId}
   └── recaps/{recapId}             # Monthly milestones
```

## Global Read-Only Taxonomies

```
/categories/{categoryId}            # Public category definitions
/places/{placeId}                   # Curated viewpoint & courtyard catalogue
```
