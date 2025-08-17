// CONTROLLERS/search.controller.js
import Note from '../MODELS/note.model.js';
import User from '../MODELS/user.model.js';
import Apperror from "../UTIL/error.util.js";
// Advanced Search Controller
export const searchNotes = async (req, res, next) => {
    try {
        const { 
            query = '', 
            subject = '', 
            semester = '', 
            category = '', 
            university = 'AKTU', 
            course = 'BTECH',
            sortBy = 'relevance',
            page = 1,
            limit = 12,
            minRating = 0,
            minDownloads = 0
        } = req.query;

        // Build search query
        const searchConditions = [];

        // Text search
        if (query.trim()) {
            searchConditions.push({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { subject: { $regex: query, $options: 'i' } }
                ]
            });
        }

        // Filter conditions
        if (subject) searchConditions.push({ subject: { $regex: subject, $options: 'i' } });
        if (semester) searchConditions.push({ semester: parseInt(semester) });
        if (category) searchConditions.push({ category });
        if (university) searchConditions.push({ university });
        if (course) searchConditions.push({ course });
        if (minDownloads > 0) searchConditions.push({ downloads: { $gte: parseInt(minDownloads) } });

        const searchQuery = searchConditions.length > 0 ? { $and: searchConditions } : {};

        // Sort options
        let sortOptions = {};
        switch (sortBy) {
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'popular':
                sortOptions = { downloads: -1 };
                break;
            case 'rating':
                // Sort by average rating (calculated in aggregation)
                break;
            case 'alphabetical':
                sortOptions = { title: 1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        let notesQuery;

        if (sortBy === 'rating' || minRating > 0) {
            // Use aggregation for rating-based queries
            const aggregationPipeline = [
                { $match: searchQuery },
                {
                    $addFields: {
                        avgRating: {
                            $cond: [
                                { $gt: [{ $size: '$rating' }, 0] },
                                { $avg: '$rating.rating' },
                                0
                            ]
                        },
                        ratingCount: { $size: '$rating' }
                    }
                }
            ];

            if (minRating > 0) {
                aggregationPipeline.push({ $match: { avgRating: { $gte: parseFloat(minRating) } } });
            }

            if (sortBy === 'rating') {
                aggregationPipeline.push({ $sort: { avgRating: -1, ratingCount: -1 } });
            } else {
                aggregationPipeline.push({ $sort: sortOptions });
            }

            aggregationPipeline.push(
                { $skip: (parseInt(page) - 1) * parseInt(limit) },
                { $limit: parseInt(limit) },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'uploadedBy',
                        foreignField: '_id',
                        as: 'uploadedBy'
                    }
                },
                { $unwind: '$uploadedBy' }
            );

            notesQuery = Note.aggregate(aggregationPipeline);
        } else {
            // Regular query for other sort options
            notesQuery = Note.find(searchQuery)
                .populate('uploadedBy', 'fullName avatar')
                .sort(sortOptions)
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit));
        }

        const notes = await notesQuery;
        const totalNotes = await Note.countDocuments(searchQuery);

        // Get search suggestions (popular subjects)
        const popularSubjects = await Note.aggregate([
            { $group: { _id: '$subject', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            message: 'Search results retrieved successfully',
            data: {
                notes,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalNotes / parseInt(limit)),
                    totalNotes,
                    hasNext: parseInt(page) < Math.ceil(totalNotes / parseInt(limit)),
                    hasPrev: parseInt(page) > 1
                },
                filters: { 
                    query, subject, semester, category, university, course, 
                    sortBy, minRating: parseFloat(minRating), minDownloads: parseInt(minDownloads) 
                },
                suggestions: {
                    popularSubjects: popularSubjects.map(s => s._id)
                }
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        return next(new Apperror('Failed to search notes', 500));
    }
};

// Trending Notes
export const getTrendingNotes = async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const trendingNotes = await Note.aggregate([
            {
                $addFields: {
                    recentActivity: {
                        $cond: [
                            { $gte: ['$updatedAt', sevenDaysAgo] },
                            { $multiply: ['$downloads', 1.5] },
                            '$downloads'
                        ]
                    },
                    avgRating: {
                        $cond: [
                            { $gt: [{ $size: '$rating' }, 0] },
                            { $avg: '$rating.rating' },
                            0
                        ]
                    },
                    bookmarkCount: { $size: '$bookmarkedBy' },
                    trendScore: {
                        $add: [
                            { $multiply: ['$downloads', 0.4] },
                            { $multiply: [{ $avg: '$rating.rating' }, 3] },
                            { $multiply: [{ $size: '$bookmarkedBy' }, 2] }
                        ]
                    }
                }
            },
            { $match: { trendScore: { $gt: 0 } } },
            { $sort: { trendScore: -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'uploadedBy',
                    foreignField: '_id',
                    as: 'uploadedBy'
                }
            },
            { $unwind: '$uploadedBy' }
        ]);

        res.status(200).json({
            success: true,
            message: 'Trending notes retrieved successfully',
            data: trendingNotes
        });
    } catch (error) {
        console.error('Trending notes error:', error);
        return next(new Apperror('Failed to get trending notes', 500));
    }
};

// Popular Notes
export const getPopularNotes = async (req, res, next) => {
    try {
        const popularNotes = await Note.find()
            .populate('uploadedBy', 'fullName avatar')
            .sort({ downloads: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            message: 'Popular notes retrieved successfully',
            data: popularNotes
        });
    } catch (error) {
        console.error('Popular notes error:', error);
        return next(new Apperror('Failed to get popular notes', 500));
    }
};
