import mongoose from "mongoose";

const { Schema } = mongoose;

const examInsightSchema = new Schema(
  {
    university: {
      type: String,
      default: "AKTU",
      index: true
    },

    course: {
      type: String,
      default: "BTECH",
      index: true
    },

    subject: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    unit: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      index: true
    },

    topTopics: [
      {
        topic: {
          type: String,
          required: true
        },
        appearanceCount: {
          type: Number,
          required: true
        },
        weight: {
          type: Number,
          required: true
        }
      }
    ],

    examTrend: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      required: true,
      index: true
    },

    recommendation: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

/**
 * 🔑 One insight per subject per unit
 */
examInsightSchema.index(
  {
    subject: 1,
    unit: 1
  },
  { unique: true }
);

const ExamInsight = mongoose.model("ExamInsight", examInsightSchema);

export default ExamInsight;
