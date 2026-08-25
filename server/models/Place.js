import mongoose from 'mongoose';

const placeSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    neighborhood: {
      type: String,
      default: '',
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    category: {
      type: String,
      enum: ['Café', 'Viewpoint', 'Park', 'Temple', 'Heritage', 'Museum', 'Street', 'Walkway', 'Nature Trail'],
      required: true,
      index: true,
    },
    priceLevel: {
      type: String,
      enum: ['Free', 'Low ($)', 'Moderate ($$)', 'High ($$$)'],
      default: 'Free',
    },
    openingHours: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '21:00' },
    },
    isIndoor: {
      type: Boolean,
      default: false,
    },
    weatherSuitability: {
      type: [String], // e.g. ['Rain', 'Sunny', 'Cloudy', 'Evening']
      default: ['Sunny', 'Cloudy'],
    },
    safetyRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    userVisitCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

export const Place = mongoose.model('Place', placeSchema);
