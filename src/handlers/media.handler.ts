import { Bot } from 'grammy';
import type { MyContext } from '../types';

export function registerMediaHandlers(bot: Bot<MyContext>) {
    bot.on("message:document", async (ctx) => {
        try {
            const fileId = ctx.message.document?.file_id;
            console.log("📄 DOCUMENT FILE_ID:", fileId);
            await ctx.reply(`file_id:\n${fileId}`);
        } catch (error) {
            console.error('Error handling document message:', error);
        }
    });

    bot.on("message:video", async (ctx) => {
        try {
            const fileId = ctx.message.video?.file_id;
            console.log("📦 VIDEO FILE_ID:", fileId);
            await ctx.reply(`file_id:\n${fileId}`);
        } catch (error) {
            console.error('Error handling video message:', error);
        }
    });

    bot.on("message:photo", async (ctx) => {
        try {
            const photo = ctx.message.photo;
            const fileId = photo[photo.length - 1].file_id;
            console.log("📸 PHOTO FILE_ID:", fileId);
            await ctx.reply(`file_id:\n${fileId}`);
        } catch (error) {
            console.error('Error handling photo message:', error);
        }
    });
}