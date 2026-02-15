import { Schema, model } from "mongoose";

const filterAnalyticsSchema = new Schema(
  {
    // 🔑 Who triggered it
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    sessionId: {
      type: String,
      index: true
    },

    // 📦 Filter Snapshot
    semester: {
      type: Number,
      required: true,
      index: true
    },

    subject: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },

    category: {
      type: String,
      trim: true
    },

    unit: {
      type: Number
    },

    videoChapter: {
      type: Number
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    // 📊 Result Intelligence
    resultsCount: {
      type: Number,
      default: 0
    },

    hasResults: {
      type: Boolean,
      default: true
    },

    // 🔥 NEW: Download Tracking
    downloadedAfterFilter: {
      type: Boolean,
      default: false
    },

    downloadedAt: {
      type: Date,
      default: null
    },

    // ✨ NEW: Which note was downloaded
    downloadedNoteId: {
      type: Schema.Types.ObjectId,
      ref: "Note",
      default: null,
      index: true
    },

    // ✨ NEW: Notes that were viewed (not downloaded)
    viewedNotes: [{
      noteId: {
        type: Schema.Types.ObjectId,
        ref: "Note"
      },
      viewedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // ✨ NEW: Time to conversion (how long until download)
    timeToDownload: {
      type: Number,  // Milliseconds from filter apply to download
      default: null
    },

    // ✨ NEW: Was the filter saved as preset?
    savedAsPreset: {
      type: Boolean,
      default: false
    },

    // ✨ NEW: Device/Platform info
    deviceInfo: {
      platform: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop'],
        default: null
      },
      browser: {
        type: String,
        default: null
      },
      os: {
        type: String,
        default: null
      }
    },

    // ✨ NEW: User engagement metrics
    engagement: {
      scrollDepth: {
        type: Number,  // Percentage (0-100)
        default: 0
      },
      timeOnResults: {
        type: Number,  // Seconds spent viewing results
        default: 0
      },
      notesClicked: {
        type: Number,  // How many notes previewed
        default: 0
      }
    }
  },
  { timestamps: true }
);

// 📊 Indexes for analytics queries
filterAnalyticsSchema.index({
  userId: 1,
  semester: 1,
  subject: 1,
  unit: 1,
  category: 1
});

filterAnalyticsSchema.index({
  downloadedNoteId: 1,
  downloadedAt: -1
});

filterAnalyticsSchema.index({
  createdAt: 1
}, { 
  expireAfterSeconds: 60 * 60 * 24 * 90  // Auto-delete after 90 days
});

// ✨ NEW: Compound index for conversion analysis
filterAnalyticsSchema.index({
  hasResults: 1,
  downloadedAfterFilter: 1,
  semester: 1,
  createdAt: -1
});
// In filterAnalytics.model.js

// ✅ ADD THIS INDEX for session-based queries
filterAnalyticsSchema.index({
  sessionId: 1,
  createdAt: 1
});

// ✅ ADD THIS INDEX for hour-based aggregations
filterAnalyticsSchema.index({
  createdAt: 1,
  sessionId: 1,
  userId: 1
});

const FilterAnalytics = model("FilterAnalytics", filterAnalyticsSchema);
export default FilterAnalytics;
