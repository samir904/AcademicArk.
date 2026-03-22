import { Schema, model } from "mongoose";
import mongoose from "mongoose";

const noteSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, "Title must be at least 3 character long"],
        maxlength: [100, "Title must be less than 100 characters"]
    },
    slug: {
        type: String,
        // required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
        sparse: true
    },
    seoTitle: {
        type: String,
        trim: true,
        maxlength: 150
    },

    seoDescription: {
        type: String,
        trim: true,
        maxlength: 300
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, "Description must be at least 10 character long"],
        maxlength: [500, "Description must be less than 500 characters"]
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,   // ← ADD THIS — auto-lowercases on save
        maxlength: [50, "Subject name must be less than 50 character long "]
    },
    unit: {
        type: Number,
        min: 1,
        max: 20,
        index: true,  // 🔥 IMPORTANT: Makes filtering fast
        sparse: true   // Allows null values
    },

    course: {
        type: String,
        required: true,
        trim: true,
        enum: ["BTECH"],
        default: "BTECH",
        maxlength: [50, "Course name must be less than 50 character"]
    },
    semester: [{
        type: Number,
        min: 1,
        max: 8
    }],

    university: {
        type: String,
        required: true,
        trim: true,
        enum: ["AKTU"],
        default: "AKTU"
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    fileDetails: {
        public_id: {
            type: String,
            required: true
        },
        secure_url: {
            type: String,
            required: true
        }
    },
    previewFile: {
        public_id: String,
        secure_url: String
    },
    category: {
        type: String,
        enum: ["Notes", "Important Question", "PYQ", "Handwritten Notes"],
        default: "Notes"
    },
    // 🔥 NEW: Admin Recommendations
    recommended: {
        type: Boolean,
        default: false,
        index: true  // Fast filtering
    },

    recommendedRank: {
        type: Number,
        default: 0,
        index: true  // For ordering
    },
    downloads: {
        type: Number,
        default: 0,
        min: [0, "Downloads cannot be negative"]
    },
    views: {
        type: Number,
        default: 0,
        min: [0, "Views cannot be negative"]
    },
    viewedBy: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    rating: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: [1, "Rating must be at least  1 "],
            max: [5, "Rating cannot exceed 5"]
        },
        review: {
            type: String,
            trim: true,
            maxlength: [200, "Review must be less than 200 characters"]
        }
    }],
    bookmarkedBy: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    // 🔒 Premium Lock System
    isLocked: {
        type: Boolean,
        default: false,
        index: true
    },

    previewPages: {
        type: Number,
        default: 8,
        min: 1,
        max: 30
    },

}, {
    timestamps: true
})

// Compound Index for optimized recommended notes sorting
noteSchema.index({
    recommended: -1,
    recommendedRank: 1,
    downloads: -1,
    views: -1,
    createdAt: -1
});
// Indexes for performance
noteSchema.index({ subject: 1, semester: 1 });
noteSchema.index({ university: 1, course: 1 });
noteSchema.index({ uploadedBy: 1 });
// note.model.js — add these if not already present

noteSchema.index({ _id: 1, isLocked: 1 });           // access decision fast
noteSchema.index({ viewedBy: 1 });                    // addToSet lookup
noteSchema.index({ "fileDetails.secure_url": 1 });    // preview check

// Virtual for total bookmarks
noteSchema.virtual('totalBookmarks').get(function () {
    return this.bookmarkedBy.length;
});



const Note = mongoose.models.Note || model("Note", noteSchema);

export default Note;