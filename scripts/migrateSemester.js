// scripts/migrateSemester.js
import mongoose from "mongoose";
import SubjectMeta from "../MODELS/SubjectMeta.model.js";
import { config } from "dotenv";
config();

async function migrateSemester() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Connected to MongoDB");

    const subjects = await SubjectMeta.find({}).lean();
    console.log(`📝 Found ${subjects.length} subjects\n`);

    if (subjects.length === 0) {
      console.log("✅ No subjects found");
      await mongoose.disconnect();
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;

    for (const subject of subjects) {
      // If semester is a number (not array) → wrap it
      if (typeof subject.semester === "number") {
        await SubjectMeta.findByIdAndUpdate(subject._id, {
          $set: { semester: [subject.semester] },
        });
        updated++;
        console.log(`✅ "${subject._id}" (${subject.name}) → [${subject.semester}]`);
      } else if (Array.isArray(subject.semester)) {
        skipped++;
        console.log(`⏭️  SKIPPED: "${subject._id}" — already array ${JSON.stringify(subject.semester)}`);
      } else {
        skipped++;
        console.log(`⚠️  SKIPPED: "${subject._id}" — unexpected semester value: ${subject.semester}`);
      }
    }

    console.log("\n════════════════════════════");
    console.log(`✅ Migration completed`);
    console.log(`Updated : ${updated}`);
    console.log(`Skipped : ${skipped}`);
    console.log("════════════════════════════\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateSemester();