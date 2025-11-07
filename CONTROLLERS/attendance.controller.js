import Attendance from '../MODELS/attendance.model.js';
import Apperror from '../UTIL/error.util.js';


/**
 * @GET_ATTENDANCE - UPDATED WITH PREDICTION
 * @ROUTE /api/v1/attendance/:semester
 * @ACCESS Private
 */
export const getAttendance = async (req, res, next) => {
  try {
    const { semester } = req.params;
    // ✨ NEW: Handle guest users
    if (!req.user) {
      // Return empty attendance for non-logged users
      return res.status(200).json({
        success: true,
        message: 'Please login to view your attendance',
        data: {
          semester,
          subjects: []
        }
      });
    }
    const userId = req.user.id;

    let attendance = await Attendance.findOne({ 
      user: userId, 
      semester 
    });

    if (!attendance) {
      attendance = await Attendance.create({
        user: userId,
        semester,
        subjects: []
      });
    }

    // ✨ UPDATED: Calculate with initial classes + prediction + 2 decimal precision
    const subjectsWithPercentage = attendance.subjects.map(subject => {
      const recordPresent = subject.records.filter(r => r.status === 'present').length;
      const recordTotal = subject.records.length;
      
      const totalPresent = subject.initialPresentClasses + recordPresent;
      const totalClasses = subject.initialTotalClasses + recordTotal;
      
      // ✨ CHANGED: 2 decimal places
      const percentage = totalClasses > 0 ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2)) : 0;

      // ✨ NEW: Calculate classes needed/can skip
      const targetPercentage = subject.targetPercentage || 75;
      let prediction = null;

      if (percentage < targetPercentage) {
        const classesNeeded = Math.ceil((targetPercentage * totalClasses - 100 * totalPresent) / (100 - targetPercentage));
        prediction = {
          type: 'need',
          classes: classesNeeded > 0 ? classesNeeded : 0,
          message: classesNeeded > 0 
            ? `Need to attend ${classesNeeded} more ${classesNeeded === 1 ? 'class' : 'classes'} to reach ${targetPercentage}%`
            : `On track to reach ${targetPercentage}%`
        };
      } else if (percentage > targetPercentage) {
        const canSkip = Math.floor((100 * totalPresent - targetPercentage * totalClasses) / targetPercentage);
        prediction = {
          type: 'skip',
          classes: canSkip > 0 ? canSkip : 0,
          message: canSkip > 0 
            ? `Can skip ${canSkip} ${canSkip === 1 ? 'class' : 'classes'} and stay above ${targetPercentage}%`
            : `Maintain attendance to stay above ${targetPercentage}%`
        };
      } else {
        prediction = {
          type: 'exact',
          classes: 0,
          message: `Perfect! At exactly ${targetPercentage}%`
        };
      }

      return {
        subject: subject.subject,
        targetPercentage: subject.targetPercentage,
        currentPercentage: percentage, // ✨ NOW 2 DECIMAL PLACES
        classesAttended: totalPresent,
        totalClasses: totalClasses,
        initialTotalClasses: subject.initialTotalClasses,
        initialPresentClasses: subject.initialPresentClasses,
        prediction,
        records: subject.records.sort((a, b) => new Date(b.date) - new Date(a.date))
      };
    });

    res.status(200).json({
      success: true,
      message: 'Attendance fetched successfully',
      data: {
        semester,
        subjects: subjectsWithPercentage
      }
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};


/**
 * @ADD_SUBJECT - UPDATED
 * @ROUTE /api/v1/attendance/:semester/subject
 * @ACCESS Private
 */
export const addSubject = async (req, res, next) => {
  try {
    const { semester } = req.params;
    const { subject, targetPercentage, initialTotalClasses, initialPresentClasses } = req.body;
    const userId = req.user.id;

    if (!subject) {
      return next(new Apperror('Subject name is required', 400));
    }

    // ✨ VALIDATION: Present classes can't exceed total classes
    if (initialPresentClasses > initialTotalClasses) {
      return next(new Apperror('Present classes cannot exceed total classes', 400));
    }

    let attendance = await Attendance.findOne({ 
      user: userId, 
      semester 
    });

    if (!attendance) {
      attendance = await Attendance.create({
        user: userId,
        semester,
        subjects: []
      });
    }

    const existingSubject = attendance.subjects.find(s => 
      s.subject.toLowerCase() === subject.toLowerCase()
    );

    if (existingSubject) {
      return next(new Apperror('Subject already exists', 400));
    }

    // ✨ UPDATED: Include initial classes
    attendance.subjects.push({
      subject,
      targetPercentage: targetPercentage || 75,
      initialTotalClasses: initialTotalClasses || 0,
      initialPresentClasses: initialPresentClasses || 0,
      records: []
    });

    await attendance.save();

    res.status(201).json({
      success: true,
      message: 'Subject added successfully',
      data: attendance
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * ✨ NEW: EDIT_SUBJECT
 * @ROUTE /api/v1/attendance/:semester/subject/:subjectName/edit
 * @ACCESS Private
 */
export const editSubject = async (req, res, next) => {
  try {
    const { semester, subjectName } = req.params;
    const { initialTotalClasses, initialPresentClasses, targetPercentage } = req.body;
    const userId = req.user.id;

    if (initialPresentClasses > initialTotalClasses) {
      return next(new Apperror('Present classes cannot exceed total classes', 400));
    }

    const attendance = await Attendance.findOne({ 
      user: userId, 
      semester 
    });

    if (!attendance) {
      return next(new Apperror('Attendance record not found', 404));
    }

    const subjectData = attendance.subjects.find(s => 
      s.subject.toLowerCase() === subjectName.toLowerCase()
    );

    if (!subjectData) {
      return next(new Apperror('Subject not found', 404));
    }

    // ✨ UPDATE: Modify initial classes
    if (initialTotalClasses !== undefined) {
      subjectData.initialTotalClasses = initialTotalClasses;
    }
    if (initialPresentClasses !== undefined) {
      subjectData.initialPresentClasses = initialPresentClasses;
    }
    if (targetPercentage !== undefined) {
      subjectData.targetPercentage = targetPercentage;
    }

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: subjectData
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @MARK_ATTENDANCE - FIXED FOR MULTIPLE CLASSES
 * @ROUTE /api/v1/attendance/:semester/mark
 * @ACCESS Private
 */
export const markAttendance = async (req, res, next) => {
  try {
    const { semester } = req.params;
    const { subject, status } = req.body;
    const userId = req.user.id;

    if (!subject || !status) {
      return next(new Apperror('Subject and status are required', 400));
    }

    if (!['present', 'absent'].includes(status)) {
      return next(new Apperror('Invalid status. Must be present or absent', 400));
    }

    const attendance = await Attendance.findOne({ 
      user: userId, 
      semester 
    });

    if (!attendance) {
      return next(new Apperror('Attendance record not found', 404));
    }

    const subjectIndex = attendance.subjects.findIndex(s => 
      s.subject.toLowerCase() === subject.toLowerCase()
    );

    if (subjectIndex === -1) {
      return next(new Apperror('Subject not found', 404));
    }

    // ✨ FIXED: ALWAYS ADD NEW RECORD (no checking for existing)
    const now = new Date();
    
    attendance.subjects[subjectIndex].records.push({
      date: now, // ✨ Use current timestamp (not normalized to midnight)
      status
    });

    await attendance.save();

    // Calculate COMPLETE subject data with prediction
    const subjectData = attendance.subjects[subjectIndex];
    const recordPresent = subjectData.records.filter(r => r.status === 'present').length;
    const recordTotal = subjectData.records.length;
    
    const totalPresent = subjectData.initialPresentClasses + recordPresent;
    const totalClasses = subjectData.initialTotalClasses + recordTotal;
    
    const percentage = totalClasses > 0 ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2)) : 0;
    // Calculate prediction
    const targetPercentage = subjectData.targetPercentage || 75;
    let prediction = null;

    if (percentage < targetPercentage) {
      const classesNeeded = Math.ceil((targetPercentage * totalClasses - 100 * totalPresent) / (100 - targetPercentage));
      prediction = {
        type: 'need',
        classes: classesNeeded > 0 ? classesNeeded : 0,
        message: classesNeeded > 0 
          ? `Need to attend ${classesNeeded} more ${classesNeeded === 1 ? 'class' : 'classes'} to reach ${targetPercentage}%`
          : `On track to reach ${targetPercentage}%`
      };
    } else if (percentage > targetPercentage) {
      const canSkip = Math.floor((100 * totalPresent - targetPercentage * totalClasses) / targetPercentage);
      prediction = {
        type: 'skip',
        classes: canSkip > 0 ? canSkip : 0,
        message: canSkip > 0 
          ? `Can skip ${canSkip} ${canSkip === 1 ? 'class' : 'classes'} and stay above ${targetPercentage}%`
          : `Maintain attendance to stay above ${targetPercentage}%`
      };
    } else {
      prediction = {
        type: 'exact',
        classes: 0,
        message: `Perfect! At exactly ${targetPercentage}%`
      };
    }

    // RETURN COMPLETE DATA
    res.status(200).json({
      success: true,
      message: `Marked ${status} for today`,
      data: {
        subject: subjectData.subject,
        targetPercentage: subjectData.targetPercentage,
        currentPercentage: percentage,
        classesAttended: totalPresent,
        totalClasses: totalClasses,
        initialTotalClasses: subjectData.initialTotalClasses,
        initialPresentClasses: subjectData.initialPresentClasses,
        prediction,
        records: subjectData.records.sort((a, b) => new Date(b.date) - new Date(a.date)),
        todayStatus: status
      }
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};



/**a
 * ✨ NEW: GET_SUBJECT_DETAILS
 * @ROUTE /api/v1/attendance/:semester/subject/:subjectName
 * @ACCESS Private
 */
export const getSubjectDetails = async (req, res, next) => {
  try {
    const { semester, subjectName } = req.params;
    const userId = req.user.id;

    const attendance = await Attendance.findOne({ 
      user: userId, 
      semester 
    });

    if (!attendance) {
      return next(new Apperror('Attendance record not found', 404));
    }

    const subjectData = attendance.subjects.find(s => 
      s.subject.toLowerCase() === subjectName.toLowerCase()
    );

    if (!subjectData) {
      return next(new Apperror('Subject not found', 404));
    }

    const recordPresent = subjectData.records.filter(r => r.status === 'present').length;
    const recordTotal = subjectData.records.length;
    
    const totalPresent = subjectData.initialPresentClasses + recordPresent;
    const totalClasses = subjectData.initialTotalClasses + recordTotal;
    
   // ✨ CHANGED: 2 decimal places (consistent with getAttendance)
const percentage = totalClasses > 0 ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      data: {
        subject: subjectData.subject,
        targetPercentage: subjectData.targetPercentage,
        currentPercentage: percentage,
        classesAttended: totalPresent,
        totalClasses: totalClasses,
        initialTotalClasses: subjectData.initialTotalClasses,
        initialPresentClasses: subjectData.initialPresentClasses,
        records: subjectData.records.sort((a, b) => new Date(b.date) - new Date(a.date))
      }
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

// Keep other functions (updateTarget, deleteSubject, getAttendanceStats) same as before
// Just update status enum to ['present', 'absent'] in getAttendanceStats

/**
 * @UPDATE_TARGET
 * @ROUTE /api/v1/attendance/:semester/target
 * @ACCESS Private
 */
export const updateTarget = async (req, res, next) => {
  try {
    const { semester } = req.params;
    const { subject, targetPercentage } = req.body;
    const userId = req.user.id;

    if (!subject || targetPercentage === undefined) {
      return next(new Apperror('Subject and target percentage are required', 400));
    }

    if (targetPercentage < 0 || targetPercentage > 100) {
      return next(new Apperror('Target percentage must be between 0 and 100', 400));
    }

    const attendance = await Attendance.findOne({
      user: userId,
      semester
    });

    if (!attendance) {
      return next(new Apperror('Attendance record not found', 404));
    }

    const subjectData = attendance.subjects.find(s =>
      s.subject.toLowerCase() === subject.toLowerCase()
    );

    if (!subjectData) {
      return next(new Apperror('Subject not found', 404));
    }

    subjectData.targetPercentage = targetPercentage;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Target percentage updated successfully',
      data: subjectData
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @DELETE_SUBJECT
 * @ROUTE /api/v1/attendance/:semester/subject/:subject
 * @ACCESS Private
 */
export const deleteSubject = async (req, res, next) => {
  try {
    const { semester, subject } = req.params;
    const userId = req.user.id;

    const attendance = await Attendance.findOne({
      user: userId,
      semester
    });

    if (!attendance) {
      return next(new Apperror('Attendance record not found', 404));
    }

    attendance.subjects = attendance.subjects.filter(s =>
      s.subject.toLowerCase() !== subject.toLowerCase()
    );

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Subject deleted successfully'
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @GET_STATS - FIXED WITH 2 DECIMAL PRECISION
 * @ROUTE /api/v1/attendance/:semester/stats
 * @ACCESS Private
 */
export const getAttendanceStats = async (req, res, next) => {
  try {
    const { semester } = req.params;
    // ✨ NEW: Handle guest users
    if (!req.user) {
      // Return empty stats for non-logged users
      return res.status(200).json({
        success: true,
        data: {
          totalSubjects: 0,
          overallPercentage: 0,
          subjectsBelow75: 0,
          totalClassesAttended: 0,
          totalClasses: 0
        }
      });
    }

    const userId = req.user.id;

    const attendance = await Attendance.findOne({
      user: userId,
      semester
    });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: {
          totalSubjects: 0,
          overallPercentage: 0,
          subjectsBelow75: 0,
          totalClassesAttended: 0,
          totalClasses: 0
        }
      });
    }

    let totalPresent = 0;
    let totalClasses = 0;
    let subjectsBelow75 = 0;

    const subjectStats = attendance.subjects.map(subject => {
      // ✨ FIXED: Include initial classes
      const recordPresent = subject.records.filter(r => r.status === 'present').length;
      const recordTotal = subject.records.length;
      
      const present = subject.initialPresentClasses + recordPresent;
      const total = subject.initialTotalClasses + recordTotal;
      
      // ✨ CHANGED: 2 decimal places
      const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(2)) : 0;

      // ✨ FIXED: Add to overall totals
      totalPresent += present;
      totalClasses += total;

      if (percentage < 75) subjectsBelow75++;

      return {
        subject: subject.subject,
        percentage, // ✨ NOW 2 DECIMAL PLACES
        classesAttended: present,
        totalClasses: total,
        target: subject.targetPercentage
      };
    });

    // ✨ CHANGED: 2 decimal places for overall
    const overallPercentage = totalClasses > 0
      ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2))
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalSubjects: attendance.subjects.length,
        overallPercentage, // ✨ NOW 2 DECIMAL PLACES
        subjectsBelow75,
        totalClassesAttended: totalPresent,
        totalClasses,
        subjects: subjectStats
      }
    });

  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};
