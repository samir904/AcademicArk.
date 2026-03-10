import mongoose, { Schema } from 'mongoose';

const UTMCampaignSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    slug:        { type: String, unique: true, sparse: true, index: true },

    // ── Thumbnail ─────────────────────────────────────────
    thumbnail: {
      public_id:  { type: String, default: null },
      secure_url: { type: String, default: null },
      generatedVariant: {
        type:    String,
        enum:    ['purple', 'blue', 'green', 'custom'],
        default: null,
      },
      source: {
        type:    String,
        enum:    ['auto_generated', 'custom_upload'],
        default: 'auto_generated',
      },
      aspectRatio: {
        type:    String,
        enum:    ['1080x1080', '1920x1080', '1200x630'],
        default: '1200x630',
      },
    },

    // ── UTM Parameters ────────────────────────────────────
    utm_source:   { type: String, required: true, trim: true, lowercase: true },
    utm_medium:   { type: String, required: true, trim: true, lowercase: true },
    utm_campaign: { type: String, required: true, trim: true, lowercase: true },
    utm_term:     { type: String, trim: true, lowercase: true, default: null },
    utm_content:  { type: String, trim: true, lowercase: true, default: null },

    // ── Generated Link ────────────────────────────────────
    baseUrl: { type: String, default: '/arkshots' },
    fullUrl: { type: String },

    // ── Status ────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['active', 'paused', 'archived'],
      default: 'active',
      index:   true,
    },

    // ── Owner ─────────────────────────────────────────────
    createdBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // ── Aggregated Stats ──────────────────────────────────
    stats: {
      totalClicks:          { type: Number, default: 0, min: 0 },
      uniqueVisitors:       { type: Number, default: 0, min: 0 },
      returningUsers:       { type: Number, default: 0, min: 0 },
      registrations:        { type: Number, default: 0, min: 0 },
      shotsViewed:          { type: Number, default: 0, min: 0 },
      shotsBookmarked:      { type: Number, default: 0, min: 0 },
      avgSessionMinutes:    { type: Number, default: 0, min: 0 },
      thumbnailImpressions: { type: Number, default: 0, min: 0 },
    },

    // ── Email Meta (populated when utm_source === 'email') ─
    emailMeta: {
      subject:        { type: String, default: null },
      totalSent:      { type: Number, default: 0, min: 0 },
      totalOpens:     { type: Number, default: 0, min: 0 },
      totalBounces:   { type: Number, default: 0, min: 0 },
      sentAt:         { type: Date,   default: null },
      recipientCount: { type: Number, default: 0, min: 0 },
      targetAudience: {
        type:    String,
        enum:    ['all_users', 'sem4_only', 'active_users', 'inactive_users', 'custom'],
        default: 'all_users',
      },
    },
  },
  { timestamps: true }
);

// ── Virtuals ──────────────────────────────────────────────
UTMCampaignSchema.virtual('conversionRate').get(function () {
  if (!this.stats?.totalClicks) return 0;
  return +((this.stats.registrations / this.stats.totalClicks) * 100).toFixed(2);
});

UTMCampaignSchema.virtual('emailOpenRate').get(function () {
  if (!this.emailMeta?.totalSent) return 0;
  return +((this.emailMeta.totalOpens / this.emailMeta.totalSent) * 100).toFixed(2);
});

UTMCampaignSchema.virtual('emailClickRate').get(function () {
  if (!this.emailMeta?.totalSent) return 0;
  return +((this.stats.totalClicks / this.emailMeta.totalSent) * 100).toFixed(2);
});

UTMCampaignSchema.set('toJSON',   { virtuals: true });
UTMCampaignSchema.set('toObject', { virtuals: true });

// ── Pre-save: slug + fullUrl ───────────────────────────────
UTMCampaignSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    const base = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 75);
    this.slug = `${base}-${Date.now().toString().slice(-4)}`;
  }

  const params = new URLSearchParams({
    utm_source:   this.utm_source,
    utm_medium:   this.utm_medium,
    utm_campaign: this.utm_campaign,
    ...(this.utm_term    && { utm_term:    this.utm_term }),
    ...(this.utm_content && { utm_content: this.utm_content }),
  });
  this.fullUrl = `${process.env.FRONTEND_URL}${this.baseUrl}?${params.toString()}`;

  next();
});

// ── Indexes ───────────────────────────────────────────────
UTMCampaignSchema.index(
  { utm_source: 1, utm_medium: 1, utm_campaign: 1, utm_content: 1 },
  { unique: true, sparse: true }
);
UTMCampaignSchema.index({ utm_campaign: 1 });
UTMCampaignSchema.index({ createdBy: 1, status: 1 });
UTMCampaignSchema.index({ createdAt: -1 });

export default mongoose.model('UTMCampaign', UTMCampaignSchema);
