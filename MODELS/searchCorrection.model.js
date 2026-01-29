import { Schema, model } from "mongoose";

const searchCorrectionSchema = new Schema(
  {
    // ❌ What users typed
    wrongQuery: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // ✅ Correct / intended query
    correctQuery: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    // 📈 How often this typo occurs
    frequency: {
      type: Number,
      default: 1
    },

    // 🧠 How correction was added
    source: {
      type: String,
      enum: ["auto", "admin", "analytics"],
      default: "analytics"
    },

    // 🟢 Admin control
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* 🔥 Indexes */
searchCorrectionSchema.index({ wrongQuery: 1 });
searchCorrectionSchema.index({ frequency: -1 });

export default model("SearchCorrection", searchCorrectionSchema);
