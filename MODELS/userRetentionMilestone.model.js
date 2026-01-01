import { Schema, model } from "mongoose";

const userRetentionMilestoneSchema = new Schema({
    // User reference
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },

    // Registration info
    registrationDate: {
        type: Date,
        required: true,
        default: Date.now
    },

    // Milestone completion tracking
    milestones: {
        // 1. Registration (auto-completed)
        registered: {
            completed: {
                type: Boolean,
                default: true
            },
            completedAt: {
                type: Date,
                default: Date.now
            }
        },

        // 2. First login
        firstLogin: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number
        },

        // 3. Profile completion
        profileCompleted: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number
        },

        // 4. First note view
        firstNoteView: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number,
            noteId: Schema.Types.ObjectId
        },

        // 5. First note download
        firstNoteDownload: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number,
            noteId: Schema.Types.ObjectId
        },

        // 6. First interaction (rating/review/bookmark)
        firstInteraction: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number,
            interactionType: {
                type: String,
                enum: ["RATING", "REVIEW", "BOOKMARK"]
            },
            noteId: Schema.Types.ObjectId
        },

        // 7. Multiple activities (shows sustained engagement)
        multipleDownloads: {
            completed: Boolean,
            completedAt: Date,
            daysSinceRegistration: Number,
            downloadCount: Number
        }
    },

    // Activity metrics
    metrics: {
        // Total activities
        totalLogins: {
            type: Number,
            default: 0
        },
        
        totalNoteViews: {
            type: Number,
            default: 0
        },
        
        totalNoteDownloads: {
            type: Number,
            default: 0
        },
        
        totalRatings: {
            type: Number,
            default: 0
        },
        
        totalReviews: {
            type: Number,
            default: 0
        },
        
        totalBookmarks: {
            type: Number,
            default: 0
        },

        // Engagement score (0-100)
        engagementScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        // Last activity
        lastActivityAt: Date,
        
        // Days since last activity
        daysSinceLastActivity: Number
    },

    // Retention status
    retentionStatus: {
        type: String,
        enum: [
            "CHURNED",          // Hasn't logged in 30+ days
            "AT_RISK",          // Hasn't logged in 14+ days
            "ACTIVE",           // Logged in within 7 days
            "HIGHLY_ACTIVE"     // Logged in within 1 day
        ],
        default: "ACTIVE"
    },

    // Churn prediction
    churnProbability: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },

    // Last updated
    lastUpdated: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

// Index for retention analysis
userRetentionMilestoneSchema.index({ userId: 1 });
userRetentionMilestoneSchema.index({ retentionStatus: 1 });
userRetentionMilestoneSchema.index({ 'milestones.firstLogin.completedAt': 1 });

const UserRetentionMilestone = model("UserRetentionMilestone", userRetentionMilestoneSchema);

export default UserRetentionMilestone;
