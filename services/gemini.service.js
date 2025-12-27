const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

class StudyAIService {
  async chat(message, chatHistory = []) {
    try {
      const systemPrompt = `You are a helpful AKTU study assistant. Provide clear, concise educational content.`;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      const response = await this.callHuggingFace(messages);
      return response;
    } catch (error) {
      console.error('Chat error:', error.message);
      throw new Error('Failed to get response: ' + error.message);
    }
  }

  async generateStudyPlan(examData) {
    try {
      const { examName, examDate, subjects } = examData;
      const daysUntilExam = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));

      const prompt = `You are an expert academic study planner for AKTU university students.

Create a detailed study plan for:
Exam: ${examName}
Days until exam: ${daysUntilExam}
Subjects: ${subjects.map(s => s.name).join(', ')}

Include:
1. Daily study schedule (realistic hours)
2. Subject-wise breakdown with priority
3. Revision strategy
4. PYQ solving time allocation
5. Buffer days for delays
6. Exam day tips

Be specific and practical.`;

      const messages = [
        { role: 'user', content: prompt }
      ];

      const response = await this.callHuggingFace(messages);
      return response;
    } catch (error) {
      console.error('Study plan error:', error.message);
      throw new Error('Failed to generate study plan: ' + error.message);
    }
  }

  async getStudyRecommendations(subjectName, chapterProgress) {
    try {
      const prompt = `As an AKTU study advisor, provide concise recommendations for:

Subject: ${subjectName}
Progress: ${chapterProgress.completed}/${chapterProgress.total} chapters completed

Provide:
1. What to focus on next
2. Best study techniques
3. Common mistakes to avoid
4. Exam-specific tips
5. Time management advice

Keep it brief and actionable.`;

      const messages = [
        { role: 'user', content: prompt }
      ];

      const response = await this.callHuggingFace(messages);
      return response;
    } catch (error) {
      console.error('Recommendations error:', error.message);
      throw new Error('Failed to get recommendations: ' + error.message);
    }
  }

  // ✅ WORKING: Hugging Face with available model
  async callHuggingFace(messages) {
    if (!HUGGINGFACE_API_KEY) {
      throw new Error('HUGGINGFACE_API_KEY not found in .env');
    }

    try {
      const response = await fetch(
        'https://router.huggingface.co/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'meta-llama/Llama-2-7b-chat-hf', // ✅ CHANGED: Working model
            messages: messages,
            max_tokens: 512,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔴 Hugging Face error:', response.status, errorData);
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      
      if (result.choices && result.choices[0]?.message?.content) {
        return result.choices[0].message.content;
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('❌ Hugging Face API failed:', error.message);
      throw new Error(error.message);
    }
  }
}

export default new StudyAIService();
