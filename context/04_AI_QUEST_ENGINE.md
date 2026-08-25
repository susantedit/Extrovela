# 04. EXTROVELA — AI Quest Engine Specification

## 1. Core Quest Decision Matrix Formula
```
User Profile
  + Time Available (15m, 30m, 1h, 2h+, Full day)
  + Energy Level (Chill, Moderate, High Energy, Adventurous)
  + Mood (Reflective, Curious, Playful, Social, Peaceful, Spontaneous)
  + Budget (Free, Low $, Moderate $$, Treat Myself $$$)
  + Social Preference (Solo, Low-pressure social, With a friend, Group)
  + Environment (Indoor, Outdoor, Urban Street, Nature, Cozy Local Spot)
  + City Location (Kathmandu, Pokhara, Global)
  + Season & Weather (Garimahina/Summer, Jadamahina/Winter, Golden Hour)
  + Previous Quests & Ratings
  + Unexplored Places & Fog-of-War Map Data
  + Routine Patterns (Breaker Logic)
       ↓
  QUEST ENGINE ALGORITHM
       ↓
  3 Personalized Quest Options
```

## 2. Quest Generation Rules
1. **Always Output 3 Distinct Choices**: Gives user agency while preventing decision paralysis.
2. **Contextual Relevance**:
   - If Kathmandu: Suggest Swayambhunath sunset, Patan alley reading, Ring Road bus journey.
   - If Pokhara: Suggest Fewa lake cloud watching, Sarangkot viewpoint, Begnas swim.
   - If Garimahina (Summer): Suggest lake swim, cold dessert exploration.
   - If Jadamahina (Winter): Suggest spiced hot drink from scratch, cozy teahouse.
3. **Routine Breaker Weighting**:
   - If user chose 3 consecutive indoor solo quests -> Increase outdoor/nature quest weights by +40%.
