import { Schema, model } from "mongoose";

const studyProgressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  subject: {
    type: String,
    required: true
  },

  unit: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },

  status: {
    type: String,
    enum: ["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"],
    default: "NOT_STARTED"
  },

  // Tracking
  totalTimeSpent: {
    type: Number, // minutes
    default: 0
  },

  timesReviewed: {
    type: Number,
    default: 0
  },

  notesViewed: [
    {
      noteId: Schema.Types.ObjectId,
      viewedAt: Date
    }
  ],

  // Timestamps
  startedAt: Date,
  lastStudiedAt: Date,
  completedAt: Date,

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: Date
});

// Compound unique index
studyProgressSchema.index(
  { userId: 1, subject: 1, unit: 1 },
  { unique: true, sparse: true }
);

// Auto-update timestamp
studyProgressSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default model("StudyProgress", studyProgressSchema);
