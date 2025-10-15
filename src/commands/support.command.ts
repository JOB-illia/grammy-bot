import type { MyContext } from '../types';
import { sendAdminNotification } from '../features/admin/notifications';

export async function supportCommand(ctx: MyContext) {
    try {
        const userId = ctx.from!.id.toString();
        const username = ctx.from!.username || 'unknown';
        const firstName = ctx.from!.first_name || '';

        const supportRequest = `
🆘 <b>Żądanie wsparcia</b>

👤 ID: ${userId}
📝 Username: @${username}
👋 Imię: ${firstName}
🕐 Czas: ${new Date().toLocaleString('pl-PL')}

Użytkownik potrzebuje pomocy - skontaktuj się z nim.
        `;

        await sendAdminNotification(supportRequest);

        const replySMS = `
💬 <b>Potrzebujesz pomocy?</b>

Napisz bezpośrednio do mnie:
👉 @ilya_klen

Odpowiem tak szybko, jak to możliwe! 🚀
        `;

        await ctx.reply(replySMS, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error in support command:', error);
        await ctx.reply('❌ Błąd podczas łączenia z pomocą. Spróbuj ponownie.');
    }
}