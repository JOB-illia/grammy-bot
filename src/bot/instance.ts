import { Bot } from 'grammy';
import { botConfig } from '../config/bot.config';
import type { MyContext } from '../types';

export const bot = new Bot<MyContext>(botConfig.token, {
    client: botConfig.api as any
});