// CONTROLLERS/feedbackAnalytics.controller.js
import ArkMicroFeedback from '../MODELS/ArkMicroFeedback.model.js';

// ─────────────────────────────────────────────
// GET /api/v1/admin/feedback/analytics
// Query params: ?days=30
// ─────────────────────────────────────────────
export const getFeedbackAnalytics = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      total,
      byTrigger,
      byInitialChoice,
      byFollowUp,
      dailyVolume,
      topShots,
      recentFeedback,
    ] = await Promise.all([

      // ── 1. Total count
      ArkMicroFeedback.countDocuments({ createdAt: { $gte: since } }),

      // ── 2. By trigger type
      ArkMicroFeedback.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$triggerType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // ── 3. Initial choice breakdown
      ArkMicroFeedback.aggregate([
        { $match: { createdAt: { $gte: since }, initialChoice: { $exists: true, $ne: null } } },
        { $group: { _id: '$initialChoice', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // ── 4. Follow-up choice breakdown
      ArkMicroFeedback.aggregate([
        { $match: { createdAt: { $gte: since }, followUpChoice: { $exists: true, $ne: null } } },
        { $group: { _id: '$followUpChoice', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // ── 5. Daily volume (last N days)
      ArkMicroFeedback.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // ── 6. Top shots by feedback volume
      ArkMicroFeedback.aggregate([
        { $match: { createdAt: { $gte: since }, shot: { $ne: null } } },
        { $group: { _id: '$shot', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from:         'arkshots',
            localField:   '_id',
            foreignField: '_id',
            as:           'shotDoc',
          },
        },
        { $unwind: { path: '$shotDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:     0,
            shotId:  '$_id',
            count:   1,
            title:   '$shotDoc.title',
            subject: '$shotDoc.subject',
          },
        },
      ]),

      // ── 7. Recent feedback (last 20)
      ArkMicroFeedback
        .find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('user', 'fullName email')
        .populate('shot', 'title subject')
        .lean(),
    ]);

    // ── Trigger type fill (ensure all 4 always present)
    const TRIGGERS = ['fast', 'pause', 'hesitation', 'general'];
    const triggerMap = Object.fromEntries(byTrigger.map(t => [t._id, t.count]));
    const triggerFull = TRIGGERS.map(t => ({ type: t, count: triggerMap[t] || 0 }));

    // ── Completion rate (had a followUp)
    const withFollowUp = await ArkMicroFeedback.countDocuments({
      createdAt:    { $gte: since },
      followUpChoice: { $exists: true, $ne: null },
    });
    const completionRate = total > 0
      ? Math.round((withFollowUp / total) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        meta: {
          days,
          since,
          total,
          withFollowUp,
          completionRate,        // % who answered follow-up
        },
        triggerBreakdown:      triggerFull,
        initialChoices:        byInitialChoice,
        followUpChoices:       byFollowUp,
        dailyVolume,
        topShots,
        recentFeedback:        recentFeedback.map(f => ({
          id:            f._id,
          createdAt:     f.createdAt,
          triggerType:   f.triggerType,
          initialChoice: f.initialChoice,
          followUpChoice:f.followUpChoice,
          user:          f.user
            ? { id: f.user._id, name: f.user.fullName, email: f.user.email }
            : null,
          shot:          f.shot
            ? { id: f.shot._id, title: f.shot.title, subject: f.shot.subject }
            : null,
        })),
      },
    });
  } catch (err) {
    console.error('getFeedbackAnalytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};