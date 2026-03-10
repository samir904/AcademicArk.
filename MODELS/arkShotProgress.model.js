// MODELS/arkShotProgress.model.js
import { Schema, model } from "mongoose";

const ArkShotProgressSchema = new Schema({

  // ── Relations ──────────────────────────────────
  user: {
    type:     Schema.Types.ObjectId,
    ref:      "User",
    required: true,
    index:    true
  },
  arkShot: {
    type:     Schema.Types.ObjectId,
    ref:      "ArkShot",
    required: true,
    index:    true
  },

  // ── Interaction status ─────────────────────────
  // ✅ status is set by BUTTON taps — not swipe direction
  // status: {
  //   type:    String,
  //   enum:    ["seen", "liked", "bookmarked", "revised", "mastered"],
  //   default: "seen"
  // },

  // ── Engagement ─────────────────────────────────
  viewCount: {
    type:    Number,
    default: 1
  },
  lastViewedAt: {
    type:    Date,
    default: Date.now
  },
  firstViewedAt: {
    type:    Date,
    default: Date.now
  },
  timeSpentSeconds: {
    type:    Number,
    default: 0
  },

  // ── Revision system ────────────────────────────
  revisitCount:     { type: Number, default: 0 },
  nextRevisionAt:   { type: Date,   default: null },
  revisionInterval: { type: Number, default: 1 },    // days: 1→3→7→14→30


  // ── Navigation gesture (analytics only) ────────
  // ✅ UPDATED — swipe is ONLY for navigation tracking
  // NOT tied to like/mastered — those are button actions
  lastSwipeDirection: {
    type:    String,
    enum:    ["up", "down", null],   // up=next, down=prev
    default: null
    // stored for analytics: do users go back to re-read?
  },

  // ── Button actions (explicit user intent) ──────
  // ✅ NEW — separate from swipe, tracks what user tapped
  isLiked: {
    type:    Boolean,
    default: false             // ❤️ button
  },
  isBookmarked: {
    type:    Boolean,
    default: false             // 🔖 button
  },
  isMastered: {
    type:    Boolean,
    default: false,            // ✅ "Got it" button
    index:   true
  },
  masteredAt: {
    type:    Date,
    default: null              // when they tapped "Got it"
  },
  likedAt: {
    type:    Date,
    default: null
  },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────
ArkShotProgressSchema.index({ user: 1, arkShot: 1 }, { unique: true });
ArkShotProgressSchema.index({ user: 1, isMastered: 1 });                // "show mastered shots"
ArkShotProgressSchema.index({ user: 1, isLiked: 1 });                   // "show liked shots"
ArkShotProgressSchema.index({ user: 1, isBookmarked: 1 });              // "show saved shots"
ArkShotProgressSchema.index({ user: 1, lastViewedAt: -1 });             // "continue from here"
ArkShotProgressSchema.index({ user: 1, nextRevisionAt: 1 });            // spaced repetition cron

export default model("ArkShotProgress", ArkShotProgressSchema);
