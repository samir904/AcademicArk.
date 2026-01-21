import { Schema, model } from "mongoose";

const systemFlagSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default model("SystemFlag", systemFlagSchema);
