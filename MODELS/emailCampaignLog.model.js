// MODELS/emailCampaignLog.model.js
import { Schema, model } from 'mongoose';

const emailCampaignLogSchema = new Schema({
  subject:    { type: String, required: true },
  audience:   { type: String, required: true },

  // Only one of these will be set depending on audience
  flagKey:    { type: String,                   default: null },
  campaignId: { type: Schema.Types.ObjectId,    default: null },

  utm: {
    utm_source:   { type: String, default: 'email' },
    utm_medium:   { type: String, default: 'email' },
    utm_campaign: { type: String, default: ''      },
  },

  sent:   { type: Number, default: 0 },
  sentAt: { type: Date,   default: Date.now },
  sentBy: { type: Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

emailCampaignLogSchema.index({ sentAt: -1 });
emailCampaignLogSchema.index({ audience: 1 });
emailCampaignLogSchema.index({ flagKey: 1 });

export default model('EmailCampaignLog', emailCampaignLogSchema);