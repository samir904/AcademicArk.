// middleware/logAdminAction.middleware.js
export const logAdminAction = (action, targetType) => {
  return (req, res, next) => {
    // console.log('🔍 logAdminAction middleware');
    // console.log('req.user exists?', !!req.user);
    // console.log('req.user value:', req.user);
    // console.log('req.locals:', res.locals);

    if (req.user) {
      res.locals.adminLog = {
        adminId: req.user.id,
        adminName:req.user.email,  // ✅ Get actual fullName
        action,
        targetType,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };
      console.log('✅ Admin log created:', res.locals.adminLog);
    } else {
      console.warn('❌ req.user is undefined in logAdminAction');
      res.locals.adminLog = null;
    }

    next();
  };
};