
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateMedicalQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  // Always use process.env.API_KEY directly for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const difficultyInstruction = {
    [Difficulty.EASY]: "focus on basic definitions and clear medical concepts.",
    [Difficulty.MEDIUM]: "focus on clinical presentations and common diagnostic steps.",
    [Difficulty.HARD]: "focus on differential diagnosis, complex pathophysiology, and second-line treatments.",
    [Difficulty.VERY_HARD]: "focus on rare syndromes, subtle clinical findings, advanced research-level medical knowledge, and complex ethical/legal medical scenarios."
  }[difficulty];

  const prompt = `
    You are a world-class Medical Professor. Based on the following medical content, generate exactly ${count} high-quality ${difficulty} level ${type === 'mix' ? 'mixed MCQ and True/False' : type} questions.
    
    Level Guidance: ${difficultyInstruction}
    
    Strict Guidelines:
    - Questions must be 100% medically accurate.
    - If MCQ, provide 4 unique options.
    - If True/False, provide only "True" and "False" as options.
    - For each question, provide a 'explanation' that gives deep clinical insight.
    - Target Language: ${targetLanguage === 'original' ? 'the same as the input' : targetLanguage}.
    
    Input Content:
    ${fileContent.substring(0, 45000)}
  `;

  try {
    // Using gemini-3-pro-preview for complex reasoning tasks like medical question generation
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    // Accessing the text property directly as it is not a method
    const questions: Question[] = JSON.parse(response.text || '[]');
    return questions;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
