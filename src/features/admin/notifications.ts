import { bot } from '../../bot/instance';
import { botConfig } from '../../config/bot.config';

export async function sendAdminNotification(message: string): Promise<void> {
    for (const adminId of botConfig.adminIds) {
        try {
            await bot.api.sendMessage(adminId.trim(), message, {
                parse_mode: 'HTML',
            });
        } catch (error) {
            console.error(`Failed to send admin notification to ${adminId}:`, error);
        }
    }
}

export async function notifyUserStarted(
    userId: string,
    username: string,
    firstName: string
): Promise<void> {
    const message = `
🆕 <b>Nowy użytkownik rozpoczął kurs</b>

👤 ID: <b>${userId}</b>
📝 Username: <b>@${username}</b>
👋 Imię: <b>${firstName}</b>
        
🕐 Czas: ${new Date().toLocaleString('pl-PL')}
    `;

    await sendAdminNotification(message);
}

export async function notifyUserError(
    userId: string,
    error: string,
    action: string
): Promise<void> {
    const message =
        `❌ *Błąd użytkownika*\n\n` +
        `👤 ID: \`${userId}\`\n` +
        `🔧 Akcja: ${action}\n` +
        `💥 Błąd: ${error}\n` +
        `🕐 Czas: ${new Date().toLocaleString('pl-PL')}`;

    await sendAdminNotification(message);
}