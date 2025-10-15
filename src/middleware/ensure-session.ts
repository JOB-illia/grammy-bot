// middleware/ensure-session.ts
import type { MyContext } from "../types";
import { FirestoreSessionStorage, getUser } from "../services/firebase";
import { queueManager } from "../managers/queue.manager";

const storage = new FirestoreSessionStorage<MyContext["session"]>();

export async function ensureSession(ctx: MyContext, next: () => Promise<void>) {
  if (!ctx.from?.id) return next();

  const uid = String(ctx.from.id);

  if (ctx.session && Object.keys(ctx.session).length > 0) {
    return next();
  }

  const saved = await storage.read(uid);

  if (saved) {
    // відновлюємо всю сесію
    // @ts-ignore
    ctx.session = saved;

    // скидаємо летючі прапори щоб уникнути "хвостів" після рестарту
    ctx.session.isProcessing = false;
    queueManager.stopProcessing(uid);

    // Маркер для подальшого повідомлення юзеру
    (ctx as any)._restored = true;
    return next();
  }

  const user = await getUser(uid);

  if (user) {
    const completed = user.completedLessons ?? [];
    const startIndex = Math.max(...completed, -1) + 1;

    ctx.session = {
      currentDay: user.currentDay ?? startIndex,
      currentLessonIndex: startIndex < 0 ? 0 : startIndex,
      completedLessons: completed,
      isWaitingForNext: false,
      isProcessing: false,
      isWaitingForQuiz: false,
      currentQuiz: null,
      currentQuestionIndex: 0,
      quizAnswers: [],
      quizResults: [],
      quizAttempts: 0,
      isWaitingForAssessment: false,
      currentAssessment: null,
      currentAssessmentQuestionIndex: 0,
      assessmentAnswers: [],
      assessmentResults: [],
      lastAssessmentAdvice: "",
      waitingForName: [],
    } as any;

    (ctx as any)._restored = true;
  }

  return next();
}
