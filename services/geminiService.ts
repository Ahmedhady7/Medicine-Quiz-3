
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateQuizQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // تعزيز تعليمات الصعوبة لتكون أكثر تحدياً في المستويات العليا
  const difficultyInstruction = {
    [Difficulty.EASY]: "Focus on basic definitions, surface-level facts, and explicit information directly stated in the text.",
    [Difficulty.MEDIUM]: "Focus on core concepts, understanding relationships between ideas, and standard applications of the information.",
    [Difficulty.HARD]: "Focus on analysis, identifying nuances, subtle details, and requiring logical deduction based on the content.",
    [Difficulty.VERY_HARD]: "EXTREME CHALLENGE: Focus on obscure details, complex synthesis of multiple points, lateral thinking, and highly challenging inference-based questions that test deep mastery and critical evaluation of the text."
  }[difficulty];

  const prompt = `
    Role: World-Class Senior Academic Examiner and Professional Quiz Creator.
    Task: Create exactly ${count} high-quality, professional questions based strictly on the provided content.
    
    IMPORTANT: You must accept the content as it is, regardless of the topic (Medical, Technical, Academic, or General). Do not refuse based on subject matter.
    
    Difficulty Level: ${difficulty} (${difficultyInstruction})
    Format: ${type === 'mix' ? 'A balanced mixture of Multiple Choice (MCQ) and True/False' : type.toUpperCase()}.
    Language: ${targetLanguage === 'original' ? 'The same language as the input text' : (targetLanguage === 'ar' ? 'Arabic' : 'English')}.

    Rules:
    1. If difficulty is VERY_HARD, make the questions truly challenging for experts.
    2. MCQ: Exactly 4 distinct and plausible options.
    3. True/False: Exactly 2 options (True/False or صح/خطأ).
    4. Explanation: Provide a deep, insightful "why" for the correct answer.
    5. Output: Return ONLY a valid JSON array of objects. No markdown blocks, no intro, no outro.
    
    Content to analyze:
    ${fileContent.substring(0, 38000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["id", "text", "correctAnswer", "explanation", "type"]
          }
        }
      }
    });

    const text = response.text || '[]';
    // تنظيف المخرجات من أي شوائب برمجية قد تظهر
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions: Question[] = JSON.parse(cleanJson);
    
    // تأمين الـ IDs إذا كانت مفقودة
    return questions.map((q, idx) => ({
      ...q,
      id: q.id || `q-${idx}-${Date.now()}`
    }));
  } catch (error) {
    console.error("Gemini Engine Error:", error);
    throw new Error("فشل الذكاء الاصطناعي في توليد الأسئلة. حاول تقليل عدد الأسئلة أو التأكد من وضوح النص.");
  }
};
