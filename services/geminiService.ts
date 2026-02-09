
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateQuizQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_ERROR");
  }

  // إنشاء مثيل جديد في كل استدعاء لضمان الحصول على أحدث مفتاح مختار
  const ai = new GoogleGenAI({ apiKey });

  const difficultyInstruction = {
    [Difficulty.EASY]: "Basic facts and direct content.",
    [Difficulty.MEDIUM]: "Concepts and applications.",
    [Difficulty.HARD]: "Analysis and synthesis of ideas.",
    [Difficulty.VERY_HARD]: "EXTREME CHALLENGE: Obscure details and highly complex inference questions."
  }[difficulty];

  const prompt = `
    Role: World-Class Academic Examiner.
    Generate exactly ${count} professional questions from this text.
    Difficulty: ${difficulty} (${difficultyInstruction}).
    Type: ${type === 'mix' ? 'MCQ and True/False' : type}.
    Language: ${targetLanguage === 'original' ? 'As input' : targetLanguage}.

    Rules:
    1. Base ONLY on the provided text.
    2. Detailed explanation required.
    3. Return valid JSON array ONLY.

    TEXT:
    ${fileContent.substring(0, 32000)}
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
    const questions: any[] = JSON.parse(result);
    
    return questions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i}-${Date.now()}`,
      options: q.options || (q.type === 'true_false' ? ['صح', 'خطأ'] : [])
    }));
  } catch (error: any) {
    console.error("Gemini Fail:", error);
    if (error.message?.includes("API key") || error.message?.includes("set when running in a browser")) {
       throw new Error("API_KEY_ERROR");
    }
    throw new Error("حدث خطأ في توليد الأسئلة. حاول تقليل عددها أو تغيير الملف.");
  }
};
