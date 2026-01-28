
 //import '../BACKEND/CONFIG/passport.js'; // <-- Add this line! Adjust path if needed

// import "./CONFIG/passport.js";     
import express from "express";
// import {config} from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser";
import morgan from "morgan";
import session from 'express-session';
import passport from 'passport';


import userRoute from "./ROUTES/user.route.js"
import noteRoute from "./ROUTES/note.route.js"
import publicRoutes from "./ROUTES/public.routes.js"
import adminRoutes from "./ROUTES/admin.routes.js"
import searchRoutes from "./ROUTES/search.routes.js"
 import authRoute from "./ROUTES/auth.route.js"
 import attendanceRoute from "./ROUTES/attendance.route.js"
 import analyticsRoutes from "./ROUTES/analytics.routes.js"
 import feedbackRoute from './ROUTES/feedback.routes.js'
 import loginLogRoutes from './ROUTES/loginLog.routes.js'
 import logsRoutes from './ROUTES/logs.routes.js'
import retentionRoutes from './ROUTES/user.retention.routes.js'
 import mongoDbHealthRoutes from './ROUTES/mongoDbHealth.routes.js'
 import redisHealthRoutes from './ROUTES/redisHealth.routes.js'
 import leaderboardRoutes from './ROUTES/leaderboard.routes.js'
 import videoLectureRoute from './ROUTES/videoLecture.route.js'
 import homepageRoutes from './ROUTES/homepage.routes.js'
 import sessionRoutes from './ROUTES/session.routes.js'
 import adminAnalyticsRoutes from './ROUTES/admin.analytics.routes.js'
 import plannerRoutes from './ROUTES/planner.routes.js'
 import savedFilterRoutes from './ROUTES/savedFilter.routes.js'
//  import studyBuddyRoutes from './ROUTES/studyBuddy.routes.js';
// import studyPlannerRoutes from './ROUTES/studyPlanner.routes.js';

import errorMiddleware from "./MIDDLEWARES/error.middleware.js"
import responseTime from "response-time";
import serverMetrics from "./UTIL/serverMetrics.js";
import { initSessionCronJobs } from "./UTIL/sessionCronJobs.js";
import initConsoleLogger from "./UTIL/consoleLogger.js";
import requestLoggerMiddleware from "./MIDDLEWARES/requestLogger.middleware.js";
import queryTrackerMiddleware from "./MIDDLEWARES/queryTracker.middleware.js";
import queryMetricsRoutes from './ROUTES/queryMetrics.routes.js'
import sessionTrackerMiddleware from "./MIDDLEWARES/sessionTracker.middleware.js";
// import session from "express-session";
// import passport from "passport";

const app=express();
// 🔥 ADD THIS LINE
app.disable("etag");

// config();
// ✅ ADD THIS - Initialize console logger (EARLY, before other code)
initConsoleLogger();
app.use(express.urlencoded({extended:true}));
app.use(express.json())
app.use(cookieParser())
app.use(morgan("dev"))
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

 app.use(
   cors({
     origin: process.env.FRONTEND_URL,
     credentials: true,
     methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
     allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"], //what is the use of authorization her 
   })
 );
//  import path from "path";a
// // If using ESM ("type": "module" in package.json)
// const __dirname = path.resolve();

// app.use(express.static(path.join(__dirname, "../FRONTEND/public")));

//  app.use(session({
//     secret:process.env.SESSION_SECRET,
//     resave:false,
//     saveUninitialized:false
//  }))

//  app.use(passport.initialize());
//  app.use(passport.session())


// ⭐ IMPORT YOUR PASSPORT CONFIG - THIS IS WHAT'S MISSING!
// ⭐ Session middleware (REQUIRED for passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // True in production (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // None for cross-site
    path: "/",

    }
}));

// ⭐ Initialize Passport
app.use(passport.initialize());
app.use(passport.session()); // ⬅️ THIS WAS MISSING!

app.get("/health",(req,res)=>{
    res.status(200).json({
        success:"true",
        message:"health check!"
    })
})

//more route here 
// Add this BEFORE your routes
// app.use((req, res, next) => {
//   console.log(`📨 Incoming: ${req.method} ${req.url}`);
//   console.log('📦 Body:', req.body);
//   console.log('🌐 Origin:', req.get('Origin'));
//   next();
// });
// ✨ ADD THIS SESSION TRACKER MIDDLEWARE
app.use(sessionTrackerMiddleware);

app.use(responseTime((req,res,time)=>{
  serverMetrics.incrementRequest();
  serverMetrics.addResponseTime(time);
}));

//error tracking middleware (add)
// ✅ ADD THIS - Request logger middleware (AFTER morgan, BEFORE routes)
app.use(requestLoggerMiddleware);
app.use(queryTrackerMiddleware);
app.use("/api/v1/user",userRoute);
app.use("/api/v1/notes",noteRoute);
app.use('/api/v1/home',homepageRoutes)
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/search', searchRoutes);
app.use("/api/v1/oauth",authRoute);
app.use('/api/v1/analytics', analyticsRoutes)
app.use("/api/v1/attendance", attendanceRoute);
app.use('/api/v1/feedback',feedbackRoute);
app.use('/api/v1/login-logs', loginLogRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use("/api/v1/retention", retentionRoutes);
app.use('/api/v1/query-metrics', queryMetricsRoutes); 
app.use('/api/v1/db', mongoDbHealthRoutes);
app.use('/api/v1/cache', redisHealthRoutes);
app.use('/api/v1/leaderboards', leaderboardRoutes);
 app.use("/api/v1/videos", videoLectureRoute);
 app.use("/api/v1/planner", plannerRoutes);
app.use("/api/v1/saved-filters", savedFilterRoutes);
 // ✨ ADD THIS NEW SESSIONS ROUTE
app.use("/api/v1/session", sessionRoutes);
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
//app.use('/api/v1/study-buddy', studyBuddyRoutes);
//app.use('/api/v1/study-planner', studyPlannerRoutes);
// After all middleware and routes
initSessionCronJobs();

console.log('✅ OAuth routes registered at /api/v1/oauth');

app.use(errorMiddleware)

export default app;