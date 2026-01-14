import { Schema, model } from "mongoose";
import mongoose from "mongoose";

const videoLectureSchema = new Schema(
  {
    // BASIC INFO
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [150, "Title must be less than 150 characters"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [2000, "Description must be less than 2000 characters"],
    },

    // ACADEMIC FIELDS (aligned with Note)
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "Subject must be less than 50 characters"],
    },
    course: {
      type: String,
      required: true,
      trim: true,
      enum: ["BTECH"],
      default: "BTECH",
      maxlength: [50, "Course name must be less than 50 characters"],
    },
    semester: {
      type: Number,
      required: true,
      min: [1, "Semester must be at least 1"],
      max: [8, "Semester cannot exceed 8"],
    },
    university: {
      type: String,
      required: true,
      trim: true,
      enum: ["AKTU"],
      default: "AKTU",
    },

    // CHAPTER INFO
    chapterNumber: {
      type: Number,
      required: true,
      min: [1, "Chapter must be at least 1"],
      max: [100, "Chapter cannot exceed 100"],
    },
    chapterTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Chapter title must be less than 100 characters"],
    },

    // VIDEO SOURCE
    videoUrl: {
      type: String,
      required: true,
      trim: true,
      // basic URL validation
      match: [/^https?:\/\/.+/, "Please provide a valid URL"],
    },

    // Parsed data for embedding
    platform: {
      type: String,
      enum: ["YOUTUBE", "VIMEO", "OTHER"],
      default: "YOUTUBE",
    },
    videoId: {
      type: String, // e.g. YouTube video ID
      required: true,
    },
    embedUrl: {
      type: String, // iframe URL
      required: true,
    },

    // THUMBNAIL
    thumbnailUrl: {
      type: String,
      required: true,
    },

    // META
    durationSeconds: {
      type: Number,
      default: 0, // you can fill later via API if you want
    },

    // RELATIONS
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ENGAGEMENT (similar to Note)
    views: {
      type: Number,
      default: 0,
      min: [0, "Views cannot be negative"],
    },
    viewedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    rating: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: [1, "Rating must be at least 1"],
          max: [5, "Rating cannot exceed 5"],
        },
        review: {
          type: String,
          trim: true,
          maxlength: [200, "Review must be less than 200 characters"],
        },
      },
    ],
    bookmarkedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance (similar style to notes)
videoLectureSchema.index({ subject: 1, semester: 1 });
videoLectureSchema.index({ university: 1, course: 1 });
videoLectureSchema.index({ uploadedBy: 1 });
videoLectureSchema.index({ chapterNumber: 1 });
videoLectureSchema.index({ views: -1 });

// Virtual for total bookmarks
videoLectureSchema.virtual("totalBookmarks").get(function () {
  return this.bookmarkedBy.length;
});

const VideoLecture =
  mongoose.models.VideoLecture || model("VideoLecture", videoLectureSchema);

export default VideoLecture;
