import { getActiveOrders } from "../services/firebase";
import * as XLSX from "xlsx";
import { InputFile } from "grammy";           // ⬅️ додано
import fs from "fs";                          // ⬅️ для fallback
import os from "os";
import path from "path";

const normalizePhone = (raw: any): string | null => {
    if (!raw) return null;
    let s = String(raw).trim();
    s = s.replace(/[^\d+]/g, "");
    if (s.includes("+")) {
        s = "+" + s.replace(/\+/g, "").trim();
    }
    const digits = s.replace(/\D/g, "");
    if (digits.length < 9) return null;
    return s.startsWith("+") ? s : digits;
};

const parseItemDate = (item: any): Date | null => {
    const fields = ["createdAt", "created_at", "updatedAt", "updated_at", "date", "order_date"];
    for (const f of fields) {
        const v = item?.[f];
        if (!v) continue;
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
};

const isWithinLastNDays = (item: any, days: number): boolean => {
    const d = parseItemDate(item);
    if (!d) return false;
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return d >= from && d <= now;
};

const getExcludePhones = (): Set<string> => {
    const base: string[] = [
        "+48602791796","+48574473926","+447713602394","+48662673543",
        "+48790861116","+447456688500","+48660675508","+48504780641",
        "+48532848184","+48723895657","+48503835269","+48783806677",
        "+48792840223","+48722179777","+48723717023","+48693116371",
        "+48721763012","+48537629494",
    ];
    const env = process.env.EXCLUDE_PHONES?.split(",").map((s) => s.trim()).filter(Boolean) || [];
    const set = new Set<string>();
    [...base, ...env].forEach((p) => {
        const n = normalizePhone(p);
        if (n) set.add(n);
    });
    return set;
};

const createExcelBuffer = (phones: string[]): Buffer => {
    const ws = XLSX.utils.aoa_to_sheet([["phone"], ...phones.map((p) => [p])]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

// ⬇️ утиліта для fallback: зберегти тимчасово у /tmp, відправити, видалити
const sendTempFile = async (ctx: any, buf: Buffer, filename: string) => {
    const tmpPath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(tmpPath, buf);
    try {
        await ctx.replyWithDocument({
            source: fs.createReadStream(tmpPath),
            filename,
        });
    } finally {
        fs.promises.unlink(tmpPath).catch(() => {});
    }
};

export const getPhones = async (ctx: any) => {
    try {
        const adminIds = process.env.ADMIN_IDS?.split(",") || [];
        if (!adminIds.includes(ctx.from!.id.toString())) return;

        const [users] = await Promise.all([getActiveOrders()]);

        const allSet = new Set<string>();
        const last6Set = new Set<string>();

        const pushPhonesFrom = (arr: any[], recentOnly: boolean) => {
            for (const item of arr || []) {
                const raw = item?.phone ?? item?.tel ?? item?.phoneNumber ?? item?.msisdn ?? null;
                const norm = normalizePhone(raw);
                if (!norm) continue;
                if (recentOnly) {
                    if (isWithinLastNDays(item, 6)) last6Set.add(norm);
                } else {
                    allSet.add(norm);
                }
            }
        };

        pushPhonesFrom(users, false);
        pushPhonesFrom(users, true);

        const exclude = getExcludePhones();
        const allPhones = Array.from(allSet).filter((p) => !exclude.has(p));
        const last6Phones = Array.from(last6Set).filter((p) => !exclude.has(p));
        const allExceptRecent = allPhones.filter((p) => !last6Set.has(p));

        if (allPhones.length === 0 && last6Phones.length === 0) {
            await ctx.reply("⚠️ Brak numerów po filtracji (pola telefonu puste lub wszystkie na liście wykluczeń).");
            return;
        }

        await ctx.reply(
            `📊 Gotowe.\n` +
            `• Wszystkich (bez ostatnich 6 dni): ${allExceptRecent.length}\n` +
            `• Ostatnie 6 dni: ${last6Phones.length}\n\n` +
            `📦 Generuję i wysyłam pliki Excel…`
        );

        // 🧾 Excel у пам’яті
        const bufAllExcept = createExcelBuffer(allExceptRecent);
        const bufRecent = createExcelBuffer(last6Phones);
        const dateTag = new Date().toISOString().slice(0, 10);
        const nameAll = `all_except_recent_${dateTag}.xlsx`;
        const nameRecent = `recent_${dateTag}.xlsx`;

        // 📤 Надсилаємо як InputFile (надійний спосіб)
        try {
            await ctx.replyWithDocument(new InputFile(bufAllExcept, nameAll));
        } catch {
            // dev-фолбек на tmp файл
            await sendTempFile(ctx, bufAllExcept, nameAll);
        }

        try {
            await ctx.replyWithDocument(new InputFile(bufRecent, nameRecent));
        } catch {
            await sendTempFile(ctx, bufRecent, nameRecent);
        }

        await ctx.reply("✅ Pliki wysłane. Możesz pobierać bezpośrednio z Telegrama.");
    } catch (error) {
        console.error("Error in getPhones:", error);
        await ctx.reply("❌ Błąd podczas generowania raportu / eksportu Excel");
    }
};
