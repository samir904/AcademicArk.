import StudyBuddyChat from '../MODELS/studyBuddyChat.model.js';
import geminiService from '../services/gemini.service.js';

// Get chat history
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let chat = await StudyBuddyChat.findOne({ userId });
    
    if (!chat) {
      chat = await StudyBuddyChat.create({ userId, messages: [] });
    }

    res.status(200).json({
      success: true,
      messages: chat.messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send message to Study Buddy
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get or create chat
    let chat = await StudyBuddyChat.findOne({ userId });
    if (!chat) {
      chat = await StudyBuddyChat.create({ userId, messages: [], context });
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message
    });

    // Get AI response
    const aiResponse = await geminiService.chat(message, chat.messages.slice(-10)); // Last 10 messages for context

    // Add assistant message
    chat.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    await chat.save();

    res.status(200).json({
      success: true,
      message: aiResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Clear chat history
export const clearChat = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await StudyBuddyChat.findOneAndUpdate(
      { userId },
      { messages: [] }
    );

    res.status(200).json({
      success: true,
      message: 'Chat cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
