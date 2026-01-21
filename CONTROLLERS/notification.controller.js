// CONTROLLERS/notification.controller.js
import NotificationBanner from '../MODELS/NotificationBanner.model.js';

// ⭐ NEW FUNCTION - For creating banners with targeting
export const createBanner = async (req, res, next) => {
  try {
    const { title, message, type = 'info', expiresAt, targetSemesters = [], targetRoles = [] } = req.body;
    
    if (targetSemesters.length > 0) {
      const validSemesters = targetSemesters.every(sem => sem >= 1 && sem <= 8);
      if (!validSemesters) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid semester. Must be between 1 and 8" 
        });
      }
    }
    
    const banner = await NotificationBanner.create({ 
      title, 
      message, 
      type, 
      expiresAt,
      targetSemesters,
      targetRoles
    });
    
    res.status(201).json({ 
      success: true, 
      data: banner, 
      message: "Notification banner created" 
    });
  } catch (err) { 
    next(err); 
  }
};

export const getActiveBanner = async (req, res, next) => {
  try {
    console.log('🔍 getActiveBanner called');
    console.log('req.user:', req.user);
    
    const userSemester = req.user?.semester || null;
    const userRole = req.user?.role || 'GUEST';
    const now = new Date();
    
    console.log(`📊 Filtering: semester=${userSemester}, role=${userRole}`);
    
    // ⭐ FIXED QUERY - Separate $or operators properly
    const banner = await NotificationBanner.findOne({
      visible: true,
      // Expiry check (NOT affected by targeting)
      $and: [
        {
          $or: [
            { expiresAt: { $gt: now } },
            { expiresAt: { $exists: false } },
            { expiresAt: null }
          ]
        },
        // Targeting logic (SEPARATE from expiry)
        {
          $or: [
            // Case 1: No targeting at all (show to everyone)
            {
              targetSemesters: { $size: 0 },
              targetRoles: { $size: 0 }
            },
            // Case 2: Only semester targeting
            {
              targetSemesters: { $size: { $gt: 0 } },
              targetSemesters: { $in: [userSemester] },
              $or: [
                { targetRoles: { $size: 0 } },
                { targetRoles: { $in: [userRole] } }
              ]
            },
            // Case 3: Only role targeting
            {
              targetSemesters: { $size: 0 },
              targetRoles: { $size: { $gt: 0 } },
              targetRoles: { $in: [userRole] }
            },
            // Case 4: Both semester AND role targeting
            {
              targetSemesters: { $size: { $gt: 0 } },
              targetRoles: { $size: { $gt: 0 } },
              targetSemesters: { $in: [userSemester] },
              targetRoles: { $in: [userRole] }
            }
          ]
        }
      ]
    }).sort({ createdAt: -1 });

    console.log('📍 Found banner:', banner ? banner.title : 'None');

    if (!banner) {
      console.log('⚠️ No banner found, returning null');
      return res.json({ success: true, data: null });
    }
    
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error('❌ getActiveBanner error:', err);
    next(err);
  }
};

export const listBanners = async (req, res, next) => {
  try {
    const banners = await NotificationBanner.find().sort({ createdAt: -1 });
    res.json({ success: true, data: banners });
  } catch (err) { next(err); }
};

export const hideBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    await NotificationBanner.findByIdAndUpdate(id, { visible: false });
    res.json({ success: true, message: 'Notification hidden' });
  } catch (err) { next(err); }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    await NotificationBanner.findByIdAndDelete(id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
};
export const getActiveBannerForUser = async (req, res, next) => {
  try {
    console.log('🔍 getActiveBannerForUser called');
    const { userSemester, userRole } = req.body;
    
    console.log(`📊 Manual filtering: semester=${userSemester}, role=${userRole}`);
    
    const now = new Date();
    
    const banner = await NotificationBanner.findOne({
      visible: true,
      $and: [
        {
          $or: [
            { expiresAt: { $gt: now } },
            { expiresAt: { $exists: false } },
            { expiresAt: null }
          ]
        },
        {
          $or: [
            { targetSemesters: { $size: 0 }, targetRoles: { $size: 0 } },
            { 
              targetSemesters: { $size: { $gt: 0 } },
              targetSemesters: { $in: [userSemester] },
              $or: [
                { targetRoles: { $size: 0 } },
                { targetRoles: { $in: [userRole] } }
              ]
            },
            {
              targetSemesters: { $size: 0 },
              targetRoles: { $size: { $gt: 0 } },
              targetRoles: { $in: [userRole] }
            },
            {
              targetSemesters: { $size: { $gt: 0 } },
              targetRoles: { $size: { $gt: 0 } },
              targetSemesters: { $in: [userSemester] },
              targetRoles: { $in: [userRole] }
            }
          ]
        }
      ]
    }).sort({ createdAt: -1 });

    console.log('📍 Found banner:', banner ? banner.title : 'None');
    res.json({ success: true, data: banner || null });
  } catch (err) {
    console.error('❌ getActiveBannerForUser error:', err);
    next(err);
  }
};


export const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, message, type, expiresAt, targetSemesters, targetRoles } = req.body;
    
    const banner = await NotificationBanner.findByIdAndUpdate(
      id,
      { title, message, type, expiresAt, targetSemesters, targetRoles },
      { new: true, runValidators: true }
    );
    
    res.json({ success: true, data: banner, message: 'Banner updated' });
  } catch (err) { 
    next(err); 
  }
};
