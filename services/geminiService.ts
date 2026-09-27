import { Question, QuestionType, Difficulty } from "../types";

export interface GeminiPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export const generateQuizQuestions = async (
  fileContent: string,
  images: GeminiPart[],
  count: number,
  type: QuestionType,
  difficulty: Difficulty,
  targetLanguage: 'en' | 'ar' | 'original',
  mcqRatio: number = 50,
  enabledTypes?: QuestionType[]
): Promise<Question[]> => {
  try {
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileContent,
        images,
        count,
        type,
        difficulty,
        targetLanguage,
        mcqRatio,
        enabledTypes,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const rawError = errJson.error || `HTTP Error ${response.status}: Failed to generate questions`;
      throw new Error(rawError);
    }

    const data = await response.json();
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("No questions were returned by the AI generator.");
    }
    return data.questions;
  } catch (error: any) {
    console.error("Quiz generation error:", error);
    throw new Error(error.message || "Failed to generate quiz questions.");
  }
};
