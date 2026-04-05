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
      "featured_collections",   // ✅ add this
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
  // ✅ Remove ref: "Note" — resourceId stores Note OR Collection IDs
  resourceId:   { type: Schema.Types.ObjectId, default: null },
  resourceType: {
    type:    String,
    enum:    ["NOTE", "COLLECTION", "LINK", "CTA"],  // ✅ add COLLECTION
    default: null,
  },
  ctaLabel:    { type: String, default: null },
  position:    { type: Number, default: null },
  cardSection: { type: String, default: null },
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
