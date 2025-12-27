import { Schema, model } from "mongoose";

const ConsoleLogSchema = new Schema({
  // Log level
  level: {
    type: String,
    enum: ['log', 'info', 'warn', 'error', 'debug'],
    required: true,
    index: true
  },

  // Log message
  message: {
    type: String,
    required: true
  },

  // Additional data
  data: {
    type: Schema.Types.Mixed,
    default: null
  },

  // Source
  source: {
    type: String,
    default: 'console'  // 'console' or 'server'
  },

  // Stack trace (for errors)
  stackTrace: String,

  // Context
  context: {
    type: String,
    default: 'general'  // service name, middleware name, etc.
  },

  // User context
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  userEmail: String,

  // Request context
  requestId: String,
  correlationId: String,

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }

}, { timestamps: true });

// Indexes
ConsoleLogSchema.index({ timestamp: -1 });
ConsoleLogSchema.index({ level: 1 });
ConsoleLogSchema.index({ context: 1 });
ConsoleLogSchema.index({ userId: 1, timestamp: -1 });
ConsoleLogSchema.index({ level: 1, timestamp: -1 });

// Auto-delete logs older than  6 hours
ConsoleLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 21600 });

export default model('ConsoleLog', ConsoleLogSchema);
