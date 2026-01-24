import { Schema, model } from "mongoose";

const studyPreferenceSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true,
    index: true
  },

  // Copy from academicProfile
  semester: {
    type: Number,
    required: true
  },

  branch: {
    type: String,
    required: true
  },

  // Planner preferences
  dailyStudyMinutes: {
    type: Number,
    enum: [30, 45, 60, 90, 120,240,360,480,600],
    default: 60
  },

  preferredStudyTime: {
    type: String,
    enum: ["MORNING", "AFTERNOON", "EVENING", "NIGHT"],
    default: "EVENING"
  },

  examDates: [
    {
      subject: {
        type: String,
        required: true
      },
      examDate: {
        type: Date,
        required: true
      },
      priority: {
        type: Number,
        default: 1 // 1 = highest
      }
    }
  ],

  subjectsToFocus: [
    {
      type: String // subject names
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
studyPreferenceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default model("StudyPreference", studyPreferenceSchema);
