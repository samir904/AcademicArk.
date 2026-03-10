// MODELS/arkShotSession.model.js
import { Schema, model } from "mongoose";

const ArkShotSessionSchema = new Schema({

  // ── Relations ──────────────────────────────────
  user: {
    type:     Schema.Types.ObjectId,
    ref:      "User",
    required: true,
    index:    true
  },

  // ── Session Identity ───────────────────────────
  sessionId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true
  },

  // ── Entry Point ────────────────────────────────
  entrySource: {
    type:    String,
    enum:    [
      "homepage_section",
      "direct",
      "collection",
      "subject_feed",
      "revision_reminder",
      "notification",
      "utm_instagram",
      "utm_whatsapp",
      "utm_twitter",
      "utm_facebook",
      "utm_telegram",
      "utm_youtube",
      "utm_linkedin",
      "utm_google",
      "utm_email",
      "utm_qr",
      "utm_paid",
      "utm_referral",
      "utm_campaign",
    ],
    default: "direct",
    index:   true
  },

  // ── UTM Attribution ────────────────────────────
  utm: {
    source:     { type: String, default: null },
    medium:     { type: String, default: null },
    campaign:   { type: String, default: null },
    content:    { type: String, default: null },
    term:       { type: String, default: null },
    campaignId: {
      type:    Schema.Types.ObjectId,
      ref:     "UTMCampaign",
      default: null
    },
  },

  // ── Session Context ────────────────────────────
  context: {
    semester:     { type: Number, default: null },
    subject:      { type: String, default: null },
    unit:         { type: Number, default: null },
    collectionId: {
      type:    Schema.Types.ObjectId,
      ref:     "ArkShotCollection",
      default: null
    }
  },

  // ── Timing ─────────────────────────────────────
  startedAt:            { type: Date,    default: Date.now, index: true },
  endedAt:              { type: Date,    default: null },
  totalDurationSeconds: { type: Number,  default: 0 },
  isCompleted:          { type: Boolean, default: false },

  // ── Cards Seen This Session ────────────────────
  shotsViewed: [{
    arkShot:          { type: Schema.Types.ObjectId, ref: "ArkShot" },
    viewedAt:         { type: Date,   default: Date.now },
    timeSpentSeconds: { type: Number, default: 0 },
    // MODELS/arkShotSession.model.js — shotsViewed.action
    action: {
      type:    String,
      enum:    ["seen", "opened", "liked", "bookmarked", "mastered", "skipped"],
      default: "seen"
    },


    // ── Re-visit signal ──────────────────────────
    isReview: { type: Boolean, default: false },  // true = scrolled back to this shot

    // ── 1. Scroll Velocity ───────────────────────
    // How fast did the user arrive at this card?
    // Low ms = fast swipe-through (not interested)
    // High ms = slow careful scroll (engaged)
    scrollVelocityMs: {
      type:    Number,
      default: null,   // null = first card (no previous card to measure from)
    },

    // ── 2. Pause Events ──────────────────────────
    // Each distinct pause the user made while on this card
    // A pause = user stopped scrolling mid-card for ≥1.5s
    // Multiple pauses per card are possible (e.g. read title, scroll down, re-read)
    pauses: [{
      startedAt:       { type: Date,   required: true },
      durationSeconds: { type: Number, required: true },  // how long they paused
    }],
    totalPauseSeconds: { type: Number, default: 0 },  // sum of all pauses (cached)
    pauseCount:        { type: Number, default: 0 },  // how many pauses on this card

    // ── 3. Swipe Hesitation ──────────────────────
    // User started swiping away but came back = "hmm this is important"
    // hesitationCount = number of back-and-forth swipe attempts before leaving
    hesitationCount: { type: Number, default: 0 },

    // ── 4. Read Depth (scroll %) ─────────────────
    // How far down the card did the user scroll?
    // 0 = saw title only, 100 = scrolled to bottom (tags/stats)
    // Extremely powerful for long cards with diagrams
    readDepthPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── 5. Interaction Before Leave ─────────────
    // Did user interact with anything before leaving this card?
    // e.g. expanded definition, opened lightbox, tapped Read More
    // Complements action field — action = liked/bookmarked, this = micro-interactions
    expandedDefinition: { type: Boolean, default: false },
    openedDiagram:      { type: Boolean, default: false },
  }],

  // ── Session Stats (cached) ─────────────────────
  totalShotsViewed:  { type: Number, default: 0 },
  uniqueShotsViewed: { type: Number, default: 0 },
  totalLiked:        { type: Number, default: 0 },
  totalMastered:     { type: Number, default: 0 },
  totalSkipped:      { type: Number, default: 0 },
  totalBookmarked:   { type: Number, default: 0 },

  // ── Scroll Behaviour Summary (session-level) ──
  // Derived from per-card signals above — cached for fast admin queries
  scrollBehaviour: {
    avgVelocityMs:       { type: Number, default: null },  // avg swipe speed this session
    avgPauseSeconds:     { type: Number, default: null },  // avg pause per card
    totalHesitations:    { type: Number, default: 0 },     // total swipe-backs this session
    fastSwipeCount:      { type: Number, default: 0 },     // cards seen in <1s (skimming)
    deepReadCount:       { type: Number, default: 0 },     // cards with readDepth ≥ 80%
    avgReadDepthPercent: { type: Number, default: null },  // avg scroll depth per card
  },

  // ── Device Info ────────────────────────────────
  device: {
    type:    String,
    enum:    ["mobile", "tablet", "desktop"],
    default: "mobile"
  },

  // ── Drop-off Tracking ──────────────────────────
  lastShotSeen: {
    type:    Schema.Types.ObjectId,
    ref:     "ArkShot",
    default: null
  },
  dropOffReason: {
    type:    String,
    enum:    ["tab_closed", "navigated_away", "session_timeout", "completed_feed", null],
    default: null
  },

  // ── View Mode Analytics ────────────────────────
  viewMode: {
    type:    String,
    enum:    ['snap', 'list'],
    default: 'snap',
    index:   true
  },

  modeSwitch: {
    switched:    { type: Boolean, default: false },
    switchCount: { type: Number,  default: 0 },
    startedAs:   { type: String,  enum: ['snap', 'list', null], default: null },
    endedAs:     { type: String,  enum: ['snap', 'list', null], default: null },
  },

  // ── Per-mode Shot Stats ────────────────────────
  snapStats: {
    shotsViewed:      { type: Number, default: 0 },
    totalTimeSeconds: { type: Number, default: 0 },
  },
  listStats: {
    shotsViewed:      { type: Number, default: 0 },
    totalTimeSeconds: { type: Number, default: 0 },
  },

  // ── A/B Test Tracking ──────────────────────────
  abTest: {
    experimentId: { type: String,  default: null },
    variant: {
      type:    String,
      enum:    ['snap_default', 'list_default', null],
      default: null,
    },
    assignedAt:   { type: Date,    default: null },
    isControlled: { type: Boolean, default: false },
  },

  // ── TTL ────────────────────────────────────────
  createdAt: {
    type:    Date,
    default: Date.now,
    expires: 90 * 24 * 60 * 60    // auto-delete after 90 days
  },

}, { timestamps: false });


// ── Auto-calculate duration on save ───────────────────────────────────────
ArkShotSessionSchema.pre("save", function (next) {
  if (this.endedAt && this.startedAt) {
    this.totalDurationSeconds = Math.round(
      (this.endedAt - this.startedAt) / 1000
    );
  }
  next();
});


// ── Indexes ───────────────────────────────────────────────────────────────
ArkShotSessionSchema.index({ user: 1, startedAt: -1 });
ArkShotSessionSchema.index({ user: 1, isCompleted: 1 });
ArkShotSessionSchema.index({ entrySource: 1 });
ArkShotSessionSchema.index({ "context.semester": 1 });
ArkShotSessionSchema.index({ "context.subject": 1 });
ArkShotSessionSchema.index({ endedAt: 1 },                        { sparse: true });
ArkShotSessionSchema.index({ createdAt: -1 });
ArkShotSessionSchema.index({ viewMode: 1, startedAt: -1 });
ArkShotSessionSchema.index({ "modeSwitch.switched": 1 });
ArkShotSessionSchema.index({ "abTest.experimentId": 1, "abTest.variant": 1 });
ArkShotSessionSchema.index({ "utm.source": 1, "utm.medium": 1 });
ArkShotSessionSchema.index({ "utm.campaignId": 1 });
ArkShotSessionSchema.index({ sessionId: 1, user: 1 });
ArkShotSessionSchema.index({ "shotsViewed.arkShot": 1, "shotsViewed.isReview": 1 });

// ✅ NEW — behaviour analytics indexes
ArkShotSessionSchema.index({ "scrollBehaviour.avgVelocityMs": 1 });     // find skimmers
ArkShotSessionSchema.index({ "scrollBehaviour.deepReadCount": -1 });    // find engaged users
ArkShotSessionSchema.index({ "scrollBehaviour.totalHesitations": -1 }); // find uncertain users

export default model("ArkShotSession", ArkShotSessionSchema);
