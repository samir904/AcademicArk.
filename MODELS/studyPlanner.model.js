import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  chapterNumber: Number,
  // ✅ NEW: 3-stage tracking
  syllabusCompleted: {
    type: Boolean,
    default: false
  },
  revisionCompleted: {
    type: Boolean,
    default: false
  },
  pyqCompleted: {
    type: Boolean,
    default: false
  },
  completionStage: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  lastRevisedAt: Date,
  notes: [{
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note'
    },
    type: {
      type: String,
      enum: ['notes', 'pyq', 'important', 'handwritten']
    }
  }]
});

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: String,
  totalChapters: {
    type: Number,
    default: 0
  },
  completedChapters: {
    type: Number,
    default: 0
  },
  chapters: [chapterSchema],
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
});

// ✅ NEW: Timetable schema
const timetableSchema = new mongoose.Schema({
  daysUntilExam: Number,
  studyHoursPerDay: {
    type: Number,
    default: 4
  },
  hoursPerSubject: Number,
  hoursPerChapter: Number,
  schedule: [{
    subjectName: String,
    startDay: Number,
    endDay: Number,
    dailyHours: Number,
    phases: [{
      phase: String,
      daysAllocated: Number
    }]
  }]
});

const studyPlannerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examName: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    enum: ['semester', 'sessional', 'terminal', 'final'],
    required: true
  },
  examDate: {
    type: Date,
    required: true
  },
  subjects: [subjectSchema],
  overallProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  aiGeneratedPlan: String,
  // ✅ NEW: Timetable field
  timetable: timetableSchema,
  dailyGoals: [{
    date: Date,
    tasks: [String],
    completed: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// ✅ Calculate overall progress
studyPlannerSchema.methods.calculateProgress = function() {
  if (this.subjects.length === 0) return 0;
  
  const totalProgress = this.subjects.reduce((sum, subject) => sum + subject.progress, 0);
  this.overallProgress = Math.round(totalProgress / this.subjects.length);
  return this.overallProgress;
};

export default mongoose.model('StudyPlanner', studyPlannerSchema);
