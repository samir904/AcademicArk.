import Plan from "../MODELS/plan.model.js";
import Apperror from "../UTIL/error.util.js";


export const getActivePlans = async (req, res) => {
  const plans = await Plan.find({ isActive: true })
    .sort({ sortOrder: 1 });

  res.status(200).json({
    success: true,
    plans
  });
};


export const getAllPlansAdmin = async (req, res) => {
  const plans = await Plan.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "access.plan",
        as: "users"
      }
    },
    {
      $addFields: {
        activeUsers: {
          $size: {
            $filter: {
              input: "$users",
              as: "u",
              cond: {
                $and: [
                  { $ne: ["$$u.access", null] },
                  { $gt: ["$$u.access.expiresAt", new Date()] }
                ]
              }
            }
          }
        }
      }
    },
    {
      $project: {
        users: 0
      }
    },
    {
      $sort: { sortOrder: 1 }
    }
  ]);

  res.status(200).json({
    success: true,
    data: plans
  });
};



export const createPlan = async (req, res, next) => {
  const {
    code,
    name,
    price,
    validityDays
  } = req.body;

  // 🔒 Basic validation
  if (!code || !name || !price || !validityDays) {
    return next(
      new Apperror("Required plan fields are missing", 400)
    );
  }

  // ❌ Prevent duplicate plan codes
  const existing = await Plan.findOne({ code });
  if (existing) {
    return next(
      new Apperror("Plan with this code already exists", 409)
    );
  }

  const plan = await Plan.create(req.body);

  res.status(201).json({
    success: true,
    plan
  });
};


export const updatePlan = async (req, res, next) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return next(
      new Apperror("Plan not found", 404)
    );
  }

  // 🔒 Protect plan code (do NOT allow changing it)
  if (req.body.code && req.body.code !== plan.code) {
    return next(
      new Apperror("Plan code cannot be changed", 400)
    );
  }

  Object.assign(plan, req.body);
  await plan.save();

  res.status(200).json({
    success: true,
    plan
  });
};


export const togglePlanStatus = async (req, res, next) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return next(
      new Apperror("Plan not found", 404)
    );
  }

  plan.isActive = !plan.isActive;
  await plan.save();

  res.status(200).json({
    success: true,
    plan
  });
};
