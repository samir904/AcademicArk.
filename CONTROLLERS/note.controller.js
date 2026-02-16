import mongoose from "mongoose";
import Note from "../MODELS/note.model.js";
import Apperror from "../UTIL/error.util.js";
import cloudinary from "cloudinary";
import fs from "fs/promises"
// import fetch from "nodea-fetch";
import redisClient from "../CONFIG/redisClient.js"
// import redisClient from "../server.sjs"
import axios from "axios";
import { logUserActivity } from "../UTIL/activityLogger.js";
import { addWatermarkToPDF } from "../UTIL/pdfWatermark.util.js";
import User from "../MODELS/user.model.js";
import { addDownloadWatermarkToPDF } from "../UTIL/downloadWatermark.util.js";
import { markStudyActivity } from "../UTIL/updateStudyActivity.js";
import { extractUnitFromTitle } from "../UTIL/unitExtractor.js";
import VideoLecture from "../MODELS/videoLecture.model.js";
import { generatePreviewFromUrl } from "../UTIL/generatePreviewFromUrl.js";
import { uploadPdfBuffer } from "../UTIL/uploadPdfBuffer.js";
import slugify from "slugify";

export const registerNote = async (req, res, next) => {
    const { title, description, subject, course, semester, university, category } = req.body;
    const userId = req.user.id;
    if (!userId) {
        return next(new Apperror("Something went wrong please login again"))
    }
    if (!title || !description || !subject || !course || !university || !category) {
        return next(new Apperror("All fields are required "))
    }
    if (!semester || (Array.isArray(semester) && semester.length === 0)) {
        return next(new Apperror("At least one semester is required"));
    }
    if (!req.file) {
        return next(new Apperror("File is required", 400));
    }
    // ✅ AUTO-EXTRACT UNIT FROM TITLE
    const extractedUnit = extractUnitFromTitle(title);
    const semesterArray = Array.isArray(semester)
        ? semester.map(s => parseInt(s))
        : [parseInt(semester)];

        // ============================================
    // 🔥 GENERATE UNIQUE SLUG
    // ============================================

    const baseSlug = slugify(
        `${title}-semester-${semesterArray[0]}-${subject}-aktu`,
        { lower: true, strict: true }
    );

    let slug = baseSlug;
    let counter = 1;

    while (await Note.findOne({ slug })) {
        slug = `${baseSlug}-${counter++}`;
    }

    // ============================================
    // 🔥 AUTO SEO FIELDS
    // ============================================

    const seoTitle = `${title} | AKTU ${subject} Semester ${semesterArray[0]} Notes`;
    const seoDescription = `Download ${title} for AKTU ${subject} semester ${semesterArray[0]}. Updated syllabus notes, important questions and PYQ available on AcademicArk.`;

    // ============================================
    // 📝 CREATE NOTE
    // ============================================

    const note = await Note.create({
        title: title.trim(),
        description: description.trim(),
        subject: subject.toLowerCase().trim(), // Normalize to lowercase
        course: course.toUpperCase().trim(),   // Normalize to uppercase
        semester: semesterArray,          // Ensure Array
        university: university.toUpperCase().trim(),
        category: category.trim(),
        unit: extractedUnit,  // ✅ AUTO-FILLED
        uploadedBy: userId,
        slug,
        seoTitle,
        seoDescription,
        fileDetails: {
            public_id: title,
            secure_url: 'dummy'
        }
    });

    if (!note) {
        return next(new Apperror("Note not uploaded please try again"))
    }

    if (req.file) {
        try {
            // ✨ ADD WATERMARK BEFORE UPLOADING TO CLOUDINARY
            if (req.file.mimetype === 'application/pdf') {
                await addWatermarkToPDF(req.file.path, 'AcademicArk');
                console.log('✅ Watermark added to PDF');
            }
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "AcademicArk",
                resource_type: 'auto', // auto-detect file type
                access_mode: 'public', // Make sure it's public
                type: 'upload', // Standard upload type
                use_filename: true,
                unique_filename: true,
            });
            if (result) {
                note.fileDetails.public_id = result.public_id;
                note.fileDetails.secure_url = result.secure_url;
                await fs.rm(`uploads/${req.file.filename}`)
            }
        } catch (error) {
            return next(new Apperror(error.mesage || "Failed to upload note please try again!"))
        }
    }
    await note.save();
    await redisClient.del(`notes:${JSON.stringify({})}`)//clear top level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`)//clear specific filter
    res.status(201).json({
        success: true,
        message: "Note uploaded successfully",
        data: note
    })
}
export const getNotesController = async (req, res, next) => {
    if (req._notesMode === "SEMESTER_PREVIEW") {
        return getSemesterPreviewNotes(req, res, next);
    }

    return getAllNotes(req, res, next);
};
export const getAllNotes = async (req, res) => {
    try {
        if (!req.query.semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const limit = 21;
        const cursor = req.query.cursor
            ? JSON.parse(decodeURIComponent(req.query.cursor))
            : null;

        const isFirstPage = !cursor;

        const escapeRegex = (text = "") =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const semesterNumber = Number(req.query.semester);

        const filters = {
            semester: { $in: [semesterNumber] } // ✅ WORKS FOR [5] & [5,6]
        };

        if (req.query.subject)
            filters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (req.query.unit)
            filters.unit = Number(req.query.unit);

        if (req.query.university)
            filters.university = new RegExp(escapeRegex(req.query.university), "i");

        if (req.query.course)
            filters.course = new RegExp(escapeRegex(req.query.course), "i");

        if (req.query.category)
            filters.category = new RegExp(escapeRegex(req.query.category), "i");

        // if (cursor) {
        //     filters.createdAt = { $lt: new Date(cursor) };
        // }

        const pipeline = [
            { $match: filters },

            ...(isFirstPage
                ? [
                    {
                        $facet: {
                            recommended: [
                                { $match: { recommended: true } },
                                {
                                    $addFields: {
                                        subjectValue: { $toLower: "$subject" },
                                        categoryValue: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$category", "Notes"] }, then: 0 },
                                                    { case: { $eq: ["$category", "Handwritten Notes"] }, then: 1 },
                                                    { case: { $eq: ["$category", "Important Question"] }, then: 2 },
                                                    { case: { $eq: ["$category", "PYQ"] }, then: 3 }
                                                ],
                                                default: 99
                                            }
                                        }
                                    }
                                },
                                {
                                    $sort: {
                                        subjectValue: 1,
                                        categoryValue: 1,
                                        unit: 1,
                                        recommendedRank: 1,
                                        downloads: -1,
                                        views: -1,
                                        createdAt: -1
                                    }
                                }
                            ],
                            normal: [
                                { $match: { recommended: { $ne: true } } },
                                {
                                    $sort: {
                                        downloads: -1,
                                        views: -1,
                                        createdAt: -1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $project: {
                            notes: { $concatArrays: ["$recommended", "$normal"] }
                        }
                    },
                    { $unwind: "$notes" },
                    { $replaceRoot: { newRoot: "$notes" } }
                ]
                : [
                    { $match: { recommended: { $ne: true } } },
                    {
                        $match: {
                            $or: [
                                { createdAt: { $lt: new Date(cursor.createdAt) } },
                                {
                                    createdAt: new Date(cursor.createdAt),
                                    _id: { $lt: new mongoose.Types.ObjectId(cursor._id) }
                                }
                            ]
                        }
                    },
                    { $sort: { createdAt: -1, _id: -1 } }
                ]),

            { $limit: limit + 1 },

            {
                $lookup: {
                    from: "users",
                    localField: "uploadedBy",
                    foreignField: "_id",
                    as: "uploadedBy"
                }
            },
            { $unwind: "$uploadedBy" }
        ];

        const result = await Note.aggregate(pipeline);

        const hasMore = result.length > limit;
        const notes = hasMore ? result.slice(0, limit) : result;
        // 🔐 Cursor must always come from NORMAL stream ordering
        const normalNotesInPage = notes.filter(n => !n.recommended);

        const last = normalNotesInPage[normalNotesInPage.length - 1];


        const nextCursor = last
            ? encodeURIComponent(JSON.stringify({
                createdAt: last.createdAt,
                _id: last._id
            }))
            : null;

        console.log({
            semester: semesterNumber,
            matchedCount: await Note.countDocuments(filters),
            cursor
        });
        res.setHeader("Cache-Control", "no-store");

        res.status(200).json({
            success: true,
            data: { notes, nextCursor, hasMore }
        });
    } catch (err) {
        console.error("❌ getAllNotes error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notes"
        });
    }
};

export const getSemesterPreviewNotes = async (req, res) => {
    try {
        const semester = Number(req.query.semester);
        if (!semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const limit = 30;
        const cursor = req.query.cursor
            ? JSON.parse(decodeURIComponent(req.query.cursor))
            : null;

        const filters = {
            semester: { $in: [semester] }
        };

        if (cursor) {
            filters.$or = [
                { createdAt: { $lt: new Date(cursor.createdAt) } },
                {
                    createdAt: new Date(cursor.createdAt),
                    _id: { $lt: new mongoose.Types.ObjectId(cursor._id) }
                }
            ];
        }

        const notes = await Note.find(filters)
            .sort({
                recommended: -1,
                recommendedRank: 1,
                downloads: -1,
                views: -1,
                createdAt: -1,
                _id: -1
            })
            .limit(limit + 1)
            .populate("uploadedBy", "fullName avatar");

        const hasMore = notes.length > limit;
        const sliced = hasMore ? notes.slice(0, limit) : notes;

        const last = sliced[sliced.length - 1];

        const nextCursor = last
            ? encodeURIComponent(
                JSON.stringify({
                    createdAt: last.createdAt,
                    _id: last._id
                })
            )
            : null;

        res.status(200).json({
            success: true,
            mode: "SEMESTER_PREVIEW",
            data: {
                notes: sliced,
                nextCursor,
                hasMore
            }
        });

    } catch (error) {
        console.error("❌ getSemesterPreviewNotes error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch semester preview"
        });
    }
};


export const getAllNoteStats = async (req, res) => {
    try {
        if (!req.query.semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const escapeRegex = (text = "") =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        /** --------------------
         * NOTES FILTERS
         * -------------------- */
        const noteFilters = {
            semester: Number(req.query.semester)
        };

        if (req.query.subject)
            noteFilters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (req.query.unit)
            noteFilters.unit = Number(req.query.unit);

        if (req.query.university)
            noteFilters.university = new RegExp(escapeRegex(req.query.university), "i");

        if (req.query.course)
            noteFilters.course = new RegExp(escapeRegex(req.query.course), "i");

        if (req.query.category)
            noteFilters.category = new RegExp(escapeRegex(req.query.category), "i");

        if (
            req.query.uploadedBy &&
            mongoose.Types.ObjectId.isValid(req.query.uploadedBy)
        ) {
            noteFilters.uploadedBy = new mongoose.Types.ObjectId(req.query.uploadedBy);
        }

        /** --------------------
         * NOTES AGGREGATION
         * -------------------- */
        const noteStats = await Note.aggregate([
            { $match: noteFilters },
            {
                $facet: {
                    total: [{ $count: "count" }],
                    categoryStats: [
                        {
                            $group: {
                                _id: "$category",
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        const totalNotes = noteStats[0]?.total[0]?.count || 0;

        const categoryStats = {};
        noteStats[0]?.categoryStats.forEach(item => {
            categoryStats[item._id] = item.count;
        });

        /** --------------------
         * VIDEO STATS
         * -------------------- */
        const videoFilters = {
            semester: Number(req.query.semester)
        };

        if (req.query.subject)
            videoFilters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (
            req.query.uploadedBy &&
            mongoose.Types.ObjectId.isValid(req.query.uploadedBy)
        ) {
            videoFilters.uploadedBy = new mongoose.Types.ObjectId(req.query.uploadedBy);
        }

        const totalVideos = await VideoLecture.countDocuments(videoFilters);

        /** --------------------
         * MERGE RESULT
         * -------------------- */
        if (totalVideos > 0) {
            categoryStats["Video"] = totalVideos;
        }

        res.status(200).json({
            success: true,
            data: {
                total: totalNotes + totalVideos,
                categories: categoryStats
            }
        });

    } catch (error) {
        console.error("❌ getAllNoteStats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch stats"
        });
    }
};
export const getNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400));
    }

    try {
        const note = await Note.findById(id)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .populate({
                path: "rating",
                populate: {
                    path: "user",
                    select: "fullName avatar"
                }
            })
            .select(
                "+views +downloads +viewedBy +isLocked +previewPages +previewFile"
            );

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        /* ---------------------------
           🔍 VIEW COUNT (UNCHANGED)
        ---------------------------- */
        if (userId) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const alreadyViewed = note.viewedBy.some(v => v.equals(userObjectId));

            if (!alreadyViewed) {
                note.views += 1;
                note.viewedBy.push(userObjectId);
                await note.save();
            }
        }

        /* ---------------------------
           🔒 ACCESS DECISION
        ---------------------------- */
        /* ---------------------------
    🔒 ACCESS DECISION (FIXED)
 ---------------------------- */
        let dbUser = null;

        if (userId) {
            dbUser = await User.findById(userId).select("access");
        }

        const isSupporter =
            dbUser?.access?.expiresAt &&
            new Date(dbUser.access.expiresAt) > new Date();

        let pdfUrl = note.fileDetails.secure_url;
        let mode = "FULL";
        let maxPages = null;
        let allowDownload = true;

        // 🔒 LOCKED + FREE USER
        if (note.isLocked && !isSupporter) {
            mode = "PREVIEW";
            maxPages = note.previewPages || 8;
            allowDownload = false;

            // 🔥 LAZY PREVIEW GENERATION
            if (!note.previewFile?.secure_url) {
                try {
                    const previewBuffer = await generatePreviewFromUrl(
                        note.fileDetails.secure_url,
                        maxPages
                    );

                    const previewUpload = await uploadPdfBuffer(previewBuffer, {
                        folder: "AcademicArk/previews",
                        public_id: `preview_${note._id}`,
                    });

                    note.previewFile = {
                        public_id: previewUpload.public_id,
                        secure_url: previewUpload.secure_url
                    };

                    await note.save();
                } catch (err) {
                    console.error("❌ Preview generation failed:", err);
                    return next(
                        new Apperror("Preview not available at the moment", 500)
                    );
                }
            }

            // 🔐 SERVE PREVIEW PDF
            pdfUrl = note.previewFile.secure_url;
        }

        /* ---------------------------
           📊 ACTIVITY LOGGING
        ---------------------------- */
        if (userId) {
            await logUserActivity(userId, "NOTE_VIEWED", {
                resourceId: id,
                resourceType: "NOTE",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
                sessionId: req.sessionID
            });
        }

        await markStudyActivity(userId);

        /* ---------------------------
           📤 FINAL RESPONSE
        ---------------------------- */
        res.status(200).json({
            success: true,
            message: "Note fetched successfully",
            data: {
                ...note.toObject(),
                pdfAccess: {
                    pdfUrl,
                    mode,        // PREVIEW | FULL
                    maxPages,    // number | null
                    allowDownload
                }
            }
        });

    } catch (error) {
        console.error("❌ getNote error:", error);
        next(new Apperror("Failed to fetch note", 500));
    }
};


// 🔒 Toggle note lock (Admin only)
export const toggleLockNote = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isLocked, previewPages } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror("Invalid note ID", 400));
        }

        // Validation
        if (typeof isLocked !== "boolean") {
            return next(new Apperror("isLocked must be boolean", 400));
        }

        if (isLocked && previewPages !== undefined) {
            if (typeof previewPages !== "number" || previewPages < 1 || previewPages > 30) {
                return next(
                    new Apperror("previewPages must be a number between 1 and 30", 400)
                );
            }
        }

        const updates = {
            isLocked,
            ...(isLocked && previewPages ? { previewPages } : {})
        };

        // If unlocking → reset previewPages to default (optional but clean)
        if (!isLocked) {
            updates.previewPages = 8;
        }

        const note = await Note.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate("uploadedBy", "fullName avatar.secure_url");

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // 🧹 Clear cache
        await redisClient.del(`notes:${JSON.stringify({})}`);

        res.status(200).json({
            success: true,
            message: isLocked
                ? "Note locked successfully"
                : "Note unlocked successfully",
            data: {
                id: note._id,
                title: note.title,
                isLocked: note.isLocked,
                previewPages: note.previewPages
            }
        });

    } catch (error) {
        console.error("❌ toggleLockNote error:", error);
        return next(
            new Apperror(error.message || "Failed to toggle note lock", 500)
        );
    }
};


// ✅ OPTIMIZED: Get all notes without viewer data


// export const getAllNotes = async (req, res, next) => {
//     try {
//         console.log('Query params:', req.query);

//         const filters = {};

//         // Handle each filter with case-insensitive matching where needed
//         if (req.query.subject) {
//             filters.subject = { $regex: req.query.subject, $options: 'i' };
//         }
//         if (req.query.semester) {
//             filters.semester = parseInt(req.query.semester);
//         }
//         if (req.query.university) {
//             filters.university = { $regex: req.query.university, $options: 'i' };
//         }
//         if (req.query.course) {
//             filters.course = { $regex: req.query.course, $options: 'i' };
//         }
//         if (req.query.category) {
//             filters.category = { $regex: req.query.category, $options: 'i' };
//         }

//         console.log('MongoDB filters:', filters);

//         // ✅ REMOVED: .populate("viewedBy", ...) - Don't fetch viewer data here
//         const notes = await Note.find(filters)
//             .populate("uploadedBy", "fullName avatar.secure_url")
//             .sort({ createdAt: -1 })
//             .select('+views +downloads +viewedBy'); // Include viewedBy count but don't populate

//         console.log('Found notes:', notes.length);

//         // ✅ Map to return only viewer count, not full data
//         const notesWithViewerCount = notes.map(note => ({
//             ...note.toObject(),
//             viewerCount: note.viewedBy?.length || 0,
//             viewedBy: undefined // Remove the full viewedBy array
//         }));

//         res.status(200).json({
//             success: true,
//             count: notes.length,
//             data: notesWithViewerCount
//         });

//     } catch (error) {
//         console.error('Error fetching notes:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch notes',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// ✅ OPTIMIZED: Get single note (for detail page)
// export const getNote = async (req, res, next) => {
//     try {
//         const { id } = req.params;

//         if (!id || !mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid note ID'
//             });
//         }

//         const note = await Note.findById(id)
//             .populate("uploadedBy", "fullName avatar.secure_url email")
//             .select('+views +downloads +viewedBy +ratings');

//         if (!note) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Note not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: {
//                 ...note.toObject(),
//                 viewerCount: note.viewedBy?.length || 0,
//                 viewedBy: undefined // Remove full viewer list from here
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching note:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch note',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


export const updateNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400))
    }
    const note = await Note.findById(id);
    if (!note) {
        return next(new Apperror("Note not found", 404))
    }
    if (note.uploadedBy.toString() !== userId.toString() && req.user.role !== "ADMIN") {
        return next(new Apperror("Note authorized to update this", 403))
    }
    const updates = {
        ...req.body
    }
    if (req.file) {
        await cloudinary.v2.uploader.destroy(note.fileDetails.public_id);
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "AcademicArk",
                resource_type: 'auto', // auto-detect file type
                access_mode: 'public', // Make sure it's public
                type: 'upload', // Standard upload type
                use_filename: true,
                unique_filename: true,
            });
            if (result) {
                note.fileDetails.public_id = result.public_id;
                note.fileDetails.secure_url = result.secure_url;
                await fs.rm(`uploads/${req.file.filename}`)
            }
        } catch (error) {
            return next(new Apperror(error.mesage || "Note not updated successfully"));
        }
    }
    const newnote = await Note.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true
    });
    // After note.save() in registerNote, updateNote, deleteNote:
    await redisClient.del(`notes:${JSON.stringify({})}`);        // clear top-level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`); // clear specific filter


    res.status(200).json({
        success: true,
        mesage: 'Note updated successfully',
        data: newnote
    })
}

export const deleteNote = async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400))
    }
    const note = await Note.findById(id);
    if (!note) {
        return next(new Apperror("Note not found please try again!", 404))
    }
    if (note.uploadedBy.toString() !== req.user.id.toString() && req.user.role !== "ADMIN") {
        return next(new Apperror("Not authorized to delete this note", 403))
    }

    await cloudinary.v2.uploader.destroy(note.fileDetails.public_id);

    await Note.findByIdAndDelete(id);
    // After note.save() in registerNote, updateNote, deleteNote:
    await redisClient.del(`notes:${JSON.stringify({})}`);        // clear top-level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`); // clear specific filter
    // ✅ LOG DOWNLOAD ACTIVITY (only if user is logged in)
    if (userId) {
        await logUserActivity(userId, "NOTE_DOWNLOADED", {
            resourceId: id,
            resourceType: "NOTE",
            downloadSize: fileResponse.data.length,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });
    }
    res.status(200).json({
        success: true,
        mesage: 'Note deleted'
    })
    // Note: res.json has been overridden by cacheNotes middleware,
    // so this response is ALSO stored into Redis automatically.
}

// Fix your backend addRating controller
export const addRating = async (req, res, next) => {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
        return next(new Apperror("Rating must be between 1 and 5", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Check if user already rated
        const existingRatingIndex = note.rating.findIndex(r => r.user.toString() === userId);

        const newRating = {
            user: userId,
            rating: Number(rating),
            review: review || "", // Review is optional
            createdAt: new Date()
        };

        if (existingRatingIndex !== -1) {
            // Update existing rating
            note.rating[existingRatingIndex] = newRating;
        } else {
            // Add new rating
            note.rating.push(newRating);
        }

        await note.save();
        // ✅ LOG RATING ACTIVITY
        await logUserActivity(userId, "NOTE_RATED", {
            resourceId: id,
            resourceType: "NOTE",
            ratingValue: rating,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });

        // Populate the updated note
        const updatedNote = await Note.findById(id)
            .populate('uploadedBy', 'fullName avatar')
            .populate('rating.user', 'fullName');
        await markStudyActivity(userId);
        res.status(200).json({
            success: true,
            message: existingRatingIndex !== -1 ? "Rating updated successfully" : "Rating added successfully",
            data: updatedNote
        });
    } catch (error) {
        console.error('Rating error:', error);
        return next(new Apperror("Failed to add rating", 500));
    }
};


// Make sure your backend toggleBookmark returns proper structure
export const bookmarkNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    const note = await Note.findById(id).populate('uploadedBy', 'fullName avatar');

    if (!note) {
        return next(new Apperror("Note not found", 404));
    }

    const isBookmarked = note.bookmarkedBy.includes(userId);

    if (isBookmarked) {
        note.bookmarkedBy.pull(userId);
    } else {
        note.bookmarkedBy.push(userId);
    }

    await note.save();
    // ✅ LOG BOOKMARK ACTIVITY (only if newly bookmarked)
    if (!isBookmarked) {
        await logUserActivity(userId, "NOTE_BOOKMARKED", {
            resourceId: id,
            resourceType: "NOTE",
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });
    }

    const updatedNote = await Note.findById(id).populate('uploadedBy', 'fullName avatar');
    await markStudyActivity(userId);
    res.status(200).json({
        success: true,
        message: isBookmarked ? 'Note removed from bookmarks' : 'Note bookmarked successfully',
        data: updatedNote // Make sure this structure matches your frontend expectations
    });
};


// Fix your backend downloadNote controller
// Fix your backend downloadNote controller
// Backend - Get download URL instead of redirecting
// export const downloadNote = async (req, res, next) => {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return next(new Apperror("Invalid note id", 400));
//     }

//     try {
//         const note = await Note.findById(id);
//         if (!note) {
//             return next(new Apperror("Note not found", 404));
//         }

//         // Increment download count
//         note.downloads += 1;
//         await note.save();

//         // Return the URL instead of redirecting
//         res.status(200).json({
//             success: true,
//             message: "Download URL retrieved",
//             data: {
//                 downloadUrl: note.fileDetails.secure_url,
//                 filename: `${note.title}.pdf`,
//                 downloads: note.downloads
//             }
//         });

//     } catch (error) {
//         console.error('Download error:', error);
//         return next(new Apperror("Failed to get download URL", 500));
//     }
// };



export const downloadNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id; // Optional - user may not be logged in

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Log URL for manual testing
        // console.log('Fetching PDF from:', note.fileDetails.secure_url);

        // Increment download count
        note.downloads += 1;
        await note.save();

        // Fetch the file
        const fileResponse = await axios.get(note.fileDetails.secure_url, {
            responseType: 'arraybuffer' // Binary data
        });

        // ✅ STEP 4: Convert to buffer
        let pdfBuffer = Buffer.from(fileResponse.data);

        // Log fetched size to check
        // console.log('Fetched PDF size:', fileResponse.data.length, 'bytes');
        // ✅ LOG DOWNLOAD ACTIVITY (only if user is logged in)
        if (userId) {
            const user = await User.findById(userId).select('fullName email');

            if (user) {
                try {
                    console.log('✨ Adding download watermark...');

                    // Add watermark with user info
                    pdfBuffer = await addDownloadWatermarkToPDF(pdfBuffer, {
                        fullName: user.fullName,
                        email: user.email,
                        downloadDate: new Date(),
                    });

                    console.log('✅ Download watermark added successfully');
                    console.log(`📧 User: ${user.fullName} (${user.email})`);
                } catch (watermarkError) {
                    console.error('⚠️ Watermark error (continuing anyway):', watermarkError.message);
                    // Don't fail - continue with original PDF if watermark fails
                }
            }
            await logUserActivity(userId, "NOTE_DOWNLOADED", {
                resourceId: id,
                resourceType: "NOTE",
                downloadSize: fileResponse.data.length,
                planType: req.user?.access?.plan || "FREE",
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID
            });
        }
        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${note.title}.pdf"`);
        res.setHeader('Content-Length', fileResponse.data.length);

        // ✅ STEP 8: SEND PDF
        console.log('📤 Sending PDF to client...');
        res.status(200).send(pdfBuffer);
        console.log('✅ Download completed successfully');
        await markStudyActivity(userId);
    } catch (error) {
        console.error('Download error:', error.message);
        return next(new Apperror("Failed to download note: " + error.message, 500));
    }
};




export const getMostViewedNotes = async (req, res, next) => {
    try {
        const timeRange = req.query.timeRange || '7days'; // 7days, 30days, all

        let dateFilter = {};
        if (timeRange === '7days') {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
        } else if (timeRange === '30days') {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
        }

        const notes = await Note.find(dateFilter)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ views: -1 }) // Sort by views descending
            .limit(10); // Top 10

        res.status(200).json({
            success: true,
            data: notes
        });
    } catch (error) {
        next(new Apperror("Failed to fetch most viewed notes", 500));
    }
};

export const incrementViewCount = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // ✅ INCREMENT VIEWS
        if (userId) {
            const alreadyViewed = note.viewedBy.includes(userId);
            if (!alreadyViewed) {
                note.views += 1;
                note.viewedBy.push(userId);
                await note.save();
            }
        }

        res.status(200).json({
            success: true,
            message: "View counted",
            data: { views: note.views }
        });

    } catch (error) {
        next(new Apperror("Failed to increment view", 500));
    }
};

// ✅ COPY THIS ENTIRE FUNCTION
export const getNoteViewers = async (req, res, next) => {
    try {
        // ✅ IMPORTANT: Use 'id' not 'noteId' because route is /:id
        const { id: noteId } = req.params;

        console.log('🔍 getNoteViewers called with noteId:', noteId);

        // Validate noteId
        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            console.log('❌ Invalid noteId:', noteId);
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID'
            });
        }

        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        console.log('📄 Pagination - Page:', page, 'Limit:', limit, 'Skip:', skip);

        // Find note and get total viewer count
        const note = await Note.findById(noteId).select('viewedBy');
        if (!note) {
            console.log('❌ Note not found:', noteId);
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const totalViewers = note.viewedBy?.length || 0;
        console.log('👥 Total viewers found:', totalViewers);

        // Fetch paginated viewers with user details
        const viewers = await Note.findById(noteId)
            .select('viewedBy')
            .populate({
                path: 'viewedBy',
                select: 'fullName avatar email role academicProfile.semester academicProfile.branch',
                options: {
                    skip: skip,
                    limit: limit
                }
            });

        const viewersList = viewers.viewedBy || [];
        console.log('✅ Returned viewers count:', viewersList.length);

        res.status(200).json({
            success: true,
            data: {
                viewers: viewersList,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(totalViewers / limit),
                    total_viewers: totalViewers,
                    viewers_per_page: limit
                }
            }
        });

    } catch (error) {
        console.error('❌ Error in getNoteViewers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch viewers',
            error: error.message
        });
    }
};

// Toggle note as recommended
export const toggleRecommendNote = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { recommended, rank } = req.body;

        // Validate input
        if (typeof recommended !== 'boolean') {
            return next(new Apperror("Recommended must be boolean", 400));
        }

        if (recommended && (!rank || rank < 1)) {
            return next(new Apperror("Rank must be positive number for recommended notes", 400));
        }

        // Update note
        const note = await Note.findByIdAndUpdate(
            id,
            {
                recommended,
                recommendedRank: recommended ? rank : 0
            },
            { new: true }
        ).populate("uploadedBy", "fullName avatar.secure_url");

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Clear cache
        await redisClient.del(`notes:${JSON.stringify({})}`);

        res.status(200).json({
            success: true,
            message: `Note ${recommended ? 'marked' : 'unmarked'} as recommended`,
            data: note
        });

    } catch (error) {
        console.error("Error toggling recommendation:", error);
        return next(new Apperror(error.message || "Failed to toggle recommendation", 500));
    }
};

// Get all recommended notes (for admin dashboard)
export const getRecommendedNotes = async (req, res, next) => {
    try {
        const recommendedNotes = await Note.find({ recommended: true })
            .sort({
                recommendedRank: 1,
                downloads: -1
            })
            .select('title subject category recommendedRank downloads views uploadedBy')
            .populate("uploadedBy", "fullName avatar.secure_url")
            .lean();

        res.status(200).json({
            success: true,
            count: recommendedNotes.length,
            data: recommendedNotes
        });

    } catch (error) {
        console.error("Error fetching recommended notes:", error);
        return next(new Apperror(error.message || "Failed to fetch recommended notes", 500));
    }
};