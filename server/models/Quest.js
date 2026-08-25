import mongoose from 'mongoose';

const questSchema = new mongoose.Schema(
  {
    questId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    environment: {
      type: String,
      enum: ['Indoor', 'Outdoor', 'Urban Street', 'Nature', 'Cozy Local Spot'],
      required: true,
    },
    mood: {
      type: String,
      enum: ['Reflective', 'Curious', 'Playful', 'Social', 'Peaceful', 'Spontaneous'],
      required: true,
    },
    energy: {
      type: String,
      enum: ['Chill', 'Moderate', 'High Energy', 'Adventurous'],
      required: true,
    },
    time: {
      type: String,
      enum: ['15 mins', '30 mins', '1 hour', '2+ hours', 'Full day'],
      required: true,
    },
    budget: {
      type: String,
      enum: ['Free', 'Low ($)', 'Moderate ($$)', 'Treat Myself ($$$)'],
      required: true,
    },
    social: {
      type: String,
      enum: ['Solo', 'Low-pressure social', 'With a friend', 'Group adventure'],
      required: true,
    },
    season: {
      type: String,
      enum: ['Garimahina (Summer)', 'Jadamahina (Winter)', 'Any'],
      default: 'Any',
    },
    cityContext: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const QuestModel = mongoose.model('Quest', questSchema);
