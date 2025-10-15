import { Context, SessionFlavor } from "grammy";
import { ConversationFlavor } from "@grammyjs/conversations";
import { HydrateFlavor } from "@grammyjs/hydrate";

import type { Quiz, QuizResult } from "./quiz.types";
import type { AssessmentQuiz, AssessmentResult } from "./assessment.types";

export interface SessionData {
  currentDay: number;
  currentLessonIndex: number;
  isAdmin: boolean;
  completedLessons: number[];
  isWaitingForNext: boolean;
  isProcessing: boolean;

  // Поля для квізів
  isWaitingForQuiz: boolean;
  currentQuiz: Quiz | null;
  currentQuestionIndex: number;
  quizAnswers: number[];
  quizResults: QuizResult[];
  quizAttempts: number;

  isWaitingForAssessment: boolean;
  currentAssessment: AssessmentQuiz | null;
  currentAssessmentQuestionIndex: number;
  assessmentAnswers: boolean[];
  assessmentResults: AssessmentResult[];
  lastAssessmentAdvice?: string;

  // certificate
  waitingForName: number[];
  _lastCbAt?: number; // анти-даблклік
  _restoredNoticeSent?: boolean; // показували повідомлення про відновлення
  save?: () => Promise<void>;
}

export interface ExtendedSessionData extends SessionData {
  isWaitingForQuiz: boolean;
  currentQuiz: Quiz | null;
  currentQuestionIndex: number;
  quizAnswers: number[];
  quizResults: QuizResult[];
  quizAttempts: number;
}

export type MyContext = HydrateFlavor<
  Context & SessionFlavor<SessionData> & ConversationFlavor
>;
