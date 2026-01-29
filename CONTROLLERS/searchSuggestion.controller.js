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

    // 🛑 Guard: too short / empty
    if (!rawQuery || rawQuery.length < 2) {
      return res.status(200).json({
        success: true,
        suggestions: []
      });
    }

    const suggestionsSet = new Set();

    /* -------------------------------------------------
       1️⃣ TYPO / CORRECTION MATCH
       ------------------------------------------------- */

    const correction = await SearchCorrection.findOne({
      wrongQuery: rawQuery,
      isActive: true
    }).lean();

    if (correction) {
      suggestionsSet.add(correction.correctQuery);
    }

    /* -------------------------------------------------
       2️⃣ SYNONYM EXPANSION
       ------------------------------------------------- */

    const synonym = await SearchSynonym.findOne({
      keyword: rawQuery,
      isActive: true
    }).lean();

    if (synonym?.expandsTo?.length) {
      synonym.expandsTo.forEach(q => suggestionsSet.add(q));
    }

    /* -------------------------------------------------
       3️⃣ PARTIAL / TOKEN-LEVEL HELP (lightweight)
       ------------------------------------------------- */

    const tokens = rawQuery.split(" ");

    if (tokens.length > 1) {
      const lastToken = tokens[tokens.length - 1];

      // Try synonym on last token (e.g. "ds notes")
      const tokenSynonym = await SearchSynonym.findOne({
        keyword: lastToken,
        isActive: true
      }).lean();

      if (tokenSynonym?.expandsTo?.length) {
        tokenSynonym.expandsTo.forEach(expanded => {
          const rebuilt = [...tokens.slice(0, -1), expanded].join(" ");
          suggestionsSet.add(rebuilt);
        });
      }
    }

    /* -------------------------------------------------
       4️⃣ FINAL RESPONSE
       ------------------------------------------------- */

    const suggestions = Array.from(suggestionsSet).slice(0, 5);

    return res.status(200).json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error("❌ search suggestions error:", error.message);

    // Fail silently (UX > analytics)
    return res.status(200).json({
      success: true,
      suggestions: []
    });
  }
};
