
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

  const difficultyInstruction = {
    [Difficulty.EASY]: "Direct facts and simple definitions.",
    [Difficulty.MEDIUM]: "Conceptual understanding and application.",
    [Difficulty.HARD]: "Analysis, subtle details, and logical deduction.",
    [Difficulty.VERY_HARD]: "EXTREME CHALLENGE: Obscure details, complex synthesis, lateral thinking, and highly challenging inference-based questions."
  }[difficulty];

  const prompt = `
    Role: Senior Academic Examiner.
    Task: Create exactly ${count} professional questions from the provided text.
    Target Language: ${targetLanguage === 'original' ? 'The same as input' : (targetLanguage === 'ar' ? 'Arabic' : 'English')}.
    Level: ${difficulty} (${difficultyInstruction}).
    Type: ${type === 'mix' ? 'MCQ and True/False' : type}.

    STRICT RULES:
    1. Base everything on the text provided.
    2. If difficulty is VERY_HARD, make it extremely challenging.
    3. MCQ must have 4 options. True/False must have 2.
    4. Explanation must be detailed.
    5. Return ONLY a JSON array. No text before or after.
    
    TEXT TO ANALYZE:
    ${fileContent.substring(0, 30000)}
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

    const text = response.text || '[]';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions: any[] = JSON.parse(cleanJson);
    
    return questions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i}-${Date.now()}`,
      options: q.options || (q.type === 'true_false' ? (targetLanguage === 'ar' ? ['صح', 'خطأ'] : ['True', 'False']) : [])
    }));
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("الذكاء الاصطناعي واجه مشكلة في معالجة النص. حاول تقليل عدد الأسئلة أو التأكد من أن الملف يحتوي على نص مقروء.");
  }
};
