import mongoose from 'mongoose';

const memorySchema = new mongoose.Schema(
  {
    questId: {
      type: String,
      required: true,
      index: true,
    },
    questTitle: {
      type: String,
      required: true,
    },
    moodRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    reflectionText: {
      type: String,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    voiceNoteDuration: {
      type: Number,
      default: 0,
    },
    location: {
      city: { type: String, required: true },
      neighborhood: { type: String, default: '' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      placeName: { type: String, default: '' },
    },
    isFirstTimeExperience: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    userId: {
      type: String,
      default: 'anonymous_user',
      index: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast geo/city queries
memorySchema.index({ 'location.city': 1, completedAt: -1 });

export const Memory = mongoose.model('Memory', memorySchema);
