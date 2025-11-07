import { Schema, model } from 'mongoose';

const attendanceRecordSchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'], // ✨ CHANGED: Only present/absent
    required: true
  }
}, { _id: false });

const subjectAttendanceSchema = new Schema({
  subject: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    maxlength: 100
  },
  targetPercentage: {
    type: Number,
    default: 75,
    min: 0,
    max: 100
  },
  // ✨ NEW: Store initial attendance data
  initialTotalClasses: {
    type: Number,
    default: 0,
    min: 0
  },
  initialPresentClasses: {
    type: Number,
    default: 0,
    min: 0
  },
  records: [attendanceRecordSchema]
}, );

const attendanceSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  subjects: [subjectAttendanceSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
attendanceSchema.index({ user: 1, semester: 1 });

// Method to calculate subject-wise percentage
attendanceSchema.methods.getSubjectPercentage = function(subjectName) {
  const subject = this.subjects.find(s => s.subject === subjectName);
  if (!subject) return 0;
  
  // ✨ UPDATED: Include initial classes in calculation + 2 decimal precision
  const recordPresent = subject.records.filter(r => r.status === 'present').length;
  const recordTotal = subject.records.length;
  
  const totalPresent = subject.initialPresentClasses + recordPresent;
  const totalClasses = subject.initialTotalClasses + recordTotal;
  
  // ✨ CHANGED: 2 decimal places
  return totalClasses > 0 ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2)) : 0;
};


const Attendance = model('Attendance', attendanceSchema);

export default Attendance;
