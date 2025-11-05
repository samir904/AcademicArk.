// models/adminLog.model.js
import { Schema, model } from 'mongoose';

const adminLogSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['DELETE_USER', 'DELETE_NOTE', 'UPDATE_ROLE', 'CREATE_BANNER', 'EDIT_BANNER', 'DELETE_BANNER'],
    required: true
  },
  targetType: {
    type: String,
    enum: ['USER', 'NOTE', 'BANNER', 'ROLE'],
    required: true
  },
  targetId: {
    type: String,
    required: true
  },
  targetName: {
    type: String
  },
  details: {
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS'
  },
  errorMessage: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

adminLogSchema.index({ adminId: 1, timestamp: -1 });
adminLogSchema.index({ action: 1, timestamp: -1 });
adminLogSchema.index({ timestamp: -1 });

const AdminLog = model('AdminLog', adminLogSchema);
export default AdminLog;