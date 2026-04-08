import express from "express";
import {
  getAllFlags,
  getFlagByKey,
  createFlag,
  updateFlag,
  toggleFlag,
  addToWhitelist,
  removeFromWhitelist,
  updateRollout,
  deleteFlag,
  getEligibleUsers,
} from "../CONTROLLERS/featureFlag.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

const router = express.Router();

// All routes — admin only
router.use(isLoggedIn, authorizedRoles("ADMIN"));

router.get   ("/",                              getAllFlags);
router.post  ("/",                              createFlag);
router.get   ("/:key",                          getFlagByKey);
router.patch ("/:key",                          updateFlag);
router.delete("/:key",                          deleteFlag);
router.patch ("/:key/toggle",                   toggleFlag);
router.patch ("/:key/rollout",                  updateRollout);
router.post  ("/:key/whitelist/:userId",        addToWhitelist);
router.delete("/:key/whitelist/:userId",        removeFromWhitelist);
router.get   ("/:key/eligible-users",           getEligibleUsers);
// featureFlag.routes.js
import { /* ...existing... */ clearRules } from "../CONTROLLERS/featureFlag.controller.js";

router.patch("/:key/rules/clear", clearRules);   // ← add this
export default router;