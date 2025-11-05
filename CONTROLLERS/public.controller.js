// ✅ CORRECT
import Note from "../MODELS/note.model.js";
import User from "../MODELS/user.model.js";
import Apperror from "../UTIL/error.util.js";

export const getPublicStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalNotes = await Note.countDocuments();
        const totalDownloads = await Note.aggregate([
            { $group: { _id: null, total: { $sum: '$downloads' } } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                totalNotes,
                totalDownloads: totalDownloads[0]?.total || 0
            }
        });
    } catch (error) {
        return next(new Apperror('Failed to get stats', 500));
    }
};
