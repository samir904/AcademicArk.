import User from "../MODELS/user.model.js";

export async function markStudyActivity(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let last = user.lastStudyDate
    ? new Date(user.lastStudyDate)
    : null;

  if (!last) {
    user.studyStreak = 1;
  } else {
    last.setHours(0, 0, 0, 0);
    const diff = (today - last) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      user.studyStreak += 1;
    } else if (diff > 1) {
      user.studyStreak = 1;
    }
    // diff === 0 → same day → DO NOTHING
  }

  user.lastStudyDate = new Date();
  await user.save();
}

