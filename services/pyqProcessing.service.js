import fs from "fs";
import pdfParse from "pdf-parse";

import QuestionFrequencyService from "./questionFrequency.service.js";
import PYQSourceMapService from "./pyqSourceMap.service.js";
import ExamInsightService from "./examInsight.service.js";
import { syllabusMap } from "../data/syllabus.js";

import { syllabusMap } from "../data/syllabus.js";
/**
 * 🔧 Normalize text for matching
 */
const normalize = (text = "") =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

class PYQProcessingService {
  /**
   * 🔥 PROCESS ONE PYQ SAFELY
   * This function is IDEMPOTENT (safe to rerun)
   */
  static async processSinglePYQ({
    noteId,
    pdfFilePath,
    university = "AKTU",
    course = "BTECH",
    subject,
    unit,
    year
  }) {
    if (
      !noteId ||
      !pdfFilePath ||
      !subject ||
      !unit ||
      !year ||
      !syllabusTopics?.length
    ) {
      throw new Error("Missing required PYQ processing data");
    }
const syllabusTopics = syllabusMap?.[subject]?.[unit];

if (!syllabusTopics || !syllabusTopics.length) {
  throw new Error("Syllabus topics not found for subject and unit");
}
    /**
     * 1️⃣ Check if already processed
     */
    const alreadyProcessed =
      await PYQSourceMapService.isAlreadyProcessed(noteId, year);

    if (alreadyProcessed) {
      return {
        skipped: true,
        message: "PYQ already processed",
        noteId,
        year
      };
    }

    /**
     * 2️⃣ Extract PDF text
     */
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    const parsed = await pdfParse(pdfBuffer);
    const pdfText = normalize(parsed.text);

    /**
     * 3️⃣ Match syllabus topics (ONCE per paper)
     */
    const matchedTopics = [];
    const extractedTopics = [];

    for (const topic of syllabusTopics) {
      const normalizedTopic = normalize(topic);

      if (pdfText.includes(normalizedTopic)) {
        matchedTopics.push(topic);

        extractedTopics.push({
          topic,
          normalizedTopic,
          confidence: 1
        });
      }
    }

    /**
     * 4️⃣ Update QuestionFrequency (truth layer)
     */
    for (const topic of matchedTopics) {
      await QuestionFrequencyService.upsertTopicFrequency({
        university,
        course,
        subject,
        unit,
        topic,
        year
      });
    }

    /**
     * 5️⃣ Save PYQ source trace (safety layer)
     */
    await PYQSourceMapService.saveSourceMap({
      noteId,
      university,
      course,
      subject,
      unit,
      year,
      extractedTopics
    });

    /**
     * 6️⃣ Rebuild ExamInsight for this unit (experience layer)
     */
    await ExamInsightService.buildInsightForUnit({
      university,
      course,
      subject,
      unit
    });

    return {
      success: true,
      noteId,
      subject,
      unit,
      year,
      matchedTopicsCount: matchedTopics.length,
      matchedTopics
    };
  }

  /**
   * 🔄 PROCESS MULTIPLE PYQs (BATCH MODE)
   * Used for initial 450 PYQs
   */
  static async processBatchPYQs(pyqList = []) {
    const results = [];

    for (const pyq of pyqList) {
      try {
        const result = await this.processSinglePYQ(pyq);
        results.push({ status: "SUCCESS", ...result });
      } catch (error) {
        results.push({
          status: "FAILED",
          noteId: pyq.noteId,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default PYQProcessingService;
