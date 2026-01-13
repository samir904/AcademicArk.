import mongoose from "mongoose";
import Note from "../MODELS/note.model.js";
import Apperror from "../UTIL/error.util.js";
import cloudinary from "cloudinary";
import fs from "fs/promises"
// import fetch from "nodea-fetch";
import redisClient from "../CONFIG/redisClient.js"
// import redisClient from "../server.js"
import axios from "axios";
import { logUserActivity } from "../UTIL/activityLogger.js";
import { addWatermarkToPDF } from "../UTIL/pdfWatermark.util.js";
import User from "../MODELS/user.model.js";
import { addDownloadWatermarkToPDF } from "../UTIL/downloadWatermark.util.js";
export const registerNote = async (req, res, next) => {
    const { title, description, subject, course, semester, university, category } = req.body;
    const userId = req.user.id;
    if (!userId) {
        return next(new Apperror("Something went wrong please login again"))
    }
    if (!title || !description || !subject || !course || !semester || !university || !category) {
        return next(new Apperror("All fields are required "))
    }

    if (!req.file) {
        return next(new Apperror("File is required", 400));
    }
    const note = await Note.create({
        title: title.trim(),
        description: description.trim(),
        subject: subject.toLowerCase().trim(), // Normalize to lowercase
        course: course.toUpperCase().trim(),   // Normalize to uppercase
        semester: parseInt(semester),          // Ensure number
        university: university.toUpperCase().trim(),
        category: category.trim(),
        uploadedBy: userId,
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
export const getAllNotes = async (req, res, next) => {
    try {
        console.log('Query params:', req.query);
        console.log('Full URL:', req.originalUrl);

        const filters = {};

        // ✅ FIX 1: Build filters ONLY if they are provided and not empty
        if (req.query.subject && req.query.subject.trim()) {
            filters.subject = { $regex: req.query.subject, $options: 'i' };
            // console.log('✅ Filter: subject =', req.query.subject);
        }
        if (req.query.semester) {
            const sem = parseInt(req.query.semester);
            if (!isNaN(sem)) {
                filters.semester = sem;
                // console.log('✅ Filter: semester =', sem);
            }
        }
        if (req.query.university && req.query.university.trim()) {
            filters.university = { $regex: req.query.university, $options: 'i' };
            // console.log('✅ Filter: university =', req.query.university);
        }
        if (req.query.course && req.query.course.trim()) {
            filters.course = { $regex: req.query.course, $options: 'i' };
            // console.log('✅ Filter: course =', req.query.course);
        }
        if (req.query.category && req.query.category.trim()) {
            filters.category = { $regex: req.query.category, $options: 'i' };
            // console.log('✅ Filter: category =', req.query.category);
        }

        // console.log('📋 MongoDB filters:', JSON.stringify(filters));

        // ✅ FIX 2: Get sortBy parameter (ALWAYS default to downloads)
        const sortBy = (req.query.sortBy && req.query.sortBy.trim()) ? req.query.sortBy : 'downloads';
        // console.log('📊 Sorting by:', sortBy);

        // ✅ FIX 3: Define sort order BEFORE using it
        let sortOrder = { downloads: -1, createdAt: -1 }; // Default

        switch(sortBy.toLowerCase()) {
            case 'downloads':
                sortOrder = { downloads: -1, createdAt: -1 };
                // console.log('🔽 Sort: Downloads descending');
                break;
            
            case 'views':
                sortOrder = { views: -1, createdAt: -1 };
                // console.log('👁️ Sort: Views descending');
                break;
            
            case 'latest':
                sortOrder = { createdAt: -1 };
                // console.log('🆕 Sort: Latest first');
                break;
            
            case 'rating':
            case 'upvotes':
                sortOrder = { 'ratings.average': -1, downloads: -1 };
                // console.log('⭐ Sort: Rating descending');
                break;
            
            case 'trending':
                sortOrder = { views: -1, downloads: -1, createdAt: -1 };
                // console.log('🔥 Sort: Trending (views + downloads)');
                break;
            
            case 'popular':
                sortOrder = { downloads: -1, views: -1, createdAt: -1 };
                // console.log('👍 Sort: Popular (downloads + views)');
                break;
            
            default:
                sortOrder = { downloads: -1, createdAt: -1 };
                // console.log('📊 Sort: Default (downloads)');
        }

        // console.log('Sort object:', sortOrder);

        // ✅ FIX 4: Query with sorting applied
        let query = Note.find(filters);
        
        const filterCount = Object.keys(filters).length;
        // console.log(`🔍 Applying ${filterCount} filter(s)`);

        const notes = await query
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort(sortOrder)  // ✅ CRITICAL: Apply sort here
            .select('+views +downloads +viewedBy')
            .lean();  // ✅ Optimize: return plain objects

        // console.log('✅ Found notes:', notes.length);

        // ✅ Map to return viewerCount
        const notesWithStats = notes.map(note => ({
            ...note,
            viewerCount: note.viewedBy?.length || 0,
            viewedBy: undefined
        }));

        // ✅ Verify sorting worked
        if (notesWithStats.length > 1) {
            const first = notesWithStats;
            const second = notesWithStats;
            // console.log(`✅ Verification: First note downloads=${first.downloads}, Second downloads=${second.downloads}`);
            if (sortBy === 'downloads' && first.downloads < second.downloads) {
                console.warn('⚠️ WARNING: Downloads NOT in descending order!');
            }
        }

        res.status(200).json({
            success: true,
            count: notesWithStats.length,
            sortedBy: sortBy,
            filtersApplied: filterCount,
            data: notesWithStats
        });

    } catch (error) {
        console.error('❌ Error fetching notes:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notes',
            error: error.message
        });
    }
};


export const getNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    // console.log('\n========== getNote START ==========');
    // console.log('📍 noteId:', id);
    // console.log('👤 userId:', userId);
    // console.log('👤 userId type:', typeof userId);

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
            // ✅ ADD THIS populate
            // .populate({
            //     path: "viewedBy",
            //     select: "fullName avatar.secure_url role academicProfile email"
            // })

            .select('+views +downloads +viewedBy');  // ✅ ADD viewedBy

        if (!note) {
            return next(new Apperror("Note not found please try again", 404));
        }

        // console.log('\n📊 BEFORE INCREMENT:');
        // console.log('  views:', note.views);
        // console.log('  viewedBy array:', note.viewedBy);
        // console.log('  viewedBy length:', note.viewedBy?.length || 0);

        if (userId) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            // console.log('\n🔄 COMPARING:');
            // console.log('  userId (string):', userId);
            // console.log('  userObjectId:', userObjectId);

            const alreadyViewed = note.viewedBy.some(viewerId => {
                const matches = viewerId.equals(userObjectId);
                // console.log(`  checking ${viewerId} === ${userObjectId}? ${matches}`);
                return matches;
            });

            // console.log('\n✅ alreadyViewed:', alreadyViewed);

            if (!alreadyViewed) {
                note.views += 1;
                note.viewedBy.push(userObjectId);
                const savedNote = await note.save();

                // console.log('\n✅ AFTER SAVE:');
                // console.log('  new views:', savedNote.views);
                // console.log('  new viewedBy:', savedNote.viewedBy);
            } else {
                // console.log('⏭️  Skipping increment - already viewed');
            }
        } else {
            // console.log('⚠️  No userId - Anonymous user');
        }

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        if (userId) {
            await logUserActivity(userId, "NOTE_VIEWED", {
                resourceId: id,
                resourceType: "NOTE",
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID
            });
        }

        // console.log('\n📤 SENDING RESPONSE:');
        // console.log('  views in response:', note.views);
        // console.log('========== getNote END ==========\n');

        res.status(200).json({
            success: true,
            message: "note fetched successfully",
            data: note
        });

    } catch (error) {
        console.error('❌ getNote error:', error);
        next(new Apperror("Failed to fetch note: " + error.message, 500));
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

