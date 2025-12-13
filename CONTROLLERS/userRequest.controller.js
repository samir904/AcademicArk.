import UserRequest from '../MODELS/userRequest.model.js';
import User from '../MODELS/user.model.js';
import Apperror from '../UTIL/error.util.js';
import asyncWrap from '../UTIL/asyncWrap.js';

// ✅ CREATE REQUEST
export const createRequest = asyncWrap(async (req, res, next) => {
  const { requestType, subject, semester, college, branch, description } = req.body;
  const userId = req.user.id;

  // Validation
  if (!requestType || !subject || !semester || !branch) {
    return next(new Apperror('Request type, subject, semester, and branch are required', 400));
  }

  if (!['NOTES', 'PYQ', 'IMPORTANT_QUESTIONS'].includes(requestType)) {
    return next(new Apperror('Invalid request type', 400));
  }

  if (semester < 1 || semester > 8) {
    return next(new Apperror('Semester must be between 1 and 8', 400));
  }

  // Check if similar request exists (prevent duplicates)
  const existingRequest = await UserRequest.findOne({
    requestedBy: userId,
    requestType,
    subject: subject.trim(),
    semester,
    status: { $in: ['PENDING', 'IN_PROGRESS'] }
  });

  if (existingRequest) {
    return next(new Apperror('You already have a pending request for this subject', 400));
  }

  // Create request
  const request = await UserRequest.create({
    requestedBy: userId,
    requestType,
    subject: subject.trim(),
    semester,
    college: college?.trim(),
    branch,
    description: description?.trim()
  });

  // Populate user data
  await request.populate('requestedBy', 'fullName email avatar');

  res.status(201).json({
    success: true,
    message: 'Request submitted successfully! We will notify you when fulfilled.',
    data: request
  });
});

// ✅ GET USER'S OWN REQUESTS
export const getMyRequests = asyncWrap(async (req, res, next) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { requestedBy: userId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const requests = await UserRequest.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('fulfilledBy', 'fullName email')
    .populate('fulfilledNoteId', 'title downloadURL');

  const total = await UserRequest.countDocuments(query);

  res.status(200).json({
    success: true,
    data: requests,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalRequests: total,
      hasMore: skip + requests.length < total
    }
  });
});

// ✅ UPVOTE REQUEST (Users can upvote others' requests)
export const upvoteRequest = asyncWrap(async (req, res, next) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  const request = await UserRequest.findById(requestId);
  if (!request) {
    return next(new Apperror('Request not found', 404));
  }

  // Check if already upvoted
  const hasUpvoted = request.upvotes.includes(userId);

  if (hasUpvoted) {
    // Remove upvote
    request.upvotes = request.upvotes.filter(id => id.toString() !== userId);
    request.upvoteCount -= 1;
  } else {
    // Add upvote
    request.upvotes.push(userId);
    request.upvoteCount += 1;
  }

  await request.save();

  res.status(200).json({
    success: true,
    message: hasUpvoted ? 'Upvote removed' : 'Request upvoted',
    data: {
      upvoteCount: request.upvoteCount,
      hasUpvoted: !hasUpvoted
    }
  });
});

// ✅ GET ALL REQUESTS (Public - users can see others' requests)
export const getAllRequests = asyncWrap(async (req, res, next) => {
  const { 
    status, 
    requestType, 
    semester, 
    branch, 
    sortBy = 'upvotes', 
    page = 1, 
    limit = 20 
  } = req.query;

  const query = {};
  if (status) query.status = status;
  if (requestType) query.requestType = requestType;
  if (semester) query.semester = parseInt(semester);
  if (branch) query.branch = branch;

  // Default: show pending and in-progress requests
  if (!status) {
    query.status = { $in: ['PENDING', 'IN_PROGRESS'] };
  }

  const skip = (page - 1) * limit;

  // Sort options
  let sortOptions = {};
  if (sortBy === 'upvotes') {
    sortOptions = { upvoteCount: -1, createdAt: -1 };
  } else if (sortBy === 'recent') {
    sortOptions = { createdAt: -1 };
  } else {
    sortOptions = { createdAt: -1 };
  }

  const requests = await UserRequest.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('requestedBy', 'fullName email avatar academicProfile')
    .populate('fulfilledBy', 'fullName')
    .populate('fulfilledNoteId', 'title downloadURL');

  const total = await UserRequest.countDocuments(query);

  res.status(200).json({
    success: true,
    data: requests,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalRequests: total,
      hasMore: skip + requests.length < total
    }
  });
});

// ✅ ADMIN: GET ALL REQUESTS
export const getAdminRequests = asyncWrap(async (req, res, next) => {
  const { status, page = 1, limit = 20, search } = req.query;

  const query = {};
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const requests = await UserRequest.find(query)
    .sort({ upvoteCount: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('requestedBy', 'fullName email avatar academicProfile')
    .populate('fulfilledBy', 'fullName email')
    .populate('fulfilledNoteId', 'title downloadURL');

  const total = await UserRequest.countDocuments(query);

  // Get stats
  const stats = await UserRequest.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statusStats = {
    PENDING: 0,
    IN_PROGRESS: 0,
    FULFILLED: 0,
    REJECTED: 0
  };
  stats.forEach(s => {
    statusStats[s._id] = s.count;
  });

  res.status(200).json({
    success: true,
    data: requests,
    stats: statusStats,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalRequests: total,
      hasMore: skip + requests.length < total
    }
  });
});

// ✅ ADMIN: UPDATE REQUEST STATUS
export const updateRequestStatus = asyncWrap(async (req, res, next) => {
  const { requestId } = req.params;
  const { status, adminNotes, fulfilledNoteId, priority } = req.body;
  const adminId = req.user.id;

  const request = await UserRequest.findById(requestId);
  if (!request) {
    return next(new Apperror('Request not found', 404));
  }

  // Update fields
  if (status) request.status = status;
  if (adminNotes) request.adminNotes = adminNotes;
  if (priority) request.priority = priority;

  if (status === 'FULFILLED') {
    request.fulfilledBy = adminId;
    request.fulfilledAt = new Date();
    if (fulfilledNoteId) {
      request.fulfilledNoteId = fulfilledNoteId;
    }
  }

  await request.save();

  await request.populate('requestedBy', 'fullName email');
  await request.populate('fulfilledNoteId', 'title downloadURL');

  res.status(200).json({
    success: true,
    message: 'Request updated successfully',
    data: request
  });
});

// ✅ ADMIN: DELETE REQUEST
export const deleteRequest = asyncWrap(async (req, res, next) => {
  const { requestId } = req.params;

  const request = await UserRequest.findByIdAndDelete(requestId);
  if (!request) {
    return next(new Apperror('Request not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Request deleted successfully'
  });
});

// ✅ GET REQUEST ANALYTICS
export const getRequestAnalytics = asyncWrap(async (req, res, next) => {
  const { days = 30 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const analytics = await UserRequest.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $facet: {
        byType: [
          {
            $group: {
              _id: '$requestType',
              count: { $sum: 1 }
            }
          }
        ],
        bySemester: [
          {
            $group: {
              _id: '$semester',
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ],
        byBranch: [
          {
            $group: {
              _id: '$branch',
              count: { $sum: 1 }
            }
          }
        ],
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ],
        topSubjects: [
          {
            $group: {
              _id: '$subject',
              count: { $sum: 1 },
              avgUpvotes: { $avg: '$upvoteCount' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        mostUpvoted: [
          { $sort: { upvoteCount: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: 'requestedBy',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' }
        ]
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: analytics[0]
  });
});
