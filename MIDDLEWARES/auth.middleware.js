import jwt from "jsonwebtoken";
import Apperror from "../UTIL/error.util.js";
import sessionTracker from "../UTIL/sessionTracker.js";


export const isLoggedInViaQuery = async (req, res, next) => {
  try {
    // ✅ Token comes from ?token= query param (sendBeacon can't set headers)
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // same shape as your normal isLoggedIn
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ✨ NEW: Optional authentication (doesn't require login)
export const optionalAuth = async (req, res, next) => {
  try {
    // console.log('🔓 optionalAuth middleware checking...');
    let token;

    // ✅ Try Authorization header FIRST
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      // console.log('✅ Token from Authorization header');
    }
    // ✅ Try cookie as FALLBACK
    else if (req.cookies.token) {
      token = req.cookies.token;
      // console.log('✅ Token from cookie');
    }

    if (!token) {
      // console.log('⚠️ No token - allowing as guest');
      req.user = null;
      return next();
    }

    try {
      const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: userDetails.id,
        email: userDetails.email,
        semester: userDetails.semester,  // ⭐ ADD THIS
        ...userDetails
      };
      // console.log('✅ optionalAuth verified:', userDetails.email);
      next();
    } catch (error) {
      // console.log('⚠️ optionalAuth token invalid - treating as guest');
      req.user = null;// 👈 invalid/expired token — treat as anonymous, don't reject
      next();
    }
  } catch (error) {
    // console.error('❌ optionalAuth error:', error.message);
    req.user = null;
    next();
  }
};
// ✅ Optional authentication for logout
// export const optionalAuthForLogout = async (req, res, next) => {
//     try {
//         const { token } = req.cookies;
        
//         if (!token) {
//             // No token? Just proceed to logout
//             req.user = null;
//             return next();
//         }

//         // Token exists? Verify it
//         const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
//         req.user = userDetails;
//         next();
//     } catch (error) {
//         // Invalid token? Still allow logout
//         req.user = null;
//         next();
//     }
// };

export const optionalAuthForLogout = async (req, res, next) => {
  try {
    // console.log('🔓 optionalAuthForLogout middleware checking...');
    let token;

    // ✅ Try Authorization header FIRST
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      // console.log('✅ Token from Authorization header');
    }
    // ✅ Try cookie as FALLBACK
    else if (req.cookies.token) {
      token = req.cookies.token;
      // console.log('✅ Token from cookie');
    }

    if (!token) {
      // console.log('⚠️ No token - allowing logout');
      req.user = null;
      return next();
    }

    try {
      const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
      req.user = userDetails;
      // console.log('✅ optionalAuthForLogout verified:', userDetails.email);
      next();
    } catch (error) {
      // console.log('⚠️ optionalAuthForLogout token invalid');
      req.user = null;
      next();
    }
  } catch (error) {
    console.error('❌ optionalAuthForLogout error:', error.message);
    req.user = null;
    next();
  }
};


// export const isLoggedIn=async(req,res,next)=>{
//     const{token}=req.cookies;
//     if(!token){
//         return next(new Apperror("cookie not found please login again",400))
//     }
//     const userdetails=await jwt.verify(token,process.env.JWT_SECRET);
//     req.user=userdetails;

//     // Track user activity
//     sessionTracker.recordActivity(userdetails.id);
    
//     next();
// };

// export const isLoggedIn = async (req, res, next) => {
//     try {
//         const { token } = req.cookies;
        
//         // ✅ Better: Check if token exists
//         if (!token) {
//             return next(new Apperror(
//                 "Session expired. Please login again.",  // ← Better message
//                 401  // ← Use 401 (Unauthorized) not 400
//             ));
//         }

//         try {
//             // ✅ Verify token
//             const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
//             req.user = userDetails;
            
//             // Track user activity
//             sessionTracker.recordActivity(userDetails.id);
            
//             next();
//         } catch (tokenError) {
//             // ✅ Handle different token errors
//             if (tokenError.name === 'TokenExpiredError') {
//                 // Token expired
//                 res.clearCookie('token', {
//                     secure: process.env.NODE_ENV === "production",
//                     httpOnly: true,
//                     sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
//                     path: "/"
//                 });
//                 return next(new Apperror(
//                     "Your session has expired. Please login again.",
//                     401
//                 ));
//             } else if (tokenError.name === 'JsonWebTokenError') {
//                 // Invalid token
//                 return next(new Apperror(
//                     "Invalid session. Please login again.",
//                     401
//                 ));
//             } else {
//                 // Other errors
//                 return next(new Apperror(
//                     "Authentication failed. Please login again.",
//                     401
//                 ));
//             }
//         }
//     } catch (error) {
//         return next(new Apperror(
//             "Authentication error. Please try again.",
//             500
//         ));
//     }
// };

export const isLoggedIn = async (req, res, next) => {
  try {
    // console.log('🔐 Auth middleware checking...');
    let token;

    // ✅ Try Authorization header first (from frontend) for the google only ok 
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      // console.log('✅ Token from Authorization header');
    }
    // ✅ Try cookie as fallback
    else if (req.cookies.token) {
      token = req.cookies.token;
      // console.log('✅ Token from cookie');
    }

    if (!token) {
      // console.log('❌ No token found in header or cookie');
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    // ✅ Verify JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      sessionTracker.recordActivity(decoded.id);
      // console.log('✅ Token verified:', decoded.email);
      next();
    } catch (error) {
      // console.error('❌ Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please login again.'
    });
  }
};



export const authorizedRoles=(...roles)=>async(req,res,next)=>{
    const currentUserRoles=req.user.role;

    if(!roles.includes(currentUserRoles)){
        return next(new Apperror("You do not have permission to access this route ",403))
    }
    next();
}


