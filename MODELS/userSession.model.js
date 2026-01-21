// =====================================
// 📊 MODELS/userSession.model.js
// =====================================

import { Schema, model } from "mongoose";

const userSessionSchema = new Schema({
    // User reference
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Session identification
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Session timestamps
    startTime: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    endTime: {
        type: Date,
        default: null
    },

    // Session duration (in seconds)
    duration: {
        type: Number,
        default: 0
    },

    // Session status
    status: {
        type: String,
        enum: ["ACTIVE", "ENDED", "ABANDONED"],
        default: "ACTIVE",
        index: true
    },

    // Device & Browser info
    deviceInfo: {
        deviceType: {
            type: String,
            enum: ["MOBILE", "TABLET", "DESKTOP"],
            default: "DESKTOP"
        },
        userAgent: String,
        browser: String,      // Chrome, Firefox, Safari
        browserVersion: String,
        osName: String,       // iOS, Android, Windows
        osVersion: String
    },

    // Location info
    location: {
        ipAddress: String,
        country: String,
        state: String,
        city: String,
        latitude: Number,
        longitude: Number
    },

    // Session engagement metrics
    engagement: {
        // Page views in this session
        pageViews: {
            type: Number,
            default: 0
        },

        // Total clicks in session
        totalClicks: {
            type: Number,
            default: 0
        },

        // Note-specific interactions
        noteInteractions: {
            viewed: {
                type: Number,
                default: 0
            },
            downloaded: {
                type: Number,
                default: 0
            },
            bookmarked: {
                type: Number,
                default: 0
            },
            rated: {
                type: Number,
                default: 0
            },
            clicked: {
                type: Number,
                default: 0
            }
        },

        // Search interactions
        searches: {
            type: Number,
            default: 0
        },

        // Scroll depth (0-100%)
        maxScrollDepth: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        // Mouse/touch movements
        interactions: {
            type: Number,
            default: 0
        }
    },

    // Page-specific data
    pages: [
        {
            pageName: {
                type: String,
                enum: [
                    "HOMEPAGE",
                    "SEARCH",
                    "NOTES_LIST",
                    "NOTE_DETAIL",
                    "NOTE_READER",
                    "BOOKMARKS",
                    "PROFILE",
                    "LEADERBOARD",
                    "VIDEOS",
                    "OTHER"
                ]
            },

            // Page visit timestamp
            visitTime: {
                type: Date,
                default: Date.now
            },

            // Time spent on page (seconds)
            timeSpent: {
                type: Number,
                default: 0
            },

            // Click count on this page
            clickCount: {
                type: Number,
                default: 0
            },

            // Scroll depth on this page (0-100%)
            scrollDepth: {
                type: Number,
                default: 0
            },

            // Resource viewed (if applicable)
            resourceId: Schema.Types.ObjectId,
            resourceType: {
                type: String,
                enum: ["NOTE", "VIDEO", "PYQ", "QUESTION", "USER"],
                default: null
            },

            // Exit page? (last page before session end)
            isExitPage: {
                type: Boolean,
                default: false
            }
        }
    ],

    // Referrer info
    referrer: {
        source: {
            type: String,
            enum: ["DIRECT", "SEARCH", "SOCIAL", "ORGANIC", "REFERRAL", "OTHER"],
            default: "DIRECT"
        },
        refUrl: String
    },

    // Session entry & exit
    entryPage: String,
    exitPage: String,

    // Bounce info
    bounceInfo: {
        isBounce: {
            type: Boolean,
            default: false  // True if only 1 page viewed and time < 30 seconds
        },
        bounceTime: Number  // Time before bounce (seconds)
    },

    // Custom events during session
    events: [
        {
            eventType: {
                type: String,
                enum: [
                    "PAGE_VIEW",
                    "NOTE_VIEW",
                    "NOTE_DOWNLOAD",
                    "NOTE_BOOKMARK",
                    "NOTE_RATE",
                    "NOTE_CLICK",
                    "HOMEPAGE_SECTION_IMPRESSION", // ✅ ADD
                    "HOMEPAGE_SECTION_CLICK",      // ✅ ADD
                    "SEARCH",
                    "FILTER_APPLIED",
                    "SORT_CHANGED",
                    "ERROR",
                    "CUSTOM"
                ]
            },
            eventName: String,
            timestamp: {
                type: Date,
                default: Date.now
            },
            metadata: Schema.Types.Mixed,
            resourceId: Schema.Types.ObjectId
        }
    ],

    // Click-through rate data
    clickThroughData: {
        continueWhereSectionClicks: { type: Number, default: 0 },
        recommendedNoteClicks: { type: Number, default: 0 },
        trendingNotesClicks: { type: Number, default: 0 },

        // ✅ ADD THESE
        continueWhereSectionImpressions: { type: Number, default: 0 },
        recommendedSectionImpressions: { type: Number, default: 0 },
        trendingSectionImpressions: { type: Number, default: 0 },

        totalSectionClicks: { type: Number, default: 0 },
        totalSectionImpressions: { type: Number, default: 0 },

        ctr: { type: Number, default: 0 }
    },


    // Session source/campaign
    campaign: {
        source: String,
        medium: String,
        campaign: String
    },

    // Conversion tracking
    conversions: [
        {
            type: {
                type: String,
                enum: ["DOWNLOAD", "BOOKMARK", "RATING", "REGISTRATION"]
            },
            timestamp: Date,
            resourceId: Schema.Types.ObjectId
        }
    ],

    // Last activity time (for session timeout)
    lastActivityTime: {
        type: Date,
        default: Date.now
    },

    // TTL for data cleanup (90 days)
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        expires: 90 * 24 * 60 * 60  // Auto-delete after 90 days
    }

}, {
    timestamps: true
});

// Compound indexes for efficient queries
userSessionSchema.index({ userId: 1, startTime: -1 });
userSessionSchema.index({ userId: 1, status: 1 });
userSessionSchema.index({ sessionId: 1, userId: 1 });
userSessionSchema.index({ startTime: -1, status: 1 });
userSessionSchema.index({ "engagement.noteInteractions.viewed": 1 });
userSessionSchema.index({ "clickThroughData.continueWhereSectionClicks": 1 });
userSessionSchema.index({ "pages.pageName": 1 });
userSessionSchema.index({ "events.eventType": 1 });
userSessionSchema.index({ "events.resourceId": 1 });
userSessionSchema.index({ createdAt: 1 });
userSessionSchema.index({ startTime: 1 });

const UserSession = model("UserSession", userSessionSchema);

export default UserSession;