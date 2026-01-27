import { Schema, model } from "mongoose";
import mongoose from "mongoose";

const videoSchema = new Schema({
    // ✅ Video Metadata
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [5, "Title must be at least 5 characters"],
        maxlength: [150, "Title must be less than 150 characters"]
    },
    
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [20, "Description must be at least 20 characters"],
        maxlength: [1000, "Description must be less than 1000 characters"]
    },
    
    // ✅ YouTube Video Details
    youtubeVideoId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube video ID"]
    },
    
    youtubeUrl: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function(v) {
                return /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=|youtu\.be\//.test(v);
            },
            message: "Invalid YouTube URL"
        }
    },
    
    // ✅ Auto-extracted YouTube Thumbnail
    thumbnail: {
        // YouTube provides free thumbnails at:
        // https://img.youtube.com/vi/{videoId}/maxresdefault.jpg (highest quality)
        // https://img.youtube.com/vi/{videoId}/hqdefault.jpg (high quality)
        // https://img.youtube.com/vi/{videoId}/mqdefault.jpg (medium quality)
        // https://img.youtube.com/vi/{videoId}/default.jpg (default)
        url: {
            type: String,
            required: true
            // Example: https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg
        },
        quality: {
            type: String,
            enum: ["maxres", "hq", "mq", "default"],
            default: "hq"
        }
    },
    
    // ✅ Academic Classification
    subject: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: [50, "Subject must be less than 50 characters"]
        // Examples: "data structures", "algorithms", "web development"
    },
    
    chapter: {
        // Chapter number or name
        number: {
            type: Number,
            required: true,
            min: [1, "Chapter must be at least 1"]
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, "Chapter title must be less than 100 characters"]
        }
    },
    
    semester: {
        type: Number,
        required: true,
        min: [1, "Semester must be at least 1"],
        max: [8, "Semester cannot exceed 8"]
    },
    
    course: {
        type: String,
        required: true,
        enum: ["BTECH"],
        default: "BTECH"
    },
    
    branch: {
        type: String,
        enum: [
            "CSE",
            "IT",
            "ECE",
            "EEE",
            "MECH",
            "CIVIL",
            "CHEMICAL",
            "BIOTECH",
            "ALL"
        ],
        default: "CSE"
    },
    
    university: {
        type: String,
        required: true,
        enum: ["AKTU"],
        default: "AKTU"
    },
    
    // ✅ Video Source & Attribution
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
        // Who added this video to the platform
    },
    
    sourceCreator: {
        // Original creator on YouTube (if different from uploader)
        name: {
            type: String,
            trim: true,
            maxlength: [100, "Creator name must be less than 100 characters"]
        },
        channelUrl: {
            type: String,
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^(https?:\/\/)?(www\.)?youtube\.com\/@?[a-zA-Z0-9_-]+\/?$/.test(v);
                },
                message: "Invalid YouTube channel URL"
            }
        }
    },
    
    // ✅ Duration (extracted from YouTube or manual input)
    duration: {
        type: Number,
        // Duration in seconds (e.g., 3600 = 1 hour)
        required: true,
        min: [1, "Duration must be at least 1 second"]
    },
    
    // ✅ Video Statistics
    statistics: {
        views: {
            type: Number,
            default: 0,
            min: [0, "Views cannot be negative"]
        },
        
        watchTime: {
            // Total watch time in seconds across all users
            type: Number,
            default: 0,
            min: [0, "Watch time cannot be negative"]
        },
        
        averageWatchPercentage: {
            // Average percentage watched (0-100)
            type: Number,
            default: 0,
            min: [0],
            max: [100]
        },
        
        completionRate: {
            // Percentage of users who watched entire video
            type: Number,
            default: 0,
            min: [0],
            max: [100]
        },
        
        engagementScore: {
            // Calculated: (views + likes + bookmarks) / time_since_upload
            type: Number,
            default: 0
        }
    },
    
    // ✅ User Engagement
    viewedBy: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        viewedAt: {
            type: Date,
            default: Date.now
        },
        watchTimeSeconds: {
            // How many seconds they watched
            type: Number,
            default: 0
        },
        watchPercentage: {
            // Percentage of video watched (0-100)
            type: Number,
            default: 0
        },
        completed: {
            // Did they watch the entire video?
            type: Boolean,
            default: false
        }
    }],
    
    ratings: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: [1, "Rating must be at least 1"],
            max: [5, "Rating cannot exceed 5"]
        },
        review: {
            type: String,
            trim: true,
            maxlength: [300, "Review must be less than 300 characters"]
        },
        helpful: {
            type: Number,
            default: 0
            // Count of users who found this review helpful
        },
        ratedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    bookmarkedBy: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    
    // ✅ Playlist Organization
    playlist: {
        type: Schema.Types.ObjectId,
        ref: "VideoPlaylist",
        default: null
    },
    
    playlistPosition: {
        // Position in playlist (for ordering)
        type: Number,
        default: 1
    },
    
    // ✅ Content Management
    isPublished: {
        type: Boolean,
        default: true
    },
    
    isPremium: {
        // Is this a premium/restricted video?
        type: Boolean,
        default: false
    },
    
    tags: [{
        type: String,
        trim: true,
        lowercase: true
        // For search: "important", "must-watch", "shortcut", "exam-prep"
    }],
    
    difficulty: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "intermediate"
    },
    
    // ✅ Metadata
    language: {
        type: String,
        default: "english",
        enum: ["english", "hindi", "hinglish"]
    },
    
    hasSubtitles: {
        type: Boolean,
        default: false
    },
    
    subtitleLanguages: [{
        type: String
        // "english", "hindi", etc.
    }],

}, {
    timestamps: true
});

// ✅ INDEXES FOR PERFORMANCE
videoSchema.index({ subject: 1, semester: 1 });
videoSchema.index({ subject: 1, chapter: 1 });
videoSchema.index({ branch: 1, semester: 1 });
videoSchema.index({ uploadedBy: 1 });
videoSchema.index({ youtubeVideoId: 1 });
videoSchema.index({ "statistics.views": -1 });
videoSchema.index({ "statistics.engagementScore": -1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ tags: 1 });
videoSchema.index({ isPublished: 1, semester: 1, subject: 1 });

// ✅ VIRTUALS
videoSchema.virtual('totalRatings').get(function() {
    return this.ratings.length;
});

videoSchema.virtual('averageRating').get(function() {
    if (this.ratings.length === 0) return 0;
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / this.ratings.length).toFixed(1);
});

videoSchema.virtual('totalBookmarks').get(function() {
    return this.bookmarkedBy.length;
});

videoSchema.virtual('totalViews').get(function() {
    return this.statistics.views;
});

videoSchema.virtual('viewerCount').get(function() {
    return this.viewedBy.length;
});

// ✅ METHODS
videoSchema.methods.getEmbedUrl = function() {
    // Returns embed URL for YouTube iframe
    return `https://www.youtube.com/embed/${this.youtubeVideoId}?controls=1&modestbranding=1&rel=0`;
};

videoSchema.methods.getThumbnailUrl = function() {
    return this.thumbnail.url;
};

videoSchema.methods.getDurationFormatted = function() {
    const hours = Math.floor(this.duration / 3600);
    const minutes = Math.floor((this.duration % 3600) / 60);
    const seconds = this.duration % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const Video = mongoose.models.Video || model("Video", videoSchema);

export default Video;
