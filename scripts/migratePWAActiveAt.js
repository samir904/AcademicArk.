// SCRIPTS/migratePWAActiveAt.js
// Run: node SCRIPTS/migratePWAActiveAt.js

import mongoose from "mongoose";
import PWAInstall from "../MODELS/PWAInstall.model.js";
import {config} from "dotenv"
config();
await mongoose.connect(process.env.MONGO_URI);

// ── For docs that had PWA sessions, backfill lastPWAActiveAt from lastActiveAt
// lastActiveAt during that time was being set by PWA sessions
const result = await PWAInstall.updateMany(
  {
    pwaSessionCount: { $gt: 0 },   // had real PWA sessions
    lastPWAActiveAt: { $exists: false }, // field missing entirely
  },
  [
    {
      $set: {
        lastPWAActiveAt: "$lastActiveAt",  // ✅ best approximation from existing data
      },
    },
  ]
);

console.log(`✅ Migrated ${result.modifiedCount} docs`);
await mongoose.disconnect();
