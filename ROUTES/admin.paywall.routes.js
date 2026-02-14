import express from "express";
import {
  getFunnelOverview,
  getEventBreakdown,
  getUserSegments,
  getTopConvertingNotes,
  getMostPaywalledNotes
} from "../CONTROLLERS/admin.paywall.controller.js";

const router = express.Router();
import { authorizedRoles, isLoggedIn } from "../middlewares/auth.middleware.js";

// 🔐 Only ADMIN
router.use(isLoggedIn, authorizedRoles("ADMIN"));

router.get("/overview", getFunnelOverview);
router.get("/events", getEventBreakdown);
router.get("/segments", getUserSegments);
router.get("/top-notes", getTopConvertingNotes);
router.get('/most-paywalled',getMostPaywalledNotes)
export default router;
