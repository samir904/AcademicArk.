import { Schema, model } from "mongoose";

const leaderboardSchema = new Schema({
  // Snapshot metadata
  snapshotType: {
    type: String,
    enum: ["DAILY", "WEEKLY", "MONTHLY", "REAL_TIME"],
    default: "DAILY",
    index: true
  },

  // Leaderboard type
  leaderboardType: {
    type: String,
    enum: ["MOST_VIEWED_NOTES", "MOST_DOWNLOADED_NOTES", "TOP_CONTRIBUTORS", "TOP_STUDENTS"],
    required: true,
    index: true
  },

  // Leaderboard entries (top 100 by default)
  entries: [
    {
      rank: {
        type: Number,
        required: true  // 1, 2, 3, etc.
      },

      // For note-based leaderboards
      noteId: {
        type: Schema.Types.ObjectId,
        ref: "Note",
        default: null
      },
      noteTitle: String,
      
      // For user-based leaderboards
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      userName: String,
      userEmail: String,
      userAvatar: String,

      // Metrics
      metrics: {
        views: {
          type: Number,
          default: 0
        },
        downloads: {
          type: Number,
          default: 0
        },
        engagement: {  // views + downloads
          type: Number,
          default: 0
        },
        rating: {
          type: Number,
          default: 0
        },
        totalNotes: {  // For contributor leaderboard
          type: Number,
          default: 0
        }
      },

      // Additional data
      trend: {
        type: String,
        enum: ["UP", "DOWN", "STABLE"],
        default: "STABLE"
      },
      trendValue: Number,  // percentage change from last period

      // Metadata
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // Snapshot info
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  period: {
    startDate: Date,
    endDate: Date
  },

  // Stats
  totalRecords: Number,
  dataQuality: {
    totalActivities: Number,
    uniqueUsers: Number,
    uniqueResources: Number
  }

}, {
  timestamps: true
});

// ✨ INDEXES for performance
leaderboardSchema.index({ leaderboardType: 1, snapshotType: 1, generatedAt: -1 });
leaderboardSchema.index({ generatedAt: -1 });
leaderboardSchema.index({ 'entries.rank': 1 });

const Leaderboard = model("Leaderboard", leaderboardSchema);
export default Leaderboard;
