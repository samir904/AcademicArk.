import { Schema, model } from "mongoose";

const NotificationBannerSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String, enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  // ⭐ NEW: Target specific semesters
  targetSemesters: {
    type: [Number],  // [1, 2, 3, 4] or [] for all
    default: [],     // Empty = show to all semesters
    validate: {
      validator: function (v) {
        return v.every(sem => sem >= 1 && sem <= 8);
      },
      message: 'Semester must be between 1 and 8'
    }
  },

  // ⭐ NEW: Target specific roles
  targetRoles: {
    type: [String],  // ['STUDENT', 'Teacher'] or [] for all
    enum: ['USER', 'TEACHER', 'ADMIN', 'GUEST'],
    default: []      // Empty = show to all roles
  },
  visible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional: auto-hide or auto-delete after this time
}, { timestamps: true });

export default model('NotificationBanner', NotificationBannerSchema);
