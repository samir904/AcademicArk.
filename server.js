import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });                   
// console.log('Loaded REDIS_URI:', process.env.REDIS_URI);

//import '../BACKEND/CONFIG/passport.js'; // <-- Add this line! Adjust path if needed
import './CONFIG/passport.js';  // ⬅️ Correct relative path, import ONCE here


import app from "./app.js";
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