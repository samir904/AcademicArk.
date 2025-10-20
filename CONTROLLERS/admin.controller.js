// CONTROLLERS/admin.controller.js
import User from '../MODELS/user.model.js';
import Note from '../MODELS/note.model.js';
import mongoose from 'mongoose';
import Apperror from '../UTIL/error.util.js';
import serverMetrics from '../UTIL/serverMetrics.js';
import sessionTracker from '../UTIL/sessionTracker.js';
import SessionLog from '../MODELS/SessionLog.model.js';

export const getDashboardStats = async (req, res, next) => {
    try {
        // Get total counts
        const totalUsers = await User.countDocuments();
        const totalNotes = await Note.countDocuments();
        const totalDownloads = await Note.aggregate([
            { $group: { _id: null, total: { $sum: '$downloads' } } }
        ]);
        
        // Get user distribution by role
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        
        // Get notes by category
        const notesByCategory = await Note.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        
        // Get notes by semester
        const notesBySemester = await Note.aggregate([
            { $group: { _id: '$semester', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        // Get top rated notes
        const topRatedNotes = await Note.aggregate([
            {
                $addFields: {
                    avgRating: { $avg: '$rating.rating' },
                    ratingCount: { $size: '$rating' }
                }
            },
            { $match: { ratingCount: { $gt: 0 } } },
            { $sort: { avgRating: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'uploadedBy',
                    foreignField: '_id',
                    as: 'uploadedBy'
                }
            },
            { $unwind: '$uploadedBy' },
            {
                $project: {
                    title: 1,
                    avgRating: 1,
                    ratingCount: 1,
                    downloads: 1,
                    'uploadedBy.fullName': 1
                }
            }
        ]);

        // Get recent registrations (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            message: 'Dashboard stats retrieved successfully',
            data: {
                totalUsers,
                totalNotes,
                totalDownloads: totalDownloads[0]?.total || 0,
                recentUsers,
                usersByRole,
                notesByCategory,
                notesBySemester,
                topRatedNotes
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return next(new Apperror('Failed to get dashboard stats', 500));
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        
        const searchQuery = search ? {
            $or: [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const users = await User.find(searchQuery)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: {
                users,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalUsers / limit),
                    totalUsers
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        return next(new Apperror('Failed to get users', 500));
    }
};

export const getAllNotes = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        
        const searchQuery = search ? {
            $or: [
                { title: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const notes = await Note.find(searchQuery)
            .populate('uploadedBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalNotes = await Note.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            message: 'Notes retrieved successfully',
            data: {
                notes,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalNotes / limit),
                    totalNotes
                }
            }
        });
    } catch (error) {
        console.error('Get notes error:', error);
        return next(new Apperror('Failed to get notes', 500));
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid user ID', 400));
        }

        const user = await User.findById(id);
        if (!user) {
            return next(new Apperror('User not found', 404));
        }

        // Delete user's notes first
        await Note.deleteMany({ uploadedBy: id });
        
        // Then delete user
        await User.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return next(new Apperror('Failed to delete user', 500));
    }
};

export const deleteNote = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid note ID', 400));
        }

        const note = await Note.findByIdAndDelete(id);
        if (!note) {
            return next(new Apperror('Note not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Delete note error:', error);
        return next(new Apperror('Failed to delete note', 500));
    }
};

export const updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid user ID', 400));
        }

        if (!['USER', 'TEACHER', 'ADMIN'].includes(role)) {
            return next(new Apperror('Invalid role', 400));
        }

        const user = await User.findByIdAndUpdate(
            id, 
            { role }, 
            { new: true, select: '-password' }
        );

        if (!user) {
            return next(new Apperror('User not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Update user role error:', error);
        return next(new Apperror('Failed to update user role', 500));
    }
};

export const getRecentActivity = async (req, res, next) => {
    try {
        // Get recent users (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const recentUsers = await User.find({
            createdAt: { $gte: sevenDaysAgo }
        })
        .select('fullName email createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

        // Get recent notes (last 7 days)
        const recentNotes = await Note.find({
            createdAt: { $gte: sevenDaysAgo }
        })
        .populate('uploadedBy', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5);

        res.status(200).json({
            success: true,
            message: 'Recent activity retrieved successfully',
            data: {
                recentUsers,
                recentNotes
            }
        });
    } catch (error) {
        console.error('Get recent activity error:', error);
        return next(new Apperror('Failed to get recent activity', 500));
    }
};

export const getServerMetrics=async(req,res,next)=>{
    try{
        const metrics=await serverMetrics.getMetrics();

        res.status(200).json({
            success:true,
            message:'Server metrics retrieved successfully',
            data:metrics
        })
    }catch(err){
        console.error('server metrics error',err);
        return next(new Apperror('Failed to get server metrics',500));
    }
}

export const getSessionMetrics=async(req,res,next)=>{
    
        const metrics=sessionTracker.getMetrics();

        //get user details for active users
        const activeUserDetails=await User.find({
            _id:{$in: metrics.activeUsers}//what is this line meaning what is metrics.activeusers
        }).select('fullName email avatar role');

        res.status(200).json({
            success:true,
            message:'session metrics retrieved successfully',
            data:{
                ...metrics,
                activeUserDetails
            }
        });
   
}

// Get session history (last 30 days)
export const getSessionHistory = async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const history = await SessionLog.find({
            date: { $gte: startDate }
        }).sort({ date: 1 });
        
        res.status(200).json({
            success: true,
            message: 'Session history retrieved successfully',
            data: history
        });
    } catch (error) {
        console.error('Session history error:', error);
        return next(new Apperror('Failed to get session history', 500));
    }
};


/// Get weekly comparison
export const getWeeklyComparison = async (req, res, next) => {
    try {
        const thisWeekStart = new Date();
        thisWeekStart.setDate(thisWeekStart.getDate() - 7);
        thisWeekStart.setHours(0, 0, 0, 0);
        
        const lastWeekStart = new Date();
        lastWeekStart.setDate(lastWeekStart.getDate() - 14);
        lastWeekStart.setHours(0, 0, 0, 0);
        
        const thisWeek = await SessionLog.find({
            date: { $gte: thisWeekStart }
        });
        
        const lastWeek = await SessionLog.find({
            date: { $gte: lastWeekStart, $lt: thisWeekStart }
        });
        
        const thisWeekAvg = thisWeek.length > 0
            ? thisWeek.reduce((sum, day) => sum + day.maxConcurrent, 0) / thisWeek.length
            : 0;
            
        const lastWeekAvg = lastWeek.length > 0
            ? lastWeek.reduce((sum, day) => sum + day.maxConcurrent, 0) / lastWeek.length
            : 0;
        
        const growth = lastWeekAvg > 0 
            ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 
            : 0;
        
        res.status(200).json({
            success: true,
            message: 'Weekly comparison retrieved successfully',
            data: {
                thisWeekAvg: Math.round(thisWeekAvg),
                lastWeekAvg: Math.round(lastWeekAvg),
                growth: growth.toFixed(2),
                thisWeekData: thisWeek,
                lastWeekData: lastWeek
            }
        });
    } catch (error) {
        console.error('Weekly comparison error:', error);
        return next(new Apperror('Failed to get weekly comparison', 500));
    }
};

// Get traffic pattern by day of week
export const getTrafficPattern = async (req, res, next) => {
    try {
        const pattern = await SessionLog.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: '$date' },
                    avgPeak: { $avg: '$maxConcurrent' },
                    avgConcurrent: { $avg: '$avgConcurrent' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        const formattedPattern = pattern.map(day => ({
            day: dayNames[day._id - 1],
            avgPeak: Math.round(day.avgPeak),
            avgConcurrent: Math.round(day.avgConcurrent),
            dataPoints: day.count
        }));
        
        res.status(200).json({
            success: true,
            message: 'Traffic pattern retrieved successfully',
            data: formattedPattern
        });
    } catch (error) {
        console.error('Traffic pattern error:', error);
        return next(new Apperror('Failed to get traffic pattern', 500));
    }
};
