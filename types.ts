
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export enum QuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  MIX = 'mix'
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  type: QuestionType;
}

export interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  chapterId: string;
  difficulty: Difficulty;
  questions: Question[];
  createdAt: number;
}

export interface Chapter {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  userName: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  date: number;
}

export interface LanguageStrings {
  title: string;
  uploadFiles: string;
  generateQuiz: string;
  subjects: string;
  chapters: string;
  stats: string;
  leaderboard: string;
  difficulty: string;
  easy: string;
  medium: string;
  hard: string;
  mcq: string;
  tf: string;
  mix: string;
  questionCount: string;
  startQuiz: string;
  results: string;
  share: string;
  score: string;
  time: string;
  translate: string;
  toArabic: string;
  toEnglish: string;
  original: string;
}
