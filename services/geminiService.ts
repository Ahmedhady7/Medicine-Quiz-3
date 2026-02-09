
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateQuizQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  // إنشاء نسخة جديدة في كل مرة لضمان استخدام أحدث مفتاح API مفعل
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const difficultyInstruction = {
    [Difficulty.EASY]: "Basic definitions and explicit facts from the text.",
    [Difficulty.MEDIUM]: "Concepts, logic, and standard applications.",
    [Difficulty.HARD]: "Deep analysis, subtle nuances, and multi-step deduction.",
    [Difficulty.VERY_HARD]: "Expert level: Obscure details, synthesis of ideas, and highly complex inference-based questions."
  }[difficulty];

  const prompt = `
    Role: Senior Academic Examiner.
    Task: Create exactly ${count} high-quality questions from the provided content.
    Language: ${targetLanguage === 'original' ? 'Same as input' : (targetLanguage === 'ar' ? 'Arabic' : 'English')}.
    Level: ${difficulty} (${difficultyInstruction}).
    Type: ${type === 'mix' ? 'MCQ and True/False' : type.toUpperCase()}.

    Rules:
    1. Base questions ONLY on the provided content.
    2. MCQ must have 4 plausible options.
    3. True/False must have 2 options.
    4. Provide a detailed explanation for each answer.
    5. Return ONLY a valid JSON array.

    CONTENT:
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

    const resultText = response.text || '[]';
    // تنظيف أي شوائب قد تظهر في النص (مثل علامات Markdown)
    const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions: any[] = JSON.parse(cleanJson);
    
    return questions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i}-${Date.now()}`,
      options: q.options || (q.type === 'true_false' ? (targetLanguage === 'ar' ? ['صح', 'خطأ'] : ['True', 'False']) : [])
    }));
  } catch (error: any) {
    console.error("Gemini Generation Failure:", error);
    
    // معالجة أخطاء مفتاح الـ API والـ Permissions
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key")) {
      throw new Error("حدث خطأ في مفتاح الـ API. يرجى التأكد من اختيار مفتاح صالح من الإعدادات.");
    }
    
    throw new Error("فشل الذكاء الاصطناعي في توليد الأسئلة. تأكد من جودة النص المرفوع وحاول مرة أخرى.");
  }
};
