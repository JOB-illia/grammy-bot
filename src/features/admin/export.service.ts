import * as XLSX from 'xlsx';
import path from 'path';
import type { MyContext } from '../../types';
import { getActiveOrders, getActivePotentialOrders } from '../../services/firebase';

export async function exportPhonesToExcel(ctx: MyContext): Promise<void> {
    try {
        const users = await getActiveOrders();
        const potential_users = await getActivePotentialOrders();

        const phonesSet = new Set<string>();

        const pushPhonesFrom = (arr: any[]) => {
            for (const item of arr) {
                const raw = item?.phone ?? item?.tel ?? item?.phoneNumber ?? null;
                if (raw) phonesSet.add(raw.toString().trim());
            }
        };

        pushPhonesFrom(users || []);
        pushPhonesFrom(potential_users || []);

        const allPhones = Array.from(phonesSet);
        const total = allPhones.length;

        if (total === 0) {
            await ctx.reply('⚠️ Nie znaleziono żadnych numerów telefonów (pole "phone" puste).');
            return;
        }

        // Create Excel file
        const ws = XLSX.utils.aoa_to_sheet([['Phone'], ...allPhones.map(p => [p])]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Phones');

        const filePath = path.join(process.cwd(), 'phones.xlsx');
        XLSX.writeFile(wb, filePath);

        await ctx.reply(`📂 Utworzono plik Excel z ${total} numerami telefonów: phones.xlsx`);

        // Send in batches via Telegram
        const MAX_COUNT_PER_MSG = 500;
        const TG_CHAR_LIMIT = 4000;

        const batches: string[][] = [];
        for (let i = 0; i < allPhones.length; i += MAX_COUNT_PER_MSG) {
            batches.push(allPhones.slice(i, i + MAX_COUNT_PER_MSG));
        }

        await ctx.reply(
            `📊 Przygotowano ${total} numerów w ${batches.length} paczkach. Rozpoczynam wysyłkę...`
        );

        const sendPhoneBatch = async (batch: string[], index: number) => {
            const sep = ', ';
            let currentText = '';
            let partIndex = 0;

            for (const phone of batch) {
                const nextPiece = (currentText.length ? sep : '') + phone;
                if ((currentText + nextPiece).length > TG_CHAR_LIMIT) {
                    await ctx.api.sendMessage(
                        ctx.from!.id,
                        `📋 Paczka ${index + 1} — część ${partIndex + 1}:\n\n${currentText}`
                    );
                    partIndex++;
                    currentText = phone;
                } else {
                    currentText += nextPiece;
                }
            }

            if (currentText.length) {
                await ctx.api.sendMessage(
                    ctx.from!.id,
                    `📋 Paczka ${index + 1} — część ${partIndex + 1}:\n\n${currentText}`
                );
            }
        };

        for (let i = 0; i < batches.length; i++) {
            await sendPhoneBatch(batches[i], i);
            await new Promise((r) => setTimeout(r, 500));
        }

        await ctx.reply('✅ Wysłano wszystkie paczki i zapisano plik Excel.');
    } catch (error) {
        console.error('Error in export service:', error);
        throw error;
    }
}