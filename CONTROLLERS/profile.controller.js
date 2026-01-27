import { logUserActivity } from "../UTIL/activityLogger.js";

export const completeProfile = async (req, res, next) => {
    const { semester, college, branch } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return next(new Apperror("Please login", 401));
    }

    if (!semester || !college || !branch) {
        return next(new Apperror("All profile fields are required", 400));
    }

    try {
        const user = await User.findById(userId);

        user.academicProfile = {
            ...user.academicProfile,
            semester,
            college,
            branch,
            isCompleted: true,
            lastUpdated: new Date()
        };

        await user.save();

        // ✅ LOG PROFILE COMPLETION ACTIVITY
        await logUserActivity(userId, "PROFILE_COMPLETED", {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });

        res.status(200).json({
            success: true,
            message: "Profile completed successfully",
            data: user
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};
