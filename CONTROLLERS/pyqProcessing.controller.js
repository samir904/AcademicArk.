import PYQSourceMapService from "../services/pyqSourceMap.service";
import PYQProcessingService from "../services/pyqProcessing.service.js";
import Note from "../MODELS/note.model.js";

/**
 * 📌 GET PYQ source mapping by noteId
 * Route:
 * GET /api/exam/pyq-source/note/:noteId
 */
export const getPYQSourceByNote = async (req, res) => {
  try {
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: "noteId is required"
      });
    }

    const data = await PYQSourceMapService.getByNoteId(noteId);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ getPYQSourceByNote error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ source by note",
      error: error.message
    });
  }
};

/**
 * 📌 GET PYQ source mappings by subject + unit
 * Route:
 * GET /api/exam/pyq-source?subject=DAA&unit=2
 */
export const getPYQSourceBySubjectUnit = async (req, res) => {
  try {
    const { subject, unit } = req.query;

    if (!subject || !unit) {
      return res.status(400).json({
        success: false,
        message: "subject and unit are required"
      });
    }

    const data =
      await PYQSourceMapService.getBySubjectUnit(
        subject,
        Number(unit)
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getPYQSourceBySubjectUnit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ source mappings",
      error: error.message
    });
  }
};

/**
 * 📌 GET all PYQ source mappings (ADMIN / DEBUG)
 * Route:
 * GET /api/exam/pyq-source/all
 */
export const getAllPYQSources = async (req, res) => {
  try {
    const data = await PYQSourceMapService.getAll();

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ getAllPYQSources error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch all PYQ sources",
      error: error.message
    });
  }
};



/**
 * POST /api/exam/pyq/process/:noteId
 */
export const processSinglePYQController = async (req, res) => {
  try {
    const { noteId } = req.params;

    const note = await Note.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    if (note.category !== "PYQ") {
      return res.status(400).json({
        success: false,
        message: "This note is not a PYQ"
      });
    }

    const yearMatch = note.title.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "Year not found in title"
      });
    }

    const result = await PYQProcessingService.processSinglePYQ({
      noteId: note._id,
      pdfFilePath: note.fileDetails.secure_url, // adjust if local path needed
      subject: note.subject,
      unit: note.unit,
      year
    });

    return res.status(200).json({
      success: true,
      result
    });

  } catch (error) {
    console.error("❌ PYQ processing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process PYQ",
      error: error.message
    });
  }
};
