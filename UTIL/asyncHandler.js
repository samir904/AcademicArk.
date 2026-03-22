// src/UTILS/asyncHandler.js

/**
 * asyncHandler
 *
 * Wraps an async Express route handler so you never need
 * try/catch in every controller. Any thrown error or
 * rejected promise is forwarded to Express's next(err),
 * which hits your errorMiddleware automatically.
 *
 * Usage:
 *   export const myController = asyncHandler(async (req, res) => {
 *     const data = await SomeModel.find();
 *     res.status(200).json({ success: true, data });
 *   });
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
