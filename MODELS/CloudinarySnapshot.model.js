// MODELS/CloudinarySnapshot.model.js
import { Schema, model } from 'mongoose';

const CloudinarySnapshotSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, required: true },

    storage: {
      usedMB:  Number,
      limitGB: Number,
      usedPct: Number,
    },
    bandwidth: {
      usedMB:  Number,
      limitGB: Number,
      usedPct: Number,
    },
    transformations: {
      used:    Number,
      limit:   Number,
      usedPct: Number,
    },
    resources: {
      total:   Number,
      images:  Number,
      videos:  Number,
      raw:     Number,
    },
  },
  {
    // ✅ Time series — efficient for range queries
    timeseries: {
      timeField:   'timestamp',
      granularity: 'hours',
    },
    expireAfterSeconds: 2592000, // 30 days
  }
);

export default model('CloudinarySnapshot', CloudinarySnapshotSchema);
