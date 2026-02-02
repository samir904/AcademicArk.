import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js";
import Apperror from "../UTIL/error.util.js";
import cloudinary from "cloudinary";
import fs from "fs/promises"
import { getResetPasswordEmailHtml, sendEmail } from "../UTIL/sendemail.js";
import crypto from "crypto";
import mongoose from "mongoose";
import sessionTracker from "../UTIL/sessionTracker.js";
import { PREDEFINED_COLLEGES, isValidCollege } from "../CONSTANTS/colleges.js";
import asyncWrap from "../UTIL/asyncWrap.js";
import { createLoginLog } from "../services/loginLog.service.js";
import { logUserActivity } from "../UTIL/activityLogger.js";
import { invalidateHomepageCache } from "./homepage.controller.js";
const cookieoptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // True in production (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // None for cross-site
    path: "/",
}

export const register = async (req, res, next) => {

    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return next(new Apperror("All fields are required", 400))
    }

    const userExist = await User.findOne({email});
    if (userExist) {
        return next(new Apperror("Email already registered", 400));
    }

    const user = await User.create({
        fullName,
        email,
        password,
        avatar: {
            public_id: email,
            secure_url: "dummy"
        }
    })

    if (!user) {
        return next(new Apperror("Registration failed please try again!", 500))
    }
    //todo file upload
    if(req.file){
        try{
        const result=await cloudinary.v2.uploader.upload(req.file.path,{
            folder:"AcademicArk",
            width:250,
            height:250,
            gravity:"faces",
            crop:"fill"
        });
        if(result){
            user.avatar.public_id=result.public_id;
            user.avatar.secure_url=result.secure_url;
            await fs.rm(`uploads/${req.file.filename}`);
        }
    }catch(error){
        return next (new Apperror(error.message)||"profile photo not uploaded please try again!",500)
    }
}
    await user.save();
    user.password = undefined;
//✅ LOG SUCCESSFUL LOGIN
    await createLoginLog(user._id, req, 'success');
    // ✅ LOG REGISTRATION ACTIVITY
    await logUserActivity(user._id, "REGISTRATION", {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
    });
    const token = await user.generateJWTToken();
    res.cookie("token", token, cookieoptions);

    res.status(201).json({
        success:true,
        message:`You're all set, ${user.fullName}! Enjoy exploring AcademicArk and all it has to offer.`,
        data:user
    })

}

export const login = async (req, res, next) => {
    const{email,password}=req.body;
    if(!email||!password){
        return next(new Apperror("All fields are required",400))
    }
    const user=await User.findOne({email})
    .select('+password')

    if(!user){
        return next(new Apperror("email id is not registered  please try again!",400));
    }
    if(!user||!await user.comparePassword(password)){
        return next(new Apperror("email or password does not match please try again!",400))
    }
    const token=await user.generateJWTToken();
    user.password=undefined;
    res.cookie("token",token,cookieoptions)
// ✅ LOG SUCCESSFUL LOGIN
    await createLoginLog(user._id, req, 'success');
    // ✅ LOG LOGIN ACTIVITY
    await logUserActivity(user._id, "LOGIN", {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
    });
    res.status(200).json({
        success:true,
        message:`Welcome back! ${user.fullName} 🎉`,
        data:user
    })
}
export const logout = async (req, res, next) => {
    try {
        // ✅ Get token to check if user was logged in
        const { token } = req.cookies;
        
        // If token exists, try to decode and remove session
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                sessionTracker.removeSession(decoded.id);
            } catch (error) {
                // Token invalid but still clear cookie
                console.log('Invalid token during logout, clearing anyway');
            }
        }
        
        // ✅ Always clear cookie (even if token was invalid)
        res.clearCookie('token', {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
            path: "/"
        });
        
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        return next(new Apperror(error.message || "Logout failed", 500));
    }
};



// // Add this to your auth controller
// export const validateToken = async (req, res, next) => {
//     try {
//         const { token } = req.body;
        
//         if (!token) {
//             return next(new Apperror("Token is required", 400));
//         }

//         // Verify the token
//         const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
        
//         // Get user data
//         const user = await User.findById(userDetails.id).select('-password');
        
//         if (!user) {
//             return next(new Apperror("User not found", 404));
//         }

//         // Set the cookie for future requests
//         res.cookie("token", token, cookieOptions);

//         res.status(200).json({
//             success: true,
//             message: `Welcome back! ${user.fullName} 🎉`,
//             data: user
//         });
//     } catch (error) {
//         return next(new Apperror("Invalid token", 401));
//     }
// };


export const getProfile = async (req, res, next) => {
    const userid=req.user.id;
    const user=await User.findById(userid);
    if(!user){
        return next(new Apperror("operation failed please try again!"))
    }
    res.status(200).json({
        success:true,
        message:'Your details',
        data:user
    })

}


export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new Apperror('Email is required', 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new Apperror('Email not registered please try again!', 400));
  }

  try {
    const resetToken = await user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const subject = 'Password Reset Request';

    const message = getResetPasswordEmailHtml(resetPasswordUrl);

    await sendEmail(email, subject, message);

    res.status(200).json({
      success: true,
      message: `Reset password link sent to ${email} successfully`,
    });
  } catch (error) {
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new Apperror('Failed to send reset password email please try again!', 500));
  }
};

export const resetPassword = async (req, res, next) => {
    const{resetToken}=req.params;
    const{password}=req.body;
    if(!password){
        return next(new Apperror("Password is required",400))
    }
    const forgotPasswordToken=crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

    const user=await User.findOne({
        forgotPasswordToken,
        forgotPasswordExpiry:{$gt:Date.now()},
    })
    if(!user){
        return next(new Apperror("Link is broken or expired please try again!",400))
    }
    user.password=password;
    user.forgotPasswordToken=undefined;
    user.forgotPasswordExpiry=undefined;

    await user.save();

    res.status(200).json({
        success:true,
        message:"Password changed successfully"
    })
}

export const changePassword = async (req, res, next) => {
    const{oldPassword,newPassword}=req.body;
    const userId=req.user.id;
    if(!oldPassword||!newPassword){
        return next(new Apperror("All fields are required",400))
    }
    const user=await User.findById(userId).select('+password');
    if(!user){
        return next(new Apperror("user not exist",400))
    }

    const isValidPassword=await user.comparePassword(oldPassword);
    if(!isValidPassword){
        return next(new Apperror("Invalid old password",400))
    }
    user.password=newPassword;
    await user.save();
    user.password=undefined;

    res.status(200).json({
        success:true,
        message:"password changed successfully",

    })
}

export const updateProfile = async (req, res, next) => {
    const{fullName}=req.body;
    if(!fullName){
        return next(new Apperror("Full name is required",400))
    }
    const userId=req.user.id;
    const user=await User.findById(userId);
    if(!user){
        return next(new Apperror("user not found please try again",400))
    }
    if(fullName){
        user.fullName=fullName;
    }
    if(req.file){
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        try{
            const result=await cloudinary.v2.uploader.upload(req.file.path,{
                folder:"AcademicArk",
                width:250,
                height:250,
                gravity:"faces",
                crop:"fill"
            })
            if(result){
                user.avatar.public_id=result.public_id;
                user.avatar.secure_url=result.secure_url;
                await fs.rm(`uploads/${req.file.filename}`)
            }
        }catch(error){
            return next(new Apperror(error.message||"failed to upload avatar please try again!",500))
        }
    }
    await user.save();

    res.status(200).json({
        success:true,
        message:"Profile updated successfully!",
        data:user
    })
}

export const getMyAnalytics = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [myNotes, myBookmarks, myRatings] = await Promise.all([
            Note.find({ uploadedBy: userId }).populate('rating.user', 'fullName'),
            Note.find({ bookmarkedBy: userId }).select('title subject createdAt'),
            Note.find({ 'rating.user': userId }).select('title rating')
        ]);

        // Calculate total downloads
        const totalDownloads = myNotes.reduce((sum, note) => sum + note.downloads, 0);
        
        // Calculate average rating for my notes
        const avgRating = myNotes.reduce((sum, note) => {
            const noteAvg = note.rating.length > 0 
                ? note.rating.reduce((s, r) => s + r.rating, 0) / note.rating.length 
                : 0;
            return sum + noteAvg;
        }, 0) / (myNotes.length || 1);

        // Subject-wise breakdown
        const subjectStats = myNotes.reduce((acc, note) => {
            const subject = note.subject.toLowerCase();
            if (!acc[subject]) {
                acc[subject] = { count: 0, downloads: 0, avgRating: 0 };
            }
            acc[subject].count += 1;
            acc[subject].downloads += note.downloads;
            
            const noteRating = note.rating.length > 0 
                ? note.rating.reduce((s, r) => s + r.rating, 0) / note.rating.length 
                : 0;
            acc[subject].avgRating = (acc[subject].avgRating + noteRating) / acc[subject].count;
            
            return acc;
        }, {});

        // Category-wise breakdown
        const categoryStats = myNotes.reduce((acc, note) => {
            acc[note.category] = (acc[note.category] || 0) + 1;
            return acc;
        }, {});

        // Monthly upload trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlyStats = await Note.aggregate([
            { 
                $match: { 
                    uploadedBy: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    downloads: { $sum: '$downloads' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Top performing notes
        const topNotes = myNotes
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 5)
            .map(note => ({
                id: note._id,
                title: note.title,
                downloads: note.downloads,
                rating: note.rating.length > 0 
                    ? (note.rating.reduce((s, r) => s + r.rating, 0) / note.rating.length).toFixed(1)
                    : 0,
                bookmarks: note.bookmarkedBy.length
            }));

        // Recent activity
        const recentActivity = [
            ...myNotes.slice(0, 3).map(note => ({
                type: 'upload',
                title: note.title,
                date: note.createdAt,
                data: { downloads: note.downloads }
            })),
            ...myBookmarks.slice(0, 3).map(note => ({
                type: 'bookmark',
                title: note.title,
                date: note.createdAt,
                data: {}
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

        res.status(200).json({
            success: true,
            message: 'User analytics retrieved successfully',
            data: {
                overview: {
                    totalNotes: myNotes.length,
                    totalBookmarks: myBookmarks.length,
                    totalDownloads,
                    avgRating: avgRating.toFixed(1),
                    totalRatingsGiven: myRatings.length
                },
                subjectStats,
                categoryStats,
                monthlyStats,
                topNotes,
                recentActivity,
                insights: {
                    mostPopularSubject: Object.keys(subjectStats).reduce((a, b) => 
                        subjectStats[a].count > subjectStats[b].count ? a : b, 
                        Object.keys(subjectStats)[0] || 'None'
                    ),
                    bestPerformingCategory: Object.keys(categoryStats).reduce((a, b) => 
                        categoryStats[a] > categoryStats[b] ? a : b, 
                        Object.keys(categoryStats)[0] || 'None'
                    )
                }
            }
        });
    } catch (error) {
        console.error('User analytics error:', error);
        return next(new Apperror('Failed to get user analytics', 500));
    }
};

// Get user's uploaded notes
export const getMyNotes = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const myNotes = await Note.find({ uploadedBy: userId })
            .populate('rating.user', 'fullName avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalNotes = await Note.countDocuments({ uploadedBy: userId });

        res.status(200).json({
            success: true,
            message: 'User notes retrieved successfully',
            data: {
                notes: myNotes,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalNotes / limit),
                    totalNotes
                }
            }
        });
    } catch (error) {
        console.error('Get my notes error:', error);
        return next(new Apperror('Failed to get user notes', 500));
    }
};

// Get user's bookmarks
export const getMyBookmarks = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const bookmarkedNotes = await Note.find({ bookmarkedBy: userId })
            .populate('uploadedBy', 'fullName avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalBookmarks = await Note.countDocuments({ bookmarkedBy: userId });

        res.status(200).json({
            success: true,
            message: 'User bookmarks retrieved successfully',
            data: {
                notes: bookmarkedNotes,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalBookmarks / limit),
                    totalBookmarks
                }
            }
        });
    } catch (error) {
        console.error('Get bookmarks error:', error);
        return next(new Apperror('Failed to get user bookmarks', 500));
    }
};

//get public profile 
export const getPublicProfile=async(req,res,next)=>{
    const{userId}=req.params;

    if(!userId){
        return next(new Apperror("User id is required",400));
    }
    const user=await User.findById(userId).select(
        'fullName avatar role bio socialLinks isProfilePublic createdAt academicProfile'
    ); // ✨ NEW LINE
    if(!user.isProfilePublic){
        return next(new Apperror('This profile is private',403))
    }
    //get user's uploaded notes count (only for teachers/admin)
    let notesCount=0;
    if(user.role==='TEACHER'||user.role==='ADMIN'){
        notesCount=await Note.countDocuments({uploadedBy:userId});
    }

    res.status(200).json({
        success:true,
        data:{
            ...user.toObject(),
            notesCount
        }
    })
}

//update social links 
export const updateSocialLinks=async(req,res,next)=>{
    const { bio, github, linkedin, twitter, website } = req.body;
    const userId = req.user.id;

    const updateData = {};

    if (bio !== undefined) updateData.bio = bio;
    if (github !== undefined) updateData['socialLinks.github'] = github;
    if (linkedin !== undefined) updateData['socialLinks.linkedin'] = linkedin;
    if (twitter !== undefined) updateData['socialLinks.twitter'] = twitter;
    if (website !== undefined) updateData['socialLinks.website'] = website;

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).select('-password');

    if(!user){
        return next(new Apperror('user not found',404))
    }

    res.status(200).json({
        success: true,
        message: 'Social profile updated successfully',
        data: user
    })
}

//toggle profile visibility
export const toggleProfileVisibility=async(req,res,next)=>{
    const userId=req.user.id;
    
    const user=await User.findById(userId);

    if(!user){
        return next(new Apperror('User not found',404))
    }

    user.isProfilePublic = !user.isProfilePublic;
    await user.save();

    res.status(200).json({
        success: true,
        message: `Profile is now ${user.isProfilePublic ? 'public' : 'private'}`,
        data: { isProfilePublic: user.isProfilePublic }
    });
}
// ✅ UPDATE ACADEMIC PROFILE - UPDATED
export const updateAcademicProfile = asyncWrap(async (req, res, next) => {
    const { semester, college, customCollege, branch } = req.body;
    const userId = req.user.id;

    // ✨ Validation
    if (!semester) {
        return next(new Apperror('Semester is required', 400));
    }

    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(semester)) {
        return next(new Apperror('Invalid semester. Must be between 1 and 8', 400));
    }

    if (!branch) {
        return next(new Apperror('Branch is required', 400));
    }

    const validBranches = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "CHEMICAL", "BIOTECH", "OTHER"];
    if (!validBranches.includes(branch)) {
        return next(new Apperror(`Invalid branch. Must be one of: ${validBranches.join(', ')}`, 400));
    }

    // ✨ UPDATED: Handle college selection
    let collegeName = "";
    let isPredefined = false;
    let isApproved = true;

    // Case 1: User selected a predefined college
    if (college && college !== "Other") {
        if (!PREDEFINED_COLLEGES.includes(college)) {
            return next(new Apperror('Invalid college selected', 400));
        }
        collegeName = college;
        isPredefined = true;
        isApproved = true;
    }
    // Case 2: User selected "Other" and provided custom college name
    else if (college === "Other" && customCollege) {
        if (!customCollege.trim()) {
            return next(new Apperror('Please enter your college name', 400));
        }
        if (customCollege.trim().length > 100) {
            return next(new Apperror('College name must be less than 100 characters', 400));
        }
        collegeName = customCollege.trim();
        isPredefined = false;
        isApproved = false; // ✨ Needs admin approval for custom colleges
    }
    // Case 3: No valid college provided
    else {
        return next(new Apperror('Please select or enter a college name', 400));
    }

    // ✨ Update user academic profile
    const user = await User.findByIdAndUpdate(
        userId,
        {
            "academicProfile.semester": semester,
            "academicProfile.college.name": collegeName,
            "academicProfile.college.isPredefined": isPredefined,
            "academicProfile.college.isApproved": isApproved,
            "academicProfile.branch": branch,
            "academicProfile.isCompleted": true,
            "academicProfile.lastUpdated": new Date()
        },
        { new: true, runValidators: true }
    );
    if (!user) {
        return next(new Apperror('User not found', 404));
    }
     // ✨ Invalidate homepage cache
        await invalidateHomepageCache(userId);
try {
        await logUserActivity(userId, "PROFILE_COMPLETED", {
            resourceType: "USER_PROFILE",
            metadata: {
                semester: semester,
                college: collegeName,
                branch: branch,
                isPredefined: isPredefined,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID
            }
        });
    } catch (error) {
        console.error('Error logging profile completion:', error);
        // Don't fail the request if logging fails
    }
    res.status(200).json({
        success: true,
        message: isPredefined 
            ? 'Academic profile updated successfully'
            : 'Academic profile submitted! Our team will verify your college information soon.',
        data: {
            academicProfile: user.academicProfile,
            fullName: user.fullName,
            email: user.email
        }
    });
});

// ✅ GET ACADEMIC PROFILE - SAME
export const getAcademicProfile = asyncWrap(async (req, res, next) => {
    const userId = req.user.id;

    const user = await User.findById(userId).select('academicProfile fullName email');

    if (!user) {
        return next(new Apperror('User not found', 404));
    }

    res.status(200).json({
        success: true,
        data: user.academicProfile
    });
});

// ✅ CHECK PROFILE COMPLETION - SAME
export const checkProfileCompletion = asyncWrap(async (req, res, next) => {
    const userId = req.user.id;

    const user = await User.findById(userId).select('academicProfile');

    res.status(200).json({
        success: true,
        data: {
            isCompleted: user?.academicProfile?.isCompleted || false,
            academicProfile: user?.academicProfile || null
        }
    });
});

// ✅ NEW: GET COLLEGE LIST - For frontend
export const getCollegeList = asyncWrap(async (req, res, next) => {
    const collegeList = PREDEFINED_COLLEGES.map(college => ({
        value: college,
        label: college,
        isPredefined: college !== "Other"
    }));

    res.status(200).json({
        success: true,
        data: collegeList
    });
});

// ✅ UPDATED: Analytics to handle new college structure
export const getAcademicAnalytics = asyncWrap(async (req, res, next) => {
    try {
        const completedProfiles = await User.countDocuments({ 'academicProfile.isCompleted': true });
        const totalUsers = await User.countDocuments();

        // Semester distribution
        const semesterDistribution = await User.aggregate([
            { $match: { 'academicProfile.isCompleted': true } },
            { $group: { 
                _id: '$academicProfile.semester', 
                count: { $sum: 1 } 
            }},
            { $sort: { _id: 1 } }
        ]);

        // ✨ UPDATED: College distribution (now using college.name)
        const collegeDistribution = await User.aggregate([
            { $match: { 'academicProfile.isCompleted': true } },
            { $group: { 
                _id: '$academicProfile.college.name', 
                count: { $sum: 1 },
                isPredefined: { $first: '$academicProfile.college.isPredefined' },
                isApproved: { $first: '$academicProfile.college.isApproved' }
            }},
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);

        // ✨ NEW: Pending custom colleges (needs approval)
        const pendingCustomColleges = await User.aggregate([
            { $match: { 
                'academicProfile.isCompleted': true,
                'academicProfile.college.isPredefined': false,
                'academicProfile.college.isApproved': false
            }},
            { $group: { 
                _id: '$academicProfile.college.name', 
                count: { $sum: 1 } 
            }},
            { $sort: { count: -1 } }
        ]);

        // Branch distribution
        const branchDistribution = await User.aggregate([
            { $match: { 'academicProfile.isCompleted': true } },
            { $group: { 
                _id: '$academicProfile.branch', 
                count: { $sum: 1 } 
            }},
            { $sort: { count: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                profileCompletionStats: {
                    completed: completedProfiles,
                    total: totalUsers,
                    percentage: Math.round((completedProfiles / totalUsers) * 100)
                },
                semesterDistribution: semesterDistribution.map(item => ({
                    semester: item._id,
                    count: item.count
                })),
                collegeDistribution: collegeDistribution.map(item => ({
                    college: item._id,
                    count: item.count,
                    isPredefined: item.isPredefined,
                    isApproved: item.isApproved
                })),
                pendingCustomColleges: pendingCustomColleges.map(item => ({
                    college: item._id,
                    count: item.count,
                    status: 'pending_approval'
                })),
                branchDistribution: branchDistribution.map(item => ({
                    branch: item._id,
                    count: item.count
                }))
            }
        });
    } catch (error) {
        return next(new Apperror('Failed to fetch analytics', 500));
    }
});

// ✨ ADMIN: Approve custom colleges
export const approveCustomCollege = asyncWrap(async (req, res, next) => {
    const { collegeName } = req.body;

    if (!collegeName || !collegeName.trim()) {
        return next(new Apperror('College name is required', 400));
    }

    // Update all users with this custom college
    const result = await User.updateMany(
        { 
            'academicProfile.college.name': collegeName.trim(),
            'academicProfile.college.isPredefined': false,
            'academicProfile.college.isApproved': false
        },
        {
            $set: { 'academicProfile.college.isApproved': true }
        }
    );

    res.status(200).json({
        success: true,
        message: `College "${collegeName}" approved for ${result.modifiedCount} users`,
        data: {
            modifiedCount: result.modifiedCount
        }
    });
});

import SystemFlag from "../MODELS/systemFlag.model.js";

// ✅ ADMIN ONLY — INCREMENT SEMESTER ONCE
export const incrementSemesterOnce = asyncWrap(async (req, res, next) => {
  const FLAG_KEY = "SEMESTER_INCREMENT_2026";

  // 🔒 1. Check if already executed
  const flag = await SystemFlag.findOne({ key: FLAG_KEY });

  if (flag?.value === true) {
    return next(
      new Apperror(
        "Semester increment has already been executed. This action is locked.",
        409
      )
    );
  }

  // 🧠 2. Find eligible users
  const users = await User.find({
    "academicProfile.isCompleted": true,
    "academicProfile.semester": { $gte: 1, $lte: 7 }
  }).select("_id academicProfile.semester");

  if (users.length === 0) {
    return next(new Apperror("No eligible users found", 400));
  }

  // 🔁 3. Increment semester safely
  const bulkOps = users.map((user) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        $inc: { "academicProfile.semester": 1 },
        $set: { "academicProfile.lastUpdated": new Date() }
      }
    }
  }));

  const result = await User.bulkWrite(bulkOps);

  // 🔐 4. Lock execution forever
  await SystemFlag.findOneAndUpdate(
    { key: FLAG_KEY },
    { value: true, updatedAt: new Date() },
    { upsert: true }
  );

  // 🔄 5. Invalidate homepage cache (VERY IMPORTANT)
  const userIds = users.map(u => u._id.toString());
  for (const id of userIds) {
    await invalidateHomepageCache(id);
  }

  res.status(200).json({
    success: true,
    message: "Semester incremented successfully for eligible users",
    data: {
      affectedUsers: users.length,
      modifiedCount: result.modifiedCount
    }
  });
});

export const getDownloadQuota = async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.access) {
    return res.json({
      success: true,
      dailyLimit: 3,
      downloadsToday: 0,
      remaining: 3
    });
  }

  const now = new Date();
  const access = user.access;

  // reset logic
  if (
    !access.lastDownloadDate ||
    new Date(access.lastDownloadDate).toDateString() !== now.toDateString()
  ) {
    access.downloadsToday = 0;
  }

  return res.json({
    success: true,
    dailyLimit: access.dailyDownloadLimit,
    downloadsToday: access.downloadsToday,
    remaining: Math.max(
      access.dailyDownloadLimit - access.downloadsToday,
      0
    ),
    resetAt: access.resetAt || null
  });
};
