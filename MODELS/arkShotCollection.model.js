// MODELS/arkShotCollection.model.js
import { Schema, model } from "mongoose";

const ArkShotCollectionSchema = new Schema({

  name: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 100             // "Unit 3 Rapid Revision"
  },
  description: {
    type:      String,
    trim:      true,
    maxlength: 300
  },
  // ── Cover ───────────────────────────────────────
// Add these fields to your ArkShotCollection schema
coverTemplate: {
  type:    String,
  default: "gradient",
  enum:    ["gradient","aurora","neon","minimal","grid","stripes","radial","glass","duotone","circuit"],
},
colorTheme: {
  type:    String,
  default: "",   // empty = auto from subject
},
coverImage: {
  public_id:  { type: String, default: null },
  secure_url: { type: String, default: null },
},

// coverImage: {
//   type: String,   // Cloudinary URL — stored after admin saves
//   default: null,
// },
// coverColors: {
//   accent: { type: String },   // hex — derived from subject on backend
//   bg:     { type: String },
// },

  emoji: {
    type:    String,
    default: "📦"              // shown in UI
  },

  // ── Filters ────────────────────────────────────
  semester: {
  type:  Number,
  min:   1,
  max:   8,
  index: true,
  default: null        // null = cross-semester collection
},
  subject:  { type: String, trim: true, index: true,lowercase: true },
  unit:     { type: Number, min: 1, max: 10 },

  // ── Content ────────────────────────────────────
  arkShots: [{
    type: Schema.Types.ObjectId,
    ref:  "ArkShot"
  }],
  totalShots: {
    type:    Number,
    default: 0                 // cached count
  },

  // ── Display ────────────────────────────────────
  isActive:  { type: Boolean, default: true, index: true },
  isFeatured:{ type: Boolean, default: false },  // show on homepage
  order:     { type: Number,  default: 0 },      // display order
// MODELS/arkShotCollection.model.js — ADD inside schema

// ── Analytics (cached) ─────────────────────────
// Incremented on each event, no separate model needed
stats: {
  totalOpens:     { type: Number, default: 0, min: 0 },  // detail page opens
  uniqueOpens:    { type: Number, default: 0, min: 0 },  // distinct users who opened
  totalListViews: { type: Number, default: 0, min: 0 },  // appeared on collections page
  shotsViewed:    { type: Number, default: 0, min: 0 },  // shots seen inside collection
  totalLikes:     { type: Number, default: 0, min: 0 },
  totalMastered:  { type: Number, default: 0, min: 0 },
  totalBookmarks: { type: Number, default: 0, min: 0 },
  avgSessionSeconds: { type: Number, default: 0 },       // avg time spent inside
},

// ── Last opened ────────────────────────────────
lastOpenedAt: { type: Date, default: null },

  createdBy: { type: Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });

ArkShotCollectionSchema.index({ semester: 1, subject: 1 });
ArkShotCollectionSchema.index({ isFeatured: 1, order: 1 });
ArkShotCollectionSchema.index({ "stats.totalOpens": -1 });  // most popular collections
ArkShotCollectionSchema.index({ isFeatured: 1, "stats.totalOpens": -1 });

export default model("ArkShotCollection", ArkShotCollectionSchema);
