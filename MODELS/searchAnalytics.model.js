import { Schema, model } from "mongoose";

const searchAnalyticsSchema = new Schema(
  {
    // 🔍 What user typed
    rawQuery: {
      type: String,
      required: true,
      trim: true
    },

    // 🔧 Normalized version (lowercase, cleaned)
    normalizedQuery: {
      type: String,
      required: true
    },

    // 🎯 Intent detection (from your existing logic)
    intent: {
      isNotesIntent: { type: Boolean, default: false },
      isHandwrittenIntent: { type: Boolean, default: false },
      isPYQIntent: { type: Boolean, default: false },
      isVideoIntent: { type: Boolean, default: false },
      isImportantIntent:{ type: Boolean, default: false },
      detectedCategory: { type: String, default: null }
    },

    // 📊 Search result outcome
    resultsCount: {
      type: Number,
      required: true
    },

    isFailedSearch: {
      type: Boolean,
      default: false // resultsCount === 0
    },

    // 🧑 User info (optional)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // 📱 Device info
    device: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown"
    },

    // 🌍 Context (optional, future use)
    university: {
      type: String,
      default: "AKTU"
    },

    course: {
      type: String,
      default: "BTECH"
    }
  },
  { timestamps: true }
);

/* 🔥 Indexes (IMPORTANT) */
searchAnalyticsSchema.index({ rawQuery: 1 });
searchAnalyticsSchema.index({ normalizedQuery: 1 });
searchAnalyticsSchema.index({ isFailedSearch: 1 });
searchAnalyticsSchema.index({ createdAt: -1 });

export default model("SearchAnalytics", searchAnalyticsSchema);

/*🗃️ 1️⃣ SearchAnalytics (CORE MODEL)

This is the heart of everything.

Tracks:

what user searched

what intent system detected

how many results came

whether it failed

device

timestamp*/
