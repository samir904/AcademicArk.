import cron from "node-cron";
import sessionTracker from "./sessionTracker.js";
import SessionLog from "../MODELS/SessionLog.model.js";
import serverMetrics from "./serverMetrics.js";

export const initSessionCronJobs=()=>{
    //save and reset daily stats at 11:59 pm
    cron.schedule('59 23 * * *',async()=>{
        try{
            const metrics=sessionTracker.getMetrics();
            const serverStats=await serverMetrics.getMetrics();

            //check if today's log already exists
            const today= new Date();
            today.setHours(0,0,0,0);

            const existingLog=await SessionLog.findOne({
                date:{
                    $gte: today, 
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) 
                }
            });

            if(existingLog){
                //update existing log
                existingLog.maxConcurrent = Math.max(existingLog.maxConcurrent, metrics.maxConcurrent);
                existingLog.avgConcurrent = metrics.avgConcurrent;
                existingLog.peakTime = metrics.peakTime;
                existingLog.totalRequests = serverStats.requests.total;
                await existingLog.save();
            }else {
                // Create new log
                await SessionLog.create({
                    date: today,
                    maxConcurrent: metrics.maxConcurrent,
                    avgConcurrent: metrics.avgConcurrent,
                    peakTime: metrics.peakTime,
                    totalRequests: serverStats.requests.total
                });
            }
            console.log('✅ Daily session stats saved:', {
                date: today.toLocaleDateString(),
                maxConcurrent: metrics.maxConcurrent,
                avgConcurrent: metrics.avgConcurrent
            });

            // Reset counters for new day
            sessionTracker.resetMax();
            serverMetrics.reset();
        }catch (error) {
            console.error('❌ Failed to save daily session stats:', error);
        }
    })
    console.log('✅ Session cron jobs initialized (daily reset at 11:59 PM)');
}