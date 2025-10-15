// src/features/course/progress-queue.ts
import PQueue from "p-queue";
import type { MyContext } from "../../types";
import { queueConfig } from "../../config/queue.config";
import { queueManager } from "../../managers/queue.manager";
import { startAutoProgress, handleProgressError } from "./auto-progress";

export const progressQueue = new PQueue({
  concurrency: queueConfig.maxConcurrent,
  intervalCap: queueConfig.rateCap,
  interval: queueConfig.rateInterval,
});

const usersInQueue = new Set<string>();

export function scheduleUserProgress(ctx: MyContext) {
  const userId = ctx.from!.id.toString();

  console.log(`[QUEUE] Scheduling progress for user ${userId}`);
  console.log(`[QUEUE] Current lesson: ${ctx.session.currentLessonIndex}`);
  console.log(`[QUEUE] Is processing: ${ctx.session.isProcessing}`);
  console.log(`[QUEUE] Already in queue: ${usersInQueue.has(userId)}`);

  // Перевіряємо чи вже в черзі
  if (usersInQueue.has(userId)) {
    console.log(`[QUEUE] User ${userId} already queued, skipping`);
    return;
  }

  // Додаємо в чергу
  usersInQueue.add(userId);
  console.log(`[QUEUE] Added user ${userId} to queue`);

  // Додаємо завдання в чергу
  progressQueue
    .add(async () => {
      console.log(`[QUEUE] Starting job for user ${userId}`);

      try {
        // Перевіряємо чи контекст ще валідний
        if (!ctx.from || !ctx.session) {
          console.error(`[QUEUE] Invalid context for user ${userId}`);
          return;
        }

        // Запускаємо прогрес
        await startAutoProgress(ctx);

        console.log(`[QUEUE] Job completed for user ${userId}`);
      } catch (err) {
        console.error(`[QUEUE ERROR] Failed for user ${userId}:`, err);

        try {
          await handleProgressError(ctx, err);
        } catch (e) {
          console.error(`[QUEUE ERROR] Error handler also failed:`, e);
        }
      } finally {
        // Очищаємо стан
        usersInQueue.delete(userId);
        queueManager.stopProcessing(userId);

        console.log(`[QUEUE] Cleanup done for user ${userId}`);
      }
    })
    .catch((err) => {
      console.error(
        `[QUEUE FATAL] Failed to enqueue job for user ${userId}:`,
        err,
      );
      usersInQueue.delete(userId);
    });

  console.log(
    `[QUEUE] Job enqueued for user ${userId}, queue size: ${progressQueue.size}`,
  );
}

// Функція для очищення черги користувача
export function clearUserQueue(userId: string) {
  usersInQueue.delete(userId);
  console.log(`[QUEUE] Cleared queue for user ${userId}`);
}

// Функція для перевірки стану черги
export function getQueueStatus() {
  return {
    size: progressQueue.size,
    pending: progressQueue.pending,
    usersInQueue: Array.from(usersInQueue),
  };
}
