import Note from "../MODELS/note.model.js";

/**
 * 🔥 MIGRATION: Add Sem 2 to all 1st year common subjects
 * ❌ EXCEPT Engineering Mathematics-I
 *
 * Safe rules:
 * - Only AKTU + BTECH
 * - Only notes having semester 1
 * - Exclude M1 explicitly
 * - Do not touch notes already having semester 2
 */
export const migrateFirstYearCommonSubjects = async (req, res) => {
  try {
    const EXCLUDED_SUBJECTS = [
      "Engineering Mathematics-I",
      "Mathematics-I",
      "M1",
      "Maths-I"
    ];

    // DRY RUN (good practice 👍)
    const candidates = await Note.find({
      university: "AKTU",
      course: "BTECH",
      subject: { $nin: EXCLUDED_SUBJECTS },
      semester: 1,          // matches [1] and [1,2]
      semester: { $ne: 2 }  // does NOT already contain 2
    }).select("_id subject semester");

    if (candidates.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No eligible notes found for migration",
        migratedCount: 0
      });
    }

    // ✅ ACTUAL UPDATE (SAFE + IDEMPOTENT)
    const result = await Note.updateMany(
      {
        university: "AKTU",
        course: "BTECH",
        subject: { $nin: EXCLUDED_SUBJECTS },
        semester: 1,
        semester: { $ne: 2 }
      },
      {
        $addToSet: { semester: 2 }
      }
    );

    return res.status(200).json({
      success: true,
      message: "First year common subjects migrated successfully",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Migration Error:", error);
    return res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message
    });
  }
};

export const normalizeSemesterField = async (req, res) => {
  try {
    const result = await Note.updateMany(
      {
        semester: { $type: "int" } // 🔥 ONLY broken docs
      },
      [
        {
          $set: {
            semester: ["$semester"] // convert number → array
          }
        }
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Semester field normalized successfully",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Normalization Error:", error);
    return res.status(500).json({
      success: false,
      message: "Semester normalization failed",
      error: error.message
    });
  }
};


export const rollbackFirstYearMigration = async (req, res) => {
  try {
    const result = await Note.updateMany(
      {
        semester: { $all: [1, 2] } // only docs affected by migration
      },
      {
        $pull: { semester: 2 }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Rollback completed successfully",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Rollback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Rollback failed",
      error: error.message
    });
  }
};

export const cleanupInvalidSemesterTwo = async (req, res) => {
  try {
    const FIRST_YEAR_COMMON_SUBJECTS = [
      "engineering chemistry",
      "engineering physics",
      "fundamentals of electrical engineering",
      "fundamentals of electronics engineering",
      "fundamentals of mechanical engineering",
      "programming for problem solving",
      "environment and ecology",
      "soft skills"
    ];

    const result = await Note.updateMany(
      {
        semester: 2,
        subject: { $nin: FIRST_YEAR_COMMON_SUBJECTS }
      },
      {
        $pull: { semester: 2 }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Invalid semester 2 removed successfully",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Cleanup Error:", error);
    return res.status(500).json({
      success: false,
      message: "Cleanup failed",
      error: error.message
    });
  }
};

// 🔥 FULL ROLLBACK: semester array → number
export const rollbackSemesterToNumber = async (req, res) => {
  try {
    const result = await Note.updateMany(
      {
        semester: { $type: "array" }
      },
      [
        {
          $set: {
            semester: { $arrayElemAt: ["$semester", 0] }
          }
        }
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Semester rolled back to original number format",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Rollback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Semester rollback failed",
      error: error.message
    });
  }
};


export const addSem2ToFirstYearCommonSubjects = async (req, res) => {
  try {
    const FIRST_YEAR_COMMON_SUBJECTS = [
      "engineering chemistry",
      "engineering physics",
      "fundamentals of electrical engineering",
      "fundamentals of electronics engineering",
      "fundamentals of mechanical engineering",
      "programming for problem solving",
      "environment and ecology",
      "soft skills"
    ];

    const result = await Note.updateMany(
      {
        subject: { $in: FIRST_YEAR_COMMON_SUBJECTS },

        // ✅ MUST already be a semester-1 note
        semester: { $in: [1] },

        // ✅ Do not duplicate sem 2
        semester: { $ne: 2 }
      },
      {
        $addToSet: { semester: 2 }
      }
    );

    res.status(200).json({
      success: true,
      message: "Semester 2 added ONLY to semester-1 common subjects",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const addSem4ToThirdSemCommonSubjects = async (req, res) => {
  try {
    const THIRD_YEAR_COMMON_SUBJECTS = [
      "digital electronics",
      "mathematics-iv"
    ];

    const result = await Note.updateMany(
      {
        subject: { $in: THIRD_YEAR_COMMON_SUBJECTS },

        // ✅ Must currently be semester 3
        semester: { $in: [3] },

        // ✅ Avoid duplicates
        semester: { $ne: 4 }
      },
      {
        $addToSet: { semester: 4 }
      }
    );

    res.status(200).json({
      success: true,
      message: "Semester 4 added only to Digital Electronics & Mathematics-IV notes",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
