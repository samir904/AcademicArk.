import mongoose, { Schema } from 'mongoose';

const UTMEventSchema = new Schema(
  {
    // ── Campaign reference ────────────────────────────────
    campaign: {
      type:     Schema.Types.ObjectId,
      ref:      'UTMCampaign',
      required: true,
      index:    true,
    },

    // ── Raw UTM params ────────────────────────────────────
    utm_source:   { type: String, lowercase: true, default: null },
    utm_medium:   { type: String, lowercase: true, default: null },
    utm_campaign: { type: String, lowercase: true, default: null },
    utm_term:     { type: String, lowercase: true, default: null },
    utm_content:  { type: String, lowercase: true, default: null },

    // ── Visitor identity ──────────────────────────────────
    user:         { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fingerprint:  { type: String, default: null },
    ip:           { type: String, default: null },
    userAgent:    { type: String, default: null },
    isFirstVisit: { type: Boolean, default: false },

    // ── Event type ────────────────────────────────────────
    eventType: {
      type:     String,
      required: true,
      enum: [
        'page_visit',
        'session_start',
        'shot_viewed',
        'shot_bookmarked',
        'registration',
        'thumbnail_impression',
        'cta_click',
        'email_open',
      ],
    },

    // ── Extra context ─────────────────────────────────────
    meta: {
  shotId:           { type: Schema.Types.ObjectId, ref: 'ArkShot', default: null },
  sessionId:        { type: String,  default: null },
  shotsViewedCount: { type: Number,  default: null },
  viewMode:         { type: String,  enum: ['snap', 'list', null], default: null },
  referrer:         { type: String,  default: null },  // where they came FROM
  landingUrl:       { type: String,  default: null },  // ✅ ADD — the UTM link clicked
  deviceType:       { type: String,  enum: ['mobile', 'desktop', 'tablet', null], default: null },
  thumbnailUrl:     { type: String,  default: null },
  thumbnailVariant: { type: String,  enum: ['purple', 'blue', 'green', 'custom', null], default: null },
  campaignVariant:  { type: String,  default: null },
},
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────
UTMEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }   // auto-delete after 1 year
);
UTMEventSchema.index({ campaign: 1, eventType: 1, createdAt: -1 });
UTMEventSchema.index({ utm_campaign: 1, createdAt: -1 });
UTMEventSchema.index({ user: 1, campaign: 1 });
UTMEventSchema.index({ fingerprint: 1, campaign: 1 });
UTMEventSchema.index({ 'meta.thumbnailVariant': 1, campaign: 1 });

export default mongoose.model('UTMEvent', UTMEventSchema);
