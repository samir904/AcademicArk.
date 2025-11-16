import cron from 'node-cron';
import axios from 'axios';

/**

Schedule daily campaign email sending at 9 AM every day
*/
export const setupDailyCampaignJob = () => {
// Runs every day at 9:00 AM
cron.schedule('0 9 * * *', async () => {
try {
console.log('🔔 Triggering daily campaign email send...');

const response = await axios.post(
`${process.env.BACKEND_URL}/api/v1/admin/campaign/send-daily`,
{},
{
headers: {
'Authorization': `Bearer ${process.env.CRON_TOKEN}`
}
}
);

console.log('✅ Daily campaign job completed:', response.data);
} catch (error) {
console.error('❌ Daily campaign job failed:', error.message);
}
});

console.log('⏰ Daily campaign job scheduled for 9 AM every day');
};