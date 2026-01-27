import mongoose from 'mongoose';

const studyBuddyChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  context: {
    subject: String,
    topic: String,
    examType: String
  }
}, {
  timestamps: true
});

export default mongoose.model('StudyBuddyChat', studyBuddyChatSchema);
