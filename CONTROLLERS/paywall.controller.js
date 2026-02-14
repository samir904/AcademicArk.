import PaywallEvent from "../MODELS/paywallEvent.model.js";
import UserPaywallState from "../MODELS/userPaywallState.model.js"; // optional but recommended
import ConversionStats from "../MODELS/conversionStats.model.js";   // optional

/**
 * 🔥 CENTRAL PAYWALL TRACKER
 * This handles:
 * - Raw event storage
 * - User state updates
 * - Optional conversion aggregation
 */
export const trackPaywallEvent = async (req, res) => {
  try {
    const { noteId, eventType, metadata = {} } = req.body;

    // Logged in user (optionalAuth middleware)
    const userId = req.user?.id || null;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        message: "eventType is required"
      });
    }

    // 1️⃣ Store Raw Event
    await PaywallEvent.create({
      userId,
      noteId,
      eventType,
      metadata
    });

    // 2️⃣ Update UserPaywallState (if user logged in)
    if (userId) {
      let state = await UserPaywallState.findOne({ userId });

      if (!state) {
        state = await UserPaywallState.create({
          userId,
          firstExposureAt: new Date()
        });
      }

      switch (eventType) {

  case "LOCK_VIEWED":
    state.lockedNotesSeen += 1;
    break;

  case "LOCK_DOWNLOAD_ATTEMPT":
    state.lockDownloadAttempts += 1;
    break;

  case "PREVIEW_STARTED":
    state.previewsStarted += 1;
    state.lastPreviewAt = new Date();
    break;

  case "PREVIEW_ENDED":
    state.previewsEnded += 1;
    break;

  case "PREVIEW_SUPPORT_CLICKED":
    state.previewSupportClicks += 1;
    break;

  case "PAYWALL_SHOWN":
    state.paywallShownCount += 1;
    state.lastPaywallShownAt = new Date();
    break;

  case "PAYWALL_DISMISSED":
    state.paywallDismissedCount += 1;
    break;

  case "DOWNLOAD_LIMIT_SUPPORT_CLICKED":
    state.downloadLimitSupportClicks += 1;
    break;

  case "DOWNLOAD_LIMIT_DISMISSED":
    state.downloadLimitDismissed += 1;
    break;

  case "SUPPORT_VIEWED":
    state.supportViewedCount += 1;
    break;

  case "SUPPORT_CLICKED":
    state.supportClickedCount += 1;
    break;

  case "SUPPORT_DISMISSED":
    state.supportDismissedCount += 1;
    break;

  case "PAYMENT_STARTED":
    state.paymentStartedCount += 1;
    break;

  case "PAYMENT_SUCCESS":
    state.hasConverted = true;
    state.convertedAt = new Date();
    break;
}


      await state.save();
    }

    // 3️⃣ OPTIONAL: Update Daily Conversion Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let stats = await ConversionStats.findOne({ date: today });

    if (!stats) {
      stats = await ConversionStats.create({ date: today });
    }

    switch (eventType) {

  // 👀 Preview Flow
  case "PREVIEW_STARTED":
    stats.previewsStarted += 1;
    break;

  case "PREVIEW_ENDED":
    stats.previewsEnded += 1;
    break;

  case "PREVIEW_SUPPORT_CLICKED":
    stats.previewSupportClicks += 1;
    break;

  // 🔒 Lock Flow
  case "LOCK_DOWNLOAD_ATTEMPT":
    stats.lockDownloadAttempts += 1;
    break;

  // 🚧 Paywall Exposure
  case "PAYWALL_SHOWN":
    stats.paywallShown += 1;
    break;

  // 📉 Download Limit Flow
  case "DOWNLOAD_LIMIT_SUPPORT_CLICKED":
    stats.downloadLimitSupportClicks += 1;
    break;

  // 💳 Core Conversion
  case "SUPPORT_CLICKED":
    stats.supportClicks += 1;
    break;

  case "PAYMENT_STARTED":
    stats.paymentStarted += 1;
    break;

  case "PAYMENT_SUCCESS":
    stats.paymentSuccess += 1;
    break;
}


    await stats.save();

    return res.status(200).json({
      success: true,
      message: "Paywall event tracked successfully"
    });

  } catch (error) {
    console.error("Paywall Tracking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};
