import redisClient from "../CONFIG/redisClient.js";

export const cacheNotes = async (req, res, next) => {
  try {
    // 🚫 Never cache cursor pagination
    if (req.query.cursor) return next();

    const mode = req._notesMode || "UNKNOWN";

    const key = `notes:first:${mode}:${JSON.stringify(req.query)}`;

    const cached = await redisClient.get(key);
    if (cached) {
      console.log("⚡ Notes served from cache:", mode);
      return res.status(200).json(JSON.parse(cached));
    }

    // Cache response AFTER controller runs
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (data?.success) {
        redisClient.setEx(key, 120, JSON.stringify(data));
      }
      return originalJson(data);
    };

    next();
  } catch (err) {
    next(err);
  }
};

// cacheSemesterPreview.js
// import redisClient from "../CONFIG/redisClient.js";

export const cacheSemesterPreview = async (req, res, next) => {
  try {
    const { semester } = req.query;

    // 🚫 No semester → no cache
    if (!semester) return next();

    // 🔑 Simple, stable key
    const key = `notes:preview:semester:${semester}`;

    const cached = await redisClient.get(key);
    if (cached) {
      console.log("⚡ Semester preview served from cache");
      return res.status(200).json(JSON.parse(cached));
    }

    // 🪄 Hook into res.json
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (data?.success) {
        redisClient.setEx(
          key,
          300, // ⏱️ 5 minutes (perfect balance)
          JSON.stringify(data)
        );
      }
      return originalJson(data);
    };

    next();
  } catch (err) {
    next(err);
  }
};