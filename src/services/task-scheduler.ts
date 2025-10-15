// src/services/task-scheduler.ts
export interface ScheduledTask {
  userId: string;
  task: () => Promise<void>;
  executeAt: number;
  id: string;
}

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Перевіряємо завдання кожні 100мс
    this.interval = setInterval(() => {
      this.processTasks();
    }, 100);
  }

  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Планує завдання для користувача
   * @param userId - ID користувача
   * @param task - функція для виконання
   * @param delayMs - затримка в мілісекундах
   * @returns ID завдання
   */
  schedule(userId: string, task: () => Promise<void>, delayMs: number): string {
    const taskId = `${userId}_${Date.now()}_${Math.random()}`;
    const scheduledTask: ScheduledTask = {
      userId,
      task,
      executeAt: Date.now() + delayMs,
      id: taskId,
    };

    this.tasks.set(taskId, scheduledTask);
    return taskId;
  }

  /**
   * Скасовує завдання
   */
  cancel(taskId: string) {
    this.tasks.delete(taskId);
  }

  /**
   * Скасовує всі завдання користувача
   */
  cancelUserTasks(userId: string) {
    const toDelete: string[] = [];
    this.tasks.forEach((task, id) => {
      if (task.userId === userId) {
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.tasks.delete(id));
  }

  /**
   * Повертає кількість запланованих завдань
   */
  getPendingCount(): number {
    return this.tasks.size;
  }

  /**
   * Повертає кількість завдань користувача
   */
  getUserTasksCount(userId: string): number {
    let count = 0;
    this.tasks.forEach((task) => {
      if (task.userId === userId) count++;
    });
    return count;
  }

  private async processTasks() {
    const now = Date.now();
    const toExecute: ScheduledTask[] = [];
    const toDelete: string[] = [];

    // Знаходимо завдання для виконання
    this.tasks.forEach((task, id) => {
      if (task.executeAt <= now) {
        toExecute.push(task);
        toDelete.push(id);
      }
    });

    // Видаляємо з черги
    toDelete.forEach((id) => this.tasks.delete(id));

    // Виконуємо завдання
    for (const task of toExecute) {
      try {
        await task.task();
      } catch (error) {
        console.error(
          `Error executing scheduled task for user ${task.userId}:`,
          error,
        );
      }
    }
  }
}
