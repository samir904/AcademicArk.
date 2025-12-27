// UTIL/retentionCalculator.js
import UserCohort from '../MODELS/UserCohort.model.js';
import SessionLog from '../MODELS/SessionLog.model.js';
import User from '../MODELS/user.model.js';

// Get users who signed up in a specific month
export const getCohortByMonth = async (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  
  const users = await User.find({
    createdAt: { $gte: startDate, $lt: endDate }
  }).select('_id fullName email createdAt');
  
  return {
    cohortDate: startDate,
    cohortName: `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
    userIds: users.map(u => u._id),
    totalUsers: users.length,
    users
  };
};

// Calculate if user was active in specific week after signup
export const wasUserActiveInWeek = async (userId, signupDate, weekNumber) => {
  const weekStart = new Date(signupDate);
  weekStart.setDate(weekStart.getDate() + (weekNumber * 7));
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  const session = await SessionLog.findOne({
    userId,
    date: { $gte: weekStart, $lt: weekEnd }
  });
  
  return !!session;
};

// Calculate retention rate for a cohort
export const calculateCohortRetention = async (cohortData) => {
  const retention = {};
  
  // Check retention for week 0, 1, 2, 3, 4
  for (let week = 0; week <= 4; week++) {
    let activeCount = 0;
    
    for (const userId of cohortData.userIds) {
      const isActive = await wasUserActiveInWeek(
        userId,
        cohortData.cohortDate,
        week
      );
      if (isActive) activeCount++;
    }
    
    retention[`week${week}`] = (
      (activeCount / cohortData.totalUsers) * 100
    ).toFixed(2);
  }
  
  // Check retention for month 1, 2, 3, 6
  for (const month of [1, 2, 3, 6]) {
    let activeCount = 0;
    const monthStart = new Date(cohortData.cohortDate);
    monthStart.setMonth(monthStart.getMonth() + month);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    
    for (const userId of cohortData.userIds) {
      const session = await SessionLog.findOne({
        userId,
        date: { $gte: monthStart, $lt: monthEnd }
      });
      if (session) activeCount++;
    }
    
    retention[`month${month}`] = (
      (activeCount / cohortData.totalUsers) * 100
    ).toFixed(2);
  }
  
  return retention;
};

// Save cohort to database
export const saveCohort = async (cohortData, retention) => {
  const cohort = new UserCohort({
    cohortDate: cohortData.cohortDate,
    cohortName: cohortData.cohortName,
    totalUsers: cohortData.totalUsers,
    userIds: cohortData.userIds,
    retention: retention,
    lastUpdated: new Date()
  });
  
  await cohort.save();
  return cohort;
};

// Get all cohorts
export const getAllCohorts = async () => {
  return await UserCohort.find().sort({ cohortDate: -1 });
};
