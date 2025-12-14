import Feedback from "../MODELS/feedback.model.js";
import User from "../MODELS/user.model.js";
import cloudinary from "cloudinary";


// ✅ SUBMIT FEEDBACK
export const submitFeedback = async (req, res) => {
    try {
        const { feedbackType, subject, message, rating, page } = req.body;
        const userId = req.user.id;


        // Validation
        if (!feedbackType || !subject || !message || !rating) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }


        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }


        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // Handle file uploads
        let attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await cloudinary.v2.uploader.upload(file.path, {
                    folder: "AcademicArk/Feedback",
                    resource_type: "auto"
                });
                attachments.push({
                    public_id: result.public_id,
                    secure_url: result.secure_url,
                    fileName: file.originalname
                });
            }
        }


        // Create feedback
        const feedback = await Feedback.create({
            userId,
            feedbackType,
            subject,
            message,
            rating,
            attachments,
            page,
            userAgent: req.headers["user-agent"],
            userSnapshot: {
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                branch: user.academicProfile?.branch,
                semester: user.academicProfile?.semester,
                college: user.academicProfile?.college?.name
            }
        });


        res.status(201).json({
            success: true,
            message: "Thank you for your feedback! We'll review it shortly.",
            data: feedback
        });


    } catch (error) {
        console.error("Feedback submission error:", error);
        res.status(500).json({
            success: false,
            message: "Error submitting feedback",
            error: error.message
        });
    }
};


// ✅ GET USER'S FEEDBACK
export const getUserFeedback = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;


        const feedbacks = await Feedback.find({ userId })
            .select("-attachments")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);


        const total = await Feedback.countDocuments({ userId });


        res.status(200).json({
            success: true,
            data: feedbacks,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalFeedbacks: total
            }
        });


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching feedback",
            error: error.message
        });
    }
};


// ✅ GET SINGLE FEEDBACK
export const getFeedbackById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;


        const feedback = await Feedback.findById(id)
            .populate("userId", "fullName email")
            .populate("adminResponse.respondedBy", "fullName");


        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: "Feedback not found"
            });
        }


        if (feedback.userId.toString() !== userId && req.user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to view this feedback"
            });
        }


        res.status(200).json({
            success: true,
            data: feedback
        });


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching feedback",
            error: error.message
        });
    }
};


// ✅ ADMIN: GET ALL FEEDBACK - FIXED
export const getAllFeedback = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20,
            feedbackType,
            status,
            rating,
            sortBy = "createdAt"
        } = req.query;


        // Build filter
        let filter = {};
        if (feedbackType) filter.feedbackType = feedbackType;
        if (status) filter.status = status;
        if (rating) filter.rating = parseInt(rating);


        console.log('🔍 Filter object:', filter);


        const feedbacks = await Feedback.find(filter)
            .select("-attachments")
            .populate("userId", "fullName email")
            .sort({ [sortBy]: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);


        const total = await Feedback.countDocuments(filter);
        console.log('🔍 Total documents matching filter:', total);


        // Calculate stats with filter
        const stats = await Feedback.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$feedbackType",
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('🔍 Stats result:', stats);


        // ✅ FIXED: Average rating - GET ALL RATINGS (no filter)
        const avgRatingResult = await Feedback.aggregate([
            {
                $group: {
                    _id: null,
                    avg: { $avg: "$rating" }
                }
            }
        ]);

        // ✅ FIXED: Access array index [0] correctly
        const avgRating = avgRatingResult[0]?.avg || 0;

        console.log('🔍 avgRating result:', avgRatingResult);
        console.log('🔍 avgRating value:', avgRating);


        res.status(200).json({
            success: true,
            data: feedbacks,
            stats: stats,
            avgRating: avgRating,  // ✅ NOW RETURNS NUMBER
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalFeedbacks: total
            }
        });


    } catch (error) {
        console.error("❌ Error in getAllFeedback:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching feedback",
            error: error.message
        });
    }
};


// ✅ ADMIN: UPDATE FEEDBACK STATUS
export const updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const adminId = req.user.id;


        const feedback = await Feedback.findByIdAndUpdate(
            id,
            {
                status,
                "adminResponse.respondedBy": adminId,
                "adminResponse.response": adminResponse,
                "adminResponse.respondedAt": new Date()
            },
            { new: true }
        );


        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: "Feedback not found"
            });
        }


        res.status(200).json({
            success: true,
            message: "Feedback status updated",
            data: feedback
        });


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating feedback",
            error: error.message
        });
    }
};


// ✅ GET FEEDBACK ANALYTICS - FIXED
export const getFeedbackAnalytics = async (req, res) => {
    try {
        // Total feedback count
        const totalFeedback = await Feedback.countDocuments();


        // By type
        const byType = await Feedback.aggregate([
            {
                $group: {
                    _id: "$feedbackType",
                    count: { $sum: 1 }
                }
            }
        ]);


        // By status
        const byStatus = await Feedback.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);


        // By rating distribution
        const byRating = await Feedback.aggregate([
            {
                $group: {
                    _id: "$rating",
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);


        // ✅ FIXED: Average rating - access array index correctly
        const avgRatingResult = await Feedback.aggregate([
            {
                $group: {
                    _id: null,
                    avg: { $avg: "$rating" }
                }
            }
        ]);

        const avgRating = avgRatingResult[0]?.avg || 0;


        // Recent 7 days
        const last7Days = await Feedback.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);


        res.status(200).json({
            success: true,
            data: {
                totalFeedback,
                byType,
                byStatus,
                byRating,
                avgRating: avgRating,  // ✅ FIXED: Returns number, not object
                last7Days
            }
        });


    } catch (error) {
        console.error("Analytics error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching analytics",
            error: error.message
        });
    }
};


// ✅ DELETE FEEDBACK
export const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;


        const feedback = await Feedback.findById(id);


        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: "Feedback not found"
            });
        }


        if (feedback.userId.toString() !== userId && req.user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this feedback"
            });
        }


        // Delete attachments from cloudinary
        if (feedback.attachments && feedback.attachments.length > 0) {
            for (const attachment of feedback.attachments) {
                await cloudinary.v2.uploader.destroy(attachment.public_id);
            }
        }


        await Feedback.findByIdAndDelete(id);


        res.status(200).json({
            success: true,
            message: "Feedback deleted successfully"
        });


    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting feedback",
            error: error.message
        });
    }
};