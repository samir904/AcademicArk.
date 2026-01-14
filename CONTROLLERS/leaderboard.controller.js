import Leaderboard from "../MODELS/leaderboard.model.js";
import User from "../MODELS/user.model.js";
import Apperror from "../UTIL/error.util.js";

export const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'MOST_VIEWED_NOTES', limit = 100 } = req.query;

    // Get latest leaderboard snapshot
    const leaderboard = await Leaderboard.findOne({
      leaderboardType: type,
      snapshotType: 'DAILY'
    })
      .sort({ generatedAt: -1 })
      .lean();

    if (!leaderboard) {
      return next(new Apperror("Leaderboard not found", 404));
    }

    // Return limited entries
    const entries = leaderboard.entries.slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Leaderboard fetched successfully",
      data: {
        type,
        generatedAt: leaderboard.generatedAt,
        entries,
        totalEntries: leaderboard.entries.length,
        dataQuality: leaderboard.dataQuality
      }
    });

  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    return next(new Apperror("Failed to fetch leaderboard: " + error.message, 500));
  }
};

export const getLeaderboardHistory = async (req, res, next) => {
  try {
    const { type, days = 7 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const leaderboards = await Leaderboard.find({
      leaderboardType: type,
      snapshotType: 'DAILY',
      generatedAt: { $gte: cutoffDate }
    })
      .sort({ generatedAt: -1 })
      .select('_id generatedAt entries totalRecords dataQuality')
      .lean();

    res.status(200).json({
      success: true,
      message: "Leaderboard history fetched",
      data: {
        type,
        days,
        snapshots: leaderboards
      }
    });

  } catch (error) {
    console.error('❌ Get leaderboard history error:', error);
    return next(new Apperror("Failed to fetch leaderboard history: " + error.message, 500));
  }
};

export const toggleLeaderboardExclusion = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { exclude } = req.body;  // true or false

    const user = await User.findByIdAndUpdate(
      userId,
      { excludeFromLeaderboard: exclude },
      { new: true }
    ).select('fullName email excludeFromLeaderboard');

    res.status(200).json({
      success: true,
      message: exclude 
        ? `${user.fullName} excluded from leaderboard` 
        : `${user.fullName} included in leaderboard`,
      data: user
    });

  } catch (error) {
    console.error('❌ Toggle leaderboard exclusion error:', error);
    return next(new Apperror("Failed to update user: " + error.message, 500));
  }
};

export const getLeaderboardExcludedUsers = async (req, res, next) => {
  try {
    const excludedUsers = await User.find({ excludeFromLeaderboard: true })
      .select('_id fullName email excludeFromLeaderboard');

    res.status(200).json({
      success: true,
      message: "Excluded users fetched",
      data: excludedUsers
    });

  } catch (error) {
    console.error('❌ Get excluded users error:', error);
    return next(new Apperror("Failed to fetch excluded users: " + error.message, 500));
  }
};

