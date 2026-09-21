
import { GoogleGenAI, Type } from "@google/genai";
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
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_ERROR");
  }

  const ai = new GoogleGenAI({ apiKey });

  const difficultyInstruction = {
    [Difficulty.EASY]: "Basic facts and direct content.",
    [Difficulty.MEDIUM]: "Concepts and applications.",
    [Difficulty.HARD]: "Analysis and synthesis of ideas.",
    [Difficulty.VERY_HARD]: "EXTREME CHALLENGE: Obscure details and highly complex inference questions."
  }[difficulty];

  let typeDescription = "";
  if (type === 'mix') {
    if (enabledTypes && enabledTypes.length > 0) {
      const formattedTypes = enabledTypes.map(t => {
        if (t === QuestionType.MCQ) return "mcq (Multiple Choice with 1 correct option)";
        if (t === QuestionType.TRUE_FALSE) return "true_false (True/False)";
        if (t === QuestionType.MULTIPLE_SELECT) return "multiple_select (Multiple answers)";
        if (t === QuestionType.SHORT_ANSWER) return "short_answer (Written Answer)";
        if (t === QuestionType.PRACTICAL) return "practical (Anatomical / Visual identification based on images)";
        return t;
      }).join(", ");
      typeDescription = `You MUST ONLY generate questions of the following types: [${formattedTypes}]. Absolutely no other type of questions should be generated. Try to distribute the ${count} questions as evenly as possible among these selected types.`;
    } else {
      typeDescription = `Mix of MCQ, True/False, and MULTIPLE_SELECT. Aim for approximately ${mcqRatio}% MCQ/MultipleSelect and ${100 - mcqRatio}% True/False.`;
    }
  } else if (type === 'multiple_select') {
    typeDescription = "Questions where one OR MORE options can be correct.";
  } else if (type === 'short_answer') {
    typeDescription = "Short answer questions where the user must type the answer.";
  } else if (type === 'practical') {
    typeDescription = "Practical questions based on images. Can be MCQ or Short Answer.";
  } else {
    typeDescription = type;
  }

  const prompt = `
    Role: World-Class Academic Examiner.
    Objective: Generate exactly ${count} professional questions based ON ALL the provided context (Text and Images).

    CONTEXT STRUCTURE:
    - Text Context: Contains one or more documents.
    - Image Context: ${images.length > 0 ? `${images.length} images provided.` : 'No images provided.'}

    CRITICAL INSTRUCTIONS:
    1. EQUAL REPRESENTATION: Distribute the total count (${count}) as equally as possible among all identified sources (files/images).
    2. VISUAL QUESTIONS: If images are provided, generate questions that refer ONLY to visual details in the images (e.g., Identifying anatomical structures, histological slides, clinical findings). 
    3. TEXT IS REDACTED: All text labels and titles have been whited out from the provided images to prevent spoilers. You MUST generate questions that test visual recognition. Use the "Text Context" provided separately to know the subject matter, but ensure the student must look at the image features to answer.
    4. NO TEXTUAL SPOILERS: Do NOT create questions that can be answered by simply reading any text potentially remaining in the image.
    5. QUESTION VARIETY: 
       - Type: ${typeDescription}.
       - Difficulty: ${difficulty} (${difficultyInstruction}).
    6. SHUFFLE ORDER: Randomize the order of questions.
    7. LANGUAGE: ${targetLanguage === 'original' ? 'Same as the source language' : targetLanguage}.
    
    Rules:
    1. For MULTIPLE_SELECT: "correctAnswer" must be an array of all correct options.
    2. For SHORT_ANSWER: 
       - "correctAnswer" should be an array with the primary correct answer(s).
       - IMPORTANT: Even for SHORT_ANSWER, you MUST provide 4 plausible "options" (including the correct one). This allows the student to switch between typing and multiple-choice.
    3. For PRACTICAL: Questions MUST be based on identifying visual features. The student should have to look at the image to know the answer, not read the slide text.
    4. Return valid JSON array ONLY.
    
    JSON Schema Requirement:
    - text: The high-quality academic question text.
    - options: List of 4 options (MUST be provided even for short_answer and mcq).
    - correctAnswer: Array of correct strings.
    - explanation: Comprehensive scientific explanation.
    - type: The specific type (mcq, true_false, multiple_select, short_answer).
    - imageRef: Reference to provided image index like 'image_0'.
  `;

  try {
    const parts: any[] = [{ text: prompt }, { text: fileContent }, ...images.map(img => ({ inlineData: img.inlineData }))];
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Always provide 4 options for MCQ, short_answer, etc." },
              correctAnswer: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of correct answers."
              },
              explanation: { type: Type.STRING },
              type: { type: Type.STRING },
              imageRef: { type: Type.STRING, description: "Reference to provided image index like 'image_0', 'image_1' etc." }
            },
            required: ["text", "correctAnswer", "explanation", "type", "options"]
          }
        }
      }
    });

    const questions: any[] = JSON.parse(response.text || '[]');
    
    return questions.map((q, i) => {
      let qType = q.type as QuestionType;
      // Heuristic fix for type mismatches
      if (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1 && qType !== QuestionType.SHORT_ANSWER) {
        qType = QuestionType.MULTIPLE_SELECT;
      }

      // Handle image reference
      let imageUrl: string | undefined = undefined;
      if (q.imageRef && q.imageRef.startsWith('image_')) {
        const idx = parseInt(q.imageRef.split('_')[1]);
        if (!isNaN(idx) && images[idx]) {
          imageUrl = `data:${images[idx].inlineData.mimeType};base64,${images[idx].inlineData.data}`;
        }
      }

      return {
        ...q,
        id: q.id || `q-${i}-${Date.now()}`,
        type: qType,
        correctAnswer: q.correctAnswer,
        options: q.options || (qType === QuestionType.TRUE_FALSE ? ['صح', 'خطأ'] : []),
        imageUrl: imageUrl
      };
    });
  } catch (error: any) {
    console.error("Gemini Fail:", error);
    if (error.message?.includes("API key") || error.message?.includes("set when running in a browser")) {
       throw new Error("API_KEY_ERROR");
    }
    throw new Error("حدث خطأ في توليد الأسئلة. حاول تقليل عددها أو تغيير الملف.");
  }
};
