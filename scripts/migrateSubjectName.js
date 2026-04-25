// scripts/migrateSubjectName.js
// PURPOSE: Rename "Big Data" → "Big Data and Analytics" for Sem 6
// SAFE: Dry-run first (DRY_RUN=true), then real run (DRY_RUN=false)
import mongoose from "mongoose";
import { config } from "dotenv";
config();

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — change only these values
// ─────────────────────────────────────────────────────────────────────────────
const DRY_RUN     = false;   // ← set false when you're ready to commit

// All known variants of the old name that may exist in the DB
// Note schema has lowercase: true on subject, so stored values are lowercase
const OLD_NAMES = [
  "big data",
  "big data analytics",       // in case it was partially renamed before
  "bigdata",
  "big-data",
];

// What we want it to become (lowercase — Note.subject has lowercase: true)
const NEW_NAME_NOTE   = "big data and analytics";   // stored in Note.subject (lowercase)
const NEW_NAME_META   = "Big Data and Analytics";   // stored in SubjectMeta.name (display name)
const TARGET_SEMESTER = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal inline models (no import path issues)
// ─────────────────────────────────────────────────────────────────────────────
const { Schema, model, models } = mongoose;

const NoteSchema = new Schema({
  subject:  String,
  semester: Schema.Types.Mixed,   // number or array
}, { strict: false, timestamps: true });

const SubjectMetaSchema = new Schema({
  name:     String,
  code:     String,
  semester: Schema.Types.Mixed,
}, { strict: false, timestamps: true });

const Note        = models.Note        || model("Note",        NoteSchema);
const SubjectMeta = models.SubjectMeta || model("SubjectMeta", SubjectMetaSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function semesterMatches(semValue, target) {
  if (Array.isArray(semValue)) return semValue.includes(target);
  return semValue === target;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Connected to MongoDB");
    console.log(`🔍 Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "⚠️  LIVE RUN (writing to DB)"}\n`);

    // ── STEP 1: Preview what we'll find ──────────────────────────────────────
    console.log("════════════════════════════════════════");
    console.log("STEP 1 — SubjectMeta collection");
    console.log("════════════════════════════════════════");

    const metaDocs = await SubjectMeta.find({}).lean();
    const metaTargets = metaDocs.filter(doc => {
      const nameMatch = OLD_NAMES.some(
        old => doc.name?.toLowerCase().trim() === old
      );
      const semMatch  = semesterMatches(doc.semester, TARGET_SEMESTER);
      return nameMatch && semMatch;
    });

    console.log(`Found ${metaTargets.length} SubjectMeta doc(s) to update:`);
    for (const doc of metaTargets) {
      console.log(`  [${doc._id}] "${doc.name}" | sem: ${JSON.stringify(doc.semester)} | code: ${doc.code}`);
    }

    console.log("\n════════════════════════════════════════");
    console.log("STEP 2 — Note collection");
    console.log("════════════════════════════════════════");

    // Build the query: match any of the old names + semester 6
    const noteQuery = {
      subject:  { $in: OLD_NAMES },
      semester: TARGET_SEMESTER,            // exact match (number)
    };

    // Also check array-semester docs
    const noteQueryArr = {
      subject:  { $in: OLD_NAMES },
      semester: { $elemMatch: { $eq: TARGET_SEMESTER } },
    };

    const notesSingle = await Note.find(noteQuery).lean();
    const notesArr    = await Note.find(noteQueryArr).lean();

    // Deduplicate by _id
    const allNoteIds = new Map();
    for (const n of [...notesSingle, ...notesArr]) {
      allNoteIds.set(String(n._id), n);
    }
    const noteTargets = Array.from(allNoteIds.values());

    console.log(`Found ${noteTargets.length} Note doc(s) to update:`);
    for (const doc of noteTargets) {
      console.log(`  [${doc._id}] "${doc.subject}" | sem: ${JSON.stringify(doc.semester)} | title: "${doc.title?.slice(0, 50)}"`);
    }

    // ── STEP 2: Confirm before writing ───────────────────────────────────────
    if (DRY_RUN) {
      console.log("\n════════════════════════════════════════");
      console.log("✅ DRY RUN complete — no changes made.");
      console.log("   Set DRY_RUN = false to apply changes.");
      console.log("════════════════════════════════════════\n");
      await mongoose.disconnect();
      process.exit(0);
    }

    // ── STEP 3: Write changes ─────────────────────────────────────────────────
    console.log("\n════════════════════════════════════════");
    console.log("STEP 3 — Applying updates...");
    console.log("════════════════════════════════════════");

    // SubjectMeta — update display name
    let metaUpdated = 0;
    for (const doc of metaTargets) {
      await SubjectMeta.findByIdAndUpdate(doc._id, {
        $set: { name: NEW_NAME_META },
      });
      metaUpdated++;
      console.log(`  ✅ SubjectMeta [${doc._id}] "${doc.name}" → "${NEW_NAME_META}"`);
    }

    // Notes — update subject string (lowercase because schema has lowercase: true)
    let notesUpdated = 0;
    const noteIds = noteTargets.map(n => n._id);
    if (noteIds.length > 0) {
      const result = await Note.updateMany(
        { _id: { $in: noteIds } },
        { $set: { subject: NEW_NAME_NOTE } }
      );
      notesUpdated = result.modifiedCount;
      console.log(`  ✅ Notes updated: ${notesUpdated}`);
    }

    console.log("\n════════════════════════════════════════");
    console.log("✅ Migration complete");
    console.log(`   SubjectMeta updated : ${metaUpdated}`);
    console.log(`   Notes updated       : ${notesUpdated}`);
    console.log("════════════════════════════════════════\n");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();