import { Schema, model } from "mongoose";

const searchAnalyticsSchema = new Schema(
  {
    // 🔍 What user typed (internal search)
    rawQuery: {
      type: String,
      trim: true
    },

    // 🔧 Normalized version
    normalizedQuery: {
      type: String,
      trim: true,
      lowercase: true
    },

    // 🌐 Traffic source
    source: {
      type: String,
      enum: ["internal", "seo", "google", "direct", "social"],
      default: "internal",
      index: true
    },

    // 📄 If came from SEO page
    pageSlug: {
      type: String,
      trim: true,
      index: true
    },

    // 🎯 Intent detection (your powerful system)
    intent: {
      isNotesIntent: { type: Boolean, default: false },
      isHandwrittenIntent: { type: Boolean, default: false },
      isPYQIntent: { type: Boolean, default: false },
      isVideoIntent: { type: Boolean, default: false },
      isImportantIntent: { type: Boolean, default: false },
      detectedCategory: { type: String, default: null }
    },

    // 📊 Results
    resultsCount: {
      type: Number,
      default: 0
    },

    isFailedSearch: {
      type: Boolean,
      default: false,
      index: true
    },

    // 👆 Click behavior
    clickedNoteId: {
      type: Schema.Types.ObjectId,
      ref: "Note"
    },

    clickedPosition: Number,

    // 💰 Conversion
    converted: {
      type: Boolean,
      default: false,
      index: true
    },

    // 👤 User
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    sessionId: String,

    // 📱 Device
    device: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown"
    },

    // 🌍 Context
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

/* 🔥 Indexes */
searchAnalyticsSchema.index({ normalizedQuery: 1, createdAt: -1 });
searchAnalyticsSchema.index({ source: 1, createdAt: -1 });
searchAnalyticsSchema.index({ pageSlug: 1, createdAt: -1 });
searchAnalyticsSchema.index({ converted: 1, createdAt: -1 });
searchAnalyticsSchema.index({ userId: 1, createdAt: -1 });

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
