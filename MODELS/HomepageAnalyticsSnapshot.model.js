import { Schema, model } from "mongoose";

const homepageAnalyticsSnapshotSchema = new Schema({

  // ── Date (one doc per day)
  date: {
    type: String,   // "2026-02-22"
    unique: true,
    index: true
  },

  // ── Overall homepage
  overview: {
    totalVisits:        { type: Number, default: 0 },
    uniqueVisitors:     { type: Number, default: 0 },
    totalImpressions:   { type: Number, default: 0 },
    totalClicks:        { type: Number, default: 0 },
    overallCTR:         { type: Number, default: 0 },  // percentage
    avgSectionsViewed:  { type: Number, default: 0 },  // how far user scrolled
  },

  // ── Per section breakdown
  sections: [
    {
      section:     String,
      impressions: { type: Number, default: 0 },
      clicks:      { type: Number, default: 0 },
      ctr:         { type: Number, default: 0 },  // clicks/impressions * 100
    }
  ],

  // ── Top clicked cards
  topClickedCards: [
    {
      resourceId: { type: Schema.Types.ObjectId, ref: "Note" },
      title:      String,
      section:    String,
      clicks:     Number,
    }
  ],

  // ── Device breakdown
  deviceBreakdown: {
    mobile:  { type: Number, default: 0 },
    tablet:  { type: Number, default: 0 },
    desktop: { type: Number, default: 0 },
  },

  generatedAt: { type: Date, default: Date.now },

}, { timestamps: false });

export default model("HomepageAnalyticsSnapshot", homepageAnalyticsSnapshotSchema);
