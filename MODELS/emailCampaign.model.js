import { Schema, model } from "mongoose";

const emailCampaignSchema = new Schema(
  {
    campaignName: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    ctaText: {
      type: String,
      default: "",
    },
    ctaLink: {
      type: String,
      default: "",
    },
    // ✅ Image fields (existing)
    headerImage: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    // ✅ NEW: Screenshot showcase (Apple-style)
    screenshots: [
      {
        title: String, // "Track Attendance"
        description: String, // "See your attendance at a glance"
        imageUrl: String, // Cloudinary URL
        bgColor: String, // Background color for alternating
      },
    ],
    features: [
      {
        icon: String,
        title: String,
        description: String,
      },
    ],
    targetRole: {
      type: String,
      enum: ["ALL", "USER", "TEACHER", "ADMIN"],
      default: "ALL",
    },
    sentToUsers: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        email: String,
        sentAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pendingUsers: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        email: String,
      },
    ],
    dailyLimit: {
      type: Number,
      default: 100,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "in_progress", "completed", "paused"],
      default: "draft",
    },
    totalUsers: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    completedAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const EmailCampaign = model("EmailCampaign", emailCampaignSchema);

export default EmailCampaign;
