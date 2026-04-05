import FeatureFlag from "../MODELS/featureFlag.model.js";
import User        from "../MODELS/user.model.js";
import redis       from "../CONFIG/redisClient.js";
import mongoose from 'mongoose';

// ── Invalidate flag cache helper
const invalidateFlagCache = async (key) => {
  await redis.del(`flag:${key}`);
};

// ─────────────────────────────────────────────
// GET /api/v1/admin/flags
// All flags with rollout + rules summary
// ─────────────────────────────────────────────
export const getAllFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.find()
      .populate("createdBy updatedBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: flags });
  } catch (err) {
    console.error("getAllFlags error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/admin/flags/:key
// Single flag detail
// ─────────────────────────────────────────────
export const getFlagByKey = async (req, res) => {
  try {
    const flag = await FeatureFlag
      .findOne({ key: req.params.key.toLowerCase() })
      .populate("createdBy updatedBy", "fullName email")
      .populate("rollout.userIds", "fullName email academicProfile.semester")
      .lean();

    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    res.status(200).json({ success: true, data: flag });
  } catch (err) {
    console.error("getFlagByKey error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// POST /api/v1/admin/flags
// Create a new flag
// ─────────────────────────────────────────────
export const createFlag = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      key, name, description,
      isEnabled,
      rollout,
      rules,
    } = req.body;

    // ── Validate key uniqueness
    const exists = await FeatureFlag.findOne({ key: key?.toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: "Flag key already exists" });
    }

    const flag = await FeatureFlag.create({
      key:         key.toLowerCase(),
      name,
      description: description || "",
      isEnabled:   isEnabled   ?? false,
      rollout:     rollout     || { type: "WHITELIST", percentage: 0, userIds: [] },
      rules:       rules       || {},
      createdBy:   adminId,
      updatedBy:   adminId,
    });

    res.status(201).json({ success: true, data: flag });
  } catch (err) {
    console.error("createFlag error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/v1/admin/flags/:key
// Update flag (name, description, rules, rollout)
// ─────────────────────────────────────────────
export const updateFlag = async (req, res) => {
  try {
    const adminId   = req.user.id;
    const flagKey   = req.params.key.toLowerCase();
    const {
      name, description, isEnabled,
      rollout, rules,
    } = req.body;

    const flag = await FeatureFlag.findOne({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    // ── Apply only provided fields
    if (name        !== undefined) flag.name        = name;
    if (description !== undefined) flag.description = description;
    if (isEnabled   !== undefined) flag.isEnabled   = isEnabled;
    if (rollout     !== undefined) flag.rollout     = { ...flag.rollout.toObject(), ...rollout };
    if (rules       !== undefined) flag.rules       = { ...flag.rules.toObject(),   ...rules   };
    flag.updatedBy = adminId;

    await flag.save();
    await invalidateFlagCache(flagKey);  // ✅ bust cache on any update

    res.status(200).json({ success: true, data: flag });
  } catch (err) {
    console.error("updateFlag error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/v1/admin/flags/:key/toggle
// Quick on/off toggle
// ─────────────────────────────────────────────
export const toggleFlag = async (req, res) => {
  try {
    const adminId = req.user.id;
    const flagKey = req.params.key.toLowerCase();

    const flag = await FeatureFlag.findOne({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    flag.isEnabled = !flag.isEnabled;
    flag.updatedBy = adminId;
    await flag.save();
    await invalidateFlagCache(flagKey);

    res.status(200).json({
      success: true,
      data: { key: flag.key, isEnabled: flag.isEnabled },
      message: `Flag ${flag.isEnabled ? "enabled" : "disabled"}`,
    });
  } catch (err) {
    console.error("toggleFlag error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// POST /api/v1/admin/flags/:key/whitelist/:userId
// Add user to whitelist
// ─────────────────────────────────────────────

export const addToWhitelist = async (req, res) => {
  try {
    const { key, userId } = req.params;
    const flagKey = key.toLowerCase();

    // ── Resolve user by ObjectId OR email ────────────────────────
    const isObjectId = mongoose.Types.ObjectId.isValid(userId);

    const user = await User
      .findOne(
        isObjectId ? { _id: userId } : { email: userId.toLowerCase() }
      )
      .select("fullName email academicProfile.semester");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: isObjectId
          ? "User not found"
          : `No user found with email "${userId}"`,
      });
    }

    const flag = await FeatureFlag.findOne({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    // ── Idempotent — compare against resolved _id ─────────────────
    const resolvedId = user._id.toString();
    const alreadyIn  = flag.rollout.userIds
      .map(id => id.toString())
      .includes(resolvedId);

    if (alreadyIn) {
      return res.status(200).json({
        success: true,
        message: "User already in whitelist",
        data: { totalWhitelisted: flag.rollout.userIds.length },
      });
    }

    // ── Always push the ObjectId, never the raw email ─────────────
    flag.rollout.userIds.push(user._id);
    flag.updatedBy = req.user.id;
    await flag.save();
    await invalidateFlagCache(flagKey);

    res.status(200).json({
      success: true,
      message: `${user.fullName} added to whitelist`,
      data: {
        user:             { id: user._id, name: user.fullName, email: user.email },
        totalWhitelisted: flag.rollout.userIds.length,
      },
    });
  } catch (err) {
    console.error("addToWhitelist error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/v1/admin/flags/:key/whitelist/:userId
// Remove user from whitelist
// ─────────────────────────────────────────────
export const removeFromWhitelist = async (req, res) => {
  try {
    const { key, userId } = req.params;
    const flagKey = key.toLowerCase();

    const flag = await FeatureFlag.findOne({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    const before = flag.rollout.userIds.length;
    flag.rollout.userIds = flag.rollout.userIds
      .filter(id => id.toString() !== userId);

    if (flag.rollout.userIds.length === before) {
      return res.status(404).json({ success: false, message: "User not in whitelist" });
    }

    flag.updatedBy = req.user.id;
    await flag.save();
    await invalidateFlagCache(flagKey);

    res.status(200).json({
      success: true,
      message: "User removed from whitelist",
      data: { totalWhitelisted: flag.rollout.userIds.length },
    });
  } catch (err) {
    console.error("removeFromWhitelist error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/v1/admin/flags/:key/rollout
// Update rollout type + percentage in one call
// ─────────────────────────────────────────────
export const updateRollout = async (req, res) => {
  try {
    const flagKey = req.params.key.toLowerCase();
    const { type, percentage } = req.body;

    const flag = await FeatureFlag.findOne({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    if (type       !== undefined) flag.rollout.type       = type;
    if (percentage !== undefined) flag.rollout.percentage = percentage;
    flag.updatedBy = req.user.id;

    await flag.save();
    await invalidateFlagCache(flagKey);

    res.status(200).json({
      success: true,
      data: {
        key:        flag.key,
        rollout:    flag.rollout,
      },
      message: `Rollout updated → ${flag.rollout.type} ${flag.rollout.percentage ?? ""}%`,
    });
  } catch (err) {
    console.error("updateRollout error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/v1/admin/flags/:key
// Delete a flag entirely
// ─────────────────────────────────────────────
export const deleteFlag = async (req, res) => {
  try {
    const flagKey = req.params.key.toLowerCase();

    const flag = await FeatureFlag.findOneAndDelete({ key: flagKey });
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    await invalidateFlagCache(flagKey);

    res.status(200).json({
      success: true,
      message: `Flag "${flagKey}" deleted`,
    });
  } catch (err) {
    console.error("deleteFlag error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/admin/flags/:key/eligible-users
// Preview which users would pass eligibility rules
// (dry run — doesn't enable anything)
// ─────────────────────────────────────────────
export const getEligibleUsers = async (req, res) => {
  try {
    const flagKey = req.params.key.toLowerCase();
    const limit   = parseInt(req.query.limit) || 20;

    const flag = await FeatureFlag.findOne({ key: flagKey }).lean();
    if (!flag) {
      return res.status(404).json({ success: false, message: "Flag not found" });
    }

    const { rules } = flag;

    // ── Build user query from rules
    const userQuery = {};

    if (rules.semesters?.length > 0) {
      userQuery["academicProfile.semester"] = { $in: rules.semesters };
    }
    if (rules.branches?.length > 0) {
      userQuery["academicProfile.branch"] = { $in: rules.branches };
    }
    if (rules.requireProfileComplete) {
      userQuery["academicProfile.isCompleted"] = true;
    }

    const [users, total] = await Promise.all([
      User.find(userQuery)
        .select("fullName email academicProfile.semester academicProfile.branch")
        .limit(limit)
        .lean(),
      User.countDocuments(userQuery),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        preview: users,
        rules,
        note: "Activity score filter not applied in preview (expensive)",
      },
    });
  } catch (err) {
    console.error("getEligibleUsers error:", err);
    res.status(500).json({ success: false });
  }
};