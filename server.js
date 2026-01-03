import dotenv from 'dotenv';
import Note from './MODELS/note.model.js';  // ✅ ADD THIS IMPORT

dotenv.config({ path: ['.env.local', '.env'] });

import './CONFIG/passport.js';
import app from "./app.js";
import dbConnection from "./CONFIG/db.config.js";
import cloudinary from "cloudinary";

const port = process.env.PORT;

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ ADD THIS MIGRATION FUNCTION
const runMigration = async () => {
    try {
        const result = await Note.updateMany(
            { views: { $exists: false } },
            { $set: { views: 0, viewedBy: [] } }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`✅ Migrated ${result.modifiedCount} notes`);
        } else {
            console.log('✅ All notes already have views field');
        }
    } catch (error) {
        console.error('⚠️  Migration warning:', error.message);
    }
};

// ✅ MODIFY THIS PART
app.listen(port, async () => {
    await dbConnection();    // Connect to DB
    console.log(`🚀 APP IS LISTENING ON: ${port}!`);
});
