import PYQSourceMap from "../MODELS/pyqSourceMap.model.js";

class PYQSourceMapService {
  /**
   * 🔹 Check if a PYQ (noteId + year) is already processed
   * Used before running frequency upsert
   */
  static async isAlreadyProcessed(noteId, year) {
    if (!noteId || !year) {
      throw new Error("noteId and year are required");
    }

    const existing = await PYQSourceMap.findOne({
      noteId,
      year
    });

    return !!existing; // true / false
  }

  /**
   * 🔹 Save trace of a processed PYQ
   * This is called AFTER QuestionFrequency updates
   */
  static async saveSourceMap({
    noteId,
    university = "AKTU",
    course = "BTECH",
    subject,
    unit,
    year,
    extractedTopics
  }) {
    if (!noteId || !subject || !unit || !year) {
      throw new Error("Missing required fields for PYQ source map");
    }

    return await PYQSourceMap.create({
      noteId,
      university,
      course,
      subject,
      unit,
      year,
      extractedTopics
    });
  }

  /**
   * 🔹 Get PYQ source mapping by noteId
   * Used by admin/debug UI
   */
  static async getByNoteId(noteId) {
    return await PYQSourceMap.find({ noteId }).sort({
      year: -1
    });
  }

  /**
   * 🔹 Get PYQ source mappings by subject + unit
   * Used for transparency & debugging
   */
  static async getBySubjectUnit(subject, unit) {
    return await PYQSourceMap.find({
      subject,
      unit
    }).sort({
      year: -1
    });
  }

  /**
   * 🔹 Get all PYQ source mappings (ADMIN / DEBUG)
   */
  static async getAll() {
    return await PYQSourceMap.find({}).sort({
      createdAt: -1
    });
  }
}

export default PYQSourceMapService;
