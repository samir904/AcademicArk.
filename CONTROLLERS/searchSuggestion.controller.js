// CONTROLLERS/searchSuggestion.controller.js
import SearchCorrection from "../MODELS/searchCorrection.model.js";
import SearchSynonym    from "../MODELS/searchSynonym.model.js";
import Note             from "../MODELS/note.model.js";

export const getSearchSuggestions = async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").toLowerCase().trim();

    if (!rawQuery || rawQuery.length < 1) {
      return res.json({ success: true, suggestions: [], isFallback: false });
    }

    const suggestionsSet = new Set();
    const tokens    = rawQuery.split(" ");
    const lastToken = tokens[tokens.length - 1];

    // ✅ Run ALL DB lookups in parallel — no sequential awaiting
    const [corrections, synonyms, tokenSynonyms, subjectMatches] = await Promise.all([
      
      /* 1️⃣ CORRECTIONS */
      SearchCorrection.find({
        wrongQuery: { $regex: `^${rawQuery}`, $options: "i" },
        isActive: true
      }).lean(),

      /* 2️⃣ SYNONYMS */
      SearchSynonym.find({
        keyword: { $regex: `^${rawQuery}`, $options: "i" },
        isActive: true
      }).lean(),

      /* 3️⃣ TOKEN LEVEL */
      lastToken.length > 1
        ? SearchSynonym.find({
            keyword: { $regex: `^${lastToken}`, $options: "i" },
            isActive: true
          }).lean()
        : Promise.resolve([]),

      /* 4️⃣ SUBJECT — always runs in parallel, never blocks */
      Note.aggregate([
        { $match: { subject: { $regex: rawQuery, $options: "i" } } },
        {
          $group: {
            _id: { $toLower: "$subject" },
            displaySubject: { $first: "$subject" },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, subject: "$displaySubject", count: 1 } }
      ])
    ]);

    // Fill the set
    corrections.forEach(c => suggestionsSet.add(c.correctQuery));
    synonyms.forEach(s => s.expandsTo.forEach(e => suggestionsSet.add(e)));
    tokenSynonyms.forEach(s =>
      s.expandsTo.forEach(expanded => {
        const rebuilt = [...tokens.slice(0, -1), expanded].join(" ");
        suggestionsSet.add(rebuilt);
      })
    );

    const beforeSubjects = suggestionsSet.size;
    subjectMatches.forEach(s => {
      if (s.subject) suggestionsSet.add(s.subject);
    });

    // isFallback = subjects were the only source of results
    const isFallback = beforeSubjects === 0 && suggestionsSet.size > 0;

    // console.log("📚 Subject matches:", subjectMatches.map(s => s.subject));

    return res.json({
      success: true,
      suggestions: Array.from(suggestionsSet).slice(0, 5),
      isFallback,
    });

  } catch (err) {
    console.error("getSearchSuggestions error:", err);
    return res.json({ success: true, suggestions: [], isFallback: false });
  }
};