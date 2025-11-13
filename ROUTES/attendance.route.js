import { Router } from 'express';
import {
  getAttendance,
  addSubject,
  markAttendance,
  updateTarget,
  deleteSubject,
  getAttendanceStats,
  getSubjectDetails,
  editSubject
} from '../CONTROLLERS/attendance.controller.js';
import {isLoggedIn, optionalAuth} from '../MIDDLEWARES/auth.middleware.js';

const router = Router();

// ✨ NEW: Get subject details
router.get('/:semester/subject/:subjectName',optionalAuth, getSubjectDetails);
router.get('/:semester/stats',optionalAuth, getAttendanceStats);

// Get attendance for a semester
router.get('/:semester',optionalAuth, getAttendance);
// Get stats


// All routes require authentication
router.use(isLoggedIn);


// ✨ NEW: Get subject details
router.get('/:semester/subject/:subjectName', getSubjectDetails);


// Add new subject
router.post('/:semester/subject', addSubject);

// Mark attendance
router.post('/:semester/mark', markAttendance);

// ✨ NEW: Edit subject
router.put('/:semester/subject/:subjectName/edit', editSubject);


// Update target percentage
router.put('/:semester/target', updateTarget);

// Delete subject
router.delete('/:semester/subject/:subject', deleteSubject);

export default router;
