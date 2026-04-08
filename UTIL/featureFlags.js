// UTIL/featureFlags.js
import FeatureFlag from "../MODELS/featureFlag.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import redis from "../CONFIG/redisClient.js";

/**
 * Check if a user is eligible for a feature flag
 * Returns: boolean
 */
export async function isFeatureEnabled(flagKey, user) {
  try {
    // ── 1. Cache flag config (5 min) ──────────────
    const cacheKey = `flag:${flagKey}`;
    let flag;
    const cached = await redis.get(cacheKey);

    if (cached) {
      flag = JSON.parse(cached);
    } else {
      flag = await FeatureFlag.findOne({ key: flagKey }).lean();
      if (flag) await redis.setEx(cacheKey, 300, JSON.stringify(flag));
    }

    // ── 2. Master switch ──────────────────────────
    if (!flag || !flag.isEnabled) return false;

    const userId   = user._id.toString();
    const { rules, rollout } = flag;
    const rolloutType = rollout?.type ?? "WHITELIST";

    // ── 3. WHITELIST bypasses ALL rules ───────────
    // Whitelisted users are explicitly chosen — rules are irrelevant.
    // Check this BEFORE eligibility rules.
    if (rolloutType === "WHITELIST") {
      return (rollout.userIds ?? [])
        .map(id => id.toString())
        .includes(userId);
    }

    // ── 4. Eligibility rules (PERCENTAGE / ALL only) ──
    // Rules gate the general population, not hand-picked users.

    // Semester filter
    if (rules?.semesters?.length > 0) {
      const userSem = user.academicProfile?.semester;
      if (!rules.semesters.includes(userSem)) return false;
    }

    // Branch filter
    if (rules?.branches?.length > 0) {
      const userBranch = user.academicProfile?.branch;
      if (!rules.branches.includes(userBranch)) return false;
    }

    // Profile complete
    if (rules?.requireProfileComplete) {
      if (!user.academicProfile?.isCompleted) return false;
    }

    // Activity score — only hit DB if threshold is set
    if (rules?.minActivityScore > 0) {
      const score = await getUserActivityScore(user._id);
      if (score < rules.minActivityScore) return false;
    }

    // ── 5. Rollout strategy (ALL / PERCENTAGE) ────

    if (rolloutType === "ALL") return true;

    if (rolloutType === "PERCENTAGE") {
      const hash = hashUserId(userId, flagKey);
      return hash < rollout.percentage;
    }

    return false;
  } catch (err) {
    console.error(`[FeatureFlag] Error checking ${flagKey}:`, err);
    return false; // fail-safe — never show on error
  }
}

/**
 * Deterministic 0-100 hash from userId + flagKey
 * Same user always gets same bucket — no flickering across requests
 */
function hashUserId(userId, flagKey) {
  let hash = 0;
  const str = `${userId}:${flagKey}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

/**
 * Activity score = views + (downloads × 2) in last 30 days
 * Cached 10 min per user — never called for WHITELIST flags
 */
async function getUserActivityScore(userId) {
  const cacheKey = `activity_score:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return parseInt(cached);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [views, downloads] = await Promise.all([
    UserActivity.countDocuments({
      userId,
      activityType: "NOTE_VIEWED",
      createdAt: { $gte: thirtyDaysAgo },
    }),
    UserActivity.countDocuments({
      userId,
      activityType: "NOTE_DOWNLOADED",
      createdAt: { $gte: thirtyDaysAgo },
    }),
  ]);

  const score = views + downloads * 2;
  await redis.setEx(cacheKey, 600, String(score));
  return score;
}