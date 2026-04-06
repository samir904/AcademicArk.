/// MODELS/arkShot.model.js
import { Schema, model } from "mongoose";

export const COLOR_SCHEMES = {

  // ── Blue (Computer Networks) ──────────────────
  blue: {
    easy:   { bg: "#152b4e", accent: "#60a5fa", text: "#bfdbfe", pill: "#1e3a5f" },
    medium: { bg: "#0f1f3d", accent: "#3b82f6", text: "#93c5fd", pill: "#172554" },
    hard:   { bg: "#080f1f", accent: "#1d4ed8", text: "#60a5fa", pill: "#0d1a3a" },
  },

  // ── Purple (Operating Systems) ────────────────
  purple: {
    easy:   { bg: "#2a1a45", accent: "#a78bfa", text: "#ddd6fe", pill: "#3b2060" },
    medium: { bg: "#1a0f2e", accent: "#8b5cf6", text: "#c4b5fd", pill: "#2e1a4a" },
    hard:   { bg: "#0e0820", accent: "#6d28d9", text: "#a78bfa", pill: "#1a0f35" },
  },

  // ── Green (DBMS) ──────────────────────────────
  green: {
    easy:   { bg: "#143d25", accent: "#34d399", text: "#a7f3d0", pill: "#1a5230" },
    medium: { bg: "#0d2818", accent: "#10b981", text: "#6ee7b7", pill: "#14432a" },
    hard:   { bg: "#071510", accent: "#059669", text: "#34d399", pill: "#0a2416" },
  },

  // ── Amber (Data Structures) ───────────────────
  amber: {
    easy:   { bg: "#332810", accent: "#fbbf24", text: "#fde68a", pill: "#4a3a10" },
    medium: { bg: "#1f1a0d", accent: "#f59e0b", text: "#fcd34d", pill: "#3a2e0d" },
    hard:   { bg: "#100d05", accent: "#d97706", text: "#fbbf24", pill: "#1f1800" },
  },

  // ── Red (Algorithms) ──────────────────────────
  red: {
    easy:   { bg: "#431010", accent: "#f87171", text: "#fecaca", pill: "#5a1a1a" },
    medium: { bg: "#2d0f0f", accent: "#ef4444", text: "#fca5a5", pill: "#4a1a1a" },
    hard:   { bg: "#180808", accent: "#b91c1c", text: "#f87171", pill: "#280a0a" },
  },

  // ── Cyan (Software Engineering) ───────────────
  cyan: {
    easy:   { bg: "#103030", accent: "#22d3ee", text: "#a5f3fc", pill: "#164040" },
    medium: { bg: "#0f1f1f", accent: "#06b6d4", text: "#67e8f9", pill: "#0f3a3a" },
    hard:   { bg: "#050f0f", accent: "#0891b2", text: "#22d3ee", pill: "#091818" },
  },

  // ── Pink (Computer Organization) ──────────────
  pink: {
    easy:   { bg: "#35152a", accent: "#f472b6", text: "#fbcfe8", pill: "#4a1f3a" },
    medium: { bg: "#1f0f1a", accent: "#ec4899", text: "#f9a8d4", pill: "#3a1a2e" },
    hard:   { bg: "#10080e", accent: "#be185d", text: "#f472b6", pill: "#1e0d1a" },
  },

  // ── Lime (Theory of Computation) ──────────────
  lime: {
    easy:   { bg: "#283010", accent: "#a3e635", text: "#d9f99d", pill: "#354010" },
    medium: { bg: "#1a1f0d", accent: "#84cc16", text: "#bef264", pill: "#2a3a0d" },
    hard:   { bg: "#0d1005", accent: "#65a30d", text: "#a3e635", pill: "#141a08" },
  },

  // ── Orange (Compiler Design) ──────────────────
  orange: {
    easy:   { bg: "#352010", accent: "#fb923c", text: "#fed7aa", pill: "#4a2e10" },
    medium: { bg: "#1f150d", accent: "#f97316", text: "#fdba74", pill: "#3a250d" },
    hard:   { bg: "#100a05", accent: "#c2410c", text: "#fb923c", pill: "#1e1005" },
  },

  // ── Indigo (Default / fallback) ───────────────
  indigo: {
    easy:   { bg: "#242438", accent: "#818cf8", text: "#c7d2fe", pill: "#2e2e50" },
    medium: { bg: "#141414", accent: "#6366f1", text: "#a5b4fc", pill: "#1e1e3a" },
    hard:   { bg: "#08080f", accent: "#4338ca", text: "#818cf8", pill: "#0f0f20" },
  },
  teal: {
  easy:   { bg: "#0d2d2d", accent: "#2dd4bf", text: "#99f6e4", pill: "#1a4a4a" },
  medium: { bg: "#091f1f", accent: "#14b8a6", text: "#5eead4", pill: "#0f3a3a" },
  hard:   { bg: "#040f0f", accent: "#0f766e", text: "#2dd4bf", pill: "#091818" },
},
yellow: {
  easy:   { bg: "#2e2708", accent: "#facc15", text: "#fef08a", pill: "#453a0a" },
  medium: { bg: "#1c1905", accent: "#eab308", text: "#fde047", pill: "#332e08" },
  hard:   { bg: "#0e0d02", accent: "#a16207", text: "#facc15", pill: "#1a1900" },
},
};

// ── Subject → auto color mapping ──────────────────────────────────────────
export const SUBJECT_COLOR_MAP = {
  "computer networks":     "blue",
  "operating system":     "purple",
  "dBMS":                  "green",
  "data structures":       "amber",
  "algorithms":            "red",
  "software engineering":  "cyan",
  "computer organization": "pink",
  "theory of computation": "lime",
  "compiler design":       "orange",
};

const ArkShotSchema = new Schema({

  // ── Core Identity ──────────────────────────────
  subject: {
    type:     String,
    required: true,
    trim:     true,
    lowercase: true,
    index:    true
  },
  semester: [{
  type: Number,
  min: 1,
  max: 8,
  required: true
}],
  unit: {
    type:     Number,
    required: true,
    min:      1,
    max:      10,
    index:    true
  },
  order: {
    type:    Number,
    default: 0,
    index:   true
  },

  // ── Content ────────────────────────────────────
  title: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 120
  },
  concept: {
    type:      String,
    trim:      true,
    maxlength: 500
  },
  definition: {
    type:      String,
    trim:      true,
    maxlength: 700//600
  },
  example: {
    type:      String,
    trim:      true,
    maxlength: 600
  },
  memoryTip: {
    type:      String,
    trim:      true,
    maxlength: 200
  },
  examTip: {
    type:      String,
    trim:      true,
    maxlength: 300//350
  },

  // ── Media ──────────────────────────────────────
  diagram: {
    public_id:  { type: String, default: null },
    secure_url: { type: String, default: null }
  },
  diagramCaption: {
    type:      String,
    trim:      true,
    maxlength: 150,
    default:   null
  },

  // ── Classification ─────────────────────────────
  difficulty: {
    type:    String,
    enum:    ["easy", "medium", "hard"],
    default: "easy",
    index:   true
  },
  tags:           { type: [String], default: [] },
  frequencyScore: { type: Number, default: 0, min: 0, max: 100, index: true },
  isPYQ:          { type: Boolean, default: false, index: true },
  pyqYears:       { type: [Number], default: [] },

  // ── Stats (cached for fast UI render) ──────────
  views: {
    type:    Number,
    default: 0,
    min:     0,
    index:   true           // ✅ NEW — same as Note.views
  },
uniqueViews: {
  type:    Number,
  default: 0,              // ✅ 1 per user (no array needed)
  min:     0
},
  likes: {
    type:    Number,
    default: 0,
    min:     0              // ✅ NEW — cached like count
  },

  // ── 🎨 Theme ───────────────────────────────────
  theme: {
  colorScheme: {
    type:    String,
    enum:    [...Object.keys(COLOR_SCHEMES), null],  // ← allow null
    default: null,   // ← null = "auto assign from subject"
  },
  customBg:     { type: String, default: null },
  customAccent: { type: String, default: null },
  customText:   { type: String, default: null },
},

  // ── Cross-references ───────────────────────────
  relatedNotes: [{
  type: Schema.Types.ObjectId,
  ref:  "Note",
}],
  relatedShots: [{
    type: Schema.Types.ObjectId,
    ref:  "ArkShot"
  }],

  // ── Paywall ────────────────────────────────────
  isLocked: {
    type:    Boolean,
    default: false,
    index:   true
  },

  // ── Status ─────────────────────────────────────
  status: {
    type:    String,
    enum:    ["draft", "published", "archived"],
    default: "draft",
    index:   true
  },
  isActive: {
    type:    Boolean,
    default: true,
    index:   true
  },

  // ── Auto-gen metadata ──────────────────────────
  isAutoGenerated:   { type: Boolean, default: false },
  generatedFromNote: { type: Schema.Types.ObjectId, ref: "Note", default: null },

  // ── Admin ──────────────────────────────────────
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });

// ── Auto-assign color from subject before save ────────────────────────────
ArkShotSchema.pre("save", function (next) {
  // Auto-assign if colorScheme not manually set
  if (!this.theme.colorScheme) {
    const autoColor = SUBJECT_COLOR_MAP[this.subject?.toLowerCase()];
    this.theme.colorScheme = autoColor || "indigo";  // subject match OR indigo fallback
  }
  next();
});

ArkShotSchema.pre("findOneAndUpdate", function (next) {
  const update  = this.getUpdate();
  const subject = update?.subject || update?.$set?.subject;
  const scheme  = update?.["theme.colorScheme"] || update?.$set?.["theme.colorScheme"];

  // Only auto-assign if explicitly cleared to null/empty
  if (subject && !scheme) {
    const autoColor = SUBJECT_COLOR_MAP[subject.toLowerCase()];
    this.set({ "theme.colorScheme": autoColor || "indigo" });
  }
  next();
});


// ── Virtual: resolved theme colors (sent to frontend) ─────────────────────
// ── Virtual: resolved theme colors ────────────────────────────────────────
ArkShotSchema.virtual("resolvedTheme").get(function () {
  const base    = COLOR_SCHEMES[this.theme.colorScheme] || COLOR_SCHEMES.indigo;
  const palette = base[this.difficulty]                 || base.medium;

  return {
    bg:     this.theme.customBg     || palette.bg,
    accent: this.theme.customAccent || palette.accent,
    text:   this.theme.customText   || palette.text,
    pill:   palette.pill,
  };
});

ArkShotSchema.set("toJSON",   { virtuals: true });
ArkShotSchema.set("toObject", { virtuals: true });

// ── Indexes ───────────────────────────────────────────────────────────────
ArkShotSchema.index({ semester: 1, subject: 1, unit: 1, order: 1 });
ArkShotSchema.index({ semester: 1, subject: 1, frequencyScore: -1 });
ArkShotSchema.index({ status: 1, isActive: 1, isLocked: 1 });
ArkShotSchema.index({ tags: 1 });
ArkShotSchema.index({ isPYQ: 1, frequencyScore: -1 });
ArkShotSchema.index({ views: -1 });

export default model("ArkShot", ArkShotSchema);


//v2
//1.) related arkshots ok when we have many arkshots ok for now leave this one out ok 