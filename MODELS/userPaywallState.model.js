import { Schema, model } from "mongoose";

const userPaywallStateSchema = new Schema({

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },

  // 🔒 LOCK FLOW
  lockedNotesSeen: { type: Number, default: 0 },
  lockDownloadAttempts: { type: Number, default: 0 },

  // 👀 PREVIEW FLOW
  previewsStarted: { type: Number, default: 0 },
  previewsEnded: { type: Number, default: 0 },
  previewSupportClicks: { type: Number, default: 0 },

  // 🚧 PAYWALL FLOW
  paywallShownCount: { type: Number, default: 0 },
  paywallDismissedCount: { type: Number, default: 0 },

  // 📉 DOWNLOAD LIMIT FLOW
  downloadLimitSupportClicks: { type: Number, default: 0 },
  downloadLimitDismissed: { type: Number, default: 0 },

  // 💳 SUPPORT FLOW
  supportClickedCount: { type: Number, default: 0 },
  supportViewedCount: { type: Number, default: 0 },
  supportDismissedCount: { type: Number, default: 0 },
  paymentStartedCount: { type: Number, default: 0 },

  // 🏁 CONVERSION
  hasConverted: { type: Boolean, default: false },
  convertedAt: { type: Date, default: null },

  // 🕒 Timeline Tracking
  firstExposureAt: { type: Date, default: null },
  lastPaywallShownAt: { type: Date, default: null },
  lastPreviewAt: { type: Date, default: null },
  lastLimitReachedAt: { type: Date, default: null }

}, { timestamps: true });

const UserPaywallState = model("UserPaywallState", userPaywallStateSchema);

export default UserPaywallState;
