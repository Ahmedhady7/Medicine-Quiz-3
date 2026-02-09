
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateQuizQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  // إنشاء مثيل جديد لضمان استخدام المفتاح المختار حالياً
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const difficultyInstruction = {
    [Difficulty.EASY]: "Focus on direct facts and basic definitions found in the text.",
    [Difficulty.MEDIUM]: "Focus on concepts and logical applications of the information.",
    [Difficulty.HARD]: "Focus on deep analysis, subtle nuances, and synthesis of ideas.",
    [Difficulty.VERY_HARD]: "EXTREME CHALLENGE: Obscure details, lateral thinking, and highly complex inference-based questions for experts."
  }[difficulty];

  const prompt = `
    Role: World-Class Senior Academic Examiner.
    Task: Generate exactly ${count} high-quality questions based on the provided content.
    Language: ${targetLanguage === 'original' ? 'The same as input' : (targetLanguage === 'ar' ? 'Arabic' : 'English')}.
    Difficulty: ${difficulty} (${difficultyInstruction}).
    Question Type: ${type === 'mix' ? 'MCQ and True/False' : type.toUpperCase()}.

    Strict Requirements:
    1. Questions must be derived ONLY from the provided text.
    2. MCQ must have 4 distinct options.
    3. True/False must have 2 options.
    4. Include a detailed "Explanation" for the correct answer.
    5. Return ONLY a valid JSON array.

    TEXT CONTENT:
    ${fileContent.substring(0, 35000)}
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
            required: ["text", "correctAnswer", "explanation", "type"]
          }
        }
      }
    });

    const result = response.text || '[]';
    const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions: any[] = JSON.parse(cleanJson);
    
    return questions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i}-${Date.now()}`,
      options: q.options || (q.type === 'true_false' ? (targetLanguage === 'ar' ? ['صح', 'خطأ'] : ['True', 'False']) : [])
    }));
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // إذا كان الخطأ بسبب المفتاح المفقود أو غير الصحيح
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key")) {
      throw new Error("API_KEY_ERROR");
    }
    
    throw new Error("فشل الذكاء الاصطناعي في معالجة النص. حاول مرة أخرى أو استخدم ملفاً مختلفاً.");
  }
};
