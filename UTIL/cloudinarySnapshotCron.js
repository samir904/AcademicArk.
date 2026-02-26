// UTIL/cloudinarySnapshotCron.js
import cron       from 'node-cron';
import cloudinary from 'cloudinary';
import CloudinarySnapshot from '../MODELS/CloudinarySnapshot.model.js';

export const initCloudinarySnapshotCron = () => {
  // ✅ Runs once daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const usage     = await cloudinary.v2.api.usage();
      const toMB      = (b) => parseFloat((b / 1024 / 1024).toFixed(2));
      const toGB      = (b) => parseFloat((b / 1024 / 1024 / 1024).toFixed(3));

      const [images, videos, raws] = await Promise.all([
        cloudinary.v2.api.resources({ resource_type: 'image', max_results: 1 }),
        cloudinary.v2.api.resources({ resource_type: 'video', max_results: 1 }),
        cloudinary.v2.api.resources({ resource_type: 'raw',   max_results: 1 }),
      ]);

      await CloudinarySnapshot.create({
        timestamp: new Date(),
        storage: {
          usedMB:  toMB(usage.storage?.usage  ?? 0),
          limitGB: toGB(usage.storage?.limit  ?? 0),
          usedPct: usage.storage?.used_percent ?? 0,
        },
        bandwidth: {
          usedMB:  toMB(usage.bandwidth?.usage  ?? 0),
          limitGB: toGB(usage.bandwidth?.limit  ?? 0),
          usedPct: usage.bandwidth?.used_percent ?? 0,
        },
        transformations: {
          used:    usage.transformations?.usage         ?? 0,
          limit:   usage.transformations?.limit         ?? 0,
          usedPct: usage.transformations?.used_percent  ?? 0,
        },
        resources: {
          total:  (images.total_count ?? 0) + (videos.total_count ?? 0) + (raws.total_count ?? 0),
          images:  images.total_count ?? 0,
          videos:  videos.total_count ?? 0,
          raw:     raws.total_count   ?? 0,
        },
      });

      console.log('✅ Cloudinary snapshot saved');
    } catch (err) {
      console.error('[CLOUDINARY_CRON]', err.message);
    }
  });

  console.log('✅ Cloudinary snapshot cron started (daily midnight)');
};
