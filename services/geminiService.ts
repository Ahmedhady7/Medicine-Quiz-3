
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
    [Difficulty.EASY]: "Basic medical concepts, fundamental terminology, and simple facts.",
    [Difficulty.MEDIUM]: "Clinical presentations, standard diagnostic procedures, and common treatments.",
    [Difficulty.HARD]: "Differential diagnosis, complex pathophysiology, and specific pharmacology.",
    [Difficulty.VERY_HARD]: "Advanced specialized medical knowledge, rare conditions, complex ethical dilemmas, and latest research-based clinical guidelines."
  }[difficulty];

  const prompt = `
    Role: Senior Medical Academic Examiner.
    Task: Generate exactly ${count} medical questions.
    Level: ${difficulty} (${difficultyInstruction})
    Format: ${type === 'mix' ? 'A mixture of MCQs and True/False' : type.toUpperCase()}.
    Language: ${targetLanguage === 'original' ? 'Same as input content' : targetLanguage}.

    Instructions:
    1. Every question must be clinically accurate and relevant to the content.
    2. MCQ must have 4 options. T/F must have exactly 2 options: ["True", "False"] or ["صح", "خطأ"].
    3. The 'explanation' field must provide high-yield clinical reasoning.
    4. Return ONLY a valid JSON array of objects.

    Content to analyze:
    ${fileContent.substring(0, 30000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash is better for structured JSON tasks
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
    // Clean potential markdown code blocks if the API returns them despite the mimeType
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const questions: Question[] = JSON.parse(text);
    return questions;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
