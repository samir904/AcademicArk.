import PaywallEvent from "../MODELS/paywallEvent.model.js";
import ConversionStats from "../MODELS/conversionStats.model.js";
import UserPaywallState from "../MODELS/userPaywallState.model.js";
import mongoose from "mongoose";

/**
 * 1️⃣ FUNNEL OVERVIEW (Last 7 days summary)
 */
export const getFunnelOverview = async (req, res) => {
  try {
    const stats = await ConversionStats
      .find()
      .sort({ date: -1 })
      .limit(7);

    const enriched = stats.map(day => {

      const previewToSupportRate =
        day.previewsStarted > 0
          ? ((day.previewSupportClicks / day.previewsStarted) * 100).toFixed(2)
          : 0;

      const supportToPaymentRate =
        day.supportClicks > 0
          ? ((day.paymentSuccess / day.supportClicks) * 100).toFixed(2)
          : 0;

      const overallConversionRate =
        day.paywallShown > 0
          ? ((day.paymentSuccess / day.paywallShown) * 100).toFixed(2)
          : 0;

      return {
        ...day.toObject(),

        rates: {
          previewToSupportRate: Number(previewToSupportRate),
          supportToPaymentRate: Number(supportToPaymentRate),
          overallConversionRate: Number(overallConversionRate)
        }
      };
    });

    return res.json({
      success: true,
      data: enriched
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};



/**
 * 2️⃣ EVENT BREAKDOWN (Raw Event Aggregation)
 */
export const getEventBreakdown = async (req, res) => {
  try {
    const result = await PaywallEvent.aggregate([
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 }
        }
      }
    ]);

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};


/**
 * 3️⃣ USER SEGMENTATION
 * Cold / Warm / Hot / Converted
 */

export const getUserSegments = async (req, res) => {
  try {

    const allStates = await UserPaywallState
      .find()
      .populate("userId", "fullName email role  academicProfile  access");

    const totalUsers = allStates.length;

    const convertedUsers = allStates.filter(u => u.hasConverted);

    const hotLeadUsers = allStates.filter(u =>
      !u.hasConverted &&
      u.paywallShownCount >= 5
    );

    const warmLeadUsers = allStates.filter(u =>
      !u.hasConverted &&
      u.paywallShownCount >= 2 &&
      u.paywallShownCount < 5
    );

    const coldLeadUsers = allStates.filter(u =>
      !u.hasConverted &&
      u.paywallShownCount < 2
    );

    return res.json({
      success: true,
      data: {
        totalUsers,

        segments: {
          converted: {
            count: convertedUsers.length,
            users: convertedUsers
          },
          hotLeads: {
            count: hotLeadUsers.length,
            users: hotLeadUsers
          },
          warmLeads: {
            count: warmLeadUsers.length,
            users: warmLeadUsers
          },
          coldLeads: {
            count: coldLeadUsers.length,
            users: coldLeadUsers
          }
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};



/**
 * 4️⃣ TOP CONVERTING NOTES
 */
export const getTopConvertingNotes = async (req, res) => {
  try {

    const result = await PaywallEvent.aggregate([
      {
        $match: { eventType: "PAYMENT_SUCCESS" }
      },
      {
        $group: {
          _id: "$noteId",
          conversions: { $sum: 1 }
        }
      },
      { $sort: { conversions: -1 } },
      { $limit: 10 }
    ]);

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

export const getMostPaywalledNotes = async (req, res) => {
  try {

    const data = await PaywallEvent.aggregate([
      {
        $match: {
          eventType: "PAYWALL_SHOWN",
          noteId: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$noteId",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: "notes",
          localField: "_id",
          foreignField: "_id",
          as: "note"
        }
      },
      {
        $unwind: "$note"
      },
      {
        $project: {
          _id: 1,
          count: 1,
          title: "$note.title",
          subject: "$note.subject",
          semester: "$note.semester",
          category: "$note.category"
        }
      }
    ]);

    return res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};