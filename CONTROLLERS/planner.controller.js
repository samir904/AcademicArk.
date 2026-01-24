import User from "../MODELS/user.model.js";
import StudyPreference from "../MODELS/studyPreference.model.js";
import StudyProgress from "../MODELS/studyProgress.model.js";
import plannerService from "../services/planner.service.js";
import Note from "../MODELS/note.model.js";
import { extractUnitFromTitle } from "../UTIL/unitExtractor.js";
import { markStudyActivity } from "../UTIL/updateStudyActivity.js";

/**
 * Initialize or update study preferences
 * POST /api/v1/planner/preferences
 */
export async function saveStudyPreferences(req, res) {
  try {
    const  userId  = req.user.id; // From auth middleware
    const { dailyStudyMinutes, examDates, preferredStudyTime, subjectsToFocus } =
      req.body;

    // Validation
    if (!dailyStudyMinutes || ![30, 45, 60, 90, 120,240,360,480,600].includes(dailyStudyMinutes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dailyStudyMinutes. Must be one of: 30, 45, 60, 90, 120,240,360,480,600"
      });
    }

    if (preferredStudyTime && !["MORNING", "AFTERNOON", "EVENING", "NIGHT"].includes(preferredStudyTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid preferredStudyTime"
      });
    }

    // Validate exam dates
    if (examDates && Array.isArray(examDates)) {
      for (const exam of examDates) {
        if (!exam.subject || !exam.examDate) {
          return res.status(400).json({
            success: false,
            message: "Each exam must have subject and examDate"
          });
        }

        const examDate = new Date(exam.examDate);
        if (examDate <= Date.now()) {
          return res.status(400).json({
            success: false,
            message: `Exam date for ${exam.subject} must be in the future`
          });
        }
      }
    }

    // Get user's academic profile
    const user = await User.findById(userId);
    if (!user || !user.academicProfile) {
      return res.status(400).json({
        success: false,
        message: "Please complete your academic profile first"
      });
    }

    // Upsert StudyPreference
    const preference = await StudyPreference.findOneAndUpdate(
      { userId },
      {
        userId,
        semester: user.academicProfile.semester,
        branch: user.academicProfile.branch,
        dailyStudyMinutes,
        preferredStudyTime: preferredStudyTime || "EVENING",
        examDates: examDates || [],
        subjectsToFocus: subjectsToFocus || []
      },
      { upsert: true, new: true }
    );

    // Update user model
    await User.findByIdAndUpdate(userId, {
      studyPreference: preference._id,
      "plannerSetup.isCompleted": true,
      "plannerSetup.completedAt": Date.now()
    });

    res.json({
      success: true,
      message: "Study preferences saved successfully",
      data: preference
    });
  } catch (error) {
    console.error("Error saving preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error saving preferences",
      error: error.message
    });
  }
}

/**
 * Get today's study plan
 * GET /api/v1/planner/today
 */
export async function getTodayPlan(req, res) {
  try {
    const  userId  = req.user.id;

    const plan = await plannerService.generateTodayPlan(userId);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Please set up your study preferences first"
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching study plan",
      error: error.message
    });
  }
}

/**
 * Get study statistics
 * GET /api/v1/planner/stats
 */
export async function getStudyStats(req, res) {
  try {
    const  userId  = req.user.id;

    const stats = await plannerService.getStudyStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching study statistics",
      error: error.message
    });
  }
}

/**
 * Update progress for a unit
 * PATCH /api/v1/planner/progress
 */
export async function updateProgress(req, res) {
  try {
    const  userId  = req.user.id;
    const { subject, unit, status } = req.body;

    // Validation
    if (!subject || !unit || !status) {
      return res.status(400).json({
        success: false,
        message: "subject, unit, and status are required"
      });
    }

    if (!["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: NOT_STARTED, IN_PROGRESS, REVIEW, or COMPLETED"
      });
    }

    // Find or create progress
    let progress = await StudyProgress.findOne({ userId, subject, unit });

    if (!progress) {
      progress = new StudyProgress({
        userId,
        subject,
        unit,
        status,
        startedAt: status !== "NOT_STARTED" ? Date.now() : null
      });
    } else {
      progress.status = status;

      // Set timestamps
      if (status === "IN_PROGRESS" && !progress.startedAt) {
        progress.startedAt = Date.now();
      }
      if (status === "COMPLETED" && !progress.completedAt) {
        progress.completedAt = Date.now();
      }
      if (status === "REVIEW") {
        progress.timesReviewed += 1;
      }
    }

    progress.lastStudiedAt = Date.now();
    await progress.save();

    // Update user's study streak & total time
    const user = await User.findById(userId);
    if (user) {
      user.lastStudyDate = Date.now();

      // Calculate streak (simplified)
      const lastStudy = user.lastStudyDate
        ? (Date.now() - user.lastStudyDate) / (1000 * 60 * 60 * 24)
        : 1;

      // if (lastStudy <= 1) {
      //   user.studyStreak += 1;
      // } else {
      //   user.studyStreak = 1;
      // }

      user.totalStudyTimeMinutes += 30; // Assume 30 min per session

      await user.save();
    }
    await markStudyActivity(userId);

    res.json({
      success: true,
      message: "Progress updated successfully",
      data: progress
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    res.status(500).json({
      success: false,
      message: "Error updating progress",
      error: error.message
    });
  }
}

/**
 * Get study preferences
 * GET /api/v1/planner/preferences
 */
export async function getPreferences(req, res) {
  try {
   const  userId  = req.user.id;

    const preferences = await StudyPreference.findOne({ userId });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: "Study preferences not set up yet"
      });
    }

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching preferences",
      error: error.message
    });
  }
}

/**
 * Get all progress for user
 * GET /api/v1/planner/progress
 */
export async function getAllProgress(req, res) {
  try {
    const  userId  = req.user.id;
    const { subject, status } = req.query;
    console.log(userId);
    let query = { userId };

    if (subject) query.subject = subject;
    if (status) query.status = status;

    const progress = await StudyProgress.find(query).sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: progress.length,
      data: progress
    });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching progress",
      error: error.message
    });
  }
}

/**
 * Update study preferences
 * PATCH /api/v1/planner/preferences
 */
export async function updateStudyPreferences(req, res) {
  try {
    const userId = req.user.id;
    const { dailyStudyMinutes, preferredStudyTime, examDates, subjectsToFocus } =
      req.body;

    const preference = await StudyPreference.findOne({ userId });
    if (!preference) {
      return res.status(404).json({
        success: false,
        message: "Study preferences not found. Please create them first."
      });
    }

    // Partial updates
    if (dailyStudyMinutes) {
      if (![30,45,60,90,120,240,360,480,600].includes(dailyStudyMinutes)) {
        return res.status(400).json({ success:false, message:"Invalid dailyStudyMinutes"});
      }
      preference.dailyStudyMinutes = dailyStudyMinutes;
    }

    if (preferredStudyTime) {
      preference.preferredStudyTime = preferredStudyTime;
    }

    if (Array.isArray(examDates)) {
      preference.examDates = examDates;
    }

    if (Array.isArray(subjectsToFocus)) {
      preference.subjectsToFocus = subjectsToFocus;
    }

    await preference.save();

    res.json({
      success: true,
      message: "Study preferences updated successfully",
      data: preference
    });

  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({
      success:false,
      message:"Error updating study preferences"
    });
  }
}



export const getPlannerNotes = async (req, res) => {
  try {
    const { subject, unit } = req.query;

    if (!subject || !unit) {
      return res.status(400).json({
        success: false,
        message: "subject and unit are required"
      });
    }

    // 1️⃣ Fetch all notes of this subject
    const notes = await Note.find(
      { subject },
      { title: 1, category: 1 }
    ).lean();

    const unitNotes = [];
    const handwritten = [];
    const pyqs = [];
    const important = [];

    for (const note of notes) {
      const noteUnit = extractUnitFromTitle(note.title);

      // Notes & Handwritten (unit specific)
      if (
        (note.category === "Notes" || note.category === "Handwritten Notes") &&
        noteUnit === Number(unit)
      ) {
        note.category === "Notes"
          ? unitNotes.push(note)
          : handwritten.push(note);
      }

      // PYQs (subject-wide)
      if (note.category === "PYQ") {
        pyqs.push(note);
      }

      // Important Questions
      if (note.category === "Important Questions") {
        if (!noteUnit || noteUnit === Number(unit)) {
          important.push(note);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        notes: unitNotes,
        handwritten,
        important,
        pyqs
      }
    });

  } catch (error) {
    console.error("Planner notes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch planner notes"
    });
  }
};

/**
 * Get subject suggestions from notes (semester based)
 * GET /api/v1/planner/subjects?semester=3
 */
/**
 * Get subject suggestions from notes (AUTO from user academic profile)
 * GET /api/v1/planner/subjects
 */
export const getSubjectSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user with academic profile
    const user = await User.findById(userId)
      .select("academicProfile.semester");

    if (!user || !user.academicProfile?.semester) {
      return res.status(400).json({
        success: false,
        message: "Academic profile incomplete. Semester not found."
      });
    }

    const semester = user.academicProfile.semester;

    // Fetch distinct subjects for that semester
    const rawSubjects = await Note.distinct("subject", { semester });

    // Normalize + alias mapping
    const subjects = rawSubjects
      .filter(Boolean)
      .map((subject) => ({
        label: subject,
        value: subject.toLowerCase()
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    res.json({
      success: true,
      semester,
      count: subjects.length,
      data: subjects
    });

  } catch (error) {
    console.error("Subject suggestion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subject suggestions"
    });
  }
};