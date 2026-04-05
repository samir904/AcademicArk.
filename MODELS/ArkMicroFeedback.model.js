import mongoose, { Schema } from "mongoose";

// models/ArkMicroFeedback.model.js
const schema = new Schema({
  user:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shot:          { type: Schema.Types.ObjectId, ref: 'ArkShot', default: null },
  session:       { type: String, default: null },
  triggerType:   { type: String, enum: ['fast', 'pause', 'hesitation', 'general'] },
  initialChoice:  String,
  followUpChoice: String,
}, { timestamps: true });

export default mongoose.model('ArkMicroFeedback', schema);