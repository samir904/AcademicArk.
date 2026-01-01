import { Schema, model } from "mongoose";

const cohortAnalysisSchema = new Schema({
    // Cohort info
    cohortWeek: {
        type: String,      // e.g., "2025-W01" (year-week)
        required: true,
        unique: true,
        index: true
    },
    
    startDate: {
        type: Date,
        required: true
    },
    
    endDate: {
        type: Date,
        required: true
    },

    // Total users registered in this cohort
    totalUsers: {
        type: Number,
        default: 0
    },

    // Retention by week after registration
    retentionByWeek: {
        // Week 0: Registration week
        week0: {
            activeUsers: Number,
            percentage: Number
        },
        
        // Week 1: 1 week after registration
        week1: {
            activeUsers: Number,
            percentage: Number
        },
        
        // Week 2: 2 weeks after registration
        week2: {
            activeUsers: Number,
            percentage: Number
        },
        
        // Week 4: 1 month after registration
        week4: {
            activeUsers: Number,
            percentage: Number
        },
        
        // Week 8: 2 months after registration
        week8: {
            activeUsers: Number,
            percentage: Number
        },
        
        // Week 12: 3 months after registration
        week12: {
            activeUsers: Number,
            percentage: Number
        }
    },

    // Average metrics
    averageEngagementScore: Number,
    averageDownloads: Number,
    averageNoteViews: Number,

    // Conversion rates
    conversionRates: {
        profileCompletion: Number,      // % who completed profile
        firstNoteView: Number,           // % who viewed a note
        firstNoteDownload: Number,       // % who downloaded a note
        firstInteraction: Number         // % who rated/reviewed
    }

}, {
    timestamps: true
});

const CohortAnalysis = model("CohortAnalysis", cohortAnalysisSchema);

export default CohortAnalysis;
