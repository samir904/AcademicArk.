// src/ROUTES/presence.routes.js
import express from "express";
import {
  ping,
  goOffline,
  getStatus,
} from "../CONTROLLERS/presence.controller.js";
import { isLoggedIn, isLoggedInViaQuery, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

const router = express.Router();

// POST /api/v1/presence/ping
// Called every 30s from App.jsx — marks user as online
router.post("/ping", isLoggedIn, ping);

// POST /api/v1/presence/offline
// Called via sendBeacon on tab close — token in query param
router.post("/offline", isLoggedInViaQuery, goOffline);

// GET /api/v1/presence/status?userIds=id1,id2,id3
// Called by note page to check if specific users are online
router.get("/status", optionalAuth, getStatus);

export default router;
