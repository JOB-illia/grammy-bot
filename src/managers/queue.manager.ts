import { queueConfig } from "../config/queue.config";

/**
 * Менеджер черг на користувача:
 * - FIFO для кожного userId
 * - глобальний ліміт одночасних обробок (maxConcurrent)
 * - пауза між тасками для одного юзера (delayBetweenLessons)
 */
export class UserQueueManager {
  // Черга задач для кожного юзера
  private queues = new Map<string, Array<() => Promise<void>>>();

  // Позначка, що зараз для цього юзера щось виконується
  private processing = new Set<string>();

  // Скільки юзерів зараз активно обробляються (для глобального ліміту)
  private globalActive = 0;

  private readonly maxConcurrent: number;
  private readonly delayBetweenLessons: number;

  constructor(maxConcurrent: number, delayMs: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent || 1);
    this.delayBetweenLessons = Math.max(0, delayMs || 0);
  }

  /** Чи зараз щось виконується для юзера */
  isProcessing(userId: string): boolean {
    return this.processing.has(userId);
  }

  /**
   * Сумісність зі старим інтерфейсом:
   * Пробує «зайняти» слот. Якщо перевищено глобальний ліміт — повертає false.
   * У новій моделі це не обовʼязково викликати напряму — достатньо enqueue().
   */
  startProcessing(userId: string): boolean {
    if (this.globalActive >= this.maxConcurrent) return false;
    if (!this.processing.has(userId)) {
      this.processing.add(userId);
      this.globalActive++;
    }
    return true;
  }

  /**
   * Сумісність: знімає позначку активності з юзера
   * (поточну таску примусово не відміняє, але наступні не підхопляться).
   */
  stopProcessing(userId: string): void {
    if (this.processing.delete(userId)) {
      this.globalActive = Math.max(0, this.globalActive - 1);
    }
    // Можемо також вичистити чергу користувача, якщо хочеш «жорстку» зупинку:
    // this.queues.delete(userId);
  }

  /** Скільки юзерів зараз паралельно обробляються */
  getActiveCount(): number {
    return this.globalActive;
  }

  /** Повне очищення всіх черг і статусів */
  clear(): void {
    this.queues.clear();
    this.processing.clear();
    this.globalActive = 0;
  }

  /**
   * НОВЕ: поставити задачу в чергу конкретного користувача.
   * Завжди повертає void (фоновий запуск), помилки всередині логуються.
   */
  enqueue(userId: string, task: () => Promise<void>): void {
    if (!userId) return;

    // Додаємо таску в чергу юзера
    const q = this.queues.get(userId) ?? [];
    q.push(task);
    this.queues.set(userId, q);

    // Спробуємо стартувати виконання, якщо ще не виконується
    void this.tryProcess(userId);
  }

  // ---------------------------------------
  // Внутрішня логіка
  // ---------------------------------------

  private async tryProcess(userId: string): Promise<void> {
    // Якщо для цього юзера вже крутиться обробка — не дублюємо
    if (this.processing.has(userId)) return;

    const q = this.queues.get(userId);
    if (!q || q.length === 0) return;

    // Якщо глобальний ліміт вибраний — зачекаємо, поки звільниться слот
    if (this.globalActive >= this.maxConcurrent) {
      // Маленький бепофф: спробуємо пізніше
      setTimeout(() => void this.tryProcess(userId), 50);
      return;
    }

    // Стартуємо процес цього юзера
    this.processing.add(userId);
    this.globalActive++;

    try {
      while (true) {
        const queue = this.queues.get(userId);
        const next = queue?.shift();
        if (!next) {
          // Порожньо — зупиняємось
          this.queues.delete(userId);
          break;
        }

        try {
          await next();
        } catch (err) {
          // Не валимо всю чергу через одну помилку
          // (логування — на твій смак)
          // eslint-disable-next-line no-console
          console.error(`[queue][${userId}] task error:`, err);
        }

        // Пауза між задачами одного юзера (щоб не «заливати» повідомленнями)
        if (this.delayBetweenLessons > 0) {
          await new Promise((r) => setTimeout(r, this.delayBetweenLessons));
        }
      }
    } finally {
      // Позначка завершення для цього юзера
      if (this.processing.delete(userId)) {
        this.globalActive = Math.max(0, this.globalActive - 1);
      }
      // Якщо за час виконання додали нові задачі — підхопимо їх
      const hasMore = (this.queues.get(userId)?.length ?? 0) > 0;
      if (hasMore) {
        // Невелика пауза, щоб інші юзери теж мали шанс на слот
        setTimeout(() => void this.tryProcess(userId), 0);
      }
    }
  }
}

export const queueManager = new UserQueueManager(
  queueConfig.maxConcurrent,
  queueConfig.delayBetweenLessons,
);
