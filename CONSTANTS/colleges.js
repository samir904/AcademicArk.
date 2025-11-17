// 🏫 FILE: BACKEND/CONSTANTS/colleges.js
// ✨ Predefined college list

export const PREDEFINED_COLLEGES = [
    "KCC Institute of Technology and Management",
    "GL Bajaj Institute of Technology and Management",
    "GNIOT (Greater Noida Institute of Technology)",
    "NIET (Noida Institute of Engineering and Technology)",
    "ABESIT (ABESIT GROUP OF INSTITUTIONS)",
    "Other"
];

// ✨ Format for easier use
export const COLLEGE_OPTIONS = PREDEFINED_COLLEGES.map((college, index) => ({
    value: college,
    label: college,
    isPredefined: college !== "Other"
}));

// ✨ Validation helper
export const isValidCollege = (collegeName, includePredefined = true) => {
    if (!collegeName || !collegeName.trim()) return false;
    
    if (includePredefined && PREDEFINED_COLLEGES.includes(collegeName)) {
        return true;
    }
    
    // Custom colleges need approval but are initially valid
    if (!includePredefined && collegeName.length > 0 && collegeName.length <= 100) {
        return true;
    }
    
    return false;
};

// ✨ Get college list for frontend
export const getCollegeList = () => COLLEGE_OPTIONS;