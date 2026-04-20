// models/PYQInsightsFeed.js
import mongoose from 'mongoose';

const InsightCardSchema = new mongoose.Schema({
  cardId:           { type: String, required: true },
  type: {
    type: String,
    enum: ['PREDICTION', 'PATTERN', 'SKIP_SAFE', 'DUE_COMEBACK', 'REPEAT'],
    required: true,
  },
  priority:         { type: Number, required: true },   // 1 = show first
  headline:         { type: String, required: true },
  subtext:          { type: String },
  confidence:       { type: Number, min: 0, max: 100 }, // null for PATTERN/SKIP
  tag: {
    type: String,
    enum: ['VERY_LIKELY', 'HIGH_PRIORITY', 'LOW_PRIORITY', 'WATCH_OUT', 'CERTAIN'],
  },
  relatedTopicId:   { type: String },                   // null for unit-level cards
  isVisible:        { type: Boolean, default: true },
  isLocked:         { type: Boolean, default: false },  // paywall
}, { _id: false });

const PYQInsightsFeedSchema = new mongoose.Schema({
  subjectCode:    { type: String, required: true, index: true },//what about then here , here also subject code as os right 
  unitId:         { type: String, required: true, index: true },
  cards:          [InsightCardSchema],
  generatedAt:    { type: Date, default: Date.now },
  editedByAdmin:  { type: Boolean, default: false },
  isStale:        { type: Boolean, default: false },    // true when new paper added
}, {
  timestamps: true,
});

// One document per subject + unit combo
PYQInsightsFeedSchema.index({ subjectCode: 1, unitId: 1 }, { unique: true });

export default mongoose.model('PYQInsightsFeed', PYQInsightsFeedSchema);