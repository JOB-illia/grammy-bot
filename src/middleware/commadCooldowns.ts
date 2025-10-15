import type { MyContext } from "../types";
import type { NextFunction } from "grammy";

const commandCooldowns = new Map<string, number>();

export const cooldowns = async (ctx: MyContext, next: NextFunction) => {
  if (ctx.message?.text?.startsWith("/start")) {
    const userId = ctx.from!.id.toString();
    const now = Date.now();
    const lastCommand = commandCooldowns.get(`${userId}:start`);

    if (lastCommand && now - lastCommand < 10000) {
      ctx.reply("Poczekaj sekunde, ja już zaczynam wysyłać kurs :)");
      return;
    }

    commandCooldowns.set(`${userId}:start`, now);
  }

  await next();
};
