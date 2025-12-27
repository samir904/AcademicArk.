import { Schema, model } from "mongoose";

const RequestLogSchema = new Schema({
  // Request details
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    required: true,
    index: true
  },

  path: {
    type: String,
    required: true,
    index: true
  },

  // Query and body
  query: {
    type: Object,
    default: {}
  },

  body: {
    type: Object,
    default: {}
  },

  // Response details
  statusCode: {
    type: Number,
    required: true,
    index: true
  },

  statusMessage: String,

  // Performance
  responseTime: {
    type: Number,  // milliseconds
    required: true
  },

  // User info
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  userEmail: String,

  // Client info
  ipAddress: String,
  userAgent: String,

  // Error tracking
  error: {
    message: String,
    stack: String,
    code: String
  },

  // Size tracking
  requestSize: Number,
  responseSize: Number,

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }

}, { timestamps: true });

// Indexes for fast queries
RequestLogSchema.index({ timestamp: -1 });
RequestLogSchema.index({ statusCode: 1 });
RequestLogSchema.index({ userId: 1, timestamp: -1 });
RequestLogSchema.index({ method: 1, path: 1 });
RequestLogSchema.index({ statusCode: 1, timestamp: -1 });
// Auto-delete logs older than 6 hours
RequestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 21600 });
// 2592000 seconds = 30 days

export default model('RequestLog', RequestLogSchema);
