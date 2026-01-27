import mongoose from "mongoose";
import Note from "../MODELS/note.model.js";
import {config} from "dotenv"
config();
function extractUnitFromTitle(title = "") {
  if (!title) return null;

  const match = title.match(/unit[\s-]?(\d+)/i);
  if (!match) return null;

  const unit = Number(match[1]);
  return Number.isNaN(unit) ? null : unit;
}

async function migrateUnits() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Connected to MongoDB");

    const notes = await Note.find({
      $or: [{ unit: { $exists: false } }, { unit: null }]
    });

    console.log(`📝 Found ${notes.length} notes without unit\n`);

    if (notes.length === 0) {
      console.log("✅ All notes already have unit");
      await mongoose.disconnect();
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;

    for (const note of notes) {
      const unit = extractUnitFromTitle(note.title);

      if (unit) {
        note.unit = unit;
        await note.save();
        updated++;
        console.log(`✅ "${note.title}" → Unit ${unit}`);
      } else {
        skipped++;
        console.log(`⏭️  SKIPPED: "${note.title}"`);
      }
    }

    console.log("\n════════════════════════════");
    console.log(`✅ Migration completed`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log("════════════════════════════\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateUnits();