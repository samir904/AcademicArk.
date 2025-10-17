import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken"
const cookieoptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // True in production (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // None for cross-site
    path: "/",
}


const router=Router();
// ✅ Test route to verify router is working
router.get("/test", (req, res) => {
    res.json({ success: true, message: "Auth routes working!" });
});

//1) kick off google oauth
router.get("/google",
    passport.authenticate("google",{scope:["profile","email"],prompt:'select_account'})
);

// 2) Google callback - issue JWT, set cookie
router.get("/google/callback",
    passport.authenticate("google", {
        failureRedirect: `${process.env.FRONTEND_URL}/login`,
        session: false
    }),
    (req, res) => {
        try {
            // ✅ Check if user exists
            if (!req.user) {
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
            }

            // Create JWT
            const token = jwt.sign({
                id: req.user._id,
                email: req.user.email,
                role: req.user.role
            }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRY
            });

            // Set cookie
            res.cookie("token", token, cookieoptions);

            // ✅ Redirect to frontend
            res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
        } catch (error) {
            console.error("❌ OAuth callback error:", error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);
export default router;
