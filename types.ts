
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  VERY_HARD = 'very_hard'
}

export enum QuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  MULTIPLE_SELECT = 'multiple_select',
  SHORT_ANSWER = 'short_answer',
  PRACTICAL = 'practical',
  MIX = 'mix'
}

export interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string | string[]; // Can be string for single, or array for multiple
  explanation: string;
  type: QuestionType;
  imageUrl?: string;
  imageAlt?: string;
}

export interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  chapterId: string;
  difficulty: Difficulty;
  questions: Question[];
  passingScore: number;
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

export interface User {
  id: string;
  name: string;
  photo: string;
  isLoggedIn: boolean;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
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
  veryHard: string;
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
  back: string;
  home: string;
  login: string;
  logout: string;
  welcome: string;
  importQuiz: string;
  copySuccess: string;
  clearCache: string;
  exportData: string;
  importData: string;
  explanation: string;
  modelAnswer: string;
  quizTitle: string;
  passingScore: string;
  pass: string;
  fail: string;
  rename: string;
  delete: string;
  addCategory: string;
  categoryName: string;
  uncategorized: string;
  mcqRatio: string;
  next: string;
  finish: string;
  multipleSelect: string;
  selectRequired: string;
  checkAnswer: string;
  shortAnswer: string;
  practical: string;
  writeAnswer: string;
  practiceTitle: string;
  switchToMCQ: string;
  switchToType: string;
}
