import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ Initialize all AI services
const claudeClient = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Track quota usage per user
const quotaTracker = new Map();

class AIRouter {
  
  // ✅ Check and update quota
  updateQuota(userId, aiType, tokensUsed) {
    const key = `${userId}:${aiType}`;
    if (!quotaTracker.has(key)) {
      quotaTracker.set(key, { tokens: 0, lastReset: Date.now() });
    }
    
    const tracker = quotaTracker.get(key);
    
    // Reset daily for Gemini
    if (aiType === 'gemini') {
      const daysPassed = Math.floor((Date.now() - tracker.lastReset) / (1000 * 60 * 60 * 24));
      if (daysPassed >= 1) {
        tracker.tokens = 0;
        tracker.lastReset = Date.now();
      }
    }
    
    tracker.tokens += tokensUsed;
    quotaTracker.set(key, tracker);
    
    return tracker.tokens;
  }

  // ✅ Smart routing: Claude → Gemini → Together
  async chat(message, chatHistory = [], userId) {
    try {
      // Step 1: Try Claude (100K/month) - FIRST CHOICE
      try {
        console.log('🤖 Trying Claude...');
        const response = await this.useClaude(message, chatHistory);
        console.log('✅ Claude used successfully');
        this.updateQuota(userId, 'claude', this.estimateTokens(message + response));
        return { response, aiUsed: 'claude' };
      } catch (claudeError) {
        if (claudeError.message?.includes('quota') || claudeError.status === 429) {
          console.warn('⚠️ Claude quota exceeded, trying Gemini...');
        } else {
          throw claudeError;
        }
      }

      // Step 2: Try Gemini (50K/day) - SECOND CHOICE
      try {
        console.log('🔥 Trying Gemini...');
        const response = await this.useGemini(message, chatHistory);
        console.log('✅ Gemini used successfully');
        this.updateQuota(userId, 'gemini', this.estimateTokens(message + response));
        return { response, aiUsed: 'gemini' };
      } catch (geminiError) {
        if (geminiError.message?.includes('quota') || geminiError.status === 429) {
          console.warn('⚠️ Gemini quota exceeded, using Together AI...');
        } else {
          throw geminiError;
        }
      }

      // Step 3: Fallback to Together AI (Unlimited but slower) - LAST RESORT
      console.log('🌐 Using Together AI (free open-source)...');
      const response = await this.useTogether(message, chatHistory);
      console.log('✅ Together AI used successfully');
      return { response, aiUsed: 'together' };

    } catch (error) {
      console.error('❌ All AI services failed:', error);
      throw new Error('All AI services failed: ' + error.message);
    }
  }

  // ✅ Claude Implementation (Priority 1)
  async useClaude(message, chatHistory) {
    const messages = [
      ...chatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await claudeClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: 'You are a helpful AKTU study assistant. Provide clear, concise educational content.',
      messages: messages
    });

    return response.content[0].text;
  }

  // ✅ Gemini Implementation (Priority 2)
  async useGemini(message, chatHistory) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const formattedHistory = chatHistory
      .filter(msg => msg.content && msg.content.trim())
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift();
    }

    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  }

  // ✅ Together AI Implementation (Priority 3 - Fallback)
  async useTogether(message, chatHistory) {
    try {
      const response = await fetch('https://api.together.xyz/inference', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-2-7b-chat-hf', // Free open-source model
          prompt: this.formatPromptForTogether(message, chatHistory),
          max_tokens: 512,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.output?.choices?.[0]?.text || 'Unable to generate response';
    } catch (error) {
      throw new Error('Together AI failed: ' + error.message);
    }
  }

  // ✅ Helper: Format prompt for Together AI
  formatPromptForTogether(message, chatHistory) {
    let prompt = chatHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    prompt += `\nUser: ${message}\nAssistant:`;
    return prompt;
  }

  // ✅ Helper: Estimate tokens (rough calculation)
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  // ✅ Generate Study Plan with routing
  async generateStudyPlan(examData, userId) {
    const { examName, examDate, subjects } = examData;
    const daysUntilExam = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));

    const prompt = `Create a ${daysUntilExam}-day study plan for ${examName}.
Subjects: ${subjects.map(s => s.name).join(', ')}

Include:
1. Daily schedule
2. Subject-wise breakdown
3. Revision strategy
4. PYQ solving time
5. Exam tips

Be practical and specific.`;

    try {
      // Try Claude first
      try {
        const response = await claudeClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      } catch (claudeError) {
        if (claudeError.status === 429) {
          // Fall back to Gemini
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
          const result = await model.generateContent(prompt);
          return (await result.response).text();
        }
        throw claudeError;
      }
    } catch (error) {
      console.error('Study plan generation error:', error);
      throw new Error('Failed to generate study plan');
    }
  }

  // ✅ Get recommendations with routing
  async getRecommendations(subjectName, chapterProgress, userId) {
    const prompt = `As an AKTU study advisor, provide brief recommendations for ${subjectName}.
Progress: ${chapterProgress.completed}/${chapterProgress.total} chapters done.

Include: next focus, study techniques, common mistakes, exam tips (under 300 words).`;

    try {
      // Try Claude first
      try {
        const response = await claudeClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      } catch (claudeError) {
        if (claudeError.status === 429) {
          // Fall back to Gemini
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
          const result = await model.generateContent(prompt);
          return (await result.response).text();
        }
        throw claudeError;
      }
    } catch (error) {
      console.error('Recommendations error:', error);
      throw new Error('Failed to get recommendations');
    }
  }

  // ✅ Get quota status
  getQuotaStatus(userId) {
    return {
      claude: quotaTracker.get(`${userId}:claude`)?.tokens || 0,
      gemini: quotaTracker.get(`${userId}:gemini`)?.tokens || 0,
    };
  }
}

export default new AIRouter();
