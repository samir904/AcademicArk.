// MODELS/arkShotAnalytics.model.js
import { Schema, model } from "mongoose";

const ArkShotAnalyticsSchema = new Schema({

  // ── Relation ───────────────────────────────────
  arkShot: {
    type:     Schema.Types.ObjectId,
    ref:      "ArkShot",
    required: true,
    unique:   true,
    index:    true
  },

  // ── Aggregate counters ─────────────────────────
  totalViews:       { type: Number, default: 0 },
  totalLikes:       { type: Number, default: 0 },
  totalBookmarks:   { type: Number, default: 0 },
  totalMastered:    { type: Number, default: 0 },
  totalSkipped:     { type: Number, default: 0 },  // left swipe count
  totalRevised:     { type: Number, default: 0 },

  // ── Time analytics ─────────────────────────────
  totalTimeSpentSeconds: { type: Number, default: 0 },
  averageTimeSpentSeconds: { type: Number, default: 0 },

  // ── Difficulty signal ──────────────────────────
  // if skipped >> mastered → concept is confusing
  skipToMasteredRatio: {
    type:    Number,
    default: 0                  // auto-calculated
  },
  confusionScore: {
    type:    Number,
    default: 0,
    min:     0,
    max:     100                // 🔥 high = students find this hard
  },

  // ── Daily breakdown (last 30 days) ─────────────
  dailyStats: [{
    date:   { type: Date },
    views:  { type: Number, default: 0 },
    likes:  { type: Number, default: 0 },
  }],

  // ── Last computed ──────────────────────────────
  lastUpdatedAt: {
    type:    Date,
    default: Date.now
  },

}, { timestamps: true });

// ── Auto-calculate confusionScore before save ───────────────────────────────
ArkShotAnalyticsSchema.pre("save", function (next) {
  if (this.totalViews > 0) {
    // high skips + low mastered = confusing concept
    this.skipToMasteredRatio = this.totalSkipped / (this.totalMastered || 1);
    this.confusionScore      = Math.min(
      100,
      Math.round((this.totalSkipped / this.totalViews) * 100)
    );
  }
  next();
});

ArkShotAnalyticsSchema.index({ confusionScore: -1 });   // find hardest concepts
ArkShotAnalyticsSchema.index({ totalViews: -1 });        // most popular shots
ArkShotAnalyticsSchema.index({ totalMastered: -1 });     // most mastered
// ArkShotAnalytics — for upsert
ArkShotAnalyticsSchema.index({ arkShot: 1 }, { unique: true });
export default model("ArkShotAnalytics", ArkShotAnalyticsSchema);
