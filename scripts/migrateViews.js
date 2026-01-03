import mongoose from 'mongoose';
import Note from '../models/Note.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateViews = async () => {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Find notes without views field
        const notesBeforeMigration = await Note.countDocuments({ 
            views: { $exists: false } 
        });
        console.log(`📋 Found ${notesBeforeMigration} notes without views field`);

        // 3. Update ALL notes without views field
        const result = await Note.updateMany(
            { 
                views: { $exists: false }  // Notes that don't have views
            },
            { 
                $set: { 
                    views: 0,              // Initialize views to 0
                    viewedBy: []           // Initialize viewedBy to empty
                }
            }
        );

        console.log(`\n✅ Migration Results:`);
        console.log(`   📊 Modified: ${result.modifiedCount} notes`);
        console.log(`   🔍 Matched: ${result.matchedCount} notes`);

        // 4. Verify migration
        const notesAfterMigration = await Note.countDocuments({ 
            views: { $exists: false } 
        });
        
        console.log(`\n✅ Verification:`);
        console.log(`   Remaining notes without views: ${notesAfterMigration}`);

        if (notesAfterMigration === 0) {
            console.log('   ✅ All notes migrated successfully!');
        }

        // 5. Sample verification
        const sampleNote = await Note.findOne();
        console.log(`\n📝 Sample migrated note:`);
        console.log(`   Title: ${sampleNote?.title}`);
        console.log(`   Views: ${sampleNote?.views}`);
        console.log(`   ViewedBy: ${sampleNote?.viewedBy?.length} users`);

        // Close connection
        await mongoose.connection.close();
        console.log(`\n✅ Migration complete! Disconnected from MongoDB`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

// Run migration
migrateViews();
