import Payment from "../MODELS/payment.model.js";
import User from "../MODELS/user.model.js";
export const getAllPaymentsAdmin = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    planType
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (planType) query.planType = planType;

  const payments = await Payment.find(query)
    .populate("user", "fullName email academicProfile.semester")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Payment.countDocuments(query);

  res.status(200).json({
    success: true,
    payments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  });
};
export const getPaymentStatsAdmin = async (req, res) => {
  const stats = await Payment.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
      }
    }
  ]);

  const planStats = await Payment.aggregate([
    {
      $match: { status: "SUCCESS" }
    },
    {
      $group: {
        _id: "$planType",
        totalRevenue: { $sum: "$amount" },
        purchases: { $sum: 1 }
      }
    }
  ]);

  const totalRevenue = await Payment.aggregate([
    { $match: { status: "SUCCESS" } },
    { $group: { _id: null, amount: { $sum: "$amount" } } }
  ]);

  res.status(200).json({
    success: true,
    summary: {
      totalRevenue: totalRevenue[0]?.amount || 0,
      statusBreakdown: stats,
      planBreakdown: planStats
    }
  });
};
