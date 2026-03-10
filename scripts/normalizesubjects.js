// scripts/normalizeNoteSubjects.js
 import Note from '../MODELS/note.model.js';
import mongoose from 'mongoose';

export const normalizeNoteSubjects = async () => {
  const notes = await Note.find({}, 'subject').lean();
  
  let fixed = 0;
  for (const note of notes) {
    const normalized = note.subject.trim().toLowerCase();
    if (normalized !== note.subject) {
      await Note.updateOne(
        { _id: note._id },
        { $set: { subject: normalized } }
      );
      console.log(`Fixed: "${note.subject}" → "${normalized}"`);
      fixed++;
    }
  }
  console.log(`✅ Done. Fixed ${fixed} notes.`);
};
