import { session } from "grammy";
import type { MyContext, ExtendedSessionData } from "../types";
import { FirestoreSessionStorage } from "../services/firebase";

export const sessionMiddleware = session<ExtendedSessionData, MyContext>({
  initial: (): ExtendedSessionData => ({
    mode: null,
    currentDay: 0,
    currentLessonIndex: 0,
    isAdmin: false,
    completedLessons: [],
    isWaitingForNext: false,
    isProcessing: false,

    // Quiz fields
    isWaitingForQuiz: false,
    currentQuiz: null,
    currentQuestionIndex: 0,
    quizAnswers: [],
    quizResults: [],
    quizAttempts: 0,

    // Assessment fields
    isWaitingForAssessment: false,
    currentAssessment: null,
    currentAssessmentQuestionIndex: 0,
    assessmentAnswers: [],
    assessmentResults: [],
    lastAssessmentAdvice: "",

    waitingForName: [],
    _lastCbAt: 0,
    _restoredNoticeSent: false,
  }),
  storage: new FirestoreSessionStorage<ExtendedSessionData>(),
  getSessionKey: (ctx: Omit<MyContext, "session">): string | undefined => {
    const chatId =
      (ctx as any).chat?.id ??
      ctx.callbackQuery?.message?.chat?.id ??
      (ctx as any).message?.chat?.id ??
      ctx.from?.id;

    return chatId ? String(chatId) : undefined;
  },
});
