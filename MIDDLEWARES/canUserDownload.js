import User from "../MODELS/user.model.js";

export const canUserDownload = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Please login again."
            });
        }

        const now = new Date();

        // 🟡 ENSURE ACCESS OBJECT EXISTS (FREE USERS)
        if (!user.access) {
            user.access = {
                plan: null,                // FREE USER
                dailyDownloadLimit: 3,
                downloadsToday: 0,
                lastDownloadDate: null,
                expiresAt: null
            };
        }

        const access = user.access;
        // 🔴 PAID PLAN BUT EXPIRED
        if (access.plan && access.expiresAt && new Date(access.expiresAt) <= now) {
            return res.status(403).json({
                success: false,
                code: "PLAN_EXPIRED",
                message: "Your plan has expired. Please upgrade to continue downloading."
            });
        }

        // 🟢 PAID USER → UNLIMITED DOWNLOADS
        if (access.plan && access.expiresAt && new Date(access.expiresAt) > now) {
            return next();
        }

        // 🟡 FREE USER LOGIC (NO PLAN)

        // Reset daily count if date changed
        if (
            !access.lastDownloadDate ||
            new Date(access.lastDownloadDate).toDateString() !== now.toDateString()
        ) {
            access.downloadsToday = 0;
            access.lastDownloadDate = now;
        }

        // Enforce soft daily limit
        if (access.downloadsToday >= access.dailyDownloadLimit) {
            return res.status(429).json({
                success: false,
                code: "DOWNLOAD_LIMIT_REACHED",
                message: "You’ve reached today’s free download limit. Support AcademicArk for unlimited access."
            });
        }

        // Increment count
        access.downloadsToday += 1;
        // Only save if free user
        if (!access.plan) {
            await user.save();
        }


        next();
    } catch (err) {
  const apiError = err?.response?.data;

  setDownloading(prev => ({
    ...prev,
    [id]: { status: "error" }
  }));

  if (apiError?.code) {
    return {
      success: false,
      code: apiError.code,
      message: apiError.message
    };
  }

  return {
    success: false,
    code: "UNKNOWN_ERROR",
    message: "Download failed"
  };
}

};
