import cron from 'node-cron';
import leaderboardService from '../services/leaderboard.service.js';

// ✨ Run daily at 2:00 AM IST (8:30 PM UTC previous day)
export const startLeaderboardCron = () => {
  console.log('🚀 Starting Leaderboard Cron Jobs...');

  // Daily leaderboard generation - 2:00 AM IST
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('\n⏰ Running Daily Leaderboard Generation Cron...');
      await leaderboardService.generateAllLeaderboards();
      await leaderboardService.cleanupOldLeaderboards();
    } catch (error) {
      console.error('❌ Cron job error:', error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  // Optional: Cleanup cron - Run every Sunday at 3:00 AM IST
  cron.schedule('0 3 * * 0', async () => {
    try {
      console.log('\n⏰ Running Cleanup Cron...');
      await leaderboardService.cleanupOldLeaderboards();
    } catch (error) {
      console.error('❌ Cleanup cron error:', error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Leaderboard Cron Jobs Started!');
};

// Manual trigger (for testing)
export const triggerLeaderboardGeneration = async () => {
  try {
    console.log('🎯 Manually triggering leaderboard generation...');
    await leaderboardService.generateAllLeaderboards();
    console.log('✅ Manual generation completed!');
  } catch (error) {
    console.error('❌ Manual generation error:', error);
  }
};
