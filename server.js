import app from "./app.js";
import mongoose from "mongoose";
import dbConnection from "./CONFIG/db.config.js";
import cloudinary from "cloudinary";
const port=process.env.PORT


cloudinary.v2.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
})
app.listen(port,()=>{
    dbConnection();
    console.log(`APP IS LISTNING ON :  ${port}!`)
})