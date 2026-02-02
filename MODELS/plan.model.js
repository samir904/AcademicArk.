import { Schema, model } from "mongoose";

const planSchema = new Schema({
  code: {
    type: String,
    enum: ["SEMESTER_SUPPORT", "EXAM_BOOST"],
    required: true,
    unique: true
  },

  name: {
    type: String,
    required: true
  },

  description: {
    type: String,
    default: ""
  },

  price: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: "INR"
  },

  validityDays: {
    type: Number,
    required: true
  },

  dailyDownloadLimit: {
    type: Number,
    default: 3
  },

  isActive: {
    type: Boolean,
    default: true
  },

  sortOrder: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default model("Plan", planSchema);
