import jwt from "jsonwebtoken";
import Apperror from "../UTIL/error.util.js";
import sessionTracker from "../UTIL/sessionTracker.js";

// ✨ NEW: Optional authentication (doesn't require login)
export const optionalAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    
    if (!token) {
      // ✨ No token? Set req.user to null and continue
      req.user = null;
      return next();
    }

    // Token exists? Verify it
    const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: userDetails.id,      // ✨ Make sure id exists!
      email: userDetails.email,
      ...userDetails
    };;
    next();
  } catch (error) {
    // Invalid token? Treat as guest
    req.user = null;
    next();
  }
};

export const isLoggedIn = async (req, res, next) => {
    // ✨ SOLUTION: Check multiple sources for token
    let token = req.cookies.token;
    
    // Fallback: Check Authorization header
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    // Fallback: Check body for token (for POST requests)
    if (!token && req.body.token) {
        token = req.body.token;
    }

    if (!token) {
        return next(new Apperror("Authentication required. Please login again.", 401));
    }

    try {
        const userdetails = await jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
      id: userdetails.id,      // ✨ Make sure id exists!
      email: userdetails.email,
      ...userdetails
    };

        // Track user activity
        sessionTracker.recordActivity(userdetails.id);
        
        next();
    } catch (error) {
        return next(new Apperror("Invalid or expired token. Please login again.", 401));
    }
}

export const authorizedRoles=(...roles)=>async(req,res,next)=>{
    const currentUserRoles=req.user.role;

    if(!roles.includes(currentUserRoles)){
        return next(new Apperror("You do not have permission to access this route ",403))
    }
    next();
}


