// src/middleware/ensure-session.ts
import type { MyContext } from "../types";
import { FirestoreSessionStorage, getUser } from "../services/firebase";
import { queueManager } from "../managers/queue.manager";

const storage = new FirestoreSessionStorage<MyContext["session"]>();

export async function ensureSession(ctx: MyContext, next: () => Promise<void>) {
  if (!ctx.from?.id) return next();

  const uid = String(ctx.from.id);

  // Якщо сесія вже є і валідна - продовжуємо
  if (
    ctx.session &&
    Object.keys(ctx.session).length > 0 &&
    ctx.session.currentLessonIndex !== undefined
  ) {
    // Зберігаємо сесію після кожної взаємодії
    ctx.api.config.use(async (prev, method, payload, signal) => {
      const result = await prev(method, payload, signal);
      if (ctx.session && method !== "getUpdates") {
        await storage.write(uid, ctx.session);
      }
      return result;
    });
    return next();
  }

  // Спробуємо відновити з Firestore
  const saved: any = await storage.read(uid);

  if (saved && saved.currentLessonIndex !== undefined) {
    // Відновлюємо всю сесію
    ctx.session = saved;

    // Скидаємо "летючі" прапори після рестарту
    ctx.session.isProcessing = false;
    ctx.session.isWaitingForNext = false;
    queueManager.stopProcessing(uid);

    // Маркер для повідомлення користувачу про відновлення
    (ctx as any)._restored = true;

    console.log(
      `Session restored for user ${uid}, lesson: ${ctx.session.currentLessonIndex}`,
    );
    return next();
  }

  // Спробуємо відновити з бази даних користувачів
  const user = await getUser(uid);

  if (user) {
    const completed = user.completedLessons ?? [];
    const startIndex = user.currentDay ?? 0;

    ctx.session = {
      currentDay: startIndex,
      currentLessonIndex: startIndex,
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
      isAdmin: false,
    } as any;

    // Зберігаємо відновлену сесію
    await storage.write(uid, ctx.session);

    (ctx as any)._restored = true;
    console.log(
      `Session created from user data for ${uid}, lesson: ${ctx.session.currentLessonIndex}`,
    );
  } else {
    // Новий користувач - створюємо базову сесію
    ctx.session = {
      currentDay: 0,
      currentLessonIndex: 0,
      completedLessons: [],
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
      isAdmin: false,
    } as any;

    console.log(`New session created for user ${uid}`);
  }

  // Автоматичне збереження сесії після кожного оновлення
  ctx.api.config.use(async (prev, method, payload, signal) => {
    const result = await prev(method, payload, signal);
    if (ctx.session && method !== "getUpdates") {
      await storage.write(uid, ctx.session);
    }
    return result;
  });

  return next();
}
