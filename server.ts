import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Allow large payloads for base64 images and extracted text
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post('/api/generate-quiz', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

  if (!apiKey || apiKey.trim() === '') {
    const keyError = "Missing Gemini API key: process.env.GEMINI_API_KEY is not defined or is empty on the server.";
    console.error(keyError);
    return res.status(500).json({ error: keyError });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const {
      fileContent,
      images = [],
      count = 10,
      type,
      difficulty,
      targetLanguage = 'original',
      mcqRatio = 50,
      enabledTypes,
    } = req.body;

    const requestedCount = Math.max(1, Number(count) || 1);

    const difficultyInstruction: Record<string, string> = {
      easy: 'Basic facts and direct content.',
      medium: 'Concepts and applications.',
      hard: 'Analysis and synthesis of ideas.',
      very_hard: 'EXTREME CHALLENGE: Obscure details and highly complex inference questions.',
    };

    let typeDescription = '';
    if (type === 'mix') {
      if (enabledTypes && enabledTypes.length > 0) {
        const formattedTypes = enabledTypes
          .map((t: string) => {
            if (t === 'mcq') return 'mcq (Multiple Choice with 1 correct option)';
            if (t === 'true_false') return 'true_false (True/False)';
            if (t === 'multiple_select') return 'multiple_select (Multiple answers)';
            if (t === 'short_answer') return 'short_answer (Written Answer)';
            if (t === 'practical') return 'practical (Anatomical / Visual identification based on images)';
            return t;
          })
          .join(', ');
        typeDescription = `You MUST ONLY generate questions of the following types: [${formattedTypes}]. Absolutely no other type of questions should be generated. Distribute the ${requestedCount} question(s) evenly among these selected types.`;
      } else {
        typeDescription = `Mix of MCQ, True/False, and MULTIPLE_SELECT. Aim for approximately ${mcqRatio}% MCQ/MultipleSelect and ${100 - mcqRatio}% True/False.`;
      }
    } else if (type === 'multiple_select') {
      typeDescription = 'Questions where one OR MORE options can be correct.';
    } else if (type === 'short_answer') {
      typeDescription = 'Short answer questions where the user must type the answer.';
    } else if (type === 'practical') {
      typeDescription = 'Practical questions based on images. Can be MCQ or Short Answer.';
    } else {
      typeDescription = type;
    }

    const prompt = `
      Role: World-Class Academic Examiner.
      Objective: Generate exactly ${requestedCount} question(s) based ON ALL the provided context (Text and Images).

      CONTEXT STRUCTURE:
      - Text Context: Contains one or more documents.
      - Image Context: ${images.length > 0 ? `${images.length} images provided.` : 'No images provided.'}

      CRITICAL INSTRUCTIONS:
      1. EXACT COUNT: You must generate an array containing EXACTLY ${requestedCount} question object(s).
      2. EQUAL REPRESENTATION: Distribute the total count (${requestedCount}) as equally as possible among all identified sources (files/images).
      3. VISUAL QUESTIONS: If images are provided, generate questions that refer ONLY to visual details in the images (e.g., Identifying anatomical structures, histological slides, clinical findings). 
      4. TEXT IS REDACTED: All text labels and titles have been whited out from the provided images to prevent spoilers. You MUST generate questions that test visual recognition. Use the "Text Context" provided separately to know the subject matter, but ensure the student must look at the image features to answer.
      5. NO TEXTUAL SPOILERS: Do NOT create questions that can be answered by simply reading any text potentially remaining in the image.
      6. QUESTION VARIETY: 
         - Type: ${typeDescription}.
         - Difficulty: ${difficulty} (${difficultyInstruction[difficulty] || difficulty}).
      7. SHUFFLE ORDER: Randomize the order of questions.
      8. LANGUAGE: ${targetLanguage === 'original' ? 'Same as the source language' : targetLanguage}.
      
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

    const parts: any[] = [
      { text: prompt },
      { text: fileContent || '' },
      ...images.map((img: any) => ({ inlineData: img.inlineData })),
    ];

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let parsedQuestions: any[] = [];

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Always provide 4 options for MCQ, short_answer, etc.',
            },
            correctAnswer: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of correct answers.',
            },
            explanation: { type: Type.STRING },
            type: { type: Type.STRING },
            imageRef: {
              type: Type.STRING,
              description: "Reference to provided image index like 'image_0', 'image_1' etc.",
            },
          },
          required: ['text', 'correctAnswer', 'explanation', 'type', 'options'],
        },
      },
    };

    for (const modelName of candidateModels) {
      try {
        console.log(`Attempting generation with model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: schemaConfig,
        });

        let rawText = response.text || '';
        // Clean markdown backticks if any
        if (rawText.startsWith('```json')) {
          rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        } else if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
        }

        parsedQuestions = JSON.parse(rawText.trim() || '[]');
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          console.log(`Successfully generated ${parsedQuestions.length} questions using ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.error(`Model ${modelName} error:`, err);
        lastError = err;
      }
    }

    if (!parsedQuestions || parsedQuestions.length === 0) {
      const detailError = lastError?.message || (typeof lastError === 'string' ? lastError : JSON.stringify(lastError)) || "Could not generate questions from the provided content.";
      console.error("All candidate models failed. Last error:", detailError);
      return res.status(500).json({ error: detailError });
    }

    const questions = parsedQuestions.map((q, i) => {
      let qType = q.type;
      if (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1 && qType !== 'short_answer') {
        qType = 'multiple_select';
      }

      let imageUrl: string | undefined = undefined;
      if (q.imageRef && q.imageRef.startsWith('image_')) {
        const idx = parseInt(q.imageRef.split('_')[1], 10);
        if (!isNaN(idx) && images[idx]) {
          imageUrl = `data:${images[idx].inlineData.mimeType};base64,${images[idx].inlineData.data}`;
        }
      }

      return {
        ...q,
        id: q.id || `q-${i}-${Date.now()}`,
        type: qType,
        correctAnswer: q.correctAnswer,
        options: q.options || (qType === 'true_false' ? ['صح', 'خطأ'] : []),
        imageUrl: imageUrl,
      };
    });

    return res.json({ questions });
  } catch (error: any) {
    console.error("Exact backend error during quiz generation:", error);
    const rawError = error?.message || (typeof error === 'string' ? error : JSON.stringify(error)) || "Unknown error occurred";
    return res.status(500).json({ error: rawError });
  }
});

// Vite dev middleware or static serving
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
