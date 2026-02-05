import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js"; // 🔒 NEW

export const canUserDownload = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id; // 🔒 NEW

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
        plan: null,
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

    // 🔒 NEW: FETCH NOTE & CHECK LOCK
    const note = await Note.findById(noteId).select("isLocked");
    if (!note) {
      return res.status(404).json({
        success: false,
        code: "NOTE_NOT_FOUND",
        message: "Note not found."
      });
    }

    const isSupporter =
      access.plan &&
      access.expiresAt &&
      new Date(access.expiresAt) > now;

    // 🔒 NEW: LOCKED NOTE + FREE USER → BLOCK
    if (note.isLocked && !isSupporter) {
      return res.status(403).json({
        success: false,
        code: "LOCKED_NOTE",
        message:
          "This note is locked. Support AcademicArk to download full PDF."
      });
    }

    // 🟢 PAID USER → UNLIMITED DOWNLOADS
    if (isSupporter) {
      return next();
    }

    // 🟡 FREE USER LOGIC (UNCHANGED)

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
        message:
          "You’ve reached today’s free download limit. Support AcademicArk for unlimited access."
      });
    }

    // Increment count (ONLY for free + unlocked)
    access.downloadsToday += 1;
    await user.save();

    next();
  } catch (err) {
    console.error("❌ canUserDownload error:", err);
    return res.status(500).json({
      success: false,
      code: "DOWNLOAD_CHECK_FAILED",
      message: "Download failed"
    });
  }
};
