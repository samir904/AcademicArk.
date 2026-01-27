import express from 'express';
import { isLoggedIn } from '../MIDDLEWARES/auth.middleware.js';
import {
  getChatHistory,
  sendMessage,
  clearChat
} from '../CONTROLLERS/studyBuddy.controller.js';

const router = express.Router();

// All routes require authentication
router.use(isLoggedIn);

// Get chat history
router.get('/chat/history', getChatHistory);

// Send message to Study Buddy
router.post('/chat/message', sendMessage);

// Clear chat
router.delete('/chat/clear', clearChat);

export default router;
