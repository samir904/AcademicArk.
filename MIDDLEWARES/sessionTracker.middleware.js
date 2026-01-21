// =====================================
// 📊 MIDDLEWARES/sessionTracker.middleware.js
// =====================================

import UserSession from "../MODELS/userSession.model.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Automatic session tracking middleware
 * Attaches session to request and creates/retrieves session
 */
export const sessionTrackerMiddleware = async (req, res, next) => {
    try {
        // Skip if user not logged in
        if (!req.user?._id) {
            return next();
        }

        // Get or create session ID from cookie
        let sessionId = req.cookies?.sessionId;

        if (!sessionId) {
            // Create new session
            sessionId = `${req.user._id}-${uuidv4()}`;

            // Set cookie (expires in 24 hours)
            res.cookie('sessionId', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
                maxAge: 24 * 60 * 60 * 1000
            });

            // Create session in database
            const session = new UserSession({
                userId: req.user._id,
                sessionId,
                status: "ACTIVE",
                entryPage: req.body?.entryPage || "HOMEPAGE"
            });

            await session.save();
            req.sessionData = session;
        } else {
            // Retrieve existing session
            let session = await UserSession.findOne({ sessionId });

            if (!session) {
                // Session expired or invalid, create new one
                sessionId = `${req.user._id}-${uuidv4()}`;
                const newSession = new UserSession({
                    userId: req.user._id,
                    sessionId,
                    status: "ACTIVE"
                });
                await newSession.save();
                req.sessionData = newSession;

                // Update cookie
                res.cookie('sessionId', sessionId, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Lax',
                    maxAge: 24 * 60 * 60 * 1000
                });
            } else if (session.status === "ENDED") {
                // Create new session
                sessionId = `${req.user._id}-${uuidv4()}`;
                const newSession = new UserSession({
                    userId: req.user._id,
                    sessionId,
                    status: "ACTIVE"
                });
                await newSession.save();
                req.sessionData = newSession;
            } else {
                // Session is active, update last activity
                session.lastActivityTime = new Date();
                await session.save();
                req.sessionData = session;
            }
        }

        req.sessionId = sessionId;
        next();
    } catch (error) {
        console.error("Session tracker error:", error);
        next();
    }
};

export default sessionTrackerMiddleware;