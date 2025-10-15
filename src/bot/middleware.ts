import { bot } from "./instance";
import { sessionMiddleware } from "../middleware/session.middleware";
import { hydrateMiddleware } from "../middleware/hydrate.middleware";

export function setupMiddleware() {
  bot.use(hydrateMiddleware);
  bot.use(sessionMiddleware);
}
