import ExamInsight from "../MODELS/examInsight.model.js";
import QuestionFrequency from "../MODELS/questionFrequency.model.js";

class ExamInsightService {
  /**
   * 🔹 Get insight for subject + unit (READ-ONLY)
   */
  static async getBySubjectUnit(subject, unit) {
    return await ExamInsight.findOne({
      subject,
      unit
    });
  }

  /**
   * 🔹 Get all insights for a subject (READ-ONLY)
   */
  static async getBySubject(subject) {
    return await ExamInsight.find({
      subject
    }).sort({ unit: 1 });
  }

  /**
   * 🔹 Get all insights (ADMIN / DEBUG)
   */
  static async getAll() {
    return await ExamInsight.find({}).sort({
      subject: 1,
      unit: 1
    });
  }

  /**
   * 🔥 CORE METHOD
   * Build / rebuild insight for ONE subject + unit
   * Called by cron or admin action
   */
  static async buildInsightForUnit({
    university = "AKTU",
    course = "BTECH",
    subject,
    unit
  }) {
    if (!subject || !unit) {
      throw new Error("subject and unit are required to build exam insight");
    }

    /**
     * 1️⃣ Fetch raw frequency data
     */
    const frequencies = await QuestionFrequency.find({
      university,
      course,
      subject,
      unit
    }).sort({ appearanceCount: -1 });

    if (!frequencies.length) {
      return null;
    }

    /**
     * 2️⃣ Calculate total appearances (unit weight)
     */
    const totalAppearances = frequencies.reduce(
      (sum, f) => sum + f.appearanceCount,
      0
    );

    /**
     * 3️⃣ Decide exam trend
     */
    let examTrend = "LOW";

    if (totalAppearances >= 8) {
      examTrend = "HIGH";
    } else if (totalAppearances >= 4) {
      examTrend = "MEDIUM";
    }

    /**
     * 4️⃣ Pick top topics (UI friendly)
     */
    const topTopics = frequencies.slice(0, 5).map((f) => ({
      topic: f.topic,
      appearanceCount: f.appearanceCount,
      weight: f.appearanceCount
    }));

    /**
     * 5️⃣ Human-readable recommendation
     */
    let recommendation = "Light revision is sufficient";

    if (examTrend === "HIGH") {
      recommendation = "Focus PYQs and Important Questions";
    } else if (examTrend === "MEDIUM") {
      recommendation = "Revise notes and solve PYQs";
    }

    /**
     * 6️⃣ Upsert ExamInsight
     */
    return await ExamInsight.findOneAndUpdate(
      {
        university,
        course,
        subject,
        unit
      },
      {
        university,
        course,
        subject,
        unit,
        topTopics,
        examTrend,
        recommendation
      },
      {
        upsert: true,
        new: true
      }
    );
  }

  /**
   * 🔄 Rebuild insights for ALL units of a subject
   * Used by:
   * - Cron job
   * - Admin rebuild button
   */
  static async rebuildInsightsForSubject({
    university = "AKTU",
    course = "BTECH",
    subject
  }) {
    if (!subject) {
      throw new Error("subject is required to rebuild insights");
    }

    const units = await QuestionFrequency.distinct("unit", {
      university,
      course,
      subject
    });

    const results = [];

    for (const unit of units) {
      const insight = await this.buildInsightForUnit({
        university,
        course,
        subject,
        unit
      });

      if (insight) {
        results.push(insight);
      }
    }

    return results;
  }
}

export default ExamInsightService;
