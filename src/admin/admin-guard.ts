// admin-guard.ts
import { adminMenu } from "../features/admin";
import { adminState } from "../conversations/admin/admin";
import { handleNewsletter } from "../conversations/admin";

export function registerAdminGuard(bot: any) {
  const menuMw = adminMenu.middleware();

  bot.use(async (ctx: any, next: any) => {
    const uid = ctx.from?.id;
    const state = uid ? adminState.get(uid) : undefined;

    const raw = ctx.msg?.text ?? ctx.update?.callback_query?.data ?? "";
    const isExit =
      typeof raw === "string" && /^\/(exit|cancel)(@\w+)?$/.test(raw);

    if (!state || isExit) return next();

    return menuMw(ctx, async () => {
      await handleNewsletter(ctx, state);
    });
  });
}
