// MODELS/featureFlag.model.js
import { Schema, model } from "mongoose";

const featureFlagSchema = new Schema({

  // ── Identity ──────────────────────────────────
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    // e.g. "arkshots_homepage_section"
  },

  name:        { type: String, required: true },  // "ArkShots Homepage Section"
  description: { type: String, default: "" },

  // ── Master switch ─────────────────────────────
  isEnabled: { type: Boolean, default: false },

  // ── Rollout strategy ─────────────────────────
  rollout: {
    type: {
      type: String,
      enum: [
        "WHITELIST",    // only specific userIds
        "PERCENTAGE",   // random X% of eligible users
        "ALL",          // everyone who passes rules
      ],
      default: "WHITELIST",
    },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    // Explicit user whitelist
    userIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },

  // ── Eligibility rules (AND logic — all must pass) ──
  rules: {
    // Only specific semesters
    semesters: {
      type: [Number],
      default: [],   // empty = no filter
    },

    // Only specific branches
    branches: {
      type: [String],
      default: [],
    },

    // Min activity score (we compute from UserActivity)
    minActivityScore: {
      type: Number,
      default: 0,    // 0 = no minimum
    },

    // Profile must be complete
    requireProfileComplete: {
      type: Boolean,
      default: false,
    },
  },

  // ── Metadata ──────────────────────────────────
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });

featureFlagSchema.index({ key: 1 });
featureFlagSchema.index({ isEnabled: 1 });

export default model("FeatureFlag", featureFlagSchema);