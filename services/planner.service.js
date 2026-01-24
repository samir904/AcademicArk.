import StudyPreference from "../MODELS/studyPreference.model.js";
import StudyProgress from "../MODELS/studyProgress.model.js";
import Note from "../MODELS/note.model.js";
import User from "../MODELS/user.model.js";
import { extractUnitFromTitle } from "../UTIL/unitExtractor.js";

class PlannerService {
  /**
   * Generate today's study plan
   * @param {string} userId
   * @returns {object} { tasks, totalMinutes, message }
   */
 /**
 * Generate today's study plan (FIXED VERSION)
 */
async generateTodayPlan(userId) {
  try {
    const pref = await StudyPreference.findOne({ userId })
      .populate("userId", "academicProfile");

    if (!pref) return null;

    const { semester, dailyStudyMinutes, subjectsToFocus } = pref;

    // ✅ 1. Decide subjects SOURCE
    let subjects = subjectsToFocus;

    // Safety fallback (old users)
    if (!subjects || subjects.length === 0) {
      subjects = await Note.distinct("subject", { semester });
    }

    if (!subjects || subjects.length === 0) {
      return {
        tasks: [],
        totalMinutes: 0,
        message: "No subjects available"
      };
    }

    // ✅ 2. Fetch progress ONCE
    const progressList = await StudyProgress.find({ userId }).lean();

    const progressMap = {};
    for (const p of progressList) {
      progressMap[`${p.subject}-${p.unit}`] = p;
    }

    const tasks = [];

    // ✅ 3. Build tasks SUBJECT-WISE
    for (const subject of subjects) {
      const nextUnit = await this._findNextUnitForSubject(
        userId,
        subject,
        progressMap
      );

      if (!nextUnit) continue;

      const progress = progressMap[`${subject}-${nextUnit}`];

      // ❌ SKIP COMPLETED UNITS COMPLETELY
      if (progress?.status === "COMPLETED") continue;

      let priority = 0;

      // ✅ PRIORITY RULES (VERY IMPORTANT)
      if (progress?.status === "IN_PROGRESS") {
        priority = 1000; // always on top
      } else if (progress?.status === "REVIEW") {
        priority = 500;
      } else {
        priority = 100; // NOT_STARTED
      }

      tasks.push({
        subject,
        unit: nextUnit,
        status: progress?.status || "NOT_STARTED",
        priority,
        timeAllocated: 30
      });
    }

    // ✅ 4. SORT (IN_PROGRESS FIRST)
    tasks.sort((a, b) => b.priority - a.priority);

    // ✅ 5. Limit by daily time
    const maxTasks = Math.ceil(dailyStudyMinutes / 30);
    const finalTasks = tasks.slice(0, maxTasks);

    return {
      tasks: finalTasks.map(({ priority, ...rest }) => rest),
      totalMinutes: finalTasks.length * 30,
      message: `Study ${finalTasks.length} unit(s) today`
    };

  } catch (error) {
    console.error("Error generating plan:", error);
    throw error;
  }
}

  /**
   * Find next unit to study for a subject
   */
async _findNextUnitForSubject(userId, subject, progressMap) {
  // 1️⃣ Get all note titles for this subject
  const notes = await Note.find(
  {
    subject,
    category: { $in: ["Notes", "Handwritten Notes"] }
  },
  { title: 1 }
).lean();

  if (!notes || notes.length === 0) return null;

  // 2️⃣ Extract units from titles
  const units = new Set();

  for (const note of notes) {
    const unit = extractUnitFromTitle(note.title);
    if (unit) units.add(unit);
  }

  if (units.size === 0) return null;

  const sortedUnits = [...units].sort((a, b) => a - b);

  // 3️⃣ Find first incomplete unit
  for (const unit of sortedUnits) {
    const key = `${subject}-${unit}`;
    const p = progressMap[key];

    if (!p || p.status === "NOT_STARTED" || p.status === "IN_PROGRESS") {
      return unit;
    }
  }

  // 4️⃣ All completed → suggest review of last unit
  return sortedUnits[sortedUnits.length - 1];
}

  /**
   * Calculate priority score for a task
   * Higher score = higher priority
   */
  _calculatePriority(subject, unit, pref, progressMap) {
    let score = 0;

    // 1️⃣ Exam urgency (highest weight)
    if (pref.examDates && pref.examDates.length > 0) {
      const exam = pref.examDates.find((e) => e.subject === subject);
      if (exam) {
        const daysUntilExam = Math.ceil(
          (exam.examDate - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExam <= 7) score += 100; // 1 week before
        else if (daysUntilExam <= 14) score += 80; // 2 weeks
        else if (daysUntilExam <= 30) score += 60; // 1 month
        else score += 40;
      }
    }

    // 2️⃣ Not started (high priority)
    const key = `${subject}-${unit}`;
    const p = progressMap[key];

    if (!p || p.status === "NOT_STARTED") {
      score += 50;
    } else if (p.status === "IN_PROGRESS") {
      score += 40; // Continue what you started
    } else if (p.status === "REVIEW") {
      score += 20; // Lower priority, but still important
    }

    // 3️⃣ Least recently studied
    if (p && p.lastStudiedAt) {
      const daysSinceStudy = Math.ceil(
        (Date.now() - p.lastStudiedAt) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceStudy >= 7) score += 30; // Not studied in a week
      else if (daysSinceStudy >= 3) score += 15;
    }

    // 4️⃣ Focused subjects (if user marked)
    if (pref.subjectsToFocus && pref.subjectsToFocus.includes(subject)) {
      score += 25;
    }

    return score;
  }

  /**
   * Get study statistics
   */
async getStudyStats(userId) {
  // 1️⃣ Fetch progress + user in parallel (efficient)
  const [progress, user] = await Promise.all([
    StudyProgress.find({ userId }).lean(),
    User.findById(userId).select(
      "studyStreak lastStudyDate totalStudyTimeMinutes"
    )
  ]);

  // 2️⃣ Existing stats (UNCHANGED)
  const stats = {
    totalUnitsStarted: progress.filter(
      (p) => p.status !== "NOT_STARTED"
    ).length,

    totalUnitsCompleted: progress.filter(
      (p) => p.status === "COMPLETED"
    ).length,

    totalTimeSpent: progress.reduce(
      (sum, p) => sum + (p.totalTimeSpent || 0),
      0
    ),

    subjectProgress: {}
  };

  // 3️⃣ Group by subject (UNCHANGED)
  progress.forEach((p) => {
    if (!stats.subjectProgress[p.subject]) {
      stats.subjectProgress[p.subject] = {
        completed: 0,
        total: 0
      };
    }

    stats.subjectProgress[p.subject].total++;
    if (p.status === "COMPLETED") {
      stats.subjectProgress[p.subject].completed++;
    }
  });

  // 4️⃣ 🔥 ADD STREAK (THIS IS THE ONLY NEW PART)
  return {
    ...stats,

    streak: {
      current: user?.studyStreak || 0,
      lastStudyDate: user?.lastStudyDate || null
    },

    lifetime: {
      totalStudyTimeMinutes: user?.totalStudyTimeMinutes || 0
    }
  };
}
}

export default new PlannerService();
