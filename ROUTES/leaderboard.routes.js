import { Router } from "express";
import { authorizedRoles, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import { getLeaderboard, getLeaderboardExcludedUsers, getLeaderboardHistory, toggleLeaderboardExclusion } from "../CONTROLLERS/leaderboard.controller.js";
import asyncWrap from "../UTIL/asyncWrap.js";
import { triggerLeaderboardGeneration } from "../CRONS/leaderboard.cron.js";

const router = Router();

router.get("/", asyncWrap(optionalAuth), asyncWrap(getLeaderboard));
router.get("/history", asyncWrap(optionalAuth), asyncWrap(getLeaderboardHistory));
router.get("/excluded", authorizedRoles("ADMIN") ,asyncWrap(getLeaderboardExcludedUsers));
router.put("/exclude/:userId",  asyncWrap(toggleLeaderboardExclusion));

// ✨ TEST ENDPOINT - Manually trigger leaderboard generation
// Use this for testing - REMOVE IN PRODUCTION
router.post("/generate", asyncWrap(async (req, res, next) => {
  try {
    console.log('🎯 Manual trigger requested...');
    await triggerLeaderboardGeneration();
    
    res.status(200).json({
      success: true,
      message: "Leaderboard generation triggered successfully!"
    });
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    return next(error);
  }
}));
export default router;
