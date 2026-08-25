import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String,
      default: 'anonymous_user',
    },
    questId: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      enum: ['Safety Risk', 'Inaccurate Venue', 'Trespassing', 'Inappropriate Content', 'Other'],
      required: true,
    },
    details: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Reviewed', 'Dismissed', 'Action Taken'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

export const Report = mongoose.model('Report', reportSchema);
