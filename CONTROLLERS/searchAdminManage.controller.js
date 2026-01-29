import SearchSynonym from "../MODELS/searchSynonym.model.js";
import SearchCorrection from "../MODELS/searchCorrection.model.js";

/* =====================================================
   🔹 SEARCH SYNONYM
===================================================== */

/**
 * ➕ CREATE SYNONYM
 * DS → ["data structure", "data structures"]
 */
export const createSearchSynonym = async (req, res) => {
  const { keyword, expandsTo } = req.body;

  if (!keyword || !Array.isArray(expandsTo) || expandsTo.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Keyword and expandsTo are required"
    });
  }

  const synonym = await SearchSynonym.create({
    keyword,
    expandsTo
  });

  res.status(201).json({
    success: true,
    data: synonym
  });
};

/**
 * ✏️ UPDATE SYNONYM
 */
export const updateSearchSynonym = async (req, res) => {
  const { id } = req.params;
  const { keyword, expandsTo } = req.body;

  const updated = await SearchSynonym.findByIdAndUpdate(
    id,
    { keyword, expandsTo },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: updated
  });
};

/**
 * 🔁 TOGGLE ACTIVE / INACTIVE
 */
export const toggleSearchSynonym = async (req, res) => {
  const { id } = req.params;

  const synonym = await SearchSynonym.findById(id);
  if (!synonym) {
    return res.status(404).json({ success: false });
  }

  synonym.isActive = !synonym.isActive;
  await synonym.save();

  res.status(200).json({
    success: true,
    isActive: synonym.isActive
  });
};

/* =====================================================
   🔹 SEARCH CORRECTION
===================================================== */

/**
 * ➕ CREATE CORRECTION
 * data structre → data structure
 */
export const createSearchCorrection = async (req, res) => {
  const { wrongQuery, correctQuery, source = "admin" } = req.body;

  if (!wrongQuery || !correctQuery) {
    return res.status(400).json({
      success: false,
      message: "wrongQuery and correctQuery are required"
    });
  }

  const correction = await SearchCorrection.create({
    wrongQuery,
    correctQuery,
    source
  });

  res.status(201).json({
    success: true,
    data: correction
  });
};

/**
 * ✏️ UPDATE CORRECTION
 */
export const updateSearchCorrection = async (req, res) => {
  const { id } = req.params;
  const { wrongQuery, correctQuery, isActive } = req.body;

  const updated = await SearchCorrection.findByIdAndUpdate(
    id,
    { wrongQuery, correctQuery, isActive },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: updated
  });
};

/**
 * 🔁 TOGGLE ACTIVE / INACTIVE
 */
export const toggleSearchCorrection = async (req, res) => {
  const { id } = req.params;

  const correction = await SearchCorrection.findById(id);
  if (!correction) {
    return res.status(404).json({ success: false });
  }

  correction.isActive = !correction.isActive;
  await correction.save();

  res.status(200).json({
    success: true,
    isActive: correction.isActive
  });
};
