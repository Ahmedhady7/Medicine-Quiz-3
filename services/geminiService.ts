
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Difficulty } from "../types";

export const generateMedicalQuestions = async (
  fileContent: string,
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original'
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const difficultyInstruction = {
    [Difficulty.EASY]: "Focus on basic definitions, simple facts, and clear concepts from the text.",
    [Difficulty.MEDIUM]: "Focus on core principles, analysis of standard scenarios, and common applications.",
    [Difficulty.HARD]: "Focus on complex reasoning, detailed analysis of nuances, and connections between different parts of the content.",
    [Difficulty.VERY_HARD]: "Focus on expert-level insights, subtle exceptions, highly advanced theoretical scenarios, and critical evaluation of the material."
  }[difficulty];

  const prompt = `
    Role: Expert Academic Examiner and Educator.
    Task: Generate exactly ${count} high-quality questions based strictly on the provided content.
    Level: ${difficulty} (${difficultyInstruction})
    Format: ${type === 'mix' ? 'A mixture of Multiple Choice Questions (MCQ) and True/False' : type.toUpperCase()}.
    Language: ${targetLanguage === 'original' ? 'The same language as the input content' : targetLanguage}.

    Strict Instructions:
    1. Every question must be factually accurate based on the provided text.
    2. MCQ must have 4 unique options. True/False must have exactly 2 options: ["True", "False"] or ["صح", "خطأ"] depending on the language.
    3. The 'explanation' field must provide a clear and detailed reasoning for why the correct answer is right.
    4. Return ONLY a valid JSON array of objects without any conversational text.

    Content to analyze:
    ${fileContent.substring(0, 35000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Using a highly capable model for structured output
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

    let text = response.text || '[]';
    // Clean potential markdown code blocks
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const questions: Question[] = JSON.parse(text);
    return questions;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};
