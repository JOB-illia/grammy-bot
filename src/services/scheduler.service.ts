import { queueConfig } from "../config/queue.config";
import { getUsers } from "./firebase";
import { loadCourse } from "./courseLoader";
import { updateUserProgress } from "./firebase";
import { bot } from "../bot/instance";
import { sleep } from "../utils/sleep";

export async function setupScheduler() {
  console.log("Starting scheduled lesson distribution...");
  try {
    const users = await getUsers();
    const course = await loadCourse();

    const batchSize = queueConfig.maxConcurrent;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (user) => {
          if (!user.isActive) return;

          try {
            const nextLesson = (user.currentDay || 0) + 1;
            if (nextLesson < course.length) {
              const lesson = course[nextLesson];
              await bot.api.sendMessage(
                user.userId,
                `📚 *Nowa lekcja jest dostępna!*\n\n${lesson.title}`,
                { parse_mode: "Markdown" },
              );

              await updateUserProgress(user.userId, nextLesson);
            }
          } catch (error) {
            console.error(`Error sending to ${user.userId}:`, error);
          }
        }),
      );

      await sleep(1000);
    }
  } catch (error) {
    console.error("Error in scheduled distribution:", error);
  }
}
