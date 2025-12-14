import { Schema, model } from "mongoose";

const feedbackSchema = new Schema({
    // User who gave feedback
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Type of feedback
    feedbackType: {
        type: String,
        enum: [
            "BUG_REPORT",      // Found a bug
            "FEATURE_REQUEST", // Suggest new feature
            "UI_UX",           // Design/UX feedback
            "PERFORMANCE",     // App is slow/issues
            "CONTENT",         // Notes/content quality
            "OTHER"            // General feedback
        ],
        required: true
    },

    // Feedback subject
    subject: {
        type: String,
        required: true,
        trim: true,
        minlength: [5, "Subject must be at least 5 characters"],
        maxlength: [100, "Subject must be less than 100 characters"]
    },

    // Detailed feedback message
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, "Message must be at least 10 characters"],
        maxlength: [2000, "Message must be less than 2000 characters"]
    },

    // Rating (1-5)
    rating: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
        required: true
    },

    // Optional: Screenshots/attachments
    attachments: [
        {
            public_id: String,
            secure_url: String,
            fileName: String
        }
    ],

    // Status
    status: {
        type: String,
        enum: ["NEW", "IN_REVIEW", "ACKNOWLEDGED", "RESOLVED", "CLOSED"],
        default: "NEW"
    },

    // Admin response
    adminResponse: {
        respondedBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        response: String,
        respondedAt: Date
    },

    // User info snapshot (for reporting)
    userSnapshot: {
        fullName: String,
        email: String,
        role: String,
        branch: String,
        semester: Number,
        college: String
    },

    // For analytics
    page: {
        type: String,
        default: "" // e.g., "/notes", "/browse-requests"
    },

    userAgent: String, // Browser info
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for querying
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ feedbackType: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ 'userSnapshot.branch': 1 });
feedbackSchema.index({ 'userSnapshot.semester': 1 });

const Feedback = model("Feedback", feedbackSchema);

export default Feedback;
