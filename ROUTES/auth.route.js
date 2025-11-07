// ROUTES/auth.route.js - Fixed with detailed logging

import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
    // ✨ NEW: Add domain for cross-origin cookies
    domain: process.env.NODE_ENV === "production" ? ".academicark.onrender.com" : undefined

};

const router = Router();

// ✅ Test route to verify router is working
router.get("/test", (req, res) => {
    console.log('✅ Test route hit');
    res.json({ success: true, message: "Auth routes working!" });
});

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

// ✅ Google OAuth Callback - FIXED with detailed logging
router.get("/google/callback",
    (req, res, next) => {
        console.log('📥 Google callback received');
        console.log('📋 Query params:', req.query);
        console.log('🔑 Code present:', !!req.query.code);
        next();
    },
    passport.authenticate("google", {
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
        session: false  // Use JWT instead of sessions
    }),
    (req, res) => {
        try {
            console.log('✅ Passport authentication successful');

            if (!req.user) {
                console.error('❌ No user object in request');
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
            }

            console.log('👤 Authenticated user:', req.user.email);

            // Create JWT token
            const token = jwt.sign(
                {
                    id: req.user._id,
                    email: req.user.email,
                    role: req.user.role
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY }
            );

            // Set token cookie
            res.cookie("token", token, cookieOptions);
            console.log('🍪 Authentication cookie set');
// ✨ SOLUTION 2: Pass token and user data in URL for fallback
            const userData = encodeURIComponent(JSON.stringify({
                id: req.user._id,
                email: req.user.email,
                fullName: req.user.fullName,
                role: req.user.role,
                avatar: req.user.avatar
            }));
            // Redirect to frontend with success flag
            // Redirect with token and user data for cookie-blocked browsers
            const redirectUrl = `${process.env.FRONTEND_URL}?googleAuth=success&token=${token}&userData=${userData}`;
            console.log('🔄 Redirecting to:', redirectUrl);

            res.redirect(redirectUrl);
        } catch (error) {
            console.error("❌ OAuth callback error:", error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);

export default router;
