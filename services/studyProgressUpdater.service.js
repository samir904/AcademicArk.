import StudyProgress from "../MODELS/studyProgress.model.js";
import Note from "../MODELS/note.model.js";
import { getTimeSpentOnNote } from "./noteTime.service.js";

export async function updateProgressFromActivity({
  userId,
  activityType,
  resourceId,
  metadata
}) {
  try {
    console.log("user id", userId);
    console.log("activity type", activityType);
    console.log("resource_id", resourceId);

    // 1️⃣ Only care about note interactions
    if (!["NOTE_VIEWED", "NOTE_DOWNLOADED"].includes(activityType)) return;
    if (!resourceId) return;

    // 2️⃣ Fetch note details
    const note = await Note.findById(resourceId).select("subject title");
    if (!note || !note.subject) return;

    // 3️⃣ Extract unit from title
    const unitMatch = note.title.match(/unit[-\s]?(\d+)/i);
    if (!unitMatch) return;

    const unit = Number(unitMatch[1]);
    const subject = note.subject;

    // 4️⃣ Find or create StudyProgress
    let progress = await StudyProgress.findOne({ userId, subject, unit });

    if (!progress) {
      progress = new StudyProgress({
        userId,
        subject,
        unit,
        status: "IN_PROGRESS",
        startedAt: new Date()
      });
    }
    // console.log('progress before calculating time ok!',progress)
    // 5️⃣ 🔥 REAL TIME CALCULATION (FROM SESSION DATA)
    // const seconds = await getTimeSpentOnNote(userId, resourceId);
    // const minutes = Math.ceil(seconds / 60);

    // progress.totalTimeSpent = minutes;
    // console.log('total time spent',progress.totalTimeSpent)
    // console.log('after adding progress time then progress data',progress)
    // 6️⃣ Track note view (dedup optional later)
    progress.notesViewed.push({
      noteId: resourceId,
      viewedAt: new Date()
    });

    progress.lastStudiedAt = new Date();

    await progress.save();
    
    // console.log("✅ StudyProgress updated with real time:", minutes, "minutes");
    // console.log('final progress',progress);
  } catch (err) {
    console.error("StudyProgress update failed:", err);
  }
}


export async function updateProgressFromReaderExit({
  userId,
  noteId,
  timeSpentSeconds
}) {
  try {
    const note = await Note.findById(noteId).select("subject title");
    if (!note || !note.subject) return;

    const unitMatch = note.title.match(/unit[-\s]?(\d+)/i);
    if (!unitMatch) return;

    const unit = Number(unitMatch[1]);
    const subject = note.subject;

    const minutes = Math.ceil(timeSpentSeconds / 60);

    let progress = await StudyProgress.findOne({ userId, subject, unit });
    if (!progress) return;

    // 🔥 ADD time (not replace)
    progress.totalTimeSpent += minutes;
    progress.lastStudiedAt = new Date();

    await progress.save();

    console.log(
      `✅ StudyProgress updated from reader exit: +${minutes} min`
    );
  } catch (err) {
    console.error("StudyProgress exit update failed:", err);
  }
}