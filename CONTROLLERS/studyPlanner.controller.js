import StudyPlanner from '../MODELS/studyPlanner.model.js';
import Note from '../MODELS/note.model.js';
import geminiService from '../services/gemini.service.js';
import Apperror from '../UTIL/error.util.js';

// ✅ Generate smart study timetable
const generateStudyTimetable = (examDate, subjects) => {
  const daysUntilExam = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
  const studyHoursPerDay = 4;
  const totalStudyHours = daysUntilExam * studyHoursPerDay;
  const hoursPerSubject = Math.floor(totalStudyHours / subjects.length);
  const hoursPerChapter = Math.floor(hoursPerSubject / subjects.reduce((sum, s) => sum + (s.chapters?.length || 5), 0) / subjects.length);

  return {
    daysUntilExam,
    studyHoursPerDay,
    hoursPerSubject,
    hoursPerChapter,
    schedule: subjects.map((subject, idx) => {
      const daysForSubject = Math.ceil(hoursPerSubject / studyHoursPerDay);
      return {
        subjectName: subject.name,
        startDay: idx > 0 ? subjects.slice(0, idx).reduce((sum, s) => sum + Math.ceil(hoursPerSubject / studyHoursPerDay), 1) : 1,
        endDay: idx > 0 ? subjects.slice(0, idx + 1).reduce((sum, s) => sum + Math.ceil(hoursPerSubject / studyHoursPerDay), 1) : daysForSubject,
        dailyHours: studyHoursPerDay,
        phases: [
          { phase: 'Syllabus Coverage', daysAllocated: Math.ceil((hoursPerSubject * 0.4) / studyHoursPerDay) },
          { phase: 'Revision', daysAllocated: Math.ceil((hoursPerSubject * 0.35) / studyHoursPerDay) },
          { phase: 'PYQ & Practice', daysAllocated: Math.ceil((hoursPerSubject * 0.25) / studyHoursPerDay) }
        ]
      };
    })
  };
};

// ✅ Create study plan
export const createStudyPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { examName, examType, examDate, subjects } = req.body;

    if (!examName || !examType || !examDate || !subjects || subjects.length === 0) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    // Generate AI study plan + timetable
    const aiPlan = await geminiService.generateStudyPlan({
      examName,
      examDate,
      subjects
    });

    const timetable = generateStudyTimetable(examDate, subjects);

    const studyPlanner = await StudyPlanner.create({
      userId,
      examName,
      examType,
      examDate,
      subjects: subjects.map((s, idx) => ({
        name: s.name,
        code: s.code,
        totalChapters: s.chapters?.length || 0,
        chapters: (s.chapters || []).map((ch, chIdx) => ({
          name: ch.name,
          chapterNumber: chIdx + 1,
          syllabusCompleted: false,
          revisionCompleted: false,
          pyqCompleted: false,
          completionStage: 0
        }))
      })),
      aiGeneratedPlan: aiPlan,
      timetable: timetable
    });

    res.status(201).json({
      success: true,
      message: 'Study plan created with AI timetable',
      studyPlanner
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Get study plan by ID (with all materials)
export const getStudyPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const studyPlanner = await StudyPlanner.findOne({ _id: id, userId });

    if (!studyPlanner) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    // Fetch materials for each subject
    const subjectsWithMaterials = await Promise.all(
      studyPlanner.subjects.map(async (subject) => {
        const materials = await Note.find({
          $or: [
            { subject: { $regex: subject.name, $options: 'i' } },
            { title: { $regex: subject.name, $options: 'i' } }
          ]
        }).select('_id title category subject downloads rating createdAt fileUrl').limit(50);

        return {
          ...subject.toObject(),
          materials: {
            notes: materials.filter(m => m.category === 'Notes' || m.category === 'Handwritten Notes'),
            pyq: materials.filter(m => m.category === 'PYQ'),
            importantQuestions: materials.filter(m => m.category === 'Important Question')
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      studyPlanner: {
        ...studyPlanner.toObject(),
        subjects: subjectsWithMaterials,
        timetable: studyPlanner.timetable // ✅ IMPORTANT: Return timetable
      }
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Get materials for a specific subject
export const getSubjectMaterials = async (req, res, next) => {
  try {
    const { id, subjectId } = req.params;
    const userId = req.user.id;

    const studyPlanner = await StudyPlanner.findOne({ _id: id, userId });
    if (!studyPlanner) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    const subject = studyPlanner.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    // Get ALL materials for this subject
    const materials = await Note.find({
      $or: [
        { subject: { $regex: subject.name, $options: 'i' } },
        { title: { $regex: subject.name, $options: 'i' } }
      ]
    })
    .select('_id title category subject downloads rating createdAt fileUrl')
    .sort({ downloads: -1, rating: -1 })
    .limit(100);

    res.status(200).json({
      success: true,
      materials: {
        notes: materials.filter(m => m.category === 'Notes' || m.category === 'Handwritten Notes'),
        pyq: materials.filter(m => m.category === 'PYQ'),
        importantQuestions: materials.filter(m => m.category === 'Important Question')
      }
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Update chapter progress
export const updateChapterProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subjectId, chapterId, progressType } = req.body;

    const studyPlanner = await StudyPlanner.findById(id);
    if (!studyPlanner) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    const subject = studyPlanner.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const chapter = subject.chapters.id(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    // Update based on progress type
    if (progressType === 'syllabus') {
      chapter.syllabusCompleted = !chapter.syllabusCompleted;
      if (!chapter.syllabusCompleted) {
        chapter.revisionCompleted = false;
        chapter.pyqCompleted = false;
      }
    }
    if (progressType === 'revision' && chapter.syllabusCompleted) {
      chapter.revisionCompleted = !chapter.revisionCompleted;
      if (!chapter.revisionCompleted) {
        chapter.pyqCompleted = false;
      }
    }
    if (progressType === 'pyq' && chapter.revisionCompleted) {
      chapter.pyqCompleted = !chapter.pyqCompleted;
    }

    // Calculate completion stage
    chapter.completionStage =
      (chapter.syllabusCompleted ? 1 : 0) +
      (chapter.revisionCompleted ? 1 : 0) +
      (chapter.pyqCompleted ? 1 : 0);

    // Recalculate subject progress
    const completedChapters = subject.chapters.filter(c => c.pyqCompleted).length;
    subject.progress = Math.round((completedChapters / subject.chapters.length) * 100);

    // Recalculate overall progress
    const completedSubjects = studyPlanner.subjects.filter(s => s.progress === 100).length;
    studyPlanner.overallProgress = Math.round((completedSubjects / studyPlanner.subjects.length) * 100);

    await studyPlanner.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated',
      studyPlanner
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Get all study plans
export const getStudyPlans = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const studyPlans = await StudyPlanner.find({ userId })
      .select('_id examName examType examDate overallProgress subjects.name subjects.progress createdAt timetable')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, studyPlans });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Delete study plan
export const deleteStudyPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const studyPlanner = await StudyPlanner.findOneAndDelete({ _id: id, userId });

    if (!studyPlanner) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    res.status(200).json({ success: true, message: 'Study plan deleted' });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// ✅ Get recommendations for a subject
export const getRecommendations = async (req, res, next) => {
  try {
    const { id, subjectId } = req.params;

    const studyPlanner = await StudyPlanner.findById(id);
    if (!studyPlanner) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    const subject = studyPlanner.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const recommendations = await geminiService.getStudyRecommendations(subject.name, {
      completed: subject.chapters.filter(c => c.pyqCompleted).length,
      total: subject.totalChapters
    });

    res.status(200).json({
      success: true,
      recommendations
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};
