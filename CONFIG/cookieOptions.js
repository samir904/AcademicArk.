// BACKEND/CONFIG/cookieOptions.js
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "None",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};
