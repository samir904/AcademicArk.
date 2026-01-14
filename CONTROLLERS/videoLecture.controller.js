import VideoLecture from "../MODELS/videoLecture.model.js";
import Apperror from "../UTIL/error.util.js";
import { extractYouTubeId, buildYouTubeEmbedUrl, buildYouTubeThumbnailUrl } from "../UTIL/video.util.js";
import mongoose from "mongoose";

export const registerVideoLecture = async (req, res, next) => {
  const {
    title,
    description,
    subject,
    course,
    semester,
    university,
    chapterNumber,
    chapterTitle,
    videoUrl,
  } = req.body;

  const userId = req.user?.id;

  if (!userId) {
    return next(new Apperror("Something went wrong, please login again", 401));
  }

  // Basic required checks
  if (
    !title ||
    !description ||
    !subject ||
    !course ||
    !semester ||
    !university ||
    !chapterNumber ||
    !chapterTitle ||
    !videoUrl
  ) {
    return next(new Apperror("All fields are required", 400));
  }

  // Extract YouTube ID
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    return next(new Apperror("Invalid YouTube URL", 400));
  }

  const embedUrl = buildYouTubeEmbedUrl(videoId);
  const thumbnailUrl = buildYouTubeThumbnailUrl(videoId);

  try {
    const video = await VideoLecture.create({
      title: title.trim(),
      description: description.trim(),
      subject: subject.toLowerCase().trim(),
      course: course.toUpperCase().trim(),
      semester: parseInt(semester),
      university: university.toUpperCase().trim(),
      chapterNumber: parseInt(chapterNumber),
      chapterTitle: chapterTitle.trim(),
      videoUrl: videoUrl.trim(),
      platform: "YOUTUBE",
      videoId,
      embedUrl,
      thumbnailUrl,
      uploadedBy: userId,
    });

    if (!video) {
      return next(new Apperror("Video not uploaded, please try again", 500));
    }

    // (Optional) clear any cache if you add caching for videos later

    res.status(201).json({
      success: true,
      message: "Video lecture uploaded successfully",
      data: video,
    });
  } catch (error) {
    return next(
      new Apperror(error.message || "Failed to upload video, please try again", 500)
    );
  }
};

export const getAllVideoLectures = async (req, res, next) => {
  try {
    const filters = {};

    if (req.query.subject && req.query.subject.trim()) {
      filters.subject = { $regex: req.query.subject, $options: "i" };
    }
    if (req.query.semester) {
      const sem = parseInt(req.query.semester);
      if (!isNaN(sem)) filters.semester = sem;
    }
    if (req.query.university && req.query.university.trim()) {
      filters.university = { $regex: req.query.university, $options: "i" };
    }
    if (req.query.course && req.query.course.trim()) {
      filters.course = { $regex: req.query.course, $options: "i" };
    }
    if (req.query.chapterNumber) {
      const ch = parseInt(req.query.chapterNumber);
      if (!isNaN(ch)) filters.chapterNumber = ch;
    }

    // Sorting (views, latest, rating, etc.)
    const sortBy =
      (req.query.sortBy && req.query.sortBy.trim()) || "latest";

    let sortOrder = { createdAt: -1 }; // default latest

    switch (sortBy.toLowerCase()) {
      case "views":
        sortOrder = { views: -1, createdAt: -1 };
        break;
      case "rating":
        // you can later store avg rating for faster sorting
        sortOrder = { "ratingAverage": -1, createdAt: -1 };
        break;
      case "latest":
      default:
        sortOrder = { createdAt: -1 };
    }

    const videos = await VideoLecture.find(filters)
      .populate("uploadedBy", "fullName avatar.secure_url")
      .sort(sortOrder)
      .select("+views +viewedBy")
      .lean();

    const videosWithStats = videos.map((video) => ({
      ...video,
      viewerCount: video.viewedBy?.length || 0,
      viewedBy: undefined,
    }));

    res.status(200).json({
      success: true,
      count: videosWithStats.length,
      sortedBy: sortBy,
      filtersApplied: Object.keys(filters).length,
      data: videosWithStats,
    });
  } catch (error) {
    console.error("❌ Error fetching videos:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch videos",
      error: error.message,
    });
  }
};

export const getVideoLecture = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new Apperror("Invalid video Id", 400));
  }

  try {
    const video = await VideoLecture.findById(id)
      .populate("uploadedBy", "fullName avatar.secure_url")
      .populate({
        path: "rating",
        populate: {
          path: "user",
          select: "fullName avatar",
        },
      })
      .select("+views +viewedBy");

    if (!video) {
      return next(new Apperror("Video not found, please try again", 404));
    }

    if (userId) {
     await logUserActivity(userId, "VIDEO_VIEWED", {
            resourceId: id,
            resourceType: "VIDEO",
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const alreadyViewed = video.viewedBy.some((viewerId) =>
        viewerId.equals(userObjectId)
      );

      if (!alreadyViewed) {
        video.views += 1;
        video.viewedBy.push(userObjectId);
        await video.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Video fetched successfully",
      data: video,
    });
  } catch (error) {
    console.error("❌ getVideoLecture error:", error);
    next(
      new Apperror("Failed to fetch video: " + error.message, 500)
    );
  }
};


/**
 * ADD OR REMOVE VIDEO BOOKMARK
 * Route: GET /api/v1/videos/:id/bookmark
 * Auth: Required
 */
export const bookmarkVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // ✅ Validation
    if (!id) {
      return next(new Apperror("Video ID is required", 400));
    }

    if (!userId) {
      return next(new Apperror("Please login to bookmark videos", 401));
    }

    // ✅ Find video
    const video = await VideoLecture.findById(id);
    if (!video) {
      return next(new Apperror("Video not found", 404));
    }

    // ✅ Check if already bookmarked
    const isBookmarked = video.bookmarkedBy.includes(userId);

    if (isBookmarked) {
      // ✅ Remove bookmark
      video.bookmarkedBy = video.bookmarkedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
      await video.save();

      // Log activity
      // await logUserActivity({
      //   userId,
      //   action: "REMOVED_VIDEO_BOOKMARK",
      //   resourceType: "VIDEO",
      //   resourceId: id,
      //   details: {
      //     videoTitle: video.title,
      //     subject: video.subject,
      //   },
      // });

      return res.status(200).json({
        success: true,
        message: "Video removed from bookmarks",
        data: video,
        isBookmarked: false,
      });
    } else {
      // ✅ Add bookmark
      video.bookmarkedBy.push(userId);
      await video.save();

      // Log activity
      // await logUserActivity({
      //   userId,
      //   action: "ADDED_VIDEO_BOOKMARK",
      //   resourceType: "VIDEO",
      //   resourceId: id,
      //   details: {
      //     videoTitle: video.title,
      //     subject: video.subject,
      //   },
      // });

      return res.status(200).json({
        success: true,
        message: "Video added to bookmarks",
        data: video,
        isBookmarked: true,
      });
    }
  } catch (error) {
    return next(new Apperror(error.message || "Error bookmarking video", 500));
  }
};

/**
 * ADD VIDEO RATING & REVIEW
 * Route: POST /api/v1/videos/:id/rate
 * Auth: Required
 * Body: { rating: 1-5, review: "optional text" }
 */
export const addVideoRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    // ✅ Validation
    if (!id) {
      return next(new Apperror("Video ID is required", 400));
    }

    if (!userId) {
      return next(new Apperror("Please login to rate videos", 401));
    }

    if (!rating) {
      return next(new Apperror("Rating is required", 400));
    }

    if (rating < 1 || rating > 5) {
      return next(new Apperror("Rating must be between 1 and 5", 400));
    }

    if (review && review.length > 200) {
      return next(new Apperror("Review must be less than 200 characters", 400));
    }

    // ✅ Find video
    const video = await VideoLecture.findById(id);
    if (!video) {
      return next(new Apperror("Video not found", 404));
    }

    // ✅ Check if user already rated
    const existingRatingIndex = video.rating.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    if (existingRatingIndex !== -1) {
      // ✅ Update existing rating
      video.rating[existingRatingIndex].rating = rating;
      video.rating[existingRatingIndex].review = review || "";
      await video.save();


      return res.status(200).json({
        success: true,
        message: "Rating updated successfully",
        data: video,
        rating: video.rating[existingRatingIndex],
      });
    } else {
      // ✅ Add new rating
      video.rating.push({
        user: userId,
        rating: rating,
        review: review || "",
      });
      await video.save();

      return res.status(201).json({
        success: true,
        message: "Rating added successfully",
        data: video,
        rating: video.rating[video.rating.length - 1],
      });
    }
  } catch (error) {
    return next(new Apperror(error.message || "Error adding rating", 500));
  }
};

/**
 * GET VIDEO RATINGS & REVIEWS
 * Route: GET /api/v1/videos/:id/ratings
 * Auth: Optional
 */
export const getVideoRatings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // ✅ Validation
    if (!id) {
      return next(new Apperror("Video ID is required", 400));
    }

    // ✅ Find video
    const video = await VideoLecture.findById(id).populate(
      "rating.user",
      "fullName avatar email"
    );
    if (!video) {
      return next(new Apperror("Video not found", 404));
    }

    // ✅ Calculate statistics
    const totalRatings = video.rating.length;
    const averageRating =
      totalRatings > 0
        ? (
            video.rating.reduce((sum, r) => sum + r.rating, 0) /
            totalRatings
          ).toFixed(1)
        : 0;

    const ratingDistribution = {
      5: video.rating.filter((r) => r.rating === 5).length,
      4: video.rating.filter((r) => r.rating === 4).length,
      3: video.rating.filter((r) => r.rating === 3).length,
      2: video.rating.filter((r) => r.rating === 2).length,
      1: video.rating.filter((r) => r.rating === 1).length,
    };

    // ✅ Pagination
    const skip = (page - 1) * limit;
    const paginatedRatings = video.rating
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      success: true,
      message: "Ratings fetched successfully",
      data: {
        totalRatings,
        averageRating,
        ratingDistribution,
        ratings: paginatedRatings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalRatings,
          pages: Math.ceil(totalRatings / limit),
        },
      },
    });
  } catch (error) {
    return next(new Apperror(error.message || "Error fetching ratings", 500));
  }
};

/**
 * GET USER'S BOOKMARKED VIDEOS
 * Route: GET /api/v1/videos/bookmarks/my
 * Auth: Required
 */
export const getUserBookmarkedVideos = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 12 } = req.query;

    // ✅ Validation
    if (!userId) {
      return next(new Apperror("Please login to view bookmarks", 401));
    }

    // ✅ Find videos bookmarked by user
    const skip = (page - 1) * limit;
    const videos = await VideoLecture.find({
      bookmarkedBy: userId,
    })
      .populate("uploadedBy", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VideoLecture.countDocuments({
      bookmarkedBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Bookmarked videos fetched successfully",
      data: videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(
      new Apperror(error.message || "Error fetching bookmarked videos", 500)
    );
  }
};

/**
 * GET USER'S RATING FOR A VIDEO
 * Route: GET /api/v1/videos/:id/my-rating
 * Auth: Required
 */
export const getUserVideoRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // ✅ Validation
    if (!id) {
      return next(new Apperror("Video ID is required", 400));
    }

    if (!userId) {
      return next(new Apperror("Please login to view your rating", 401));
    }

    // ✅ Find video
    const video = await VideoLecture.findById(id);
    if (!video) {
      return next(new Apperror("Video not found", 404));
    }

    // ✅ Find user's rating
    const userRating = video.rating.find(
      (r) => r.user.toString() === userId.toString()
    );

    if (!userRating) {
      return res.status(200).json({
        success: true,
        message: "No rating found for this user",
        data: null,
        hasRated: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: "User rating fetched successfully",
      data: userRating,
      hasRated: true,
    });
  } catch (error) {
    return next(
      new Apperror(error.message || "Error fetching user rating", 500)
    );
  }
};

/**
 * DELETE VIDEO RATING
 * Route: DELETE /api/v1/videos/:id/rating
 * Auth: Required
 */
export const deleteVideoRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // ✅ Validation
    if (!id) {
      return next(new Apperror("Video ID is required", 400));
    }

    if (!userId) {
      return next(new Apperror("Please login to delete rating", 401));
    }

    // ✅ Find video
    const video = await VideoLecture.findById(id);
    if (!video) {
      return next(new Apperror("Video not found", 404));
    }

    // ✅ Find and remove user's rating
    const ratingIndex = video.rating.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    if (ratingIndex === -1) {
      return next(new Apperror("You have not rated this video", 404));
    }

    video.rating.splice(ratingIndex, 1);
    await video.save();


    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully",
      data: video,
    });
  } catch (error) {
    return next(new Apperror(error.message || "Error deleting rating", 500));
  }
};

