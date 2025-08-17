// import { Router } from "express";
// import passport from "passport";
// import jwt from "jsonwebtoken"
// const cookieoptions = {
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production", // True in production (HTTPS)
//     sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // None for cross-site
//     path: "/",
// }


// const router=Router();

// //1) kick off google oauth
// router.get("/google",
//     passport.authenticate("google",{scope:["profile","email"],prompt:'select_account'})
// );

// //2)google callback-issue jwt set cookie
// router.get("/google/callback",
//     passport.authenticate("google",{
//         failureRedirect:"/login",
//         session:false
//     }),
//     (req,res)=>{
//         //req.user set by passport
//         const token=jwt.sign({
//             id:req.user.id,
//             email:req.user.email,
//             role:req.user.role
//         },process.env.JWT_SECRET,{
//             expiresIn:process.env.JWT_EXPIRY
//         });
//         res.cookie("token",token,cookieoptions);
//         //redirect back to frontend home/dashbord
//         res.redirect(process.env.FRONTEND_URL||"http://localhost:5173")
//     }
// )
// export default router;
