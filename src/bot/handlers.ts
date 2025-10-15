import { bot } from './instance';
import { registerCommands } from '../commands';
import { registerCallbackHandlers } from '../handlers/callback.handler';
import { registerMediaHandlers } from '../handlers/media.handler';
import { setupErrorHandler } from '../handlers/error.handler';
import { adminMenu } from '../features/admin/admin.menu';

export function setupHandlers() {
    bot.use(adminMenu);

    registerCommands(bot);
    registerCallbackHandlers(bot);
    registerMediaHandlers(bot);
    setupErrorHandler(bot);
}