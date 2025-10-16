

// import "./CONFIG/passport.js";     
import express from "express";
// import {config} from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser";
import morgan from "morgan";

import userRoute from "./ROUTES/user.route.js"
import noteRoute from "./ROUTES/note.route.js"
import adminRoutes from "./ROUTES/admin.routes.js"
import searchRoutes from "./ROUTES/search.routes.js"
// import authRoute from "./ROUTES/auth.route.js"
import errorMiddleware from "./MIDDLEWARES/error.middleware.js"
// import session from "express-session";
// import passport from "passport";

const app=express();
// config();
app.use(express.urlencoded({extended:true}));
app.use(express.json())
app.use(cookieParser())
app.use(morgan("dev"))
 app.use(
   cors({
     origin: process.env.FRONTEND_URL,
     credentials: true,
     methods: ["GET", "POST", "PUT", "DELETE"],
     allowedHeaders: ["Content-Type", "Authorization"], //what is the use of authorization her 
   })
 );
//  import path from "path";
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

app.use("/api/v1/user",userRoute);
app.use("/api/v1/notes",noteRoute);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/search', searchRoutes);
// app.use("/api/v1/oauth",authRoute)

app.use(errorMiddleware)

export default app;