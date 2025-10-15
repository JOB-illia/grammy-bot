import { getUsers } from "../../services/firebase";
import { queueManager } from "../../managers/queue.manager";
import { queueConfig } from "../../config/queue.config";
import { sendAdminNotification } from "./notifications";

// Допоміжне: повертає "YYYY-MM-DD" або null
function toISODateYMD(input: any): string | null {
  if (!input) return null;

  // Firestore Timestamp { seconds, nanoseconds }
  if (
    typeof input === "object" &&
    "seconds" in input &&
    typeof input.seconds === "number"
  ) {
    return new Date(input.seconds * 1000).toISOString().slice(0, 10);
  }

  // Date
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  // number -> ms/seconds
  if (typeof input === "number") {
    const ms = input > 1e12 ? input : input * 1000; // якщо секунди — конвертуємо
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // string: ISO, 'YYYY-MM-DD', інше — довіряємо Date
  if (typeof input === "string") {
    // швидкий кейс: вже 'YYYY-MM-DD'
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  return null;
}

export async function sendDailyReport(): Promise<void> {
  try {
    const users = await getUsers();

    const todayUTC = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" (UTC)

    // Безпечний підрахунок нових за сьогодні
    let newUsersToday = 0;
    let activeUsers = 0;

    for (const u of users) {
      const ymd = toISODateYMD(u.startDate ?? u.createdAt);
      if (ymd === todayUTC) newUsersToday++;
      if (Boolean(u.isActive)) activeUsers++;
    }

    const processingUsers = queueManager.getActiveCount?.() ?? 0;
    const memoryUsage = process.memoryUsage();
    const uptimeH = Math.floor(process.uptime() / 3600);

    const report =
      `📊 *Dzienny raport systemu*\n\n` +
      `📅 Data: ${new Date().toLocaleDateString("pl-PL")}\n\n` +
      `👥 *Użytkownicy:*\n` +
      `• Łącznie: ${users.length}\n` +
      `• Nowi dzisiaj: ${newUsersToday}\n` +
      `• Aktywni: ${activeUsers}\n` +
      `• W trakcie kursu: ${processingUsers}\n\n` +
      `🖥️ *System:*\n` +
      `• Uptime: ${uptimeH}h\n` +
      `• RAM: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB\n` +
      `• Aktywne kolejki: ${processingUsers}/${queueConfig.maxConcurrent}\n\n` +
      `🕐 Wygenerowano: ${new Date().toLocaleString("pl-PL")}`;

    await sendAdminNotification(report);
  } catch (error: any) {
    console.error("Error generating daily report:", error);
    await sendAdminNotification(
      `❌ Błąd generowania raportu: ${error?.message}`,
    );
  }
}
