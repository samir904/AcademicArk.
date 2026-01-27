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
      // ✅ 2. Fetch progress ONCE
      const progressList = await StudyProgress.find({ userId }).lean();

      // ✅ 1. Decide subjects SOURCE
      // 1️⃣ Subjects with existing progress (resume first)
      const progressSubjects = [
        ...new Set(progressList.map(p => p.subject))
      ];

      // 2️⃣ Subjects user explicitly selected
      const focusedSubjects = subjectsToFocus || [];

      // 3️⃣ Merge with priority
      let subjects = [...progressSubjects];

      // Add focused subjects if not already included
      for (const s of focusedSubjects) {
        if (!subjects.includes(s)) {
          subjects.push(s);
        }
      }

      // 4️⃣ Absolute fallback (old users)
      if (subjects.length === 0) {
        subjects = await Note.distinct("subject", { semester });
      }

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


      const progressMap = {};
      for (const p of progressList) {
        progressMap[`${p.subject}-${p.unit}`] = p;
      }
      console.log("SUBJECTS FROM PREF / NOTES:", subjects);
      console.log("PROGRESS SUBJECTS:", progressList.map(p => p.subject));

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
          lastStudiedAt: progress?.lastStudiedAt || null,
          timeAllocated: 30
        });
      }

      // ✅ 4. SORT (IN_PROGRESS FIRST)
      tasks.sort((a, b) => {
        // 1️⃣ Priority first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }

        // 2️⃣ Most recently studied first
        const aTime = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
        const bTime = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;

        return bTime - aTime;
      });

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

  async _findNextUnitForSubject(userId, subject, progressMap) {
    // 1️⃣ Get all units for this subject
    const units = await Note.distinct("unit", { subject });

    if (!units || units.length === 0) return null;

    const sortedUnits = units
      .filter(u => typeof u === "number")
      .sort((a, b) => a - b);

    // 🔥 2️⃣ MOST RECENT IN_PROGRESS (KEY FIX)
    let recentInProgress = null;

    for (const unit of sortedUnits) {
      const p = progressMap[`${subject}-${unit}`];

      if (p?.status === "IN_PROGRESS") {
        if (
          !recentInProgress ||
          new Date(p.lastStudiedAt) > new Date(recentInProgress.lastStudiedAt)
        ) {
          recentInProgress = { unit, lastStudiedAt: p.lastStudiedAt };
        }
      }
    }

    if (recentInProgress) {
      return recentInProgress.unit;
    }

    // 3️⃣ First NOT_STARTED
    for (const unit of sortedUnits) {
      const p = progressMap[`${subject}-${unit}`];
      if (!p) {
        return unit;
      }
    }

    // 4️⃣ REVIEW (least recently studied first)
    let reviewCandidate = null;

    for (const unit of sortedUnits) {
      const p = progressMap[`${subject}-${unit}`];
      if (p?.status === "REVIEW") {
        if (
          !reviewCandidate ||
          new Date(p.lastStudiedAt) < new Date(reviewCandidate.lastStudiedAt)
        ) {
          reviewCandidate = { unit, lastStudiedAt: p.lastStudiedAt };
        }
      }
    }

    if (reviewCandidate) {
      return reviewCandidate.unit;
    }

    // 5️⃣ Everything completed
    return null;
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
