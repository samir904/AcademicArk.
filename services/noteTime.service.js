import UserSession from "../MODELS/userSession.model.js";
import mongoose from "mongoose";

export async function getTimeSpentOnNote(userId, noteId) {
  const result = await UserSession.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        "pages.resourceId": new mongoose.Types.ObjectId(noteId)
      }
    },
    { $unwind: "$pages" },
    {
      $match: {
        "pages.resourceId": new mongoose.Types.ObjectId(noteId),
        "pages.pageName": "NOTE_READER"
      }
    },
    {
      $group: {
        _id: null,
        totalTimeSeconds: { $sum: "$pages.timeSpent" }
      }
    }
  ]);

  return result[0]?.totalTimeSeconds || 0;
}