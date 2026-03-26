// ROUTES/auth.route.js - Fixed with detailed logging

// import { Router } from "express";
// import passport from "passport";
// import jwt from "jsonwebtoken";

// const cookieOptions = {
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
//     path: "/",
// };

// const router = Router();

// // ✅ Test route to verify router is working
// router.get("/test", (req, res) => {
//     console.log('✅ Test route hit');
//     res.json({ success: true, message: "Auth routes working!" });
// });

// // ✅ Initiate Google OAuth
// router.get("/google",
//     (req, res, next) => {
//         console.log('🚀 Google OAuth flow initiated');
//         next();
//     },
//     passport.authenticate("google", {
//         scope: ["profile", "email"],
//         prompt: 'select_account'
//     })
// );

// // ✅ Google OAuth Callback - FIXED with detailed logging
// router.get("/google/callback",
//     (req, res, next) => {
//         console.log('📥 Google callback received');
//         console.log('📋 Query params:', req.query);
//         console.log('🔑 Code present:', !!req.query.code);
//         next();
//     },
//     passport.authenticate("google", {
//         failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
//         session: false  // Use JWT instead of sessions
//     }),
//     (req, res) => {
//         try {
//             console.log('✅ Passport authentication successful');

//             if (!req.user) {
//                 console.error('❌ No user object in request');
//                 return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
//             }

//             console.log('👤 Authenticated user:', req.user.email);

//             // Create JWT token
//             const token = jwt.sign(
//                 {
//                     id: req.user._id,
//                     email: req.user.email,
//                     role: req.user.role
//                 },
//                 process.env.JWT_SECRET,
//                 { expiresIn: process.env.JWT_EXPIRY }
//             );

//             // Set token cookie
//             res.cookie("token", token, cookieOptions);
//             console.log('🍪 Authentication cookie set');

//             // Redirect to frontend with success flag
//             const redirectUrl = `${process.env.FRONTEND_URL}?googleAuth=success`;
//             console.log('🔄 Redirecting to:', redirectUrl);

//             res.redirect(redirectUrl);
//         } catch (error) {
//             console.error("❌ OAuth callback error:", error);
//             res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
//         }
//     }
// );

// export default router;

import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { createLoginLog } from "../services/loginLog.service.js";
import { logUserActivity } from "../UTIL/activityLogger.js";

const router = Router();

// ✅ Initiate Google OAuth
router.get("/google",
    (req, res, next) => {
        console.log('🚀 Google OAuth flow initiated');
        next();
    },
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: 'select_account'
    })
);

// ✅ Google OAuth Callback - SEND TOKEN IN URL
router.get("/google/callback",
    passport.authenticate("google", {
        failureRedirect: '/login?error=auth_failed',
        session: false
    }),
    async (req, res) => {
        try {
            // console.log('✅ Passport authentication successful');
            console.log('👤 User:', req.user.email);

            if (!req.user) {
                console.error('❌ No user in request');
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
            }

            // ✅ Create JWT token
            const token = jwt.sign(
                {
                    id: req.user._id,
                    email: req.user.email,
                    role: req.user.role,
                    fullName: req.user.fullName
                },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // console.log('🔑 JWT token created');
            // ✅ LOG SUCCESSFUL GOOGLE LOGIN
            await createLoginLog(req.user._id, req, 'success');
            // ✅ LOG LOGIN ACTIVITY
            // ✅ LOG GOOGLE LOGIN ACTIVITY
            await logUserActivity(req.user._id, "LOGIN", {
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID,
                authProvider: "GOOGLE"
            });

            // ✅ CRITICAL: Send token in URL (not just cookie)
            const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
            const redirectURL = `${frontendURL}?googleAuth=success&token=${token}&isNewUser=${req.user.isNewUser ? '1' : '0'}`;

            // console.log('🔄 Redirecting with token to:', frontendURL);
            res.redirect(redirectURL);

        } catch (error) {
            console.error('❌ OAuth error:', error.message);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);

export default router;
