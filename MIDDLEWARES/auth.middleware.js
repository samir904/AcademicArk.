import jwt from "jsonwebtoken";
import Apperror from "../UTIL/error.util.js";
import sessionTracker from "../UTIL/sessionTracker.js";

export const isLoggedIn=async(req,res,next)=>{
    const{token}=req.cookies;
    if(!token){
        return next(new Apperror("cookie not found please login again",400))
    }
    const userdetails=await jwt.verify(token,process.env.JWT_SECRET);
    req.user=userdetails;

    // Track user activity
    sessionTracker.recordActivity(userdetails.id);
    
    next();
}

export const authorizedRoles=(...roles)=>async(req,res,next)=>{
    const currentUserRoles=req.user.role;

    if(!roles.includes(currentUserRoles)){
        return next(new Apperror("You do not have permission to access this route ",403))
    }
    next();
}


