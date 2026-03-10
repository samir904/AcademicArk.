// MODELS/PWAInstall.model.js
import { Schema, model } from "mongoose";

const PWAInstallSchema = new Schema(
  {
    // ── PRIMARY KEY — always device-level ────────────────────────────
    fingerprint: {
      type:     String,
      required: true,
      unique:   true,    // ✅ one record per device, always
      index:    true,
    },

    // ── User link — metadata only, NOT the primary key ───────────────
    // A user can have MULTIPLE records (one per device)
    user: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
      index:   true,     // still indexed for user-level queries
    },

    // ── Device classification ─────────────────────────────────────────
    platform: {
      type:    String,
      enum:    ["android", "ios", "desktop", "unknown"],
      default: "unknown",
    },
    deviceType: {
      type:    String,
      enum:    ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown",
    },
    browser:   { type: String, default: null },
    userAgent: { type: String, default: null },  // full UA for debugging

    // ── Prompt history ─────────────────────────────────────────────────
    promptShownAt: { type: Date,   default: null },
    promptCount:   { type: Number, default: 0    },
    promptAction: {
      type:    String,
      enum:    ["installed", "dismissed", "ignored"],
      default: null,
    },
    actionAt:      { type: Date, default: null },

    // ── Re-prompt cooldown ─────────────────────────────────────────────
    nextPromptAt:  { type: Date, default: null },

    // ── Install status ─────────────────────────────────────────────────
    isInstalled:   { type: Boolean, default: false },
    installedAt:   { type: Date,    default: null  },

    // ── Session tracking ───────────────────────────────────────────────
    lastSeenAs: {
      type:    String,
      enum:    ["browser", "installed_pwa"],
      default: "browser",
    },
    lastActiveAt:    { type: Date,   default: null },
    lastEntryPage:   { type: String, default: null },
    pwaSessionCount: { type: Number, default: 0    },
    entryPage:       { type: String, default: null },
    // Add these fields to PWAInstallSchema

// ── Engagement depth ───────────────────────────────────────────────
lastSeenPages: {
  type: [
    {
      page:   { type: String },
      seenAt: { type: Date, default: Date.now },
      mode:   { type: String, enum: ["browser", "installed_pwa"], default: "browser" },
    },
  ],
  default: [],
},
totalPageViews:   { type: Number, default: 0 },
lastSessionDurationSeconds: { type: Number, default: 0 },
avgSessionDurationSeconds:  { type: Number, default: 0 },

// ── Retention signals ──────────────────────────────────────────────
firstSeenAt:      { type: Date, default: null },   // very first visit (browser)
firstPWAOpenAt:   { type: Date, default: null },   // first time opened as PWA
daysSinceInstall: { type: Number, default: 0 },    // computed virtually in queries

// ── Uninstall signal (indirect) ────────────────────────────────────
// If lastSeenAs = 'browser' AND was installed AND lastActiveAt > 7d ago
// → likely uninstalled — no direct browser API for this
wentBackToBrowser:  { type: Boolean, default: false },
    wentBackAt:         { type: Date,    default: null  },
  },                   // ✅ this closes the schema fields object
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────
PWAInstallSchema.index({ user: 1, platform: 1 });        // user's installs per platform
PWAInstallSchema.index({ user: 1, deviceType: 1 });      // user's mobile vs desktop
PWAInstallSchema.index({ isInstalled: 1, platform: 1 }); // stats by platform
PWAInstallSchema.index({ isInstalled: 1, deviceType: 1 });
PWAInstallSchema.index({ nextPromptAt: 1 });
PWAInstallSchema.index({ createdAt: -1 });
// MODELS/PWAInstall.model.js
PWAInstallSchema.index({ lastPWAActiveAt: -1 });   // ✅ ADD — used by all retention queries

export default model("PWAInstall", PWAInstallSchema);
