import { Schema, model } from "mongoose";

const userActivitySchema = new Schema({
    // User reference
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Activity type tracking
    activityType: {
        type: String,
        enum: [
            "REGISTRATION",      // User registered
            "LOGIN",             // User logged in
            "PROFILE_COMPLETED", // Completed profile
            "NOTE_VIEWED",       // Viewed a note
            "NOTE_DOWNLOADED",   // Downloaded a note
            "NOTE_RATED",        // Rated a note
            "NOTE_REVIEWED",     // Added a review
            "NOTE_BOOKMARKED",   // Bookmarked a note
            "NOTE_SHARED",       // Shared a note
            "SEARCH_PERFORMED",  // Performed search
            "LOGOUT"             // User logged out
        ],
        required: true,
        index: true
    },

    // Resource details (optional - depends on activity type)
    resourceId: {
        type: Schema.Types.ObjectId,
        ref: "Note",
        default: null
    },
    
    resourceType: {
        type: String,
        enum: ["NOTE", "PYQ", "QUESTION", "HANDWRITTEN", "USER_PROFILE"],
        default: null
    },

    // Metadata
    metadata: {
        // For login activities
        ipAddress: String,
        userAgent: String,
        deviceType: {
            type: String,
            enum: ["MOBILE", "TABLET", "DESKTOP"],
            default: "DESKTOP"
        },
        
        // For view/download activities
        viewDuration: Number,      // seconds spent
        downloadSize: Number,      // bytes
        
        // For rating/review activities
        ratingValue: {
            type: Number,
            min: 1,
            max: 5,
            default: null
        }
    },

    // Session tracking
    sessionId: String,

    // Location
    location: {
        country: String,
        state: String,
        city: String
    },

    // Timestamp
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        expires: 90 * 24 * 60 * 60 // Auto-delete after 90 days
    }

}, {
    timestamps: false
});

// Indexes for efficient queries
userActivitySchema.index({ userId: 1, createdAt: -1 });
userActivitySchema.index({ activityType: 1, createdAt: -1 });
userActivitySchema.index({ resourceId: 1, activityType: 1 });
userActivitySchema.index({ userId: 1, activityType: 1 });

const UserActivity = model("UserActivity", userActivitySchema);

export default UserActivity;
