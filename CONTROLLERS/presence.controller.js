// src/CONTROLLERS/presence.controller.js
import asyncHandler from "../UTIL/asyncHandler.js";
import User         from "../MODELS/user.model.js";
import sessionTracker from "../UTIL/sessionTracker.js";

const ONLINE_THRESHOLD_MS = 3  * 60 * 1000; // 3 min  → online
const IDLE_THRESHOLD_MS   = 10 * 60 * 1000; // 10 min → idle

// ─────────────────────────────────────────────
// POST /api/v1/presence/ping
// Lightweight — updates in-memory first, DB in background
// ─────────────────────────────────────────────
export const ping = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now    = new Date();

  // 1. Update in-memory tracker (instant, O(1))
  sessionTracker.recordActivity(userId);

  // 2. Update DB in background — don't await, don't block response
  // Fire-and-forget: if it fails, in-memory still works
  User.findByIdAndUpdate(userId, { lastSeenAt: now }).exec().catch(() => {});

  res.status(200).json({ ok: true });
});

// ─────────────────────────────────────────────
// POST /api/v1/presence/offline
// Called via sendBeacon — must respond fast
// ─────────────────────────────────────────────
export const goOffline = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Remove from in-memory tracker immediately
  sessionTracker.removeSession(userId);

  // DB: lastSeenAt stays as-is — accurate "last seen" timestamp

  res.status(200).json({ ok: true });
});

// ─────────────────────────────────────────────
// GET /api/v1/presence/status?userIds=id1,id2
// Returns online/idle/offline for each requested userId
// ─────────────────────────────────────────────
// presence.controller.js — update getStatus to use new methods

export const getStatus = asyncHandler(async (req, res) => {
  const raw = req.query.userIds || "";
  if (!raw) return res.status(200).json({ success: true, data: [] });

  const ids = raw.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return res.status(200).json({ success: true, data: [] });

  const now = Date.now();
  const ONLINE_MS = 3  * 60 * 1000;
  const IDLE_MS   = 10 * 60 * 1000;

  const statusMap = {};

  // FIX: use getLastActivity() — tells us online vs idle FROM memory
  // Old way: just checked if id was in Set → could only return "online/not"
  // New way: check timestamp → can return "online" OR "idle" from memory alone
  const notInMemory = [];

  ids.forEach((id) => {
    const lastActivity = sessionTracker.getLastActivity(id); // NEW METHOD ✅
    if (lastActivity !== null) {
      const diff = now - lastActivity;
      if (diff <= ONLINE_MS)      statusMap[id] = "online";
      else if (diff <= IDLE_MS)   statusMap[id] = "idle";
      // if somehow > IDLE_MS but still in map (race before cleanup) → treat offline
      else                        statusMap[id] = "offline";
    } else {
      notInMemory.push(id); // need DB fallback
    }
  });

  // DB fallback — only for users NOT in memory
  if (notInMemory.length > 0) {
    const dbUsers = await User.find(
      { _id: { $in: notInMemory } },
      { _id: 1, lastSeenAt: 1 }
    ).lean();

    dbUsers.forEach((u) => {
      const id = u._id.toString();
      if (!u.lastSeenAt) { statusMap[id] = "offline"; return; }
      const diff = now - new Date(u.lastSeenAt).getTime();
      if (diff <= ONLINE_MS)    statusMap[id] = "online";
      else if (diff <= IDLE_MS) statusMap[id] = "idle";
      else                      statusMap[id] = "offline";
    });
  }

  // Anything still unresolved → offline (user never existed)
  ids.forEach((id) => { if (!statusMap[id]) statusMap[id] = "offline"; });

  res.status(200).json({
    success: true,
    data: ids.map((id) => ({ userId: id, status: statusMap[id] })),
  });
});
