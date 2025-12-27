// MODELS/UserCohort.model.js
import { Schema, model } from 'mongoose';

const cohortSchema = new Schema({
  // Cohort identifier (signup month/week)
  cohortDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Users who signed up in this cohort
  cohortName: {
    type: String,
    required: true,
    example: 'Dec-2024'
  },
  
  // Retention data for each week/month
  retention: {
    week0: { type: Number, default: 0 },    // Week they signed up
    week1: { type: Number, default: 0 },    // Week 1 after signup
    week2: { type: Number, default: 0 },
    week3: { type: Number, default: 0 },
    week4: { type: Number, default: 0 },
    month1: { type: Number, default: 0 },   // Month 1 after signup
    month2: { type: Number, default: 0 },
    month3: { type: Number, default: 0 },
    month6: { type: Number, default: 0 },
  },
  
  // Total users in cohort
  totalUsers: {
    type: Number,
    required: true
  },
  
  // User IDs for tracking
  userIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for quick lookups
cohortSchema.index({ cohortDate: 1 });
cohortSchema.index({ cohortName: 1 });

export default model('UserCohort', cohortSchema);
