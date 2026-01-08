// BACKEND/MIDDLEWARES/queryTracker.middleware.js - NEW FILE

/**
 * Middleware to capture current route for query tracking
 * Must be placed BEFORE route handlers in app.js
 */
export const queryTrackerMiddleware = (req, res, next) => {
    // Store the current route in global scope for query tracker to access
    global.currentRoute = `${req.method} ${req.path}`;
    next();
};

export default queryTrackerMiddleware;