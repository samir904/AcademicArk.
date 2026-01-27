import Video from "../MODELS/video.model.js";
import VideoPlaylist from "../MODELS/videoPlaylist.model.js";
import Apperror from "../UTIL/error.util.js";
import mongoose from "mongoose";
import axios from "axios";

// ============================================================================
//  ✅ 1. UPLOAD VIDEO (Teacher/Admin adds video)
// ============================================================================

export const uploadVideo = async (req, res, next) => {
    try {
        const { title, description, youtubeUrl, subject, chapterNumber, chapterTitle, semester, branch, sourceCreator, tags, difficulty, language } = req.body;
        const userId = req.user.id;

        // ✅ Validation
        if (!title || !description || !youtubeUrl || !subject || !chapterNumber || !chapterTitle || !semester) {
            return next(new Apperror("All required fields must be provided", 400));
        }

        // ✅ Extract YouTube Video ID from URL
        // Supports: youtube.com/watch?v=XXXXX or youtu.be/XXXXX
        const videoIdMatch = youtubeUrl.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        
        if (!videoIdMatch) {
            return next(new Apperror("Invalid YouTube URL format", 400));
        }

        const youtubeVideoId = videoIdMatch[1];

        // ✅ Check if video already exists
        const existingVideo = await Video.findOne({ youtubeVideoId });
        if (existingVideo) {
            return next(new Apperror("This YouTube video has already been added", 400));
        }

        // ✅ Get YouTube video details and thumbnail
        let duration = 0;
        let thumbnail = {
            url: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
            quality: "hq"
        };

        // Optional: Fetch duration from YouTube Data API (if you have API key)
        // For now, set a default or use manual input
        if (req.body.duration) {
            duration = parseInt(req.body.duration);
        } else {
            duration = 600; // Default 10 minutes
        }

        // ✅ Create video document
        const video = await Video.create({
            title: title.trim(),
            description: description.trim(),
            youtubeVideoId,
            youtubeUrl,
            thumbnail,
            subject: subject.toLowerCase().trim(),
            chapter: {
                number: parseInt(chapterNumber),
                title: chapterTitle.trim()
            },
            semester: parseInt(semester),
            course: "BTECH",
            branch: branch || "CSE",
            university: "AKTU",
            uploadedBy: userId,
            sourceCreator: sourceCreator ? {
                name: sourceCreator.name,
                channelUrl: sourceCreator.channelUrl
            } : null,
            duration,
            tags: tags ? tags.split(",").map(t => t.trim().toLowerCase()) : [],
            difficulty: difficulty || "intermediate",
            language: language || "english"
        });

        res.status(201).json({
            success: true,
            message: "Video uploaded successfully",
            data: video
        });

    } catch (error) {
        console.error("❌ Upload video error:", error);
        next(new Apperror("Failed to upload video: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 2. GET ALL VIDEOS (With Filters)
// ============================================================================

export const getAllVideos = async (req, res, next) => {
    try {
        const { subject, semester, branch, chapter, sortBy, page = 1, limit = 12, difficulty, language } = req.query;

        // ✅ Build filters
        const filters = { isPublished: true };

        if (subject && subject.trim()) {
            filters.subject = { $regex: subject, $options: 'i' };
        }
        if (semester) {
            filters.semester = parseInt(semester);
        }
        if (branch && branch.trim()) {
            filters.branch = { $regex: branch, $options: 'i' };
        }
        if (chapter) {
            filters['chapter.number'] = parseInt(chapter);
        }
        if (difficulty) {
            filters.difficulty = difficulty;
        }
        if (language) {
            filters.language = language;
        }

        // ✅ Sorting
        let sortOrder = { createdAt: -1 }; // Default: newest first

        switch((sortBy || 'newest').toLowerCase()) {
            case 'views':
                sortOrder = { 'statistics.views': -1 };
                break;
            case 'trending':
                sortOrder = { 'statistics.engagementScore': -1 };
                break;
            case 'rating':
                sortOrder = { 'ratings.rating': -1 }; // Average rating
                break;
            case 'duration':
                sortOrder = { duration: 1 }; // Shortest first
                break;
            case 'popular':
                sortOrder = { 'statistics.views': -1, 'statistics.engagementScore': -1 };
                break;
            default:
                sortOrder = { createdAt: -1 }; // Newest
        }

        // ✅ Pagination
        const skip = (page - 1) * limit;

        // ✅ Fetch videos
        const videos = await Video.find(filters)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort(sortOrder)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-viewedBy -ratings'); // Exclude heavy fields

        // ✅ Total count for pagination
        const total = await Video.countDocuments(filters);

        res.status(200).json({
            success: true,
            data: videos,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("❌ Get videos error:", error);
        next(new Apperror("Failed to fetch videos: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 3. GET SINGLE VIDEO (Watch video + track view)
// ============================================================================

export const getVideo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror("Invalid video ID", 400));
        }

        const video = await Video.findById(id)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .populate({
                path: "ratings",
                populate: {
                    path: "user",
                    select: "fullName avatar.secure_url"
                }
            })
            .select('+viewedBy +ratings');

        if (!video) {
            return next(new Apperror("Video not found", 404));
        }

        // ✅ Track view
        if (userId) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const alreadyViewed = video.viewedBy.some(v => v.userId.equals(userObjectId));

            if (!alreadyViewed) {
                video.viewedBy.push({
                    userId: userObjectId,
                    viewedAt: new Date(),
                    watchTimeSeconds: 0,
                    watchPercentage: 0,
                    completed: false
                });

                video.statistics.views += 1;
                await video.save();
            }
        } else {
            // Anonymous user - just increment view
            video.statistics.views += 1;
            await video.save();
        }

        // ✅ Get embed URL
        const embedUrl = video.getEmbedUrl();

        res.status(200).json({
            success: true,
            data: {
                ...video.toObject(),
                embedUrl,
                thumbnailUrl: video.getThumbnailUrl(),
                durationFormatted: video.getDurationFormatted(),
                averageRating: video.averageRating,
                totalRatings: video.totalRatings,
                totalBookmarks: video.totalBookmarks
            }
        });

    } catch (error) {
        console.error("❌ Get video error:", error);
        next(new Apperror("Failed to fetch video: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 4. TRACK WATCH PROGRESS
// ============================================================================

export const updateWatchProgress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { watchTimeSeconds, watchPercentage, completed } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return next(new Apperror("You must be logged in to track watch progress", 401));
        }

        const video = await Video.findById(id);
        if (!video) {
            return next(new Apperror("Video not found", 404));
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const viewIndex = video.viewedBy.findIndex(v => v.userId.equals(userObjectId));

        if (viewIndex !== -1) {
            video.viewedBy[viewIndex].watchTimeSeconds = watchTimeSeconds;
            video.viewedBy[viewIndex].watchPercentage = watchPercentage;
            video.viewedBy[viewIndex].completed = completed || false;

            // ✅ Update statistics
            video.statistics.watchTime += watchTimeSeconds;
            if (completed) {
                video.statistics.completionRate = (
                    video.viewedBy.filter(v => v.completed).length / video.viewedBy.length
                ) * 100;
            }

            await video.save();
        }

        res.status(200).json({
            success: true,
            message: "Watch progress updated"
        });

    } catch (error) {
        console.error("❌ Update watch progress error:", error);
        next(new Apperror("Failed to update watch progress: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 5. RATE VIDEO
// ============================================================================

export const rateVideo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rating, review } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return next(new Apperror("You must be logged in to rate videos", 401));
        }

        if (!rating || rating < 1 || rating > 5) {
            return next(new Apperror("Rating must be between 1 and 5", 400));
        }

        const video = await Video.findById(id);
        if (!video) {
            return next(new Apperror("Video not found", 404));
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // ✅ Check if user already rated
        const existingRating = video.ratings.find(r => r.user.equals(userObjectId));

        if (existingRating) {
            // Update existing rating
            existingRating.rating = rating;
            existingRating.review = review || '';
        } else {
            // Add new rating
            video.ratings.push({
                user: userObjectId,
                rating,
                review: review || ''
            });
        }

        await video.save();

        res.status(200).json({
            success: true,
            message: "Rating submitted successfully",
            data: video
        });

    } catch (error) {
        console.error("❌ Rate video error:", error);
        next(new Apperror("Failed to rate video: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 6. BOOKMARK VIDEO
// ============================================================================

export const bookmarkVideo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return next(new Apperror("You must be logged in to bookmark videos", 401));
        }

        const video = await Video.findById(id);
        if (!video) {
            return next(new Apperror("Video not found", 404));
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const isBookmarked = video.bookmarkedBy.includes(userObjectId);

        if (isBookmarked) {
            // Remove bookmark
            video.bookmarkedBy = video.bookmarkedBy.filter(id => !id.equals(userObjectId));
        } else {
            // Add bookmark
            video.bookmarkedBy.push(userObjectId);
        }

        await video.save();

        res.status(200).json({
            success: true,
            message: isBookmarked ? "Bookmark removed" : "Video bookmarked",
            isBookmarked: !isBookmarked
        });

    } catch (error) {
        console.error("❌ Bookmark video error:", error);
        next(new Apperror("Failed to bookmark video: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 7. GET USER'S BOOKMARKED VIDEOS
// ============================================================================

export const getBookmarkedVideos = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return next(new Apperror("You must be logged in", 401));
        }

        const videos = await Video.find({
            bookmarkedBy: new mongoose.Types.ObjectId(userId)
        })
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: videos
        });

    } catch (error) {
        console.error("❌ Get bookmarked videos error:", error);
        next(new Apperror("Failed to fetch bookmarked videos: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 8. GET WATCH HISTORY
// ============================================================================

export const getWatchHistory = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return next(new Apperror("You must be logged in", 401));
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        const videos = await Video.find({
            "viewedBy.userId": userObjectId
        })
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ "viewedBy.viewedAt": -1 })
            .select('+viewedBy');

        // Extract view info for this user
        const watchHistory = videos.map(video => {
            const viewInfo = video.viewedBy.find(v => v.userId.equals(userObjectId));
            return {
                video: video,
                viewedAt: viewInfo?.viewedAt,
                watchTimeSeconds: viewInfo?.watchTimeSeconds,
                watchPercentage: viewInfo?.watchPercentage
            };
        });

        res.status(200).json({
            success: true,
            data: watchHistory
        });

    } catch (error) {
        console.error("❌ Get watch history error:", error);
        next(new Apperror("Failed to fetch watch history: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 9. GET VIDEOS BY SUBJECT & CHAPTER (For Library Page)
// ============================================================================

export const getVideosBySubjectChapter = async (req, res, next) => {
    try {
        const { subject, semester, chapter } = req.params;

        if (!subject || !semester) {
            return next(new Apperror("Subject and semester are required", 400));
        }

        const filters = {
            isPublished: true,
            subject: { $regex: subject, $options: 'i' },
            semester: parseInt(semester)
        };

        if (chapter) {
            filters['chapter.number'] = parseInt(chapter);
        }

        const videos = await Video.find(filters)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ 'chapter.number': 1, createdAt: -1 });

        // ✅ Group by chapter if not filtered by specific chapter
        let groupedVideos = {};
        if (!chapter) {
            videos.forEach(video => {
                const chapterKey = `Chapter ${video.chapter.number}: ${video.chapter.title}`;
                if (!groupedVideos[chapterKey]) {
                    groupedVideos[chapterKey] = [];
                }
                groupedVideos[chapterKey].push(video);
            });
        } else {
            groupedVideos['All Videos'] = videos;
        }

        res.status(200).json({
            success: true,
            data: groupedVideos,
            totalVideos: videos.length
        });

    } catch (error) {
        console.error("❌ Get videos by subject/chapter error:", error);
        next(new Apperror("Failed to fetch videos: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 10. GET RECOMMENDED VIDEOS
// ============================================================================

export const getRecommendedVideos = async (req, res, next) => {
    try {
        const { id } = req.params; // Current video ID

        const currentVideo = await Video.findById(id);
        if (!currentVideo) {
            return next(new Apperror("Video not found", 404));
        }

        // ✅ Find similar videos by subject and chapter
        const recommended = await Video.find({
            _id: { $ne: id },
            subject: currentVideo.subject,
            semester: currentVideo.semester,
            isPublished: true
        })
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ 'statistics.views': -1 })
            .limit(6);

        res.status(200).json({
            success: true,
            data: recommended
        });

    } catch (error) {
        console.error("❌ Get recommended videos error:", error);
        next(new Apperror("Failed to fetch recommendations: " + error.message, 500));
    }
};


// ============================================================================
//  ✅ 11. DELETE VIDEO (Admin/Teacher)
// ============================================================================

export const deleteVideo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror("Invalid video ID", 400));
        }

        const video = await Video.findById(id);
        if (!video) {
            return next(new Apperror("Video not found", 404));
        }

        // ✅ Check authorization
        if (video.uploadedBy.toString() !== userId && req.user.role !== "ADMIN") {
            return next(new Apperror("You don't have permission to delete this video", 403));
        }

        await Video.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Video deleted successfully"
        });

    } catch (error) {
        console.error("❌ Delete video error:", error);
        next(new Apperror("Failed to delete video: " + error.message, 500));
    }
};
