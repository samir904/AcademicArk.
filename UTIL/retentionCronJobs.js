import cron from 'node-cron';
import UserRetentionMilestone from '../MODELS/userRetentionMilestone.model.js';
import CohortAnalysis from '../MODELS/cohortAnalysis.model.js';
import UserActivity from '../MODELS/userActivity.model.js';

// Run daily to update retention statuses
export const initRetentionCronJobs = () => {
    // Update retention status daily
    cron.schedule('0 2 * * *', async () => {
        console.log('🔄 Updating retention statuses...');
        
        try {
            const milestones = await UserRetentionMilestone.find({});
            
            for (let milestone of milestones) {
                const daysSinceLastActivity = Math.floor(
                    (new Date() - milestone.metrics.lastActivityAt) / (1000 * 60 * 60 * 24)
                );

                let newStatus;
                if (daysSinceLastActivity <= 1) newStatus = "HIGHLY_ACTIVE";
                else if (daysSinceLastActivity <= 7) newStatus = "ACTIVE";
                else if (daysSinceLastActivity <= 14) newStatus = "AT_RISK";
                else newStatus = "CHURNED";

                milestone.retentionStatus = newStatus;
                await milestone.save();
            }

            console.log('✅ Retention statuses updated');
        } catch (error) {
            console.error('Error updating retention statuses:', error);
        }
    });

    // Generate weekly cohort analysis
    cron.schedule('0 3 * * 1', async () => {
        console.log('📊 Generating weekly cohort analysis...');
        
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            // Get users registered in the past week
            const newUsers = await UserRetentionMilestone.find({
                registrationDate: { $gte: weekAgo }
            });

            const cohortWeek = getWeekString(new Date());

            // Calculate retention metrics
            const totalUsers = newUsers.length;
            let profileCompleted = 0;
            let firstNoteView = 0;
            let firstNoteDownload = 0;
            let firstInteraction = 0;

            newUsers.forEach(user => {
                if (user.milestones.profileCompleted?.completed) profileCompleted++;
                if (user.milestones.firstNoteView?.completed) firstNoteView++;
                if (user.milestones.firstNoteDownload?.completed) firstNoteDownload++;
                if (user.milestones.firstInteraction?.completed) firstInteraction++;
            });

            await CohortAnalysis.create({
                cohortWeek,
                startDate: weekAgo,
                endDate: new Date(),
                totalUsers,
                conversionRates: {
                    profileCompletion: totalUsers > 0 ? (profileCompleted / totalUsers) * 100 : 0,
                    firstNoteView: totalUsers > 0 ? (firstNoteView / totalUsers) * 100 : 0,
                    firstNoteDownload: totalUsers > 0 ? (firstNoteDownload / totalUsers) * 100 : 0,
                    firstInteraction: totalUsers > 0 ? (firstInteraction / totalUsers) * 100 : 0
                }
            });

            console.log('✅ Cohort analysis generated');
        } catch (error) {
            console.error('Error generating cohort analysis:', error);
        }
    });
};

function getWeekString(date) {
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}
