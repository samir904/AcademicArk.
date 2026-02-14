// models/PageView.model.js
import mongoose from "mongoose";

const pageViewSchema = new mongoose.Schema(
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
    // Page Information
    // =========================
    path: {
      type: String,
      required: true,
      index: true
    },

    from: {
      type: String,
      default: null
    },

    // =========================
    // Engagement
    // =========================
    timeSpent: {
      type: Number, // milliseconds
      default: 0
    },

    scrollDepth: {
      type: Number, // max percentage reached (0–100)
      default: 0
    },

    // =========================
    // Metadata
    // =========================
    entryAt: {
      type: Date,
      default: Date.now
    },

    exitAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("PageView", pageViewSchema);
