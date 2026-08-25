/**
 * EXTROVELA — Telemetry & Analytics Event Taxonomy (Phase 3, extended in 11–12)
 *
 * WHAT IS NEVER TRACKED — this is a hard rule, not a guideline:
 *   - private reflection contents
 *   - memory titles, captions, or media
 *   - exact coordinates (city-level `city` is the finest granularity permitted)
 *   - any inferred sensitive attribute
 *
 * Phase 11/12 events therefore carry COUNTS, ENUMS, and BUCKETS only. When you
 * need to know "did personalization help", the answer comes from
 * `personalization_applied` + `quest_completed`, not from the quest's text.
 */

export type AnalyticsEventName =
  | 'app_opened'
  | 'auth_started'
  | 'auth_completed'
  | 'guest_started'
  | 'guest_converted'
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_abandoned'
  | 'onboarding_completed'
  | 'location_permission_prompted'
  | 'location_permission_granted'
  | 'location_permission_denied'
  | 'notification_permission_prompted'
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'quest_generated'
  | 'quest_started'
  | 'quest_completed'
  | 'quest_abandoned'
  | 'phone_free_mode_toggled'
  | 'reflection_added'
  | 'memory_created'
  | 'memory_shared'
  | 'friend_quest_created'
  | 'friend_quest_joined'
  | 'map_opened'
  | 'recap_viewed'
  | 'recap_shared'
  | 'memory_deleted'
  | 'safety_report_submitted'

  // ─── Phase 11: Experience Intelligence ───
  | 'experience_event_recorded'
  | 'preference_signal_updated'
  | 'preference_contradiction_detected'
  | 'preference_reversal_detected'
  | 'experience_profile_rebuilt'
  | 'experience_gap_detected'
  | 'repetition_detected'
  | 'personalization_applied'
  | 'personalization_cold_start'
  | 'novelty_level_selected'
  | 'surprise_quest_offered'
  | 'surprise_quest_accepted'
  | 'surprise_quest_rejected'
  | 'ai_generation_requested'
  | 'ai_generation_succeeded'
  | 'ai_generation_fell_back'
  | 'ai_schema_rejected'
  | 'ai_hallucination_blocked'
  | 'memory_recall_shown'
  | 'preference_corrected_by_user'
  | 'preference_deleted_by_user'
  | 'personalization_reset'
  | 'personalization_disabled'
  | 'personalization_enabled'
  | 'learned_preferences_viewed'
  | 'explicit_preference_submitted'

  // ─── Phase 12: Memory Journal 2.0 & Recaps ───
  | 'memory_journal_opened'
  | 'memory_detail_opened'
  | 'memory_searched'
  | 'memory_filtered'
  | 'memory_favorited'
  | 'memory_media_upload_started'
  | 'memory_media_upload_succeeded'
  | 'memory_media_upload_failed'
  | 'memory_media_upload_retried'
  | 'memory_media_upload_cancelled'
  | 'memory_title_suggested'
  | 'memory_title_accepted'
  | 'memory_title_edited'
  | 'memory_draft_saved_offline'
  | 'memory_draft_synced'
  | 'timeline_opened'
  | 'timeline_period_changed'
  | 'recap_generation_started'
  | 'recap_generation_succeeded'
  | 'recap_generation_failed'
  | 'recap_narrative_unavailable'
  | 'recap_story_mode_opened'
  | 'recap_slide_viewed'
  | 'recap_invalidated'
  | 'share_card_previewed'
  | 'share_card_template_changed'
  | 'share_card_created'
  | 'share_card_revoked'
  | 'collection_created'
  | 'collection_memory_added'
  | 'smart_collection_viewed';

/** Fixed-vocabulary parameter types. A free-form string is never accepted. */
export type AnalyticsSource = 'ai-primary' | 'ai-fallback' | 'deterministic';
export type AnalyticsNoveltyLevel = 'comfortable' | 'stretch' | 'surprise';
export type AnalyticsRecapPeriod = 'weekly' | 'monthly' | 'yearly';
export type AnalyticsShareTemplate = 'minimal' | 'editorial' | 'photo' | 'journal' | 'recap';
export type AnalyticsTimelineGrouping = 'day' | 'week' | 'month' | 'year';
export type AnalyticsMediaKind = 'photo' | 'video' | 'audio';
export type AnalyticsCountBucket = '0' | '1' | '2-5' | '6-20' | '21-50' | '51+';

export interface AnalyticsEventParams {
  category?: string;
  step?: number;
  quest_id?: string;
  memory_id?: string;
  duration_minutes?: number;
  mood_rating?: number;
  is_first_time?: boolean;
  city?: string;
  share_destination?: 'instagram_story' | 'whatsapp' | 'generic';
  error_code?: string;

  // ─── Phase 11 ───
  /** One of ExperienceEventType. An enum, never free text. */
  event_type?: string;
  /** One of PreferenceDimension. */
  dimension?: string;
  /** Rounded to 1 decimal. Never the raw learned value. */
  confidence?: number;
  /** Rounded to 1 decimal. */
  strength?: number;
  sample_count?: number;
  profile_version?: number;
  profile_confidence?: number;
  novelty_level?: AnalyticsNoveltyLevel;
  novelty_target?: number;
  /** Which layer of the AI chain produced the result. */
  ai_source?: AnalyticsSource;
  /** Model identifier only. Never a prompt or a completion. */
  ai_model?: string;
  ai_latency_ms?: number;
  /** Machine reason code, e.g. 'schema_invalid' — never model output. */
  rejection_reason?: string;
  /** Count of recall lines shown, not their text. */
  recall_count?: number;
  /** True when the profile lacked the confidence to personalize. */
  cold_start?: boolean;
  personalization_enabled?: boolean;
  /** Reason a gap was flagged: neverTried | longAbsence | underexplored. */
  gap_reason?: string;
  /** Where a surprise seed came from. */
  surprise_origin?: string;

  // ─── Phase 12 ───
  recap_period?: AnalyticsRecapPeriod;
  /** Which slide index; not the slide's text. */
  slide_index?: number;
  slide_count?: number;
  narrative_available?: boolean;
  share_template?: AnalyticsShareTemplate;
  timeline_grouping?: AnalyticsTimelineGrouping;
  media_kind?: AnalyticsMediaKind;
  /** Bytes, so upload failures can be correlated with size. */
  media_bytes?: number;
  upload_attempt?: number;
  /** Bucketed rather than exact, so it cannot fingerprint a small cohort. */
  memory_count_bucket?: AnalyticsCountBucket;
  collection_size?: number;
  /** Whether a search returned anything — never the query itself. */
  had_results?: boolean;
  /** Which filter was used, from a fixed set. Not the filter's value. */
  filter_kind?: string;
  sort_kind?: string;
  is_offline?: boolean;
}

/** Buckets a count so a rare exact value cannot identify a user. */
export function toCountBucket(count: number): AnalyticsCountBucket {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  return '51+';
}
