// models/userRequest.model.js
import mongoose from 'mongoose';

const userRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestType: {
    type: String,
    enum: ['NOTES', 'PYQ', 'IMPORTANT_QUESTIONS','Handwritten Notes'],
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  college: {
    type: String,
    trim: true
  },
  branch: {
    type: String,
    enum: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEMICAL', 'BIOTECH', 'OTHER'],
    required: true
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'FULFILLED', 'REJECTED'],
    default: 'PENDING'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM'
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  upvoteCount: {
    type: Number,
    default: 0
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fulfilledNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'
  },
  adminNotes: {
    type: String,
    maxlength: 500
  },
  fulfilledAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
userRequestSchema.index({ status: 1, createdAt: -1 });
userRequestSchema.index({ requestedBy: 1 });
userRequestSchema.index({ semester: 1, subject: 1 });
userRequestSchema.index({ upvoteCount: -1 });

export default mongoose.model('UserRequest', userRequestSchema);
