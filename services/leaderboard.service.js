import Note from "../MODELS/note.model.js";
import User from "../MODELS/user.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import Leaderboard from "../MODELS/leaderboard.model.js";

class LeaderboardService {
  
  // ============================================
  // 1️⃣ MOST VIEWED NOTES LEADERBOARD
  // ============================================
  async generateMostViewedNotesLeaderboard() {
    try {
      console.log('📊 Generating Most Viewed Notes leaderboard...');

      // Get top viewed notes
      const notes = await Note.find()
        .select('_id title views downloads uploadedBy')
        .populate('uploadedBy', 'fullName')
        .sort({ views: -1 })
        .limit(100)
        .lean();

      // Get previous ranking for trend calculation
      const previousLeaderboard = await Leaderboard.findOne({
        leaderboardType: 'MOST_VIEWED_NOTES',
        snapshotType: 'DAILY'
      })
        .sort({ generatedAt: -1 })
        .lean();

      const previousMap = new Map();
      if (previousLeaderboard) {
        previousLeaderboard.entries.forEach((entry, index) => {
          previousMap.set(entry.noteId?.toString(), index + 1);
        });
      }

      // Create entries
      const entries = notes.map((note, index) => {
        const currentRank = index + 1;
        const previousRank = previousMap.get(note._id.toString());
        
        let trend = 'STABLE';
        let trendValue = 0;

        if (previousRank) {
          if (currentRank < previousRank) {
            trend = 'UP';
            trendValue = ((previousRank - currentRank) / previousRank * 100).toFixed(2);
          } else if (currentRank > previousRank) {
            trend = 'DOWN';
            trendValue = ((currentRank - previousRank) / previousRank * 100).toFixed(2);
          }
        }

        return {
          rank: currentRank,
          noteId: note._id,
          noteTitle: note.title,
          metrics: {
            views: note.views,
            downloads: note.downloads,
            engagement: note.views + note.downloads
          },
          trend,
          trendValue,
          lastUpdated: new Date()
        };
      });

      // Save to leaderboard
      const leaderboard = await Leaderboard.create({
        leaderboardType: 'MOST_VIEWED_NOTES',
        snapshotType: 'DAILY',
        entries,
        generatedAt: new Date(),
        period: {
          startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
          endDate: new Date()
        },
        totalRecords: entries.length,
        dataQuality: {
          totalActivities: await UserActivity.countDocuments({ activityType: 'NOTE_VIEWED' }),
          uniqueUsers: await UserActivity.distinct('userId', { activityType: 'NOTE_VIEWED' }).then(u => u.length),
          uniqueResources: await UserActivity.distinct('resourceId', { activityType: 'NOTE_VIEWED' }).then(r => r.length)
        }
      });

      console.log(`✅ Most Viewed Notes leaderboard generated with ${entries.length} entries`);
      return leaderboard;

    } catch (error) {
      console.error('❌ Error generating most viewed notes leaderboard:', error);
      throw error;
    }
  }

  // ============================================
  // 2️⃣ MOST DOWNLOADED NOTES LEADERBOARD
  // ============================================
  async generateMostDownloadedNotesLeaderboard() {
    try {
      console.log('📊 Generating Most Downloaded Notes leaderboard...');

      const notes = await Note.find()
        .select('_id title views downloads uploadedBy')
        .populate('uploadedBy', 'fullName')
        .sort({ downloads: -1 })
        .limit(100)
        .lean();

      const previousLeaderboard = await Leaderboard.findOne({
        leaderboardType: 'MOST_DOWNLOADED_NOTES',
        snapshotType: 'DAILY'
      })
        .sort({ generatedAt: -1 })
        .lean();

      const previousMap = new Map();
      if (previousLeaderboard) {
        previousLeaderboard.entries.forEach((entry, index) => {
          previousMap.set(entry.noteId?.toString(), index + 1);
        });
      }

      const entries = notes.map((note, index) => {
        const currentRank = index + 1;
        const previousRank = previousMap.get(note._id.toString());
        
        let trend = 'STABLE';
        let trendValue = 0;

        if (previousRank) {
          if (currentRank < previousRank) {
            trend = 'UP';
            trendValue = ((previousRank - currentRank) / previousRank * 100).toFixed(2);
          } else if (currentRank > previousRank) {
            trend = 'DOWN';
            trendValue = ((currentRank - previousRank) / previousRank * 100).toFixed(2);
          }
        }

        return {
          rank: currentRank,
          noteId: note._id,
          noteTitle: note.title,
          metrics: {
            views: note.views,
            downloads: note.downloads,
            engagement: note.views + note.downloads
          },
          trend,
          trendValue,
          lastUpdated: new Date()
        };
      });

      const leaderboard = await Leaderboard.create({
        leaderboardType: 'MOST_DOWNLOADED_NOTES',
        snapshotType: 'DAILY',
        entries,
        generatedAt: new Date(),
        period: {
          startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
          endDate: new Date()
        },
        totalRecords: entries.length,
        dataQuality: {
          totalActivities: await UserActivity.countDocuments({ activityType: 'NOTE_DOWNLOADED' }),
          uniqueUsers: await UserActivity.distinct('userId', { activityType: 'NOTE_DOWNLOADED' }).then(u => u.length),
          uniqueResources: await UserActivity.distinct('resourceId', { activityType: 'NOTE_DOWNLOADED' }).then(r => r.length)
        }
      });

      console.log(`✅ Most Downloaded Notes leaderboard generated with ${entries.length} entries`);
      return leaderboard;

    } catch (error) {
      console.error('❌ Error generating most downloaded notes leaderboard:', error);
      throw error;
    }
  }

  // ============================================
  // 3️⃣ TOP CONTRIBUTORS LEADERBOARD
  // ============================================
  async generateTopContributorsLeaderboard() {
    try {
      console.log('📊 Generating Top Contributors leaderboard...');

      // Aggregate notes by teacher
      const contributors = await Note.aggregate([
        {
          $group: {
            _id: "$uploadedBy",
            totalNotes: { $sum: 1 },
            totalViews: { $sum: "$views" },
            totalDownloads: { $sum: "$downloads" },
            totalEngagement: { $sum: { $add: ["$views", "$downloads"] } }
          }
        },
        {
          $sort: { totalEngagement: -1 }
        },
        {
          $limit: 100
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        }
      ]);

      const previousLeaderboard = await Leaderboard.findOne({
        leaderboardType: 'TOP_CONTRIBUTORS',
        snapshotType: 'DAILY'
      })
        .sort({ generatedAt: -1 })
        .lean();

      const previousMap = new Map();
      if (previousLeaderboard) {
        previousLeaderboard.entries.forEach((entry, index) => {
          previousMap.set(entry.userId?.toString(), index + 1);
        });
      }

      const entries = contributors.map((contributor, index) => {
        const currentRank = index + 1;
        const previousRank = previousMap.get(contributor._id.toString());
        
        let trend = 'STABLE';
        let trendValue = 0;

        if (previousRank) {
          if (currentRank < previousRank) {
            trend = 'UP';
            trendValue = ((previousRank - currentRank) / previousRank * 100).toFixed(2);
          } else if (currentRank > previousRank) {
            trend = 'DOWN';
            trendValue = ((currentRank - previousRank) / previousRank * 100).toFixed(2);
          }
        }

        return {
          rank: currentRank,
          userId: contributor._id,
          userName: contributor.user.fullName,
          userEmail: contributor.user.email,
          userAvatar: contributor.user.avatar?.secure_url || null,
          metrics: {
            views: contributor.totalViews,
            downloads: contributor.totalDownloads,
            engagement: contributor.totalEngagement,
            totalNotes: contributor.totalNotes
          },
          trend,
          trendValue,
          lastUpdated: new Date()
        };
      });

      const leaderboard = await Leaderboard.create({
        leaderboardType: 'TOP_CONTRIBUTORS',
        snapshotType: 'DAILY',
        entries,
        generatedAt: new Date(),
        period: {
          startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
          endDate: new Date()
        },
        totalRecords: entries.length,
        dataQuality: {
          totalActivities: await UserActivity.countDocuments({ resourceType: 'NOTE' }),
          uniqueUsers: await User.countDocuments({ role: 'TEACHER' }),
          uniqueResources: await Note.countDocuments()
        }
      });

      console.log(`✅ Top Contributors leaderboard generated with ${entries.length} entries`);
      return leaderboard;

    } catch (error) {
      console.error('❌ Error generating top contributors leaderboard:', error);
      throw error;
    }
  }

  // ============================================
  // 4️⃣ TOP STUDENTS LEADERBOARD
  // ============================================
  async generateTopStudentsLeaderboard() {
    try {
      console.log('📊 Generating Top Students leaderboard...');
// Get excluded user IDs
    const excludedUsers = await User.find({ excludeFromLeaderboard: true })
      .select('_id')
      .lean();
    
    const excludedUserIds = excludedUsers.map(u => u._id);

      // Aggregate activities by user
      const students = await UserActivity.aggregate([
        {
          $match: {
            activityType: { $in: ['NOTE_VIEWED', 'NOTE_DOWNLOADED'] },
             userId: { $nin: excludedUserIds }  // ✨ EXCLUDE these users
          }
        },
        {
          $group: {
            _id: "$userId",
            totalViews: {
              $sum: { $cond: [{ $eq: ["$activityType", "NOTE_VIEWED"] }, 1, 0] }
            },
            totalDownloads: {
              $sum: { $cond: [{ $eq: ["$activityType", "NOTE_DOWNLOADED"] }, 1, 0] }
            },
            totalEngagement: { $sum: 1 }
          }
        },
        {
          $sort: { totalEngagement: -1 }
        },
        {
          $limit: 100
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        }
      ]);

      const previousLeaderboard = await Leaderboard.findOne({
        leaderboardType: 'TOP_STUDENTS',
        snapshotType: 'DAILY'
      })
        .sort({ generatedAt: -1 })
        .lean();

      const previousMap = new Map();
      if (previousLeaderboard) {
        previousLeaderboard.entries.forEach((entry, index) => {
          previousMap.set(entry.userId?.toString(), index + 1);
        });
      }

      const entries = students.map((student, index) => {
        const currentRank = index + 1;
        const previousRank = previousMap.get(student._id.toString());
        
        let trend = 'STABLE';
        let trendValue = 0;

        if (previousRank) {
          if (currentRank < previousRank) {
            trend = 'UP';
            trendValue = ((previousRank - currentRank) / previousRank * 100).toFixed(2);
          } else if (currentRank > previousRank) {
            trend = 'DOWN';
            trendValue = ((currentRank - previousRank) / previousRank * 100).toFixed(2);
          }
        }

        return {
          rank: currentRank,
          userId: student._id,
          userName: student.user.fullName,
          userEmail: student.user.email,
          userAvatar: student.user.avatar?.secure_url || null,
          metrics: {
            views: student.totalViews,
            downloads: student.totalDownloads,
            engagement: student.totalEngagement
          },
          trend,
          trendValue,
          lastUpdated: new Date()
        };
      });

      const leaderboard = await Leaderboard.create({
        leaderboardType: 'TOP_STUDENTS',
        snapshotType: 'DAILY',
        entries,
        generatedAt: new Date(),
        period: {
          startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
          endDate: new Date()
        },
        totalRecords: entries.length,
        dataQuality: {
          totalActivities: await UserActivity.countDocuments({ activityType: { $in: ['NOTE_VIEWED', 'NOTE_DOWNLOADED'] } }),
          uniqueUsers: await UserActivity.distinct('userId', { activityType: { $in: ['NOTE_VIEWED', 'NOTE_DOWNLOADED'] } }).then(u => u.length),
          uniqueResources: await UserActivity.distinct('resourceId', { activityType: { $in: ['NOTE_VIEWED', 'NOTE_DOWNLOADED'] } }).then(r => r.length)
        }
      });

      console.log(`✅ Top Students leaderboard generated with ${entries.length} entries`);
      return leaderboard;

    } catch (error) {
      console.error('❌ Error generating top students leaderboard:', error);
      throw error;
    }
  }

  // ============================================
  // 5️⃣ GENERATE ALL LEADERBOARDS
  // ============================================
  async generateAllLeaderboards() {
    try {
      console.log('\n🎯 Starting Leaderboard Generation...');
      
      const results = {
        mostViewed: await this.generateMostViewedNotesLeaderboard(),
        mostDownloaded: await this.generateMostDownloadedNotesLeaderboard(),
        topContributors: await this.generateTopContributorsLeaderboard(),
        topStudents: await this.generateTopStudentsLeaderboard()
      };

      console.log('✅ All leaderboards generated successfully!');
      return results;

    } catch (error) {
      console.error('❌ Error generating all leaderboards:', error);
      throw error;
    }
  }

  // ============================================
  // 6️⃣ CLEANUP OLD LEADERBOARDS
  // ============================================
  async cleanupOldLeaderboards() {
    try {
      // Keep only last 30 daily snapshots
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleted = await Leaderboard.deleteMany({
        snapshotType: 'DAILY',
        generatedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`🧹 Cleaned up ${deleted.deletedCount} old leaderboard snapshots`);
      return deleted;

    } catch (error) {
      console.error('❌ Error cleaning up leaderboards:', error);
      throw error;
    }
  }
}

export default new LeaderboardService();
