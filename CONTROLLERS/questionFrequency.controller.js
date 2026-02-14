import QuestionFrequencyService from "../services/questionFrequency.service";

/**
 * 📌 GET frequency for subject + unit
 * Route:
 * GET /api/exam/frequency?subject=DAA&unit=2
 */
export const getFrequencyBySubjectUnit = async (req, res) => {
  try {
    const { subject, unit } = req.query;

    if (!subject || !unit) {
      return res.status(400).json({
        success: false,
        message: "subject and unit are required"
      });
    }

    const data =
      await QuestionFrequencyService.getFrequencyBySubjectUnit(
        subject,
        Number(unit)
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getFrequencyBySubjectUnit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch question frequency",
      error: error.message
    });
  }
};

/**
 * 📌 GET all frequency data for a subject
 * Route:
 * GET /api/exam/frequency/subject/:subject
 */
export const getFrequencyBySubject = async (req, res) => {
  try {
    const { subject } = req.params;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "subject is required"
      });
    }

    const data =
      await QuestionFrequencyService.getFrequencyBySubject(subject);

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getFrequencyBySubject error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subject frequency",
      error: error.message
    });
  }
};

/**
 * 📌 GET all frequency records (ADMIN / DEBUG)
 * Route:
 * GET /api/exam/frequency/all
 */
export const getAllFrequencies = async (req, res) => {
  try {
    const data = await QuestionFrequencyService.getAllFrequencies();

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getAllFrequencies error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch all question frequencies",
      error: error.message
    });
  }
};
