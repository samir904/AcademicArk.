// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // =========================
    // Identity
    // =========================
    sessionId: {
      type: String,
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    // =========================
    // Event Core
    // =========================
    type: {
      type: String,
      required: true,
      index: true
    },

    page: {
      type: String,
      required: true
    },

    // =========================
    // Optional Metadata
    // =========================
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // =========================
    // Timestamp
    // =========================
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  }
);

export default mongoose.model("Event", eventSchema);


/*
NOTE_CLICK
NOTE_VIEW
PREVIEW_START
PAYWALL_SHOWN
DOWNLOAD_ATTEMPT
DOWNLOAD_SUCCESS
DOWNLOAD_BLOCKED
SUPPORT_CLICKED
SUPPORT_SUCCESS
SEARCH_PERFORMED
FILTER_APPLIED
*/