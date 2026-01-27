export const decideNotesMode = (req, res, next) => {
  const { semester, subject, category, unit } = req.query;

  const onlySemester =
    semester &&
    !subject &&
    !category &&
    !unit;

  req._notesMode = onlySemester
    ? "SEMESTER_PREVIEW"
    : "FILTERED";

  next();
};