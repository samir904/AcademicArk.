import SessionLog from '../MODELS/SessionLog.model.js';

export const seedSessionLogs = async () => {
    try {
        // Check if data already exists
        const existingLogs = await SessionLog.countDocuments();
        if (existingLogs > 0) {
            console.log('✅ Session logs already exist, skipping seed');
            return;
        }

        // Create 30 days of sample data
        const logs = [];
        const today = new Date();
        
        for (let i = 30; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            // Generate random but realistic data
            const maxConcurrent = Math.floor(Math.random() * 100) + 50; // 50-150 users
            const avgConcurrent = Math.floor(maxConcurrent * 0.6); // 60% of max
            
            // Generate random peak time (between 10 AM - 8 PM)
            const peakTime = new Date(date);
            peakTime.setHours(Math.floor(Math.random() * 10) + 10); // 10-20 (10 AM - 8 PM)
            peakTime.setMinutes(Math.floor(Math.random() * 60));
            
            logs.push({
                date,
                maxConcurrent,
                avgConcurrent,
                peakTime,
                totalRequests: Math.floor(Math.random() * 1000) + 500
            });
        }
        
        await SessionLog.insertMany(logs);
        console.log(`✅ Seeded ${logs.length} session logs`);
        
    } catch (error) {
        console.error('❌ Failed to seed session logs:', error);
    }
};
