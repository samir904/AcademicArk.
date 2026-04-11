// CONTROLLERS/adminArkShot.controller.js
import ArkShot           from "../MODELS/arkShot.model.js";
import ArkShotAnalytics  from "../MODELS/arkShotAnalytics.model.js";
import ArkShotCollection from "../MODELS/arkShotCollection.model.js";
import ArkShotProgress   from "../MODELS/arkShotProgress.model.js";
import AppError          from "../UTIL/error.util.js";
import cloudinary        from "cloudinary";
import fs                from "fs";
import Note from "../MODELS/note.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — upload diagram to Cloudinary
// ─────────────────────────────────────────────────────────────────────────────
const uploadDiagram = async (filePath) => {
  const result = await cloudinary.v2.uploader.upload(filePath, {
    folder:         "AcademicArk/ArkShots",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, crop: "limit" },   // max width
      { quality: "auto:good" },         // auto compress
      { fetch_format: "auto" },         // webp on modern browsers
    ],
  });
  fs.unlinkSync(filePath);              // clean temp file
  return {
    public_id:  result.public_id,
    secure_url: result.secure_url,
  };
};
const uploadCoverImage = async (filePath) => {
  const result = await cloudinary.v2.uploader.upload(filePath, {
    folder:          "AcademicArk/Collections",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "center" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
  });
  fs.unlinkSync(filePath);
  return {
    public_id:  result.public_id,
    secure_url: result.secure_url,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  GET ALL SHOTS (Admin view — all statuses)
//     GET /api/v1/admin/arkshots?status=draft&semester=4&page=1
// ─────────────────────────────────────────────────────────────────────────────
export const getAllShots = async (req, res, next) => {
  try {
    const {
      status,
      semester,
      subject,
      unit,
      difficulty,
      isPYQ,
      page  = 1,
      limit = 20,
      sort  = "newest",
    } = req.query;

    const filter = {};
    if (status)     filter.status     = status;
    if (semester) filter.semester = { $elemMatch: { $eq: Number(semester) } };
    if (subject)    filter.subject    = subject;
    if (unit)       filter.unit       = Number(unit);
    if (difficulty) filter.difficulty = difficulty;
    if (isPYQ)      filter.isPYQ      = isPYQ === "true";

    const sortMap = {
      newest:    { createdAt: -1 },
      oldest:    { createdAt:  1 },
      views:     { views: -1 },
      frequency: { frequencyScore: -1 },
      order:     { unit: 1, order: 1 },
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [shots, total] = await Promise.all([
      ArkShot
        .find(filter)
        .sort(sortMap[sort] || sortMap.newest)
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "fullName email")
        .lean({ virtuals: true }),
      ArkShot.countDocuments(filter),
    ]);

    // ── Status breakdown counts ───────────────────
    const [draftCount, publishedCount, archivedCount] = await Promise.all([
      ArkShot.countDocuments({ status: "draft" }),
      ArkShot.countDocuments({ status: "published" }),
      ArkShot.countDocuments({ status: "archived" }),
    ]);

    res.status(200).json({
      success: true,
      data:    shots,
      meta: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        counts: {
          draft:     draftCount,
          published: publishedCount,
          archived:  archivedCount,
        },
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  CREATE SHOT
//     POST /api/v1/admin/arkshots
//     multipart/form-data (diagram optional)
// ─────────────────────────────────────────────────────────────────────────────
export const createShot = async (req, res, next) => {
  try {
    // ── Sanitize keys + values ────────────────────
    const body = Object.fromEntries(
      Object.entries(req.body).map(([k, v]) => [
        k.trim(),
        typeof v === "string" ? v.trim() : v
      ])
    );

    const {
      subject,
      semester,
      unit,
      order,
      title,
      concept,
      definition,
      example,
      memoryTip,
      examTip,
      diagramCaption,
      difficulty,
      tags,
      frequencyScore,
      isPYQ,
      pyqYears,
      colorScheme,
      customBg,
      customAccent,
      customText,
      relatedNotes,
      isLocked,
      status,
    } = body;
// ── Debug log ─────────────────────────────────
    console.log("📦 req.body:", req.body);
    // ── Required fields ───────────────────────────
    if (!subject || !semester || !unit || !title) {
      return next(new AppError("subject, semester, unit, title are required", 400));
    }

    // ── Upload diagram if provided ─────────────────
    let diagram = { public_id: null, secure_url: null };
    if (req.file?.path) {
      diagram = await uploadDiagram(req.file.path);
    }

    const shot = await ArkShot.create({
      subject,
      semester: semester
      ? (Array.isArray(semester)
          ? semester.map(Number)           // if already array (JSON)
          : JSON.parse(semester))          // if sent as "[4]" or "[2,3]" string
      : [],
      unit:      Number(unit),
      order:     order     ? Number(order) : 0,
      title,
      concept,
      definition,
      example,
      memoryTip,
      examTip,
      diagramCaption,
      diagram,
      difficulty: difficulty || "easy",
      tags:       tags ? JSON.parse(tags) : [],         // sent as JSON string in form-data
      frequencyScore: frequencyScore ? Number(frequencyScore) : 0,
      isPYQ:          isPYQ === "true",
      pyqYears:       pyqYears ? JSON.parse(pyqYears) : [],
      theme: {
        colorScheme: colorScheme || "indigo",
        customBg:    customBg    || null,
        customAccent: customAccent || null,
        customText:  customText  || null,
      },
       // ✅ Parse JSON array, filter any empty/invalid entries
  relatedNotes: relatedNotes
    ? JSON.parse(relatedNotes).filter(id => id && id !== "null" && id !== "")
    : [],

      isLocked:     isLocked === "true",
      status:       status || "draft",
      createdBy:    req.user.id,
    });

    // ── Create analytics doc ──────────────────────
    await ArkShotAnalytics.create({ arkShot: shot._id });

    console.log(`✅ ArkShot created: ${shot.title} [${shot.status}]`);

    res.status(201).json({
      success: true,
      message: "ArkShot created successfully",
      data:    shot,
    });
  } catch (err) {
    // Clean up uploaded file if DB save fails
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPLOAD SHOTS
// POST /api/v1/admin/arkshots/bulk/upload
// Body: { shots: [...], autoPublish: false }
// shots is a JSON array — no file uploads (diagrams not supported in bulk)
// ─────────────────────────────────────────────────────────────────────────────
export const bulkUploadShots = async (req, res, next) => {
  try {
    const { shots, autoPublish = false } = req.body;

    // ── Guard ──────────────────────────────────────────────────────────────
    if (!Array.isArray(shots) || shots.length === 0) {
      return next(new AppError("shots array is required", 400));
    }
    if (shots.length > 200) {
      return next(new AppError("Max 200 shots per bulk upload", 400));
    }

    const results = {
      inserted: [],
      failed:   [],
    };

    // ── Per-shot validation + normalization ────────────────────────────────
    const toInsert = [];

    for (let i = 0; i < shots.length; i++) {
      const raw = shots[i];

      // Required field check
      const missing = [];
      if (!raw.subject?.trim()) missing.push("subject");
      if (!raw.semester)        missing.push("semester");
      if (!raw.unit)            missing.push("unit");
      if (!raw.title?.trim())   missing.push("title");

      if (missing.length > 0) {
        results.failed.push({
          index: i,
          title: raw.title || `Shot #${i + 1}`,
          reason: `Missing required fields: ${missing.join(", ")}`,
        });
        continue;
      }

      // Semester normalization — accept number, array, or "[4]" string
      let semester;
      try {
        if (Array.isArray(raw.semester)) {
          semester = raw.semester.map(Number);
        } else if (typeof raw.semester === "string" && raw.semester.startsWith("[")) {
          semester = JSON.parse(raw.semester).map(Number);
        } else {
          semester = [Number(raw.semester)];
        }
        if (semester.some(isNaN) || semester.length === 0) throw new Error();
      } catch {
        results.failed.push({
          index: i,
          title: raw.title,
          reason: "Invalid semester format — use number, array of numbers, or JSON string like [4]",
        });
        continue;
      }

      // Tags + pyqYears normalization
      let tags = [];
      let pyqYears = [];
      try {
        tags     = Array.isArray(raw.tags)     ? raw.tags     : (raw.tags     ? JSON.parse(raw.tags)     : []);
        pyqYears = Array.isArray(raw.pyqYears) ? raw.pyqYears : (raw.pyqYears ? JSON.parse(raw.pyqYears) : []);
      } catch {
        tags = []; pyqYears = [];
      }

      // relatedNotes normalization
      let relatedNotes = [];
      try {
        const raw_rn = raw.relatedNotes;
        relatedNotes = Array.isArray(raw_rn)
          ? raw_rn
          : (raw_rn ? JSON.parse(raw_rn) : []);
        relatedNotes = relatedNotes.filter(id => id && id !== "null" && id !== "");
      } catch {
        relatedNotes = [];
      }

      toInsert.push({
        subject:        raw.subject.trim().toLowerCase(),
        semester,
        unit:           Number(raw.unit),
        order:          raw.order          ? Number(raw.order) : 0,
        title:          raw.title.trim(),
        concept:        raw.concept        || undefined,
        definition:     raw.definition     || undefined,
        example:        raw.example        || undefined,
        memoryTip:      raw.memoryTip      || undefined,
        examTip:        raw.examTip        || undefined,
        diagramCaption: raw.diagramCaption || undefined,
        diagram:        { public_id: null, secure_url: null },  // bulk = no diagrams
        difficulty:     ["easy","medium","hard"].includes(raw.difficulty)
                          ? raw.difficulty : "easy",
        tags,
        frequencyScore: raw.frequencyScore ? Number(raw.frequencyScore) : 0,
        isPYQ:          raw.isPYQ === true || raw.isPYQ === "true",
        pyqYears,
        theme: {
          colorScheme:  raw.colorScheme  || null,  // pre-save hook auto-assigns from subject
          customBg:     raw.customBg     || null,
          customAccent: raw.customAccent || null,
          customText:   raw.customText   || null,
        },
        relatedNotes,
        isLocked:   raw.isLocked === true || raw.isLocked === "true",
        status:     autoPublish ? "published" : (raw.status || "draft"),
        isActive:   autoPublish ? true : (raw.isActive !== false),
        createdBy:  req.user.id,
        isAutoGenerated: false,
      });
    }

    // ── Bulk insert (ordered: false = don't stop on one failure) ───────────
    let insertedDocs = [];
    if (toInsert.length > 0) {
      try {
        insertedDocs = await ArkShot.insertMany(toInsert, {
          ordered: false,   // ✅ continue inserting even if some fail
          rawResult: false,
        });
      } catch (bulkErr) {
        // insertMany with ordered:false throws BulkWriteError
        // but still inserts valid docs — extract them
        if (bulkErr.name === "MongoBulkWriteError") {
          insertedDocs = bulkErr.result?.insertedIds
            ? Object.values(bulkErr.result.insertedIds).map((_, idx) => toInsert[idx])
            : [];

          // Capture per-doc errors
          (bulkErr.writeErrors || []).forEach(writeErr => {
            const failedDoc = toInsert[writeErr.index];
            results.failed.push({
              index:  writeErr.index,
              title:  failedDoc?.title || `Shot #${writeErr.index}`,
              reason: writeErr.errmsg || "DB insert failed",
            });
          });
        } else {
          throw bulkErr; // unexpected error — re-throw to outer catch
        }
      }
    }

    // ── Create ArkShotAnalytics docs for each inserted shot ───────────────
    if (insertedDocs.length > 0) {
      const analyticsDocs = insertedDocs.map(doc => ({ arkShot: doc._id }));
      await ArkShotAnalytics.insertMany(analyticsDocs, { ordered: false });
    }

    results.inserted = insertedDocs.map(d => ({
      _id:     d._id,
      title:   d.title,
      subject: d.subject,
      unit:    d.unit,
      status:  d.status,
    }));

    console.log(`✅ Bulk upload: ${results.inserted.length} inserted, ${results.failed.length} failed`);

    const statusCode = results.failed.length > 0 && results.inserted.length === 0
      ? 400   // all failed
      : 201;  // at least some succeeded

    return res.status(statusCode).json({
      success:       results.inserted.length > 0,
      insertedCount: results.inserted.length,
      failedCount:   results.failed.length,
      data: {
        inserted: results.inserted,
        failed:   results.failed,
      },
      message: `${results.inserted.length} shots uploaded${results.failed.length > 0 ? `, ${results.failed.length} failed` : " successfully"}`,
    });

  } catch (err) {
    console.error("bulkUploadShots error:", err);
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  UPDATE SHOT
//     PUT /api/v1/admin/arkshots/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateShot = async (req, res, next) => {
  try {
    const { id } = req.params;

    const shot = await ArkShot.findById(id);
    if (!shot) return next(new AppError("ArkShot not found", 404));

    // ── Upload new diagram if provided ────────────
    if (req.file?.path) {
      // Delete old diagram from Cloudinary
      if (shot.diagram?.public_id) {
        await cloudinary.v2.uploader.destroy(shot.diagram.public_id);
      }
      shot.diagram = await uploadDiagram(req.file.path);
    }

     // ── Simple updatable scalar fields ────────────
    // ✅ relatedNote removed — handled separately below as array
    const updatableFields = [
      "subject", "unit", "order", "title",
      "concept", "definition", "example", "memoryTip", "examTip",
      "diagramCaption", "difficulty", "frequencyScore",
      "isPYQ", "isLocked", "isActive",
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        shot[field] = req.body[field];
      }
    });
    // ── Handle semester separately as array ───────────────────────────────────
    if (req.body.semester) {
      shot.semester = Array.isArray(req.body.semester)
        ? req.body.semester.map(Number)
        : JSON.parse(req.body.semester);         // "[2,3]" → [2, 3]
    }

    // ── Array fields ──────────────────────────────
    if (req.body.tags)       shot.tags     = JSON.parse(req.body.tags);
    if (req.body.pyqYears)   shot.pyqYears = JSON.parse(req.body.pyqYears);
    if (req.body.relatedShots) {
      shot.relatedShots = JSON.parse(req.body.relatedShots);
    }

    // ✅ relatedNotes — always update when sent (even empty array = clear all)
    if (req.body.relatedNotes !== undefined) {
      const parsed = JSON.parse(req.body.relatedNotes);
      shot.relatedNotes = Array.isArray(parsed)
        ? parsed.filter(id => id && id !== "null" && id !== "")
        : [];
    }
    // ── Theme fields ──────────────────────────────
    if (req.body.colorScheme)  shot.theme.colorScheme  = req.body.colorScheme;
    if (req.body.customBg)     shot.theme.customBg     = req.body.customBg;
    if (req.body.customAccent) shot.theme.customAccent = req.body.customAccent;
    if (req.body.customText)   shot.theme.customText   = req.body.customText;

    await shot.save();

    res.status(200).json({
      success: true,
      message: "ArkShot updated",
      data:    shot,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4️⃣  DELETE SHOT
//     DELETE /api/v1/admin/arkshots/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteShot = async (req, res, next) => {
  try {
    const { id } = req.params;

    const shot = await ArkShot.findById(id);
    if (!shot) return next(new AppError("ArkShot not found", 404));

    // ── Delete diagram from Cloudinary ────────────
    if (shot.diagram?.public_id) {
      await cloudinary.v2.uploader.destroy(shot.diagram.public_id);
    }

    // ── Delete all related documents ──────────────
    await Promise.all([
      ArkShot.findByIdAndDelete(id),
      ArkShotAnalytics.deleteOne({ arkShot: id }),
      ArkShotProgress.deleteMany({ arkShot: id }),
      // Remove from collections
      ArkShotCollection.updateMany(
        { arkShots: id },
        { $pull: { arkShots: id }, $inc: { totalShots: -1 } }
      ),
    ]);

    console.log(`🗑️ ArkShot deleted: ${shot.title}`);

    res.status(200).json({
      success: true,
      message: "ArkShot deleted successfully",
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5️⃣  PUBLISH SHOT
//     PATCH /api/v1/admin/arkshots/:id/publish
// ─────────────────────────────────────────────────────────────────────────────
export const publishShot = async (req, res, next) => {
  try {
    const shot = await ArkShot.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "published", isActive: true } },
      { new: true }
    );

    if (!shot) return next(new AppError("ArkShot not found", 404));

    console.log(`🚀 ArkShot published: ${shot.title}`);

    res.status(200).json({
      success: true,
      message: `"${shot.title}" is now live`,
      data:    shot,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6️⃣  ARCHIVE SHOT
//     PATCH /api/v1/admin/arkshots/:id/archive
// ─────────────────────────────────────────────────────────────────────────────
export const archiveShot = async (req, res, next) => {
  try {
    const shot = await ArkShot.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "archived", isActive: false } },
      { new: true }
    );

    if (!shot) return next(new AppError("ArkShot not found", 404));

    res.status(200).json({
      success: true,
      message: `"${shot.title}" archived`,
      data:    shot,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7️⃣  BULK PUBLISH
//     PATCH /api/v1/admin/arkshots/bulk/publish
//     Body: { ids: ["id1", "id2", ...] }
// ─────────────────────────────────────────────────────────────────────────────
export const bulkPublish = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(new AppError("ids array is required", 400));
    }

    const result = await ArkShot.updateMany(
      { _id: { $in: ids }, status: "draft" },
      { $set: { status: "published", isActive: true } }
    );

    console.log(`🚀 Bulk published: ${result.modifiedCount} ArkShots`);

    res.status(200).json({
      success:       true,
      message:       `${result.modifiedCount} ArkShots published`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8️⃣  CREATE COLLECTION
//     POST /api/v1/admin/arkshots/collections
//     multipart/form-data (coverImage optional)
// ─────────────────────────────────────────────────────────────────────────────
export const createCollection = async (req, res, next) => {
  try {
    const {
      name,
      description,
      emoji,
      semester,
      subject,
      unit,
      arkShots,
      isFeatured,
      isActive,
      order,
      coverTemplate,
      colorTheme,
    } = req.body;

    if (!name?.trim()) {
      return next(new AppError("Collection name is required", 400));
    }

    // ── Parse arkShots (sent as JSON string from FormData) ────────────────
    let parsedShots = [];
    if (arkShots) {
      try {
        parsedShots = JSON.parse(arkShots);
      } catch {
        parsedShots = Array.isArray(arkShots) ? arkShots : [];
      }
    }

    // ── Upload cover image if provided ────────────────────────────────────
    let coverImage = { public_id: null, secure_url: null };
    if (req.file?.path) {
      coverImage = await uploadCoverImage(req.file.path);
    }

    const collection = await ArkShotCollection.create({
      name:          name.trim(),
      description:   description   || "",
      emoji:         emoji         || "📦",
      semester:      semester      ? Number(semester) : null,
      subject:       subject       || null,
      unit:          unit          ? Number(unit) : null,
      arkShots:      parsedShots,
      totalShots:    parsedShots.length,
      isFeatured:    isFeatured === "true" || isFeatured === true,
      isActive:      isActive   === "false" || isActive === false ? false : true,
      order:         order       ? Number(order) : 0,
      coverTemplate: coverTemplate || "gradient",
      colorTheme:    colorTheme    || "",
      coverImage,
      createdBy:     req.user.id,
    });

    console.log(`✅ Collection created: ${collection.name}`);

    res.status(201).json({
      success: true,
      message: "Collection created",
      data:    collection,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError(err.message, 500));
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// 9️⃣  UPDATE COLLECTION
//     PUT /api/v1/admin/arkshots/collections/:id
//     multipart/form-data (coverImage optional)
// ─────────────────────────────────────────────────────────────────────────────
export const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;

    const collection = await ArkShotCollection.findById(id);
    if (!collection) return next(new AppError("Collection not found", 404));

    const {
      name, description, emoji,
      semester, subject, unit,
      arkShots, isFeatured, isActive, order,
      coverTemplate, colorTheme,
    } = req.body;

    // ── Scalar fields ─────────────────────────────────────────────────────
    if (name?.trim())             collection.name          = name.trim();
    if (description !== undefined) collection.description  = description;
    if (emoji)                    collection.emoji         = emoji;
    if (coverTemplate)            collection.coverTemplate = coverTemplate;
    if (colorTheme !== undefined) collection.colorTheme    = colorTheme;  // allow empty string (reset to auto)

    // ── Nullable numbers ──────────────────────────────────────────────────
    if (semester !== undefined)
      collection.semester = semester ? Number(semester) : null;
    if (subject !== undefined)
      collection.subject  = subject  || null;
    if (unit !== undefined)
      collection.unit     = unit     ? Number(unit) : null;

    // ── Booleans ──────────────────────────────────────────────────────────
    if (isFeatured !== undefined)
      collection.isFeatured = isFeatured === "true" || isFeatured === true;
    if (isActive !== undefined)
      collection.isActive   = isActive   !== "false" && isActive !== false;

    // ── Order ─────────────────────────────────────────────────────────────
    if (order !== undefined)
      collection.order = Number(order) || 0;

    // ── Shots list ────────────────────────────────────────────────────────
    if (arkShots !== undefined) {
      let parsedShots = [];
      try {
        parsedShots = JSON.parse(arkShots);
      } catch {
        parsedShots = Array.isArray(arkShots) ? arkShots : [];
      }
      collection.arkShots   = parsedShots;
      collection.totalShots = parsedShots.length;
    }

    // ── Cover image upload (replace old one) ──────────────────────────────
    if (req.file?.path) {
      // Delete old image from Cloudinary if exists
      if (collection.coverImage?.public_id) {
        await cloudinary.v2.uploader.destroy(collection.coverImage.public_id);
      }
      collection.coverImage = await uploadCoverImage(req.file.path);
    }

    await collection.save();

    console.log(`✅ Collection updated: ${collection.name}`);

    res.status(200).json({
      success: true,
      message: "Collection updated",
      data:    collection,
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣1️⃣  GET ALL COLLECTIONS
//     GET /api/v1/admin/arkshots/collections
//     Query: ?semester=4&subject=dbms&isFeatured=true&isActive=true
// ─────────────────────────────────────────────────────────────────────────────
export const getCollections = async (req, res, next) => {
  try {
    const {
      semester,
      subject,
      unit,
      isFeatured,
      isActive,
      sort  = "order",   // order | newest | shots
      page  = 1,
      limit = 50,
    } = req.query;

    // ── Build filter ──────────────────────────────
    const filter = {};
    if (semester)             filter.semester   = Number(semester);
    if (subject)              filter.subject    = subject;
    if (unit)                 filter.unit       = Number(unit);
    if (isFeatured !== undefined && isFeatured !== '')
      filter.isFeatured = isFeatured === 'true';
    if (isActive !== undefined && isActive !== '')
      filter.isActive   = isActive === 'true';

    // ── Sort map ──────────────────────────────────
    const sortMap = {
      order:  { order: 1, createdAt: -1 },
      newest: { createdAt: -1 },
      shots:  { totalShots: -1 },
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [collections, total] = await Promise.all([
      ArkShotCollection
        .find(filter)
        .sort(sortMap[sort] || sortMap.order)
        .skip(skip)
        .limit(Number(limit))
        // Populate first 4 arkShot thumbnails for preview grid
        .populate({
          path:   'arkShots',
          select: 'title subject diagram difficulty status',
          options: { limit: 4 },
        })
        .populate('createdBy', 'fullName email')
        .lean(),
      ArkShotCollection.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data:    collections,
      meta: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔟  DELETE COLLECTION
//     DELETE /api/v1/admin/arkshots/collections/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCollection = async (req, res, next) => {
  try {
    const collection = await ArkShotCollection.findByIdAndDelete(req.params.id);
    if (!collection) return next(new AppError("Collection not found", 404));

    res.status(200).json({
      success: true,
      message: "Collection deleted",
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣1️⃣ OVERALL ANALYTICS DASHBOARD
//     GET /api/v1/admin/arkshots/analytics
// ─────────────────────────────────────────────────────────────────────────────
export const getAnalytics = async (req, res, next) => {
  try {

    const [
      totalShots,
      publishedShots,
      draftShots,
      totalViews,
      totalLikes,
      totalMastered,
      mostViewed,
      mostLiked,
      mostMastered,
      mostConfusing,
      subjectBreakdown,
    ] = await Promise.all([

      ArkShot.countDocuments(),
      ArkShot.countDocuments({ status: "published" }),
      ArkShot.countDocuments({ status: "draft" }),

      // total views across all shots
      ArkShot.aggregate([
        { $group: { _id: null, total: { $sum: "$views" } } }
      ]),

      // total likes
      ArkShot.aggregate([
        { $group: { _id: null, total: { $sum: "$likes" } } }
      ]),

      // total mastered from analytics
      ArkShotAnalytics.aggregate([
        { $group: { _id: null, total: { $sum: "$totalMastered" } } }
      ]),

      // top 5 most viewed
      ArkShot
        .find({ status: "published" })
        .sort({ views: -1 })
        .limit(5)
        .select("title subject views likes semester unit")
        .lean(),

      // top 5 most liked
      ArkShot
        .find({ status: "published" })
        .sort({ likes: -1 })
        .limit(5)
        .select("title subject views likes semester unit")
        .lean(),

      // top 5 most mastered
      ArkShotAnalytics
        .find()
        .sort({ totalMastered: -1 })
        .limit(5)
        .populate("arkShot", "title subject semester unit")
        .lean(),

      // top 5 most confusing (high skip rate)
      ArkShotAnalytics
        .find({ confusionScore: { $gt: 0 } })
        .sort({ confusionScore: -1 })
        .limit(5)
        .populate("arkShot", "title subject semester unit")
        .lean(),

      // shots per subject
      ArkShot.aggregate([
        { $match: { status: "published" } },
        { $group: { _id: "$subject", count: { $sum: 1 }, totalViews: { $sum: "$views" } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalShots,
          publishedShots,
          draftShots,
          totalViews:   totalViews[0]?.total   || 0,
          totalLikes:   totalLikes[0]?.total   || 0,
          totalMastered: totalMastered[0]?.total || 0,
        },
        topShots: {
          mostViewed,
          mostLiked,
          mostMastered,
          mostConfusing,
        },
        subjectBreakdown,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣2️⃣ PER-SHOT ANALYTICS
//     GET /api/v1/admin/arkshots/:id/analytics
// ─────────────────────────────────────────────────────────────────────────────
export const getShotAnalyticsById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [shot, analytics] = await Promise.all([
      ArkShot.findById(id).lean({ virtuals: true }),
      ArkShotAnalytics.findOne({ arkShot: id }).lean(),
    ]);

    if (!shot) return next(new AppError("ArkShot not found", 404));

    res.status(200).json({
      success: true,
      data: {
        shot,
        analytics: analytics || {
          totalViews:    0,
          totalLikes:    0,
          totalMastered: 0,
          totalSkipped:  0,
          confusionScore: 0,
        },
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣3️⃣ GET SHOT STATS (quick stats for admin card)
//     GET /api/v1/admin/arkshots/:id/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getShotStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [shot, analytics, masteredCount] = await Promise.all([
      ArkShot.findById(id).select("views likes uniqueViews title status").lean(),
      ArkShotAnalytics.findOne({ arkShot: id }).lean(),
      ArkShotProgress.countDocuments({ arkShot: id, isMastered: true }),
    ]);

    if (!shot) return next(new AppError("ArkShot not found", 404));

    res.status(200).json({
      success: true,
      data: {
        title:          shot.title,
        status:         shot.status,
        views:          shot.views,
        uniqueViews:    shot.uniqueViews,   // admin only
        likes:          shot.likes,
        mastered:       masteredCount,
        confusionScore: analytics?.confusionScore || 0,
        skipRate:       analytics
          ? Math.round((analytics.totalSkipped / (analytics.totalViews || 1)) * 100)
          : 0,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// GET /api/v1/admin/arkshots/meta/subjects?semester=4
export const getSubjectsBySemester = async (req, res, next) => {
  try {
    const { semester } = req.query;
    if (!semester) return next(new AppError("semester is required", 400));

    const subjects = await Note.distinct("subject", {
      semester: Number(semester)
    });
    // console.log(subjects)
    res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// GET /api/v1/admin/notes/search?subject=dbms&semester=4&unit=2
export const getNotesByFilter = async (req, res, next) => {
  try {
    const { subject, semester, unit } = req.query;

    const filter = {};
    if (subject)  filter.subject  = subject.toLowerCase().trim();
    if (semester) filter.semester = Number(semester);
    if (unit)     filter.unit     = Number(unit);

    const notes = await Note.find(filter)
      .select("_id title subject semester unit") // lean projection — just what dropdown needs
      .sort({ title: 1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: notes.length,
      data: notes,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

