// src/index.ts
import { bot } from "./bot";
import { run, sequentialize } from "@grammyjs/runner";
import dotenv from "dotenv";
import cron from "node-cron";
import PQueue from "p-queue";

import { hydrateMiddleware } from "./middleware/hydrate.middleware";
import { sessionMiddleware } from "./middleware/session.middleware";

import { adminMenu } from "./features/admin";

import {
  registerCallbackHandlers,
  registerMediaHandlers,
  setupErrorHandler,
} from "./handlers";

import { UserQueueManager } from "./managers/queue.manager";
import { registerCommands } from "./commands";
// import { getSessionUser } from "./middleware";
import { registerBotOn } from "./callback-query";
import { initializeServices, setupScheduler } from "./services";
import { conversations, createConversation } from "@grammyjs/conversations";
import { adminConversation } from "./conversations/admin";
import { emailBroadcastConversation } from "./conversations/emailBroadcast";
import { cooldowns } from "./middleware/commadCooldowns";
// import { apiThrottler } from "@grammyjs/transformer-throttler";
// import { autoRetry } from "@grammyjs/auto-retry";
import { ensureSession } from "./middleware/ensure-session";
import { notifyOnRestore } from "./middleware/notify-on-restore";

dotenv.config();

// bot.api.deleteWebhook({ drop_pending_updates: false });

// const throttler = apiThrottler();
// bot.api.config.use(throttler);

// bot.api.config.use(
//   autoRetry({
//     maxRetryAttempts: 3,
//     maxDelaySeconds: 10,
//   }),
// );

bot.use(hydrateMiddleware);
bot.use(sessionMiddleware);
bot.use(ensureSession);
bot.use(notifyOnRestore);
bot.use(conversations());
bot.use(createConversation(adminConversation));
bot.use(createConversation(emailBroadcastConversation));
bot.use(adminMenu);
// bot.use(getSessionUser);
bot.use(cooldowns);
bot.use(sequentialize((ctx) => String(ctx.from?.id ?? ctx.chat?.id ?? "")));

registerCommands(bot);
registerCallbackHandlers(bot);
registerMediaHandlers(bot);
setupErrorHandler(bot);

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || "10", 20);
const RATE_CAP = parseInt(process.env.RATE_CAP || "25", 30);
const RATE_INTERVAL = parseInt(process.env.RATE_INTERVAL_MS || "1000", 10);

const progressQueue = new PQueue({
  concurrency: MAX_CONCURRENT,
  intervalCap: RATE_CAP,
  interval: RATE_INTERVAL,
});

const queueManager = new UserQueueManager(
  parseInt(process.env.MAX_CONCURRENT || "50"),
  parseInt(process.env.DELAY_BETWEEN_LESSONS_MS || String(30 * 1000)),
);

registerBotOn(bot);

// SCHEDULED MODE
if (process.env.COURSE_MODE === "scheduled") {
  cron.schedule("0 10 * * *", async () => setupScheduler());
}

let runnerHandle: ReturnType<typeof run> | null = null;

process.once("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");

  queueManager.clear();
  progressQueue.clear();

  if (runnerHandle?.isRunning()) {
    await runnerHandle.stop();
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  process.exit(0);
});

process.once("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  queueManager.clear();
  progressQueue.clear();

  if (runnerHandle?.isRunning()) {
    await runnerHandle.stop();
  }

  process.exit(0);
});

async function start() {
  try {
    await initializeServices();

    const botInfo = await bot.api.getMe();

    console.log(`Bot @${botInfo.username} started!`);
    console.log(`Mode: ${process.env.COURSE_MODE}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Max concurrent sends: ${MAX_CONCURRENT}`);
    console.log(`Rate cap: ${RATE_CAP}/${RATE_INTERVAL}ms`);

    runnerHandle = run(bot, {
      source: {
        speedTrafficBalance: 0.5,
        maxDelayMilliseconds: 500,
      },
      runner: {
        fetch: {
          allowed_updates: ["message", "callback_query"],
          timeout: 5000,
        },
      },
      sink: {
        concurrency: MAX_CONCURRENT,
        timeout: {
          milliseconds: 5000,
          handler: (u) => console.warn(`⚠️ Slow update ${u.update_id}, ${u}`),
        },
      },
    });

    console.log("Runner started with concurrent update processing");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

start().catch((error) => {
  console.error("Critical startup error:", error);
  process.exit(1);
});
