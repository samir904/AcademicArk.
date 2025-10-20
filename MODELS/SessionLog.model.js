import { Schema, model } from 'mongoose';

const sessionLogSchema = new Schema({
    date: { 
        type: Date, 
        required: true,
        index: true
    },
    maxConcurrent: { 
        type: Number, 
        required: true 
    },
    avgConcurrent: { 
        type: Number,
        default: 0
    },
    peakTime: { 
        type: Date
    },
    totalRequests: {
        type: Number,
        default: 0
    }
}, { 
    timestamps: true 
});

// Prevent duplicate entries for the same date
sessionLogSchema.index({ date: 1 }, { unique: true });
export default model('SessionLog', sessionLogSchema);
// const SessionLog = model("SessionLog", userSchema);

// export default SessionLog;