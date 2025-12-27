import { Schema, model } from "mongoose";

const LoginLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Login status
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success',
    index: true
  },

  // IP & Network Info
  ipAddress: {
    type: String,
    required: true,
    index: true
  },

  // Browser Info
  browser: {
    name: String,           // Chrome, Firefox, Safari, etc
    version: String,        // 120.0.0
  },

  // OS Info
  os: {
    name: String,           // Windows, macOS, Linux, iOS, Android
    version: String,        // 10, 14.0, etc
  },

  // Device Info
  device: {
    type: String,           // desktop, mobile, tablet
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },

  // Device Details
  deviceName: String,        // iPhone, Samsung Galaxy, etc

  // User Agent (raw string for debugging)
  userAgent: String,

  // Location (optional - requires IP geolocation service)
  location: {
    country: String,
    city: String,
    region: String,
    timezone: String,
    latitude: Number,
    longitude: Number,
  },

  // Session Info
  sessionId: String,
  sessionDuration: Number,   // in seconds
  
  // Login method
  loginMethod: {
    type: String,
    enum: ['email', 'google', 'github'],
    default: 'email'
  },

  // Additional info
  failureReason: String,     // if status is 'failed'
  isNewLocation: Boolean,    // first time login from this location
  isSuspicious: Boolean,     // flagged as unusual activity

  // Timestamps
  loginTime: {
    type: Date,
    default: Date.now,
    index: true
  },

  logoutTime: Date,

}, { timestamps: true });

// Indexes for quick queries
LoginLogSchema.index({ userId: 1, loginTime: -1 });
LoginLogSchema.index({ ipAddress: 1 });
LoginLogSchema.index({ loginTime: -1 });
LoginLogSchema.index({ 'device.type': 1 });
LoginLogSchema.index({ status: 1 });

export default model('LoginLog', LoginLogSchema);
