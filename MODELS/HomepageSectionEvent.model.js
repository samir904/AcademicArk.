import { Schema, model } from "mongoose";

const homepageSectionEventSchema = new Schema({

  // ── Who
  userId:    { type: Schema.Types.ObjectId, ref: "User", index: true },
  sessionId: { type: String, index: true },

  // ── What section
  section: {
    type: String,
    enum: [
      "continue_where",
      "study_material_today",
      "new_notes_badge",
      "recommended",
      "trending",
      "attendance",
      "downloads",
      "leaderboard",
      "quick_actions",
    ],
    index: true,
  },

  // ── Event type
  eventType: {
    type: String,
    enum: ["IMPRESSION", "CLICK"],
    index: true,
  },

  // ── Card-level detail (only for CLICK)
  clickMeta: {
    resourceId:   { type: Schema.Types.ObjectId, ref: "Note", default: null },
    resourceType: { type: String, default: null },  // "NOTE", "LINK", "CTA"
    ctaLabel:     { type: String, default: null },  // "Continue Reading", "View all"
    position:     { type: Number, default: null },  // card index (0-based)
    cardSection:  { type: String, default: null },  // "notes", "pyq" inside study_material_today
  },

  // ── Context
  deviceType: {
    type: String,
    enum: ["MOBILE", "TABLET", "DESKTOP"],
    default: "DESKTOP"
  },

  createdAt: { type: Date, default: Date.now, index: true },

}, { timestamps: false, versionKey: false });

// ── Compound index for fast admin queries
homepageSectionEventSchema.index({ section: 1, eventType: 1, createdAt: -1 });
homepageSectionEventSchema.index({ userId: 1, createdAt: -1 });
homepageSectionEventSchema.index({ createdAt: -1, eventType: 1 });

export default model("HomepageSectionEvent", homepageSectionEventSchema);
