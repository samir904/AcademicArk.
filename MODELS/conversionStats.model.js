import { Schema, model } from "mongoose";

const conversionStatsSchema = new Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },

  // 👀 Exposure
  paywallShown: { type: Number, default: 0 },

  // 🔍 Preview funnel
  previewsStarted: { type: Number, default: 0 },
  previewsEnded: { type: Number, default: 0 },
  previewSupportClicks: { type: Number, default: 0 },

  // 🔒 Lock funnel
  lockDownloadAttempts: { type: Number, default: 0 },

  // 📉 Download limit funnel
  downloadLimitSupportClicks: { type: Number, default: 0 },

  // 💳 Core conversion
  supportClicks: { type: Number, default: 0 },
  paymentStarted: { type: Number, default: 0 },
  paymentSuccess: { type: Number, default: 0 }

}, { timestamps: true });

const ConversionStats = model("ConversionStats", conversionStatsSchema);

export default ConversionStats;
