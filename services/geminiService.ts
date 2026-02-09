
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateMedicalQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  const prompt = `
    You are a medical education expert. Based on the following medical content, generate exactly ${count} high-quality ${difficulty} level ${type === 'mix' ? 'mixed MCQ and True/False' : type} questions.
    
    Guidelines:
    - Questions must be medically accurate.
    - If MCQ, provide 4 options.
    - If True/False, provide "True" and "False" as options.
    - Ensure the explanation provides deep medical insight.
    - Output language: ${targetLanguage === 'original' ? 'the same as the input' : targetLanguage}.
    
    Content:
    ${fileContent.substring(0, 50000)} // Limiting content for context window safety
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
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["id", "text", "correctAnswer", "explanation", "type"]
          }
        }
      }
    });

    const questions: Question[] = JSON.parse(response.text || '[]');
    return questions;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
