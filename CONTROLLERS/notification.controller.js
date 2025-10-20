// CONTROLLERS/notification.controller.js
import NotificationBanner from '../MODELS/NotificationBanner.model.js';

export const createBanner = async (req, res, next) => {
  try {
    const { title, message, type = 'info', expiresAt } = req.body;
    const banner = await NotificationBanner.create({ title, message, type, expiresAt });
    res.status(201).json({ success: true, data: banner, message: "Notification banner created" });
  } catch (err) { next(err); }
};

export const getActiveBanner = async (req, res, next) => {
  try {
    // Only banners that are visible and (not expired or no expiresAt)
    const now = new Date();
    const banner = await NotificationBanner.findOne({
      visible: true,
      $or: [
        { expiresAt: { $gt: now } },
        { expiresAt: { $exists: false } },
        { expiresAt: null }
      ]
    }).sort({ createdAt: -1 }); // Show newest first

    if (!banner) return res.json({ success: true, data: null });
    res.json({ success: true, data: banner });
  } catch (err) { next(err); }
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