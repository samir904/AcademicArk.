// CONTROLLERS/searchSuggestion.controller.js
import SearchCorrection from "../MODELS/searchCorrection.model.js";
import SearchSynonym from "../MODELS/searchSynonym.model.js";

/**
 * ✨ GET SEARCH SUGGESTIONS
 * Example:
 * /search/suggestions?q=data+structre
 */
export const getSearchSuggestions = async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").toLowerCase().trim();

    if (!rawQuery || rawQuery.length < 1) {
      return res.json({ success: true, suggestions: [] });
    }

    const suggestionsSet = new Set();

    /* 1️⃣ CORRECTIONS (PARTIAL) */
    const corrections = await SearchCorrection.find({
      wrongQuery: { $regex: `^${rawQuery}`, $options: "i" },
      isActive: true
    }).lean();

    corrections.forEach(c =>
      suggestionsSet.add(c.correctQuery)
    );

    /* 2️⃣ SYNONYMS (PARTIAL) */
    const synonyms = await SearchSynonym.find({
      keyword: { $regex: `^${rawQuery}`, $options: "i" },
      isActive: true
    }).lean();

    synonyms.forEach(s =>
      s.expandsTo.forEach(e => suggestionsSet.add(e))
    );

    /* 3️⃣ TOKEN LEVEL */
    const tokens = rawQuery.split(" ");
    const lastToken = tokens[tokens.length - 1];

    if (lastToken.length > 1) {
      const tokenSynonyms = await SearchSynonym.find({
        keyword: { $regex: `^${lastToken}`, $options: "i" },
        isActive: true
      }).lean();

      tokenSynonyms.forEach(s =>
        s.expandsTo.forEach(expanded => {
          const rebuilt = [...tokens.slice(0, -1), expanded].join(" ");
          suggestionsSet.add(rebuilt);
        })
      );
    }

    return res.json({
      success: true,
      suggestions: Array.from(suggestionsSet).slice(0, 5)
    });
  } catch (err) {
    console.error(err);
    return res.json({ success: true, suggestions: [] });
  }
};

