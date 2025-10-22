import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js";
import Apperror from "../UTIL/error.util.js";
import cloudinary from "cloudinary";
import fs from "fs/promises"
import { getResetPasswordEmailHtml, sendEmail } from "../UTIL/sendemail.js";
import crypto from "crypto";
import mongoose from "mongoose";
import sessionTracker from "../UTIL/sessionTracker.js";
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

    const token = await user.generateJWTToken();
    res.cookie("token", token, cookieoptions);

    res.status(201).json({
        success:true,
        message:"Account created successfully! Welcome to AcademicArk 🎉",
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

    res.status(200).json({
        success:true,
        message:`Welcome back! ${user.fullName} 🎉`,
        data:user
    })
}

export const logout = async (req, res, next) => {
    // ✅ Clear cookie properly with same options used when setting it
    sessionTracker.removeSession(req.user.id);
    res.cookie("token", null, {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 0,
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/"
    });
    res.status(200).json({
        success:true,
        message:"Logged out successfully"
    })
}

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
        'fullName avatar role bio socialLinks isProfilePublic createdAt'
    );
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