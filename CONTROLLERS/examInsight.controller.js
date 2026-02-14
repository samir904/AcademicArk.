import ExamInsightService from "../services/examInsight.service";

/**
 * 📌 GET exam insight for a specific subject + unit
 * Route:
 * GET /api/exam/insight?subject=DAA&unit=2
 */
export const getExamInsightBySubjectUnit = async (req, res) => {
  try {
    const { subject, unit } = req.query;

    if (!subject || !unit) {
      return res.status(400).json({
        success: false,
        message: "subject and unit are required"
      });
    }

    const data =
      await ExamInsightService.getBySubjectUnit(
        subject,
        Number(unit)
      );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Exam insight not found for given subject and unit"
      });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ getExamInsightBySubjectUnit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam insight",
      error: error.message
    });
  }
};

/**
 * 📌 GET all exam insights for a subject
 * Route:
 * GET /api/exam/insight/subject/:subject
 */
export const getExamInsightsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "subject is required"
      });
    }

    const data =
      await ExamInsightService.getBySubject(subject);

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getExamInsightsBySubject error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam insights for subject",
      error: error.message
    });
  }
};

/**
 * 📌 GET all exam insights (ADMIN / DEBUG)
 * Route:
 * GET /api/exam/insight/all
 */
export const getAllExamInsights = async (req, res) => {
  try {
    const data = await ExamInsightService.getAll();

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getAllExamInsights error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch all exam insights",
      error: error.message
    });
  }
};
