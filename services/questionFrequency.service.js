import QuestionFrequency from "../MODELS/questionFrequency.model.js";

class QuestionFrequencyService {
  /**
   * 🔹 Get frequency data for a specific subject + unit
   * Used by:
   * - ExamInsight builder
   * - Debug APIs
   */
  static async getFrequencyBySubjectUnit(subject, unit) {
    return await QuestionFrequency.find({
      subject,
      unit
    }).sort({ appearanceCount: -1 });
  }

  /**
   * 🔹 Get all frequency data for a subject (all units)
   * Used by:
   * - Heatmap
   * - Subject analytics
   */
  static async getFrequencyBySubject(subject) {
    return await QuestionFrequency.find({
      subject
    }).sort({ unit: 1, appearanceCount: -1 });
  }

  /**
   * 🔹 Get all frequency records (ADMIN / DEBUG)
   */
  static async getAllFrequencies() {
    return await QuestionFrequency.find({}).sort({
      subject: 1,
      unit: 1,
      appearanceCount: -1
    });
  }

  /**
   * 🔥 CORE METHOD
   * Safely upsert ONE topic from ONE PYQ paper
   *
   * This is called by PYQProcessingService
   */
  static async upsertTopicFrequency({
    university = "AKTU",
    course = "BTECH",
    subject,
    unit,
    topic,
    year
  }) {
    if (!subject || !unit || !topic || !year) {
      throw new Error("Missing required fields for topic frequency upsert");
    }

    const normalizedTopic = topic.toLowerCase().trim();

    return await QuestionFrequency.updateOne(
      {
        university,
        course,
        subject,
        unit,
        normalizedTopic
      },
      {
        $setOnInsert: {
          topic,
          normalizedTopic
        },
        $addToSet: {
          years: year
        },
        $set: {
          lastAppeared: year
        },
        $inc: {
          appearanceCount: 1
        }
      },
      { upsert: true }
    );
  }
}

export default QuestionFrequencyService;
